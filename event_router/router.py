"""
router.py — Event Router: maps Nova Sonic tool-call events to Python backends.

The Event Router is the single dispatch point between Nova Sonic and the
four financial tool backends.  It exposes:

  1. A WebSocket endpoint  (/ws/voice)  for browser audio streaming.
  2. A REST endpoint       (/vault/log) for direct vault writes (tool 4).
  3. An async dispatch()   method that NovaSonicSession calls when a tool
     event arrives from the model.

Tool routing table
──────────────────
  "query_live_market_data"    → tools.market_data.get_market_snapshot()
  "analyze_sec_filings_rag"   → tools.sec_rag.query_sec_filings()
  "execute_quantitative_model"→ tools.quant_model.run_monte_carlo()
  "log_research_insight"      → tools.vault_logger.log_insight()
"""

import json
import logging
import uuid
import asyncio
import traceback
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse

from event_router.schemas import VaultLogRequest, VaultLogResponse
from tools.market_data import get_market_snapshot
from tools.sec_rag import query_sec_filings
from tools.quant_model import run_monte_carlo
from tools.vault_logger import log_insight
from nova_sonic.session import NovaSonicSession
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Tool dispatch table ───────────────────────────────────────────────────────

TOOL_DISPATCH: dict[str, Any] = {
    "query_live_market_data": get_market_snapshot,
    "analyze_sec_filings_rag": query_sec_filings,
    "execute_quantitative_model": run_monte_carlo,
    "log_research_insight": log_insight,
}


async def dispatch(
    tool_name: str,
    tool_input: dict[str, Any],
    session_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Route a Nova Sonic tool call to the correct backend function.

    Parameters
    ----------
    tool_name  : Name from the tool schema (must match TOOL_DISPATCH keys).
    tool_input : Parsed JSON input from the model.

    Returns
    -------
    dict that Nova Sonic will receive as the tool result.
    """
    handler = TOOL_DISPATCH.get(tool_name)
    if handler is None:
        available = list(TOOL_DISPATCH.keys())
        logger.warning("[DISPATCH] ⚠️ Tool '%s' NOT FOUND! Available tools: %s", tool_name, available)
        return {"error": f"Unknown tool: {tool_name}. Available: {', '.join(available)}"}

    logger.info("[DISPATCH] ✓ Routing %r to handler %s", tool_name, handler.__name__)
    logger.info("[DISPATCH] Input: %s", json.dumps(tool_input, indent=2)[:300])
    
    try:
        if tool_name == "log_research_insight":
            logger.info("[DISPATCH] Calling with context...")
            result = await handler(**tool_input, context=session_context or {})
        else:
            logger.info("[DISPATCH] Calling with input only...")
            result = await handler(**tool_input)
        logger.info("[DISPATCH] ✓ Got result with %d keys", len(result) if isinstance(result, dict) else 0)
        return result
    except Exception as exc:
        logger.error("[DISPATCH] ✗ Handler %r failed: %s %s", tool_name, type(exc).__name__, exc, exc_info=True)
        return {"error": str(exc)}


# ── WebSocket: browser audio ↔ Nova Sonic ───────────────────────────────────


@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket) -> None:
    """
    Bidirectional audio WebSocket.

    Browser sends:  raw PCM-16 @ 16 kHz/mono in binary frames.
    Server sends:   raw PCM-16 @ 24 kHz/mono in binary frames (Nova Sonic TTS).

    The session is created per-connection and torn down on disconnect.
    """
    session_id = str(uuid.uuid4())
    logger.info("")
    logger.info("=" * 80)
    logger.info("WebSocket connection attempt: %s", session_id)
    logger.info("=" * 80)
    
    try:
        await websocket.accept()
        logger.info("✓ WebSocket accepted and connection established")
        logger.info("")
    except Exception as e:
        logger.error("✗ Failed to accept WebSocket: %s", e)
        return

    session = NovaSonicSession(tool_handlers=dispatch)

    try:
        logger.info("Creating Nova Sonic session...")
        logger.info("  Tool handlers configured")
        logger.info("")
        
        logger.info("Starting session initialization...")
        try:
            await session.start()
        except Exception as start_err:
            logger.critical("✗✗✗ SESSION START FAILED ✗✗✗")
            logger.critical("Exception: %s", start_err, exc_info=True)
            raise
        
        logger.info("")
        logger.info("✓✓✓ Nova Sonic session fully initialized and ready! ✓✓✓")
        logger.info("")

        # Run two coroutines concurrently:
        #   • receive_loop — forward browser audio → Nova Sonic, handle control messages
        #   • send_loop    — stream Nova Sonic audio → browser

        import asyncio

        audio_bytes_count = 0
        audio_input_started = False
        audio_input_ended = False 
        response_count = 0  

        async def receive_loop() -> None:
            """Receive both audio (binary) and control messages (JSON) from browser."""
            nonlocal audio_bytes_count, audio_input_started, audio_input_ended, response_count
            try:
                while session.state.name != "CLOSED":
                    try:
                        timeout = 0.1 if audio_input_ended else 0.5
                        message = await asyncio.wait_for(websocket.receive(), timeout=timeout)
                        
                        if message["type"] == "websocket.disconnect":
                            break
                        elif message["type"] == "websocket.receive":
                            if "bytes" in message:
                                if not audio_input_started:
                                    await session.start_audio_input()
                                    audio_input_started = True

                                audio_bytes_count += 1
                                await session.send_audio_chunk(message["bytes"])
                            
                            # Text control message from browser
                            elif "text" in message:
                                try:
                                    control_msg = json.loads(message["text"])
                                    
                                    if control_msg.get("type") == "startAudio":
                                        audio_input_ended = False
                                        audio_bytes_count = 0
                                        
                                        if response_count > 0:
                                            try:
                                                await session.start_next_prompt()
                                            except Exception as e:
                                                logger.error("Failed to start next prompt: %s", e)

                                    elif control_msg.get("type") == "endAudio":
                                        await session.end_audio_input()
                                        audio_input_started = False
                                        audio_input_ended = True
                                except json.JSONDecodeError as e:
                                    logger.warning("Failed to parse control: %s", e)
                    except asyncio.TimeoutError:
                        pass
                    except Exception as e:
                        logger.error("✗ Receive error (state=%s): %s", session.state.name, e, exc_info=True)
                        break
                        
            except Exception as e:
                logger.error("✗ Receive outer error: %s", e, exc_info=True)

        async def send_loop() -> None:
            """Send audio output and metadata events from Nova Sonic to browser."""
            nonlocal response_count
            audio_sent = 0
            metadata_sent = 0
            send_errors = 0
            max_send_errors = 3
            
            try:
                logger.info("Send loop started - waiting for Nova Sonic output...")
                while session.state.name != "CLOSED":
                    try:
                        # Check for audio chunks from Nova Sonic
                        try:
                            pcm_chunk = await asyncio.wait_for(
                                session.audio_output_queue.get(), timeout=0.1
                            )
                            try:
                                await websocket.send_bytes(pcm_chunk)
                                audio_sent += 1
                                send_errors = 0  # Reset error counter on success
                            except (WebSocketDisconnect, RuntimeError) as send_err:
                                send_errors += 1
                                logger.warning("Audio send error #%d: %s", send_errors, send_err)
                                if send_errors >= max_send_errors:
                                    logger.error("Max audio send errors reached, exiting send_loop")
                                    break
                                await asyncio.sleep(0.05)
                        except asyncio.TimeoutError:
                            pass

                        # Check for metadata events (transcripts, tool calls, etc)
                        try:
                            metadata = await asyncio.wait_for(
                                session.metadata_queue.get(), timeout=0.05
                            )
                            event_type = metadata.get("type", "unknown")
                            
                            # Handle response_complete specially (marks end of response)
                            if event_type == "response_complete":
                                response_count += 1
                                try:
                                    await websocket.send_json(metadata)
                                    metadata_sent += 1
                                except (WebSocketDisconnect, RuntimeError) as send_err:
                                    logger.warning("Failed to send response_complete: %s", send_err)
                                    break
                                continue
                            
                            # Send other metadata events
                            try:
                                await websocket.send_json(metadata)
                                metadata_sent += 1
                                send_errors = 0  # Reset on successful metadata send
                            except (WebSocketDisconnect, RuntimeError) as send_err:
                                send_errors += 1
                                logger.warning("Metadata send error #%d: %s", send_errors, send_err)
                                if send_errors >= max_send_errors:
                                    logger.error("Max metadata send errors reached, exiting send_loop")
                                    break
                        except asyncio.TimeoutError:
                            pass

                    except WebSocketDisconnect:
                        logger.info("Browser disconnected during send_loop")
                        break
                    except Exception as exc:
                        if session.state.name != "CLOSED":
                            logger.error("Unexpected error in send_loop: %s", exc, exc_info=True)
                        break
                
                logger.info("")
                logger.info("Send loop ended | audio_packets: %d | metadata_events: %d", audio_sent, metadata_sent)
                logger.info("")
                        
            except Exception as e:
                logger.error("✗ Send loop exception: %s", e, exc_info=True)

        logger.info("Starting receive_loop and send_loop concurrently...")
        await asyncio.gather(receive_loop(), send_loop())
        logger.info("Both loops completed")

    except WebSocketDisconnect:
        logger.info("↙ WebSocket disconnected (client) | session_id=%s", session_id)
    except asyncio.CancelledError:
        logger.info("↙ WebSocket task cancelled | session_id=%s", session_id)
    except Exception as exc:
        import traceback
        logger.error("✗ WebSocket error | session_id=%s | %s | %s", 
                    session_id, type(exc).__name__, exc)
        logger.debug("Traceback: %s", traceback.format_exc())
    finally:
        logger.info("")
        logger.info("=" * 80)
        logger.info("Closing session | session_id=%s | final_state=%s", session_id, session.state.name)
        logger.info("=" * 80)
        logger.info("")
        await session.close()


# ── REST: vault write (also callable directly, not just via Nova Sonic) ──────


@router.post("/vault/log", response_model=VaultLogResponse)
async def vault_log_endpoint(body: VaultLogRequest) -> VaultLogResponse:
    """
    Direct REST endpoint for vault writes.
    Nova Sonic calls this indirectly via the log_research_insight tool;
    you can also POST to it manually during development.
    """
    try:
        result = await log_insight(
            content=body.content,
            tags=body.tags,
            title=body.title or None,
            context=body.context,
        )
        return VaultLogResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── Health ────────────────────────────────────────────────────────────

@router.get("/health")
async def health() -> JSONResponse:
    """Basic health check."""
    return JSONResponse({"status": "ok", "tools": list(TOOL_DISPATCH.keys())})

# ── Vault Files: list and read ────────────────────────────────────────────────


@router.get("/vault/files")
async def list_vault_files() -> JSONResponse:
    """List all markdown files in the vault directory."""
    try:
        vault_dir: Path = settings.vault_path
        
        if not vault_dir.exists():
            return JSONResponse({
                "files": [],
                "message": "Vault directory does not exist yet"
            })
        
        files = []
        for filepath in sorted(vault_dir.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                stat = filepath.stat()
                files.append({
                    "filename": filepath.name,
                    "modified": filepath.stat().st_mtime,
                    "size": stat.st_size
                })
            except Exception as e:
                logger.warning("Could not stat file %s: %s", filepath, e)
        
        logger.info("✓ Listed %d vault files", len(files))
        return JSONResponse({
            "files": files,
            "count": len(files)
        })
    except Exception as exc:
        logger.error("❌ Failed to list vault files: %s", exc)
        return JSONResponse({
            "status": "error",
            "message": str(exc),
            "type": type(exc).__name__
        }, status_code=500)


@router.get("/vault/files/{filename}")
async def read_vault_file(filename: str) -> JSONResponse:
    """Read a specific markdown file from the vault."""
    try:
        vault_dir: Path = settings.vault_path
        filepath = vault_dir / filename
        
        # Security: prevent directory traversal
        if not filepath.resolve().is_relative_to(vault_dir.resolve()):
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        if not filepath.suffix.lower() == ".md":
            raise HTTPException(status_code=400, detail="Only markdown files are supported")
        
        content = filepath.read_text(encoding="utf-8")
        
        logger.info("✓ Read vault file: %s (%d bytes)", filename, len(content))
        return JSONResponse({
            "filename": filename,
            "content": content,
            "size": len(content)
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ Failed to read vault file: %s", exc)
        return JSONResponse({
            "status": "error",
            "message": str(exc),
            "type": type(exc).__name__
        }, status_code=500)
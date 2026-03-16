# Voice AI Agent — Nova Sonic Financial Research Terminal

> AWS Bedrock Nova Sonic Hackathon project.  
> Speak a market question → live data, SEC filings, Monte Carlo simulation, vault logging — all spoken back.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [File-by-File Reference](#4-file-by-file-reference)
   - [Root level](#root-level)
   - [nova_sonic/](#nova_sonic)
   - [event_router/](#event_router)
   - [tools/](#tools)
   - [compute/](#compute)
   - [data/](#data)
   - [tests/](#tests)
   - [vault/](#vault)
5. [The Four Financial Tools](#5-the-four-financial-tools)
6. [Session State Machine](#6-session-state-machine)
7. [Setup & Running](#7-setup--running)
8. [Environment Variables](#8-environment-variables)
9. [Execution Paths & Fallbacks](#9-execution-paths--fallbacks)
10. [Running Tests](#10-running-tests)
11. [Demo Script](#11-demo-script)

---

## 1. What This Project Does

This is a **voice-native financial research agent** built on top of AWS Bedrock Nova Sonic.

You speak → Nova Sonic transcribes (STT), reasons (LLM), and speaks back (TTS).  
When Nova Sonic needs real data, it fires a **tool call** into the Python backend (the Event Router).  
The Event Router dispatches to one of four financial backends and returns the result to Nova Sonic, which reads it aloud.

You can interrupt it mid-sentence. Nova Sonic's built-in VAD handles that.

**Everything AWS manages:**

- Speech-to-text (STT)
- Language model reasoning (LLM)
- Text-to-speech (TTS)
- Voice Activity Detection + interruption (VAD)

**Everything this project adds:**

- The four financial tool backends
- The Event Router that connects Nova Sonic to those backends
- The bidirectional WebSocket bridge between the browser and Nova Sonic

---

## 2. Architecture

```
Browser (microphone)
        │  raw PCM-16 @ 16 kHz
        ▼
┌──────────────────────────────────────┐
│  FastAPI WebSocket  /ws/voice        │  ← main.py + event_router/router.py
│  (NovaSonicSession manages the pipe) │
└──────────────────┬───────────────────┘
                   │ bidirectional boto3 stream
                   ▼
        ┌──────────────────────┐
        │  AWS Bedrock         │
        │  Nova Sonic v1       │  STT → LLM → TTS (all managed by AWS)
        │  (amazon.nova-       │  VAD + interruption (built-in)
        │   sonic-v1:0)        │
        └──────────┬───────────┘
                   │ tool call JSON event
                   ▼
        ┌──────────────────────────────────────────┐
        │  Event Router  (event_router/router.py)  │
        │  dispatch(tool_name, tool_input) → dict  │
        └──┬──────────┬──────────────┬─────────────┘
           │          │              │              │
           ▼          ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Tool 1   │  │ Tool 2   │  │ Tool 3   │  │ Tool 4   │
  │ market   │  │ sec_rag  │  │ quant_   │  │ vault_   │
  │ _data.py │  │ .py      │  │ model.py │  │ logger.py│
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
     Finnhub +     Bedrock KB      ironclad-       ./vault/
     Polygon       (or local       runtime or      *.md files
     fallback      FAISS index)    native Python
```

---

## 3. Directory Structure

```
Voice_AI_Agent/
│
├── main.py                      # FastAPI app factory & entry point
├── config.py                    # Pydantic settings (reads .env)
├── requirements.txt             # Python dependencies
├── pytest.ini                   # pytest asyncio_mode = auto
├── .env.example                 # Template — copy to .env and fill in keys
├── .gitignore
├── test.excalidraw              # Architecture whiteboard sketch
│
├── frontend/                    # React + Vite + TypeScript Web UI
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx              # Root app + routing (/  and /vault/:filename)
│       ├── main.tsx
│       └── components/          # 12 UI components (see §frontend)
│
├── nova_sonic/                  # AWS Bedrock / Nova Sonic layer
│   ├── __init__.py
│   ├── client.py                # boto3 stream wrapper + event builders
│   ├── session.py               # per-connection state machine
│   └── tool_schemas.py          # JSON tool schemas injected at session start
│
├── event_router/                # Dispatch layer between Nova Sonic and tools
│   ├── __init__.py
│   ├── router.py                # WebSocket + REST endpoints + dispatch()
│   └── schemas.py               # Pydantic request/response models
│
├── tools/                       # Four financial tool backends
│   ├── __init__.py
│   ├── market_data.py           # Tool 1 — Finnhub primary + Polygon EOD fallback
│   ├── sec_rag.py               # Tool 2 — SEC filings RAG (Bedrock KB or FAISS)
│   ├── quant_model.py           # Tool 3 — Monte Carlo via ironclad or Python
│   └── vault_logger.py          # Tool 4 — Markdown note writer
│
├── compute/                     # Numerical computation
│   ├── __init__.py
│   └── monte_carlo.py           # GBM simulator (NumPy + pure-Python fallback)
│
├── data/
│   ├── build_local_index.py     # One-shot FAISS index builder from PDFs
│   └── sec_filings/             # Drop NVDA/AMD/INTC 10-K PDFs here
│
├── tests/
│   ├── __init__.py
│   ├── smoke_test_tools.py          # Live integration tests (real API calls, no mocks)
│   ├── test_nova_sonic_client.py    # Unit tests for NovaSonicClient event builders
│   ├── test_nova_sonic_session.py   # Unit tests for NovaSonicSession state machine
│   ├── test_market_data.py
│   ├── test_monte_carlo.py
│   ├── test_quant_model.py          # Integration tests for quant_model tool
│   ├── test_vault_logger.py
│   ├── test_event_router.py
│   ├── test_api.py                  # REST endpoint integration tests
│   ├── test_complete_setup.py       # End-to-end session setup validation
│   ├── test_web_ui_debug.py         # Web UI / WebSocket debug test
│   ├── test_audio_with_tools.py     # Live audio + tool calling integration test
│   ├── test_bidirectional_audio.py  # Bidirectional stream tests
│   ├── test_tools_standalone.py     # Standalone tool function tests
│   ├── bedrock_first_req.py         # Manual Bedrock connection probe
│   └── nova_sonic_simple.py         # Minimal Nova Sonic session smoke test
│
├── vault/                       # Markdown notes saved by Tool 4
└── docs/
    ├── PROJECT_OVERVIEW.md      # ← you are here
    ├── Nova_Sonic_implementation_with_tools.md
    ├── BIDIRECTIONAL_AUDIO_TEST.md
    ├── VAULT_LOGGER_DEEP_DIVE.md
    ├── Impl_AWS_AI_Hackathon.md
    ├── README_nova_sonic_tests.md
    └── learning.md
```

---

## 4. File-by-File Reference

### Root level

#### `main.py`

The FastAPI application entry point.

- Creates the `FastAPI` app with CORS middleware (permissive during development).
- Registers the Event Router (`event_router/router.py`) under the root path.
- Uses FastAPI's `lifespan` context manager to log startup diagnostics: AWS region, Nova Sonic model ID, whether a Bedrock Knowledge Base is configured, whether the ironclad-runtime binary is present, and the vault path.
- Exposes `if __name__ == "__main__"` to run via `python main.py` (uses `uvicorn` internally).

**Start the server:**

```bash
python main.py
# or
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

#### `config.py`

Centralised settings using **Pydantic Settings** (`pydantic-settings`).

All environment variables are validated at process startup — the app fails fast rather than mid-request.

**AWS & core**

| Setting                 | Env var                 | Default                  | Purpose             |
| ----------------------- | ----------------------- | ------------------------ | ------------------- |
| `aws_access_key_id`     | `AWS_ACCESS_KEY_ID`     | required                 | AWS auth            |
| `aws_secret_access_key` | `AWS_SECRET_ACCESS_KEY` | required                 | AWS auth            |
| `aws_region`            | `AWS_REGION`            | `us-east-1`              | Bedrock region      |
| `nova_sonic_model_id`   | `NOVA_SONIC_MODEL_ID`   | `amazon.nova-sonic-v1:0` | Nova Sonic model ID |

**Note generation (Vault Logger LLM)**

| Setting                    | Env var                    | Default                          | Purpose                                              |
| -------------------------- | -------------------------- | -------------------------------- | ---------------------------------------------------- |
| `note_llm_provider`        | `NOTE_LLM_PROVIDER`        | `groq`                           | Which LLM to use: `groq`, `nova_lite`, or `none`     |
| `note_llm_timeout_seconds` | `NOTE_LLM_TIMEOUT_SECONDS` | `20`                             | HTTP timeout for the note-generation LLM call        |
| `groq_api_key`             | `GROQ_API_KEY`             | `""`                             | Groq API key (primary note-generation provider)      |
| `groq_model`               | `GROQ_MODEL`               | `llama-3.3-70b-versatile`        | Groq model used to compose notes                     |
| `groq_base_url`            | `GROQ_BASE_URL`            | `https://api.groq.com/openai/v1` | Groq OpenAI-compatible base URL                      |
| `nova_lite_model_id`       | `NOVA_LITE_MODEL_ID`       | `amazon.nova-lite-v1:0`          | Bedrock Nova Lite model ID (future integration path) |

**Bedrock / data providers**

| Setting                | Env var                | Default                                                                    | Purpose                                |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| `bedrock_kb_id`        | `BEDROCK_KB_ID`        | `""`                                                                       | Bedrock Knowledge Base ID              |
| `bedrock_kb_model_arn` | `BEDROCK_KB_MODEL_ARN` | `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0` | Embedding model ARN for KB retrieval   |
| `polygon_api_key`      | `POLYGON_API_KEY`      | required                                                                   | Polygon.io key                         |
| `finnhub_api_key`      | `FINNHUB_API_KEY`      | `""`                                                                       | Finnhub key (primary market data)      |
| `tiingo_api_key`       | `TIINGO_API_KEY`       | `""`                                                                       | Tiingo key (historical vol for Tool 3) |

**App / infrastructure**

| Setting                 | Env var                 | Default                       | Purpose               |
| ----------------------- | ----------------------- | ----------------------------- | --------------------- |
| `vault_path`            | `VAULT_PATH`            | `./vault`                     | Where notes are saved |
| `ironclad_runtime_path` | `IRONCLAD_RUNTIME_PATH` | `./ironclad/ironclad-runtime` | Wasm sandbox binary   |
| `app_host`              | `APP_HOST`              | `0.0.0.0`                     | Server bind address   |
| `app_port`              | `APP_PORT`              | `8000`                        | Server port           |
| `log_level`             | `LOG_LEVEL`             | `INFO`                        | Python log level      |

**Computed properties:**

- `settings.ironclad_available` → `True` if the ironclad binary exists on disk.
- `settings.bedrock_kb_configured` → `True` if `BEDROCK_KB_ID` is non-empty.

A singleton `settings` object is imported everywhere: `from config import settings`.

---

#### `requirements.txt`

Python package dependencies.

| Package                          | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `fastapi`                        | Web framework + WebSocket support        |
| `uvicorn[standard]`              | ASGI server                              |
| `python-dotenv`                  | `.env` file loading                      |
| `pydantic` / `pydantic-settings` | Data validation & settings               |
| `boto3` / `botocore`             | AWS SDK (Bedrock, Bedrock Agent Runtime) |
| `httpx`                          | Async HTTP client for Finnhub + Polygon  |
| `numpy`                          | Monte Carlo vectorised computation       |
| `python-multipart`               | FastAPI file/form upload support         |
| `aiofiles`                       | Async file writes for the vault logger   |

Optional (commented out — needed only for local FAISS fallback):

- `llama-index`, `faiss-cpu`, `pypdf`

---

#### `.env.example`

Template showing every supported environment variable with placeholder values. Copy to `.env` and fill in real credentials before starting the server. The `.env` file is git-ignored; `.env.example` is tracked.

---

#### `pytest.ini`

Configures pytest for the entire project. Sets `asyncio_mode = auto` — without this, every `async def test_*` function would require an explicit `@pytest.mark.asyncio` decorator and would otherwise be silently skipped. Required because the majority of tests exercise async tool functions and session methods.

```ini
[pytest]
asyncio_mode = auto
```

---

### `nova_sonic/`

#### `nova_sonic/tool_schemas.py`

Defines the **four Bedrock-compatible JSON tool schemas** that are injected into the Nova Sonic session at startup. Nova Sonic reads these schemas to know which tools exist, what their parameters are, and when to call them.

Each schema follows the `toolSpec` format required by the Bedrock Converse/InvokeModelWithBidirectionalStream API.

| Constant                     | Tool name                    | Trigger phrase                                         |
| ---------------------------- | ---------------------------- | ------------------------------------------------------ |
| `QUERY_LIVE_MARKET_DATA`     | `query_live_market_data`     | "What is the current price of [ticker]?"               |
| `ANALYZE_SEC_FILINGS_RAG`    | `analyze_sec_filings_rag`    | "What did [company] say about [topic] in their 10-K?"  |
| `EXECUTE_QUANTITATIVE_MODEL` | `execute_quantitative_model` | "Run a Monte Carlo on [ticker] for [N] days."          |
| `LOG_RESEARCH_INSIGHT`       | `log_research_insight`       | "Save this / log this / add to vault, tag it [topic]." |

`ALL_TOOLS` is a list of all four, passed directly to `sessionStart.toolConfiguration.tools`.

---

#### `nova_sonic/client.py`

Low-level wrapper around **boto3's Bedrock Runtime client**.

**Class: `NovaSonicClient`**

| Method                                                      | What it does                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `__init__()`                                                | Creates a `bedrock-runtime` boto3 client using credentials from `config.settings`. Defaults to Nova 2 Sonic model. |
| `build_session_start_event(system_prompt)`                  | Returns the `sessionStart` JSON event with inference config, system prompt, and all four tool schemas.             |
| `build_audio_input_start_event(prompt_id, content_id)`      | Returns the `promptStart` event that tells Nova Sonic to expect PCM-16 audio input at 16 kHz.                      |
| `build_audio_chunk_event(prompt_id, content_id, audio_b64)` | Wraps a base64-encoded audio chunk in an `audioInput` event.                                                       |
| `build_tool_result_event(prompt_id, tool_use_id, result)`   | Wraps a tool execution result back into the stream as a `toolResult` event.                                        |
| `open_stream()`                                             | Calls `invoke_model_with_bidirectional_stream` and returns the raw boto3 stream handler.                           |

Audio format for input: `audio/lpcm`, 16 kHz, 16-bit, mono, base64-encoded.  
Audio format for output: `audio/lpcm`, 24 kHz, 16-bit, mono (Nova Sonic TTS output).

---

#### `nova_sonic/session.py`

Per-connection **state machine** for one active voice conversation.

**Enum: `SessionState`**

```
IDLE → LISTENING → MODEL_THINKING → TOOL_EXECUTING → SPEAKING → LISTENING
                                                                        └─→ CLOSED
```

| State            | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `IDLE`           | Session not yet started                                             |
| `LISTENING`      | Accepting audio from the browser, forwarding to Nova Sonic          |
| `MODEL_THINKING` | Nova Sonic is processing (internal; set on tool dispatch)           |
| `TOOL_EXECUTING` | A tool call is in-flight — audio input is dropped during this state |
| `SPEAKING`       | Nova Sonic is streaming TTS audio back                              |
| `CLOSED`         | Stream has ended                                                    |

**Class: `NovaSonicSession`**

| Method / Attribute             | What it does                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__init__(tool_handlers)`      | Takes a `dispatch` callable from the Event Router. Creates a `NovaSonicClient`, an `asyncio.Queue` for output audio, a `metadata_queue` for JSON events, and initialises `_consumer_task = None`.                                                   |
| `start()`                      | Opens the boto3 bidirectional stream, sends `sessionStart` (inference config + tools), transitions to `LISTENING`, stores & starts `_consume_output`. Does **not** send the audio prompt start — that is deferred to `start_audio_input()`.         |
| `start_audio_input()`          | Sends the `promptStart` event (audio I/O format) to Nova Sonic, signalling that the user is about to speak. Called by the router's `receive_loop` on the first audio frame of each utterance.                                                       |
| `end_audio_input()`            | Sends `contentEnd` to Nova Sonic, signalling the end of the user's audio input for the current turn.                                                                                                                                                |
| `start_next_prompt()`          | Resets prompt/content IDs and sends a fresh `promptStart` event for the next conversational turn, enabling multi-turn conversations within a single WebSocket connection.                                                                            |
| `close()`                      | Cancels the consumer task, closes the boto3 stream body, sets state to `CLOSED`.                                                                                                                                                                    |
| `send_audio_chunk(pcm_bytes)`  | Base64-encodes and forwards a PCM chunk to Nova Sonic. Drops chunks while in `TOOL_EXECUTING` or `MODEL_THINKING` state.                                                                                                                            |
| `audio_output_queue`           | `asyncio.Queue[bytes]` — raw PCM TTS chunks enqueued by `_consume_output`, drained by the WebSocket send loop and sent as binary frames to the browser.                                                                                             |
| `metadata_queue`               | `asyncio.Queue[dict]` — JSON metadata events (transcripts, tool results, `response_complete`) enqueued by `_consume_output`, drained by the WebSocket send loop and sent as JSON text frames to the browser.                                        |
| `_consume_output()`            | Background task. Spawns a daemon thread to iterate the blocking boto3 stream, forwarding parsed events via async queues. Routes `audioOutput` to `audio_output_queue`, `toolUse` to `_handle_tool_use`, pushes transcript/completion events to `metadata_queue`. |
| `_handle_tool_use(tool_event)` | Extracts `name`, `toolUseId`, and `input` from the event. Calls `self._tool_handlers(name, input)`. Returns the result via `build_tool_result_event`. Also pushes a `tool_result` metadata event for the frontend.                                  |
| `state`                        | Read-only property returning the current `SessionState`.                                                                                                                                                                                            |

---

### `event_router/`

#### `event_router/schemas.py`

Pydantic models for **all data that crosses the tool boundary**.

| Model                                      | Used by                                 |
| ------------------------------------------ | --------------------------------------- |
| `SessionStatus`                            | WebSocket session status responses      |
| `MarketDataRequest` / `MarketDataResponse` | Tool 1 I/O                              |
| `SecRagRequest` / `SecRagResponse`         | Tool 2 I/O                              |
| `QuantModelRequest` / `QuantModelResponse` | Tool 3 I/O                              |
| `VaultLogRequest` / `VaultLogResponse`     | Tool 4 I/O + `/vault/log` REST endpoint |
| `ToolResult`                               | Generic envelope for any tool result    |

`VaultLogRequest` fields: `content` (str), `tags` (list[str]), `title` (str, optional), `context` (dict — optional session metadata forwarded from the router).  
`VaultLogResponse` fields: `saved` (bool), `filepath` (str), `message` (str), `llm_provider` (str), `llm_model` (str).

---

#### `event_router/router.py`

The central dispatch hub. Exposes three things:

**1. `dispatch(tool_name, tool_input, session_context)` — async function**  
Routes a Nova Sonic tool-call event to the correct backend.

```
"query_live_market_data"     → tools.market_data.get_market_snapshot()
"analyze_sec_filings_rag"    → tools.sec_rag.query_sec_filings()
"execute_quantitative_model" → tools.quant_model.run_monte_carlo()
"log_research_insight"       → tools.vault_logger.log_insight()
```

`session_context` is an optional `dict` populated by `NovaSonicSession` for the active conversation. It is passed directly into `log_insight()` as the `context` argument so the vault logger can embed session metadata (session ID, tool history, latest tool call) in the generated note. It is silently ignored for the other three tools.

If the tool name is unknown, returns `{"error": "Unknown tool: ..."}`.  
If the backend raises, catches the exception and returns `{"error": "<message>"}` — Nova Sonic always gets a response.

**2. `GET /ws/voice` — WebSocket endpoint**  
Accepts a browser connection, creates a `NovaSonicSession`, then runs two concurrent coroutines:

- `receive_loop` — reads binary frames (PCM audio) and JSON control messages from the browser. Recognises two control message types:
  - `{"type": "startAudio"}` — marks the start of a new user utterance; calls `session.start_audio_input()` and, for subsequent turns, `session.start_next_prompt()` to reset the stream for the next exchange.
  - `{"type": "endAudio"}` — signals the end of the utterance; calls `session.end_audio_input()`.
- `send_loop` — drains both `session.audio_output_queue` (raw PCM bytes sent as binary WebSocket frames) and `session.metadata_queue` (JSON events such as transcripts, tool results, and `response_complete` sent as text frames).

The session is torn down cleanly on disconnect.

**3. `POST /vault/log` — REST endpoint**  
Direct HTTP access to the vault logger. Accepts a `VaultLogRequest` JSON body. Useful for testing Tool 4 without going through the voice pipeline, or for programmatic note creation.

**4. `GET /health`**  
Returns `{"status": "ok", "tools": [...]}`. Simple liveness check.

**5. `GET /vault/files` — REST endpoint**  
Lists all `.md` files in the vault directory. Returns a JSON array sorted by modification time (newest first), each entry containing `filename`, `modified` (Unix timestamp), and `size` (bytes). Used by the frontend Vault Panel to display the file list.

**6. `GET /vault/files/{filename}` — REST endpoint**  
Reads and returns the raw Markdown content of a specific vault file. Includes a directory-traversal guard (`filepath.resolve().is_relative_to(vault_dir.resolve())`) — requests that escape the vault directory are rejected with HTTP 403. Only `.md` files are served; other extensions return HTTP 400.

---

### `tools/`

#### `tools/market_data.py` — Tool 1

**Function: `get_market_snapshot(ticker: str) -> dict`**

Uses a dual-provider path with an in-memory cache:

1. **Primary:** Finnhub real-time `/quote` endpoint.
2. **Fallback:** Polygon previous-day aggregate endpoint.

Endpoints:

```
GET https://finnhub.io/api/v1/quote
GET https://api.polygon.io/v2/aggs/ticker/{ticker}/prev?adjusted=true
```

Results are cached in memory for **60 seconds** (`_SNAPSHOT_CACHE` dict with timestamp check). The cache is process-local and resets on server restart.

Extracts and returns:

| Field            | Source                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `ticker`         | Uppercased input                                                   |
| `price`          | Latest price (`c`)                                                 |
| `open`           | Opening price (`o`)                                                |
| `high`           | Day high (`h`)                                                     |
| `low`            | Day low (`l`)                                                      |
| `volume`         | Volume (`v`) — **always 0 from Finnhub** (quote endpoint omits it) |
| `change_pct`     | `(price - open) / open * 100` formatted as `+2.30%`                |
| `summary`        | Human-readable sentence for Nova Sonic to speak                    |
| `data_source`    | `Finnhub` or `Polygon fallback`                                    |
| `data_freshness` | `real-time` or `EOD (previous trading day)`                        |

If Finnhub fails and Polygon fallback is used, the summary explicitly states that the answer is **EOD fallback data**.

---

#### `tools/sec_rag.py` — Tool 2

**Function: `query_sec_filings(company, topic, filing_type) -> dict`**

Two execution paths selected at runtime:

**Primary — AWS Bedrock Knowledge Base** (used when `BEDROCK_KB_ID` is set):  
Calls `bedrock-agent-runtime.retrieve()` with a natural-language query built from `"{company} {topic} {filing_type}"`. Applies a relevance score threshold (`MIN_SCORE = 0.50`) — passages below this score are discarded. The Bedrock KB always returns N results regardless of relevance, so sub-threshold scores indicate the company is likely not in the knowledge base.

**Fallback — Local FAISS index** (used when `BEDROCK_KB_ID` is empty):  
Loads a LlamaIndex `VectorStoreIndex` from `data/faiss_index/`. Queries with `similarity_top_k=3`. Requires the index to have been built first by running `data/build_local_index.py`.

In both cases, returns:

```json
{
  "company": "Nvidia",
  "topic": "supply chain",
  "passages": ["...", "...", "..."],
  "sources": ["s3://bucket/NVDA_10K_fiscal2025.pdf", "..."],
  "summary": "From Nvidia's filing on supply chain (sources: NVDA 10K fiscal2025): ..."
}
```

---

#### `tools/quant_model.py` — Tool 3

**Function: `run_monte_carlo(ticker, days, simulations=10_000) -> dict`**

Two sub-steps:

**Step 1 — Fetch live price + volatility (parallel)**  
Fires three requests simultaneously via `asyncio.gather()`: Finnhub `/quote` for the current price, Tiingo `/tiingo/daily/{ticker}/prices` for 90-day closes (primary vol source), and Polygon `/v2/aggs` daily bars (fallback vol source). Tiingo closes are preferred; Polygon is used only if Tiingo returns ≤ 5 bars. Realised annualised volatility is computed from closes (`std(log_returns) * sqrt(252)`). Falls back to `σ = 0.30` only if both vol providers fail.

**Step 2 — Run Monte Carlo**  
Two execution paths:

| Path                 | When used                             | How                                                                                                              |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **ironclad-runtime** | `IRONCLAD_RUNTIME_PATH` binary exists | Writes a self-contained GBM Python script to a temp dir, executes via `ironclad-runtime`, reads JSON from stdout |
| **Native Python**    | ironclad binary not found             | Imports and calls `compute.monte_carlo.simulate()` directly in-process                                           |

Returns:

```json
{
  "ticker": "NVDA",
  "days": 30,
  "simulations": 10000,
  "current_price": 875.5,
  "p10": 820.12,
  "p50": 878.44,
  "p90": 941.33,
  "mean": 879.11,
  "execution_mode": "native",
  "calculation_engine": "numpy",
  "simulation_time_seconds": 0.03,
  "total_time_seconds": 1.67,
  "summary": "Monte Carlo on NVDA over 30 trading days ..."
}
```

---

#### `tools/vault_logger.py` — Tool 4

**Function: `log_insight(content, tags, title, context) -> dict`**

Generates a structured, AI-written Obsidian-compatible Markdown note and writes it to `settings.vault_path`. This is the sophisticated core of the vault system — notes are not a raw transcript dump, they are LLM-composed research documents shaped by session and tool context.

**Parameters:**

| Parameter | Type                | Description                                                                            |
| --------- | ------------------- | -------------------------------------------------------------------------------------- |
| `content` | `str`               | Raw research content or user utterance to be structured                                |
| `tags`    | `list[str] \| None` | Explicit tags; ticker tags are also auto-injected                                      |
| `title`   | `str \| None`       | Optional title; auto-generated from tickers + date if absent                           |
| `context` | `dict \| None`      | Session context: `session_id`, `tool_history`, `latest_tool_call`, `last_user_summary` |

**Generated note format:**

```markdown
---
title: "NVDA Supply Chain Note"
date: 2025-03-01T14:32:00
updated: 2025-03-01T14:32:00
source: Nova Sonic Research Terminal
note_type: research_insight
session_id: "session-42"
tags: ["semiconductors", "nvidia", "nvda"]
tickers: ["NVDA"]
tools_used: ["query_live_market_data"]
llm_provider: "groq"
llm_model: "llama-3.3-70b-versatile"
---

# NVDA Supply Chain Note

## Executive Summary

## Context Snapshot

## Evidence and Tool Outputs

## Key Takeaways

## Risks and Unknowns

## Suggested Next Steps

## User Additions
```

**LLM provider strategy:**

`NOTE_LLM_PROVIDER` controls which backend composes the note body:

| Provider value   | Behaviour                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `groq` (default) | Calls Groq `/chat/completions` with `llama-3.3-70b-versatile`; falls through to fallback if key is absent or call fails |
| `nova_lite`      | Placeholder — tries Nova Lite first, then falls through to Groq                                                         |
| `none`           | Skips LLM entirely; uses the deterministic fallback body                                                                |

If the chosen provider fails (missing key, network error, timeout), the system automatically falls through to the structural fallback — `log_insight` never raises.

**Helper functions:**

| Function                                 | Purpose                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `_safe_filename(title, ts)`              | Sanitises title to a safe `*.md` filename, max 60 chars; falls back to `note_<timestamp>.md`                      |
| `_yaml_list(values)`                     | Formats a Python list as a YAML inline list with double-quoted, escaped items                                     |
| `_extract_tickers(content, context)`     | Scans content for `[A-Z]{1,5}` words and inspects `context.tool_history[].input.ticker`; deduplicates, caps at 8  |
| `_extract_tools_used(context)`           | Collects unique tool names from `context.tool_history` and `context.latest_tool_call`                             |
| `_resolve_title(title, tickers, ts)`     | Returns the given title, or `"<TICKER> Research Insight - <date>"`, or `"Research Insight - <date>"`              |
| `_build_front_matter(...)`               | Renders the full YAML front matter block with all metadata fields                                                 |
| `_build_llm_prompt(...)`                 | Builds the JSON-payload prompt that instructs the LLM to write all seven required sections                        |
| `_ensure_required_sections(body, title)` | Validates that all seven `## …` headings exist; appends any missing ones; guarantees Obsidian query compatibility |
| `_fallback_body(...)`                    | Produces a deterministic structured note (no LLM) from raw inputs when all LLM providers fail or are disabled     |
| `_compose_with_groq(prompt)`             | Calls Groq OpenAI-compatible API; returns `(markdown_body, model_name)`                                           |
| `_compose_with_nova_lite(prompt)`        | Placeholder stub — returns `(None, model_name)`; tagged `TODO` for Bedrock Nova Lite text-gen integration         |
| `_compose_structured_body(...)`          | Orchestrates provider selection, calls the right composer, returns `(body, provider, model)`                      |

**Return value:**

```json
{
  "saved": true,
  "filepath": "/path/to/vault/NVDA_Supply_Chain_Note.md",
  "message": "Note saved as 'NVDA_Supply_Chain_Note.md' in vault.",
  "llm_provider": "groq",
  "llm_model": "llama-3.3-70b-versatile"
}
```

Uses `aiofiles` for non-blocking async writes. Creates the vault directory if it does not yet exist.

---

### `compute/`

#### `compute/monte_carlo.py`

Standalone Geometric Brownian Motion simulator. Can be used three ways:

**1. Imported by `tools/quant_model.py`** (native Python path):

```python
from compute.monte_carlo import simulate
result = simulate(current_price=162.45, volatility=0.35, days=30)
```

**2. Executed as a subprocess by ironclad-runtime** (Wasm sandbox path):

```bash
ironclad-runtime /tmp/sandbox/monte_carlo_run.py
```

**3. Run from the CLI for testing:**

```bash
python compute/monte_carlo.py --price 162.45 --volatility 0.35 --days 30 --simulations 10000
```

**GBM formula (per step, risk-neutral drift):**

$$S_{t+1} = S_t \cdot \exp\!\left(-\tfrac{1}{2}\sigma^2 \,\Delta t + \sigma\sqrt{\Delta t}\, Z\right), \quad Z\sim\mathcal{N}(0,1), \quad \Delta t = \tfrac{1}{252}$$

**Two internal paths:**

| Path                      | Trigger             | Notes                                                         |
| ------------------------- | ------------------- | ------------------------------------------------------------- |
| `_simulate_numpy()`       | NumPy importable    | Vectorised — `(simulations × days)` matrix in one shot. Fast. |
| `_simulate_pure_python()` | NumPy not available | Stdlib-only loop. Works inside restricted Wasm environments.  |

**Returns:** `{"p10": float, "p50": float, "p90": float, "mean": float, "engine": str}`

---

### `data/`

#### `data/build_local_index.py`

One-shot script that ingests all PDF files from `data/sec_filings/` into a local FAISS vector index stored at `data/faiss_index/`. Run this once before starting the server if you are not using the Bedrock Knowledge Base.

```bash
pip install llama-index faiss-cpu pypdf
python data/build_local_index.py
```

Requires at least one PDF in `data/sec_filings/`. Recommended files: `nvidia-2024-10k.pdf`, `amd-2024-10k.pdf`, `intc-2024-10k.pdf` (from [SEC EDGAR](https://www.sec.gov/cgi-bin/browse-edgar)).

#### `data/sec_filings/`

Empty directory (`.gitkeep` placeholder). Place downloaded 10-K/10-Q PDFs here before running the index builder or Bedrock ingestion.

---

### `tests/`

#### `tests/test_market_data.py`

Unit tests for `tools/market_data.py`.

| Test                                                                  | What it checks                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `test_get_market_snapshot_returns_expected_keys`                      | Finnhub primary success returns required keys                              |
| `test_get_market_snapshot_falls_back_to_polygon_with_eod_notice`      | Polygon fallback is used when Finnhub fails, and EOD disclosure is present |
| `test_get_market_snapshot_ticker_normalised`                          | Input ticker is uppercased before provider request                         |
| `test_get_market_snapshot_both_providers_fail_returns_combined_error` | Combined error includes both provider failure reasons                      |

#### `tests/test_monte_carlo.py`

Unit tests for `compute/monte_carlo.py`.

| Test                                   | What it checks                                                 |
| -------------------------------------- | -------------------------------------------------------------- |
| `test_simulate_returns_required_keys`  | All four output keys present                                   |
| `test_percentile_ordering`             | P10 ≤ P50 ≤ P90 always holds                                   |
| `test_mean_within_plausible_range`     | Mean stays within ±20% of start price over 5 days (zero drift) |
| `test_pure_python_fallback_consistent` | Pure-Python path produces valid ordered percentiles            |
| `test_high_volatility_widens_spread`   | Higher σ always widens the P10-P90 spread                      |
| `test_single_day_simulation`           | Edge case: 1-day simulation does not crash                     |

#### `tests/test_vault_logger.py`

Unit tests for `tools/vault_logger.py`.

| Test                                         | What it checks                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `test_log_insight_creates_file`              | A `.md` file is created; includes content, `## Executive Summary`, `## User Additions` |
| `test_log_insight_front_matter`              | YAML front matter is present with `source`, `tags`, and `note_type: research_insight`  |
| `test_log_insight_no_tags`                   | Works without tags — empty tag list is handled gracefully                              |
| `test_log_insight_filename_sanitised`        | Special characters in title (`/`, `<`, `>`, `&`) do not appear in the filename         |
| `test_log_insight_includes_context_metadata` | `session_id` and `tools_used` from `context` appear in the saved note                  |

#### `tests/test_event_router.py`

Integration tests for `event_router/router.py`.

| Test                                            | What it checks                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `test_dispatch_known_tool_delegates`            | `dispatch()` calls the correct backend for a known tool                                      |
| `test_dispatch_unknown_tool_returns_error`      | Unknown tool name returns `{"error": "Unknown tool: ..."}` without raising                   |
| `test_dispatch_tool_exception_returns_error`    | Backend exception is caught and returned as `{"error": ...}` dict                            |
| `test_dispatch_log_tool_passes_session_context` | `dispatch("log_research_insight", ..., context)` forwards `context` kwarg to `log_insight()` |
| `test_health_endpoint`                          | `GET /health` returns 200 and lists all four tool names                                      |

#### `tests/smoke_test_tools.py`

Live integration test suite — makes **real network calls** with actual API keys. Not mocked. Run manually when you want to verify end-to-end tool behaviour.

| Test                             | What it checks                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tool 1A — Live quote (GOOGL)     | Finnhub primary path returns price, open, high, low, change_pct                                            |
| Tool 1B — Cache hit              | Second identical call within 60 s is served from `_SNAPSHOT_CACHE`                                         |
| Tool 1C — Polygon fallback       | Polygon EOD path is used when Finnhub key is absent; includes EOD disclosure                               |
| Tool 2A — INTC SEC RAG           | Bedrock KB returns relevant passages for a company that is in the knowledge base                           |
| Tool 2B — Unknown company        | Score threshold (`MIN_SCORE = 0.50`) filters out noise for unknown companies                               |
| Tool 3A — AMD Monte Carlo (10 k) | Native numpy path runs 10,000 paths; reports engine, timing, and percentiles                               |
| Tool 3B — Low simulations        | 100-path run completes without error                                                                       |
| Tool 4A — Vault logger           | Note is written with rich YAML front matter, seven structured sections, and LLM-generated content via Groq |

#### `tests/test_nova_sonic_client.py`

Unit tests for `nova_sonic/client.py` event builders. All tests run without real AWS credentials — `boto3` is fully stubbed at import time.

| Test | What it checks |
| ---- | -------------- |
| `test_build_session_start_event_contains_expected_sections` | `sessionStart` contains the system prompt, all four tool schemas, and inference config (`maxTokens`, `topP`, `temperature`) |
| `test_build_audio_input_start_event_uses_expected_audio_formats` | Input audio spec: `audio/lpcm`, 16 kHz, 16-bit, mono, base64, `SPEECH` type. Output: 24 kHz, voice `matthew` |
| `test_build_audio_chunk_event_contains_prompt_content_and_payload` | `audioInput` event carries correct `promptId`, `contentId`, and base64 payload |
| `test_build_tool_result_event_serializes_result_json` | Tool result dict is JSON-serialised into `toolResult.content[0].text`; status is `success` |

#### `tests/test_nova_sonic_session.py`

Unit tests for `nova_sonic/session.py` state machine. Fully mocked — no real AWS calls.

| Test | What it checks |
| ---- | -------------- |
| `test_start_transitions_to_listening_and_sends_start_events` | `session.start()` reaches `LISTENING`, sends `sessionStart` and `promptStart` events, creates consumer task |
| `test_send_audio_chunk_drops_audio_while_tool_executing` | Audio drop in `TOOL_EXECUTING` state |
| `test_send_audio_chunk_sends_event_while_listening` | Correct base64-encoded `audioInput` event is sent in `LISTENING` state |
| `test_handle_output_event_audio_output_enqueues_pcm_and_sets_speaking` | PCM decoded from base64 and enqueued; state → `SPEAKING` |
| `test_handle_output_event_generation_complete_sets_listening` | `generationComplete` event resets state → `LISTENING` |
| `test_handle_tool_use_success_sends_tool_result_and_returns_to_listening` | Tool handler called with correct args; result sent back; state → `LISTENING` |
| `test_handle_tool_use_exception_returns_error_payload` | Handler exception produces `{"error": ...}` result without crashing the session |
| `test_close_closes_stream_and_cancels_consumer_task` | `close()` calls `body.close()`, cancels task, sets state → `CLOSED` |
| `test_consume_output_dispatches_events_from_stream_chunks` | `_consume_output()` iterates boto3 stream chunks, dispatches parsed events, closes on `generationComplete` |

#### `tests/test_quant_model.py`

Integration tests for `tools/quant_model.py` (Monte Carlo tool). Covers the full tool function including parallel data fetching (Tiingo + Polygon) and native Python simulation path.

#### `tests/test_api.py`

REST endpoint integration tests. Tests `GET /health`, `POST /vault/log`, `GET /vault/files`, and `GET /vault/files/{filename}` using FastAPI's `TestClient`. Verifies response shapes and status codes without real AWS credentials.

#### `tests/test_complete_setup.py`

End-to-end session setup validation. Checks that the full FastAPI app boots, the router registers correctly, and the WebSocket endpoint exists — all without sending real audio.

#### `tests/test_web_ui_debug.py`

WebSocket protocol debug test. Connects to the running server's `/ws/voice` endpoint, sends a `startAudio` control message and a short silence buffer, and logs all responses. Used during development to trace the event flow. Output is saved to `tests/test_web_ui_debug.log`.

#### `tests/test_audio_with_tools.py`

Full live audio + tool-calling integration test. Captures real microphone input, sends it through the WebSocket pipeline to Nova Sonic, and waits for tool events and audio output. Requires a running server and valid AWS credentials.

#### `tests/test_bidirectional_audio.py`

Tests the bidirectional stream protocol directly against the Bedrock API. Validates that the `InvokeModelWithBidirectionalStream` connection opens, events are sent, and audio chunks are received back.

#### `tests/test_tools_standalone.py`

Calls each of the four tool functions (`get_market_snapshot`, `query_sec_filings`, `run_monte_carlo`, `log_insight`) in isolation with minimal scaffolding. Useful for verifying a single tool without going through the full session pipeline.

#### `tests/bedrock_first_req.py`

Manual Bedrock connection probe — a minimal standalone script that opens a raw `InvokeModelWithBidirectionalStream` call and prints what comes back. Used to diagnose AWS credential or endpoint issues before running the full stack.

#### `tests/nova_sonic_simple.py`

Minimal Nova Sonic session smoke test. Establishes a session, sends a single hard-coded audio buffer, and prints all received events. Used as a quick sanity check that Nova Sonic is reachable and responding.

---

### `frontend/`

React + Vite + TypeScript single-page application that provides the browser UI. Communicates with the backend over a single WebSocket (`/ws/voice`) for audio streaming and receives JSON metadata events (transcripts, tool results) on the same connection. Contacts the vault REST endpoints over plain HTTP.

**Tech stack:**

| Package | Purpose |
| ------- | ------- |
| `react` 19 | UI framework |
| `vite` 8 | Dev server + production bundler |
| `typescript` 5.9 | Type safety |
| `tailwindcss` 4 | Utility-first styling |
| `framer-motion` | Micro-animations and transitions |
| `lucide-react` | Icon set |
| `react-router-dom` 6 | Client-side routing (`/` and `/vault/:filename`) |
| `clsx` + `tailwind-merge` | Conditional class merging utility (`cn()`) |

**Audio pipeline (browser side):**

The frontend uses the Web Audio API directly — no external audio library:

1. `getUserMedia` captures microphone input at 16 kHz, mono, with echo cancellation and noise suppression.
2. An `AudioWorkletNode` (`/audio-processor.js` in `public/`) processes raw PCM from the mic and emits chunks via `postMessage`.
3. Each chunk is sent as a binary WebSocket frame to the server.
4. Incoming binary WebSocket frames (Nova Sonic TTS output, 24 kHz PCM) are decoded from `Int16Array` to `Float32Array` and scheduled on an `AudioContext` using a gapless timestamp queue (`nextPlayTimeRef`).

**WebSocket control protocol:**

| Browser → Server | Meaning |
| ---------------- | ------- |
| Binary frame | Raw PCM-16 @ 16 kHz audio chunk |
| `{"type": "startAudio"}` | User started speaking (new turn) |
| `{"type": "endAudio"}` | User stopped speaking |

| Server → Browser | Meaning |
| ---------------- | ------- |
| Binary frame | Raw PCM-16 @ 24 kHz TTS audio chunk |
| `{"type": "user_transcript", "text": ...}` | Streaming ASR transcript of what the user said |
| `{"type": "transcript", "text": ...}` | Streaming ASR transcript of Nova's response |
| `{"type": "tool_result", "tool_name": ..., "result": ...}` | Tool output for the Query Stream panel |
| `{"type": "response_complete"}` | Full turn is done; transcripts are committed to chat history |

**Multi-turn support:**

On each `startAudio` message after the first response, the router calls `session.start_next_prompt()` to reset the prompt/content IDs for the next conversational turn. The frontend tracks `response_count` to know when to trigger this. This allows back-and-forth conversation without reconnecting the WebSocket.

**Reconnect logic:**

The WebSocket client uses exponential back-off (up to 10 s, max 5 attempts) to reconnect automatically if the connection drops.

**Routes:**

| Path | Component | What it shows |
| ---- | --------- | ------------- |
| `/` | `MainApp` | Full three-panel layout: Chat Session, Voice Interface, Vault + Query Stream |
| `/vault/:filename` | `VaultViewerPage` → `VaultViewer` | Full Markdown render of a single vault note |

**Components (`frontend/src/components/`):**

| File | Purpose |
| ---- | ------- |
| `Panel.tsx` | Reusable dark-glass panel shell with icon + title header and optional right-slot action |
| `MessageBubble.tsx` | Single chat message bubble (user vs. assistant style) |
| `ChatSession.tsx` | Scrollable conversation history built from `MessageBubble` items |
| `VoiceInterface.tsx` | Central panel with the mic button, waveform, and live transcript display |
| `VoiceVisualizer.tsx` | Animated audio waveform SVG that pulses when `isActive` is true |
| `ParticleWave.tsx` | Canvas-based particle animation used as background visual element |
| `QueryStreamPanel.tsx` | Right-panel wrapper for the tool-result display |
| `FormattedResult.tsx` | Renders structured tool results (market data, Monte Carlo percentiles, vault saves) with labelled fields per tool type |
| `VaultPanel.tsx` | Lists vault files from `GET /vault/files`, sorted by modification time, with a refresh button |
| `VaultFileItem.tsx` | Single vault file row with filename, relative timestamp, and click-to-open navigation |
| `VaultViewer.tsx` | Fetches and renders a single vault Markdown file via `GET /vault/files/{filename}` |
| `index.ts` | Barrel export for all components |

**Running the frontend:**

```bash
cd frontend
npm install
npm run dev   # dev server at http://localhost:5173
```

The Vite dev server proxies WebSocket and REST calls to `http://localhost:8000`. In production, serve the built output (`npm run build` → `dist/`) behind the same FastAPI server or a reverse proxy.

---

### `vault/`

Runtime directory. All Markdown notes created by Tool 4 (`log_research_insight`) are written here. Contains only a `.gitkeep` in the repository. If `VAULT_PATH` in `.env` points to your Obsidian vault folder, notes will appear there instead.

---

## 5. The Four Financial Tools

| #   | Tool name                    | Backend file            | External service                               | Fallback                                        |
| --- | ---------------------------- | ----------------------- | ---------------------------------------------- | ----------------------------------------------- |
| 1   | `query_live_market_data`     | `tools/market_data.py`  | Finnhub real-time quotes                       | Polygon previous-day aggregate (EOD disclosure) |
| 2   | `analyze_sec_filings_rag`    | `tools/sec_rag.py`      | AWS Bedrock Knowledge Base                     | Local FAISS + LlamaIndex                        |
| 3   | `execute_quantitative_model` | `tools/quant_model.py`  | ironclad-runtime (Wasm)                        | Native Python in-process                        |
| 4   | `log_research_insight`       | `tools/vault_logger.py` | Groq LLM (note composition) + local filesystem | Structural fallback template (no LLM)           |

---

## 6. Session State Machine

```
          ┌────────────────────────────────────┐
          │                                    │
  ┌──── IDLE ──── start() ──── LISTENING ────┐ │
  │                               │          │ │
  │                        audio chunk       │ │
  │                         arrives          │ │
  │                               │          │ │
  │                        Nova Sonic        │ │
  │                       decides to         │ │
  │                        call a tool       │ │
  │                               ▼          │ │
  │                       TOOL_EXECUTING     │ │
  │                               │          │ │
  │                         tool result      │ │
  │                         returned         │ │
  │                               ▼          │ │
  │                           LISTENING ─────┘ │
  │                               │            │
  │                     Nova Sonic starts      │
  │                      speaking TTS          │
  │                               ▼            │
  │                           SPEAKING         │
  │                               │            │
  │                    contentBlockStop or     │
  │                    generationComplete      │
  │                               ▼            │
  └─────────────────────────── CLOSED ◄────────┘
                           (on disconnect)
```

Audio chunks sent from the browser are **silently dropped** while in `TOOL_EXECUTING` state — this prevents partial utterances from confusing the model while it is processing a tool result.

---

## 7. Setup & Running

### Prerequisites

- Python 3.11+
- AWS account with Bedrock access in `us-east-1`
- Nova Sonic model access approved in the Bedrock console
- Polygon.io API key (fallback provider)
- Finnhub API key (recommended primary provider)

### Install

```bash
cd Voice_AI_Agent
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

### Configure

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `.env` — at minimum set:

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
POLYGON_API_KEY=...
```

Recommended for primary market data path:

```
FINNHUB_API_KEY=...
```

### Run

```bash
python main.py
# Server starts at http://localhost:8000
```

Check: `http://localhost:8000/health`

### Connect audio

The WebSocket endpoint is `ws://localhost:8000/ws/voice`. Send raw PCM-16 at 16 kHz/mono in binary frames; receive raw PCM-16 at 24 kHz/mono back.

---

## 8. Environment Variables

See [`.env.example`](../.env.example) for the full annotated list.

**Required (no default):**

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `POLYGON_API_KEY`

**Optional (have defaults):**

- `AWS_REGION` → `us-east-1`
- `NOVA_SONIC_MODEL_ID` → `amazon.nova-sonic-v1:0`
- `BEDROCK_KB_ID` → `""` (empty = use local FAISS fallback)
- `BEDROCK_KB_MODEL_ARN` → `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0`
- `FINNHUB_API_KEY` → `""` (empty = skip primary and use Polygon fallback)
- `TIINGO_API_KEY` → `""` (used for historical volatility in Tool 3; falls back to Polygon)
- `VAULT_PATH` → `./vault`
- `IRONCLAD_RUNTIME_PATH` → `./ironclad/ironclad-runtime`
- `APP_HOST` → `0.0.0.0`
- `APP_PORT` → `8000`
- `LOG_LEVEL` → `INFO`

**Vault Logger / Note Generation:**

- `NOTE_LLM_PROVIDER` → `groq` (`groq` | `nova_lite` | `none`)
- `NOTE_LLM_TIMEOUT_SECONDS` → `20`
- `GROQ_API_KEY` → `""` (required for AI-composed notes; falls back to structural template if absent)
- `GROQ_MODEL` → `llama-3.3-70b-versatile`
- `GROQ_BASE_URL` → `https://api.groq.com/openai/v1`
- `NOVA_LITE_MODEL_ID` → `amazon.nova-lite-v1:0` (placeholder, not yet wired)

---

## 9. Execution Paths & Fallbacks

### Market Data (Tool 1)

```
FINNHUB_API_KEY configured and Finnhub request succeeds?
   YES → Return Finnhub daily latest bar
   NO  → Try Polygon /v2/aggs/ticker/{ticker}/prev
           If Polygon succeeds, response summary includes explicit EOD fallback note
           If Polygon fails, return combined error with both provider messages
```

### SEC RAG (Tool 2)

```
BEDROCK_KB_ID set?
    YES → bedrock-agent-runtime.retrieve() → Bedrock Knowledge Base
    NO  → LlamaIndex + FAISS local index at data/faiss_index/
              (must run data/build_local_index.py first)
```

### Monte Carlo (Tool 3)

```
ironclad-runtime binary exists at IRONCLAD_RUNTIME_PATH?
    YES → write temp script → subprocess call → read JSON stdout
    NO  → import compute.monte_carlo.simulate() directly

Inside simulate():
    NumPy importable?
        YES → _simulate_numpy()    (vectorised, fast)
        NO  → _simulate_pure_python() (stdlib-only, slower, Wasm-safe)
```

---

## 10. Running Tests

```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

Tests use `unittest.mock` — no real AWS credentials or Polygon API key needed.
For market-data tests, Finnhub and Polygon responses are mocked.

---

## 11. Demo Script

The intended 90-second demo flow (rehearse until reliable):

1. **"What's the current trading volume and price action for AMD?"**  
   → Tool 1 fires → Finnhub primary data (or Polygon fallback) → Nova Sonic reads price, volume, change %. If fallback is used, Nova Sonic states it is EOD data.

2. **"What did Nvidia say about their datacenter supply chain in their latest 10-K?"**  
   → Tool 2 fires → Bedrock KB (or local FAISS) → Nova Sonic quotes from the actual filing.

3. **"Run a Monte Carlo simulation on Nvidia for the next 30 days."**  
   → Tool 3 fires → ironclad-runtime (or native Python) → Nova Sonic begins reading P10/P50/P90 →  
   **[Interrupt mid-sentence]** _"Wait, skip the distribution — just give me the worst-case scenario."_  
   → Nova Sonic stops (VAD built-in) and answers.

4. **"Save this insight to my vault and tag it semiconductors."**  
   → Tool 4 fires → `.md` file written to `vault/` → Nova Sonic confirms saved.

**Total: ~90 seconds. All 4 tools. One live interruption.**

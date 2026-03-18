"""
test_nova_sonic_client.py - Unit tests for nova_sonic/client.py event builders.

Run: pytest tests/test_nova_sonic_client.py -v
"""

import json
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Stub heavy AWS SDK dependencies BEFORE nova_sonic.client is imported.
# We use dedicated variable names so the guards are idempotent when the full
# test suite runs (another file may import boto3/config first).
# ---------------------------------------------------------------------------

# aws_sdk_bedrock_runtime stub (the real SDK used by client.py)
if "aws_sdk_bedrock_runtime" not in sys.modules:
    _aws_mod = types.ModuleType("aws_sdk_bedrock_runtime")
    _aws_client_mod = types.ModuleType("aws_sdk_bedrock_runtime.client")
    _aws_models_mod = types.ModuleType("aws_sdk_bedrock_runtime.models")
    _aws_config_mod = types.ModuleType("aws_sdk_bedrock_runtime.config")

    _aws_client_mod.BedrockRuntimeClient = MagicMock()
    _aws_models_mod.BidirectionalInputPayloadPart = MagicMock()
    _aws_models_mod.InvokeModelWithBidirectionalStreamInputChunk = MagicMock()
    _aws_models_mod.InvokeModelWithBidirectionalStreamOperationInput = MagicMock()
    _aws_config_mod.Config = MagicMock()

    sys.modules["aws_sdk_bedrock_runtime"] = _aws_mod
    sys.modules["aws_sdk_bedrock_runtime.client"] = _aws_client_mod
    sys.modules["aws_sdk_bedrock_runtime.models"] = _aws_models_mod
    sys.modules["aws_sdk_bedrock_runtime.config"] = _aws_config_mod

if "smithy_aws_core" not in sys.modules:
    _smithy_mod = types.ModuleType("smithy_aws_core")
    _smithy_id_mod = types.ModuleType("smithy_aws_core.identity")
    _smithy_env_mod = types.ModuleType("smithy_aws_core.identity.environment")
    _smithy_env_mod.EnvironmentCredentialsResolver = MagicMock()
    sys.modules["smithy_aws_core"] = _smithy_mod
    sys.modules["smithy_aws_core.identity"] = _smithy_id_mod
    sys.modules["smithy_aws_core.identity.environment"] = _smithy_env_mod

if "config" not in sys.modules:
    _config_stub = types.ModuleType("config")

    class _SettingsStub:
        aws_access_key_id = "test-key"
        aws_secret_access_key = "test-secret"
        aws_region = "us-east-1"
        nova_sonic_model_id = "amazon.nova-sonic-v1:0"
        finnhub_api_key = ""
        polygon_api_key = "test-polygon-key"
        tiingo_api_key = ""
        note_llm_provider = "none"
        note_llm_timeout_seconds = 20
        groq_api_key = ""
        groq_model = "llama-3.3-70b-versatile"
        groq_base_url = "https://api.groq.com/openai/v1"
        nova_lite_model_id = "amazon.nova-lite-v1:0"
        log_level = "INFO"
        vault_path = None

    _config_stub.settings = _SettingsStub()
    sys.modules["config"] = _config_stub

from nova_sonic.client import NovaSonicClient  # noqa: E402
from nova_sonic.tool_schemas import ALL_TOOLS  # noqa: E402


def _build_client() -> NovaSonicClient:
    """Create client with BedrockRuntimeClient mocked to avoid real AWS calls."""
    with patch("nova_sonic.client.BedrockRuntimeClient", return_value=MagicMock()):
        return NovaSonicClient()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_build_session_start_event_contains_expected_sections() -> None:
    client = _build_client()

    event = client.build_session_start_event(system_prompt="Test prompt")

    session_start = event["event"]["sessionStart"]
    assert session_start["systemPrompt"]["text"] == "Test prompt"
    assert session_start["toolConfiguration"]["tools"] == ALL_TOOLS

    inference = session_start["inferenceConfiguration"]
    assert inference["maxTokens"] == 1024
    assert inference["topP"] == 0.9
    assert inference["temperature"] == 0.7


def test_build_audio_input_start_event_uses_expected_audio_formats() -> None:
    # client.py signature: build_audio_input_start_event(prompt_name, content_name)
    event = NovaSonicClient.build_audio_input_start_event("prompt-1", "content-1")

    prompt_start = event["event"]["promptStart"]
    # Current implementation uses promptName (AWS SDK v2 naming)
    assert prompt_start["promptName"] == "prompt-1"

    # Output audio is under audioOutputConfiguration (flat, not nested)
    out_audio = prompt_start["audioOutputConfiguration"]
    assert out_audio["mediaType"] == "audio/lpcm"
    assert out_audio["sampleRateHertz"] == 24000
    assert out_audio["sampleSizeBits"] == 16
    assert out_audio["channelCount"] == 1
    assert out_audio["voiceId"] == "matthew"


def test_build_audio_chunk_event_contains_prompt_content_and_payload() -> None:
    event = NovaSonicClient.build_audio_chunk_event("prompt-2", "content-2", "YWJj")

    audio_input = event["event"]["audioInput"]
    # Current implementation uses promptName / contentName (AWS SDK v2 naming)
    assert audio_input["promptName"] == "prompt-2"
    assert audio_input["contentName"] == "content-2"
    assert audio_input["content"] == "YWJj"


def test_build_tool_result_event_serializes_result_json() -> None:
    result = {"ticker": "NVDA", "price": 100.5}

    event = NovaSonicClient.build_tool_result_event("prompt-3", "tool-123", result)

    tool_result = event["event"]["toolResult"]
    # Current implementation uses promptName (AWS SDK v2 naming)
    assert tool_result["promptName"] == "prompt-3"
    assert tool_result["toolUseId"] == "tool-123"
    assert tool_result["status"] == "success"

    payload_text = tool_result["content"][0]["text"]
    assert json.loads(payload_text) == result

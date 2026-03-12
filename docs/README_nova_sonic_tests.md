# Nova Sonic Tests Guide (Beginner Friendly)

This guide explains the two new test files:

- tests/test_nova_sonic_client.py
- tests/test_nova_sonic_session.py

It also explains how pytest works at a practical level and clarifies whether these tests call real project code.

## 1) What These Tests Are For

These two files are unit tests for the Nova Sonic layer.

- test_nova_sonic_client.py validates event payload builders in nova_sonic/client.py.
- test_nova_sonic_session.py validates session state transitions and routing logic in nova_sonic/session.py.

Goal: Catch regressions in event shape and session behavior without needing live AWS calls.

## 2) Quick Commands

Run both together from project root:

    d:\Code\PROJECTS\Voice_AI_Agent\.venv\Scripts\python.exe -m pytest tests/test_nova_sonic_client.py tests/test_nova_sonic_session.py -v

Run only client tests:

    d:\Code\PROJECTS\Voice_AI_Agent\.venv\Scripts\python.exe -m pytest tests/test_nova_sonic_client.py -v

Run only session tests:

    d:\Code\PROJECTS\Voice_AI_Agent\.venv\Scripts\python.exe -m pytest tests/test_nova_sonic_session.py -v

## 3) Pytest Basics (For First-Time Users)

Pytest discovers functions whose names start with test\_.

Typical lifecycle:

1. Import test modules.
2. Build fixtures (reusable setup objects).
3. Run each test function independently.
4. Report pass/fail and assertion differences.

Why collection/import matters:

- If a module crashes during import, no tests run.
- This is why these tests stub some modules early (before importing the module under test).

## 4) Do These Tests Call Real Functions?

Yes, they call real functions from your codebase.

### In test_nova_sonic_client.py

These are real calls into nova_sonic/client.py:

- NovaSonicClient.build_session_start_event
- NovaSonicClient.build_audio_input_start_event
- NovaSonicClient.build_audio_chunk_event
- NovaSonicClient.build_tool_result_event

What is mocked there:

- boto3 client creation is patched so no real AWS client is created.
- config settings object is stubbed so import does not require real secrets.

Result:

- Real payload-building logic is executed.
- External infra dependencies are replaced.

### In test_nova_sonic_session.py

These are real calls into nova_sonic/session.py:

- NovaSonicSession.start
- NovaSonicSession.send_audio_chunk
- NovaSonicSession.\_handle_output_event
- NovaSonicSession.\_handle_tool_use
- NovaSonicSession.close
- NovaSonicSession.\_consume_output

What is mocked there:

- NovaSonicClient class is patched to a mocked client instance.
- Tool dispatch handler is an AsyncMock.
- Stream input/output structures are faked.

Result:

- Real session state machine code runs.
- Network/AWS dependencies are replaced.

## 5) Why There Are Module Stubs At The Top

You will see stubs inserted into sys.modules for:

- boto3
- botocore.exceptions
- config

Reason:

- nova_sonic/client.py imports config.settings at import time.
- config.settings validates required env vars.
- Unit tests should not fail just because local secrets are unavailable.

So the stubs allow import and keep tests deterministic.

## 6) File-by-File Breakdown

## tests/test_nova_sonic_client.py

Main idea: verify event JSON structure.

Tests included:

1. test_build_session_start_event_contains_expected_sections

- Confirms system prompt is passed through.
- Confirms tool schemas are attached.
- Confirms inference config values exist.

2. test_build_audio_input_start_event_uses_expected_audio_formats

- Confirms 16 kHz input config and 24 kHz output config.
- Confirms expected audio metadata fields.

3. test_build_audio_chunk_event_contains_prompt_content_and_payload

- Confirms promptId/contentId/content are correctly set.

4. test_build_tool_result_event_serializes_result_json

- Confirms tool result payload stores JSON string in content text.
- Confirms status is success.

## tests/test_nova_sonic_session.py

Main idea: verify state machine transitions and behavior boundaries.

Fixture:

- session_with_mocks creates a NovaSonicSession wired to mocked client and mocked tool handler.

Utility:

- \_run wraps asyncio.run so async methods can be called from plain pytest functions.

Tests included:

1. test_start_transitions_to_listening_and_sends_start_events

- Verifies start sends sessionStart and promptStart.
- Verifies state becomes LISTENING.

2. test_send_audio_chunk_drops_audio_while_tool_executing

- Verifies audio is dropped during TOOL_EXECUTING.

3. test_send_audio_chunk_sends_event_while_listening

- Verifies chunk is encoded and forwarded while LISTENING.

4. test_handle_output_event_audio_output_enqueues_pcm_and_sets_speaking

- Verifies output audio is decoded and queued.
- Verifies state becomes SPEAKING.

5. test_handle_output_event_generation_complete_sets_listening

- Verifies generationComplete returns to LISTENING.

6. test_handle_tool_use_success_sends_tool_result_and_returns_to_listening

- Verifies tool handler call.
- Verifies tool result event sent.
- Verifies state recovery.

7. test_handle_tool_use_exception_returns_error_payload

- Verifies exception is converted into error payload.
- Verifies session still sends tool result and recovers state.

8. test_close_closes_stream_and_cancels_consumer_task

- Verifies stream close call.
- Verifies consumer task cancel call.
- Verifies CLOSED state.

9. test_consume_output_dispatches_events_from_stream_chunks

- Verifies stream chunk is parsed and forwarded to event handler.

## 7) Important Distinction: Unit Test vs Integration Test

These are unit tests.

They answer:

- Is our logic correct?
- Are our event payloads correctly shaped?
- Are state transitions correct?

They do not answer:

- Can AWS be reached right now?
- Are credentials valid?
- Is live Nova Sonic stream working end-to-end?

For that, use integration or smoke tests.

## 8) Why config.py Was Updated

config.py now resolves .env using an absolute path based on config.py location.

Why it helps:

- Running tests from different working directories no longer breaks .env lookup.
- This avoids environment confusion while still keeping fail-fast validation in app runtime.

## 9) If A Test Fails, How To Debug Quickly

1. Re-run just one failing test with -k filter.

   d:\Code\PROJECTS\Voice_AI_Agent\.venv\Scripts\python.exe -m pytest tests/test_nova_sonic_session.py -k start -v

2. Read assertion diff and compare expected vs actual field names.

3. Check whether failure is logic or setup:

- Logic failure: assertion mismatch.
- Setup failure: import error, missing package, validation error during module import.

4. If setup failure, verify:

- venv packages installed.
- pytest and pytest-asyncio installed.
- stubs in test file are still before importing modules under test.

## 10) Next Good Step

After these unit tests, add one integration test that opens a real stream only when required env vars are present, and skip otherwise.
That gives both fast local safety (unit tests) and real service confidence (integration test).

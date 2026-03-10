# What You Need to Learn to Build This From Scratch

Ordered by what to tackle first.

---

## 1. Python Foundations (if not already solid)

- `async`/`await`, `asyncio` — the entire backend is async. Queues, tasks, `gather()`.
- Type hints — `dict[str, Any]`, `Callable`, `Awaitable`. Used everywhere.
- `dataclasses` / Pydantic — how to model and validate data.

---

## 2. FastAPI

- Defining routes (`@router.get`, `@router.post`, `@router.websocket`)
- WebSocket lifecycle — `accept()`, `iter_bytes()`, `send_bytes()`, disconnect handling
- Lifespan context manager (startup/shutdown hooks)
- Pydantic request/response models with FastAPI
- CORS middleware

---

## 3. AWS Bedrock & Nova Sonic

- How Bedrock model invocation works (`boto3` + `bedrock-runtime`)
- The **bidirectional streaming** API (`invoke_model_with_bidirectional_stream`) — this is the trickiest part. Not much like normal REST.
- The Nova Sonic **event protocol**: `sessionStart`, `promptStart`, `audioInput`, `audioOutput`, `toolUse`, `toolResult`, `contentBlockStop`
- How **tool calling** works in Bedrock: you define JSON schemas → the model emits a `toolUse` event → you return a `toolResult`
- AWS IAM: how credentials work, what permissions Bedrock needs

---

## 4. Audio & Streaming

- PCM audio basics: sample rate, bit depth, channels, what "16 kHz 16-bit mono" means
- Base64 encoding (audio is sent as base64 in JSON events)
- Chunking: why you send audio in ~100ms frames rather than all at once
- VAD (Voice Activity Detection) — conceptually, even though Nova Sonic handles it

---

## 5. REST API Design & httpx

- How to call external REST APIs with `httpx` (async)
- Reading API documentation (Polygon.io)
- Handling errors: HTTP status codes, timeouts, rate limits (429)

---

## 6. Pydantic & pydantic-settings

- Defining models with field validation
- `BaseSettings` for loading `.env` files — this is how `config.py` works

---

## 7. Financial Concepts (just enough)

- What P10/P50/P90 percentiles mean in a price distribution
- Geometric Brownian Motion at a conceptual level — stock price = random walk with drift
- What volatility (σ) means and how to compute it from log returns
- What a 10-K / 10-Q is (annual and quarterly SEC filings)

---

## 8. NumPy

- Arrays, vectorised operations (`np.random.standard_normal`, `np.cumsum`, `np.exp`, `np.percentile`)
- Why NumPy is faster than a Python loop for 10,000 simulations

---

## 9. RAG (Retrieval-Augmented Generation)

- What a vector embedding is: text → fixed-size float array that captures meaning
- What a vector store / similarity search does (FAISS or Bedrock KB)
- The pipeline: chunk PDFs → embed each chunk → store → query with a question → return top-K chunks

For the Bedrock path specifically:

- S3 bucket setup, uploading PDFs
- Creating a Bedrock Knowledge Base in the console
- IAM permissions for Bedrock → S3 access
- `bedrock-agent-runtime.retrieve()` API call

---

## 10. State Machines

- How to model a system with discrete states and transitions (Python `Enum`)
- Why state matters here: you don't forward audio while a tool is executing

---

## 11. Subprocess & Sandboxing (for the Wasm path)

- `subprocess.run()` — how to call an external binary from Python, capture stdout
- Why sandboxing financial compute matters (conceptually)
- What WebAssembly is and why it's used as a security boundary

---

## 12. File I/O & Markdown

- `pathlib.Path` — modern Python file path handling
- `aiofiles` — non-blocking async file writes
- YAML front matter (the `---` block in Obsidian notes)

---

## 13. Testing

- `pytest` basics
- `pytest-asyncio` for testing async functions
- `unittest.mock` — `patch`, `AsyncMock`, `MagicMock` for mocking external services (AWS, Polygon) without real credentials

---

## Suggested Learning Order

```
Python async/await
    → FastAPI (routes + WebSocket)
        → boto3 basics → Bedrock tool calling → Nova Sonic event protocol
            → Polygon.io API integration
                → NumPy + Monte Carlo math
                    → RAG concepts → Bedrock KB setup
                        → Testing with pytest + mocks
```

> The single hardest thing is the **Nova Sonic bidirectional stream protocol** — the event schema
> is specific to Bedrock and the AWS documentation is thin. Plan to spend the most time there.

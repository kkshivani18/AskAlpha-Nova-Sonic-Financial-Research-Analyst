# Hackathon Presentation Script — Nova Sonic Financial Research Terminal
### AWS Bedrock Nova Hackathon · 3-Minute Demo

---

## 📋 Script Flow Summary

> Read this first to get the big picture. The full word-for-word script follows below.

| Segment | Time | What Happens |
|---|---|---|
| **Hook + What it is** | 0:00 – 0:20 | Open with the core idea — speak a market question, get a spoken answer |
| **Who it helps** | 0:20 – 0:35 | Retail traders, analysts, anyone who wants research at voice-speed |
| **Four tools (one-liner each)** | 0:35 – 0:55 | Live prices, SEC filings, Monte Carlo, vault logger |
| **Transition to demo** | 0:55 – 1:00 | Cut straight to the Web UI — no terminal |
| **Demo: Tool 1 — Market Data** | 1:00 – 1:25 | Ask for AMD price → Nova reads it back in real time |
| **Demo: Tool 2 — SEC RAG** | 1:25 – 1:50 | Ask Nvidia 10-K supply chain question → Nova quotes the filing |
| **Demo: Tool 3 — Monte Carlo + Interruption** | 1:50 – 2:20 | Run simulation → interrupt mid-sentence → VAD kicks in, Nova pivots |
| **Demo: Tool 4 — Vault Logger** | 2:20 – 2:40 | Say "save this" → `.md` note written, Nova confirms |
| **Close** | 2:40 – 3:00 | Why Nova Sonic, single stream, wrap up |

**Key things to remember:**
- Start directly on the Web UI — skip all terminal/startup commands
- The interruption in Tool 3 is your biggest wow moment, pause a beat before doing it
- Keep energy up through the tool demos, they move fast

---

---

## 🎙️ Full Script

---

### [0:00 – 0:55] — Introduction

*[Open on the Web UI, mic ready, browser in full screen]*

---

"Okay so — imagine you're doing financial research and instead of switching between a terminal, a browser, and a bunch of tabs, you just... ask. Out loud. And your AI does the rest.

That's what this is. This is the **Nova Sonic Financial Research Terminal** — a voice-native research assistant built on top of **AWS Bedrock Nova Sonic 2**.

Here's what makes it interesting: Nova Sonic handles everything on the AI side — speech recognition, understanding your intent, picking the right tool, generating a response, and speaking it back. All of that, natively. Our job was to build the financial brain behind it.

So who's this for? Retail traders who don't want to context-switch. Analysts who want to move faster. Anyone who's ever thought 'why am I typing this when I could just say it.'

Now, the system has four tools Nova can reach for at any time. I'll give you the quick version:

- **Tool 1** — live market data. Real-time stock quotes from Finnhub, with Polygon as the fallback.
- **Tool 2** — SEC filing search. RAG over 10-Ks and 10-Qs, powered by AWS Bedrock Knowledge Base.
- **Tool 3** — Monte Carlo simulation. Ten thousand price paths, running in about thirty milliseconds.
- **Tool 4** — a research vault. When you say 'save this', Nova writes a structured Markdown note with full session context.

Let me show you all four, live."

---

### [0:55 – 1:25] — Demo: Tool 1 — Live Market Data

*[Click or speak to activate the session. UI shows the waveform is listening.]*

---

"Alright, first one —

*[Speak into mic]* **'What's the current price and daily change for AMD?'**

*[Pause — waveform animates, tool fires, audio response plays]*

You can see it fired `query_live_market_data` right there. Pulled the quote from Finnhub — price, open, high, low, the change percent — and Nova read it back. Real time. No text box, no copy-paste. One question, one spoken answer.

And if Finnhub's down? It gracefully falls back to Polygon's end-of-day data and tells you it's doing that. Transparent fallbacks, always."

---

### [1:25 – 1:50] — Demo: Tool 2 — SEC Filing RAG

*[Still in the same session, continue speaking]*

---

"Next — SEC filings.

*[Speak into mic]* **'What did Nvidia say about their datacenter supply chain in their latest 10-K?'**

*[Pause — tool fires, Nova responds with sourced passages]*

That's Tool 2 — `analyze_sec_filings_rag`. It hit the Bedrock Knowledge Base, ran retrieval over Nvidia's actual 10-K, filtered by relevance score, and Nova is now quoting directly from the filing.

You're not getting a hallucination — you're getting the real document text, spoken back to you. With sources.

And it's smart about speech-to-text errors too. If you say 'tenk' instead of '10-K', it normalizes that automatically."

---

### [1:50 – 2:20] — Demo: Tool 3 — Monte Carlo + Live Interruption

*[Same session, keep the energy up here — this is the highlight moment]*

---

"Now this one's my favorite —

*[Speak into mic]* **'Run a Monte Carlo simulation on Nvidia for the next thirty days.'**

*[Pause — tool fires, Nova starts reading the simulation output aloud — P10, P50, P90...]*

Nova's running ten thousand price paths using Geometric Brownian Motion — you'll hear it start talking through the distribution...

*[Wait two seconds into Nova's response, then interrupt]*

*[Speak over Nova]* **'Wait. Just give me the worst-case number.'**

*[Nova stops mid-sentence — VAD kicks in — it pivots to answer the follow-up]*

That right there — that's Nova Sonic's built-in Voice Activity Detection. We didn't build that. It handled the interruption natively, stopped speaking, and responded to the new question. That's what bidirectional streaming gives you — it's not turn-based. It's a real conversation."

---

### [2:20 – 2:40] — Demo: Tool 4 — Vault Logger

*[Still in session, wrapping up the demo flow]*

---

"Last one — saving insights.

*[Speak into mic]* **'Save this analysis to my vault and tag it semiconductors.'**

*[Pause — tool fires, Nova confirms the save]*

Tool 4 — `log_research_insight`. It didn't just dump raw text. It called out to Groq, composed a structured research note with an executive summary, evidence from the tools we used this session, risks, next steps — all of it — and wrote it as a Markdown file with full YAML front matter. Compatible with Obsidian straight out of the box.

Nova's confirming the file was saved. That's your whole session, archived, searchable, ready to come back to."

---

### [2:40 – 3:00] — Close

*[Look back at camera, brief and clean]*

---

"So — what did Nova Sonic actually do across all of that? It handled speech-to-text, intent detection, tool selection, response generation, and text-to-speech. All over a single bidirectional stream. No stitching together multiple APIs, no lag between recording and playback.

We built the four financial backends and the event router that connects them. Nova handled the rest.

Four tools. One voice interface. All live. That's the Nova Sonic Financial Research Terminal — thank you."

---

*[END OF SCRIPT — Total: ~3 minutes]*

---

> **Tip:** Run through this twice before the actual demo. The interruption in Tool 3 needs to feel natural — wait for Nova to get about two sentences into the Monte Carlo response before you cut in.

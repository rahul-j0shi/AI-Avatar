Excellent. Let’s turn this PoC into a true product foundation. We’ll build a completely **provider‑agnostic, adapter‑driven architecture**, with a clean separation of concerns so that multiple developers can work in parallel.

Here’s the end‑to‑end plan, broken down into self‑contained files you can hand directly to your backend, frontend, and integration developers.

---

## Phase 1 Scope (what we’re building)

- A **landing page** → “Get Started” button → **playground**
- Playground with a **configuration panel** (select any STT / LLM / TTS provider, enter credentials, tweak settings)
- A **real‑time conversation loop** via a single WebSocket connection (no polling)
- **3D avatar with lipsync** (using the existing TalkingHead library, but wrapped behind an interface)
- **Adaptable backend** where you can swap providers by simply implementing a new adapter class

Everything is stateless on the browser – no user login, no database. All API keys live in the browser’s session and are sent per‑session.

---

## Document 1 – High‑Level Architecture & Project Structure

### 1.1 Technology Choices
- **Backend**: Python 3.11, FastAPI, `websockets`, `pydantic` for validation, `loguru` for logging.
- **Frontend**: Vanilla HTML/CSS/JS (no framework – small surface, fast to implement). We’ll use ES modules for clean separation.
- **3D Avatar**: TalkingHead library (loaded from CDN) but controlled through our own `AvatarController` abstraction.
- **Communication**: Single WebSocket (`/ws`) for all real‑time messaging (audio, transcripts, config, responses).

### 1.2 Adapter Pattern – Core Principle
Every external capability is behind an abstract Python class:

```
BaseSpeechToText
BaseLLM
BaseTextToSpeech
```

Each adapter (e.g., `WhisperSTT`, `MiniMaxLLM`, `ElevenLabsTTS`) implements the corresponding base.  
The backend loads the correct adapter at runtime based on the **provider name** sent by the frontend.

### 1.3 Repository Structure

```
hindi-avatar/
├── backend/
│   ├── main.py                  # FastAPI app & WebSocket handler
│   ├── adapters/
│   │   ├── base.py              # Abstract classes
│   │   ├── registry.py          # Dict mapping provider -> class
│   │   ├── stt_whisper.py
│   │   ├── stt_deepgram.py
│   │   ├── llm_minimax.py
│   │   ├── llm_openai.py
│   │   ├── tts_minimax.py
│   │   └── tts_elevenlabs.py
│   ├── session.py               # Per‑connection session state
│   └── requirements.txt
├── frontend/
│   ├── landing.html
│   ├── playground.html
│   ├── css/
│   │   ├── landing.css
│   │   └── playground.css
│   ├── js/
│   │   ├── config-panel.js      # Configuration UI logic
│   │   ├── websocket-client.js  # WS connection & message handling
│   │   ├── avatar-controller.js # Wraps TalkingHead + lipsync
│   │   ├── audio-capture.js     # Microphone (pyaudio logic moved to JS)
│   │   └── main.js              # Playground orchestration
│   └── assets/
│       └── avatar.glb
└── README.md
```

---

## Document 2 – Backend Specification (for Python developer)

### 2.1 Responsibilities
- Provide a WebSocket endpoint `/ws`.
- Accept a `config` message at the start of each connection containing:
  - `stt_provider`, `stt_api_key`, `stt_settings`
  - `llm_provider`, `llm_api_key`, `llm_settings`
  - `tts_provider`, `tts_api_key`, `tts_settings`
- Validate configuration and instantiate adapter instances for that session.
- Process a conversation loop:
  1. Receive `audio_data` (binary blob, WAV-encoded).
  2. Transcribe using STT adapter → send `transcript` message.
  3. Send transcript to LLM adapter → send `llm_response` message (text).
  4. Synthesise speech from response using TTS adapter → send `tts_audio` message (binary MP3/WAV).
  5. Handle any errors gracefully and send `error` messages.

### 2.2 Adapter Base Classes (`adapters/base.py`)

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseSpeechToText(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, settings: Dict[str, Any]) -> str:
        ...

class BaseLLM(ABC):
    @abstractmethod
    async def generate(
        self, user_text: str,
        system_prompt: str,
        settings: Dict[str, Any]
    ) -> str:
        ...

class BaseTextToSpeech(ABC):
    @abstractmethod
    async def synthesize(
        self, text: str,
        settings: Dict[str, Any]
    ) -> bytes:
        ...
```

### 2.3 Adapter Registration (`adapters/registry.py`)
A simple dictionary:

```python
from adapters.stt_whisper import WhisperSTT
from adapters.stt_deepgram import DeepgramSTT
from adapters.llm_minimax import MiniMaxLLM
from adapters.llm_openai import OpenAILLM
from adapters.tts_minimax import MiniMaxTTS
from adapters.tts_elevenlabs import ElevenLabsTTS

STT_REGISTRY = {
    "whisper": WhisperSTT,
    "deepgram": DeepgramSTT,
}

LLM_REGISTRY = {
    "minimax": MiniMaxLLM,
    "openai": OpenAILLM,
}

TTS_REGISTRY = {
    "minimax": MiniMaxTTS,
    "elevenlabs": ElevenLabsTTS,
}
```

### 2.4 WebSocket Message Protocol
All messages are JSON except binary audio frames.

**Client → Server**
```json
{ "type": "config", "payload": { ... } }
{ "type": "audio_data", "payload": <binary WAV> }
```

**Server → Client**
```json
{ "type": "transcript", "payload": {"text": "..."} }
{ "type": "llm_response", "payload": {"text": "..."} }
{ "type": "tts_audio", "payload": <binary audio> }
{ "type": "error", "payload": {"message": "..."} }
```

### 2.5 Session Handling (`session.py`)
Each WebSocket connection gets a `ConversationSession` object that holds:
- The adapter instances (instantiated after `config`)
- A small message history (last 5 interactions) for context
- A lock for thread safety (when using asyncio we don’t need it, but keep it in mind)

### 2.6 Implementation Plan for Backend Developer
1. Set up FastAPI app with CORS and static file serving (later the frontend will be served from here).
2. Implement base classes and registry.
3. Build adapter for **OpenAI Whisper** (STT) as first implementation – other adapters can follow.
4. Build adapter for **MiniMax LLM** (your existing `llm_call.py` can be adapted).
5. Build adapter for **MiniMax TTS**.
6. Create the WebSocket handler with the conversation loop.
7. Test with a simple dummy frontend or a WebSocket client.

---

## Document 3 – Frontend Specification (for JavaScript developer)

### 3.1 Pages
**`landing.html`**
- Minimal design, brief value proposition.
- “Get Started” button that navigates to `playground.html`.

**`playground.html`**
- Split layout: left 30% – Configuration Panel, right 70% – Avatar + Chat.
- The configuration panel has sections:
  - **STT**: provider dropdown, API key field, model/language options.
  - **LLM**: provider dropdown, API key, model, system prompt (textarea), temperature slider.
  - **TTS**: provider dropdown, API key, voice ID, speed.
- “Start Session” button that:
  - Validates inputs (all required fields filled).
  - Saves config to `sessionStorage` (to survive accidental reload).
  - Hides configuration, shows the avatar area and a “mic” button.
  - Establishes WebSocket connection to the backend.
  - Sends `config` message immediately after open.

### 3.2 JavaScript Modules (`js/`)
All modules are standalone, no global variables, using event emitters or callbacks.

- **`websocket-client.js`** – wraps `WebSocket`, reconnects, parses messages, exposes `onMessage` callback.
- **`config-panel.js`** – reads form values, validates, fires `configReady` event.
- **`audio-capture.js`** – uses `navigator.mediaDevices.getUserMedia` to capture microphone, does silence detection (same logic as your PoC), encodes to WAV, emits `audioBlob` event.
- **`avatar-controller.js`** – initializes TalkingHead with the 3D model, exposes `speak(audioBuffer)` method that triggers lip‑sync, and a `setMood(expression)` placeholder.
- **`main.js`** – orchestrates everything:
  1. Listens for `configReady`, then creates WS, sends config.
  2. On WS `open`, starts `audio-capture` and shows mic button.
  3. On WS `transcript` / `llm_response` – updates a text log.
  4. On WS `tts_audio` – decodes binary, passes to `avatar.speak()`.
  5. On WS `error` – displays toast notification.

### 3.3 TalkingHead Integration
We keep the existing TalkingHead CDN links, but our `avatar-controller.js` becomes the only place that interacts with it. This way, if we later swap to another lipsync engine (like Rhubarb or a custom solution), only one module changes.

### 3.4 Frontend Developer Tasks
1. Build the landing page (HTML/CSS) – can be completely separate.
2. Build the playground layout and configuration panel (HTML/CSS/JS).
3. Implement `config-panel.js` with validation.
4. Implement `audio-capture.js` (port the silence‑detection logic from Python to JS using Web Audio API).
5. Implement `websocket-client.js`.
6. Adapt the PoC’s `main.js` into the new modular structure.
7. Integrate with the actual backend WebSocket and test.

---

## Document 4 – How to Add a New Provider (Integration Guide)

For any developer tasked with expanding the supported services:

1. **Pick the interface** you want to implement (`BaseSpeechToText`, `BaseLLM`, `BaseTextToSpeech`).
2. Create a new file in `backend/adapters/` (e.g., `tts_elevenlabs.py`).
3. Implement the required async methods, using the provided `api_key` and `settings`.
4. Register your class in `registry.py` under a unique string key.
5. Update the frontend dropdown in `config-panel.js` with the new provider name.
6. (Optional) add provider‑specific fields if needed.

No other changes are required – the entire system remains agnostic.

---

## Document 5 – Task Breakdown & Team Handoff

**Team: Backend Developer (Dev A), Frontend Developer (Dev B), UI Designer / Frontend helper (Dev C)**

| # | Task | Owner | Dependencies |
|---|------|-------|--------------|
| 1 | Set up project repository, FastAPI skeleton, Dockerfile | Dev A | None |
| 2 | Implement base classes, registry, session logic | Dev A | None |
| 3 | Build Whisper STT adapter | Dev A | 2 |
| 4 | Build MiniMax LLM adapter | Dev A | 2 |
| 5 | Build MiniMax TTS adapter | Dev A | 2 |
| 6 | WebSocket endpoint with conversation loop | Dev A | 3,4,5 |
| 7 | Landing page HTML/CSS | Dev C | None |
| 8 | Playground layout + configuration panel HTML/CSS | Dev C | None |
| 9 | Configuration panel logic + validation | Dev B | 8 |
| 10| Audio capture module (mic + silence detection) | Dev B | None |
| 11| WebSocket client module | Dev B | None |
| 12| Avatar controller (wrap TalkingHead) | Dev B | None |
| 13| Playground orchestrator (main.js) | Dev B | 9,10,11,12 |
| 14| End‑to‑end integration test | Dev A + B | All |
| 15| Polish, error handling, loading states | Dev B + C | 14 |

Milestones:
- **Week 1**: Backend skeleton + adapters ready (mockable).
- **Week 2**: Frontend skeleton + WebSocket integration, audio capture.
- **Week 3**: Full integration, bug fixing, first working version.
- **Week 4**: Landing page, final styling, smoke test.

---

This plan gives you a **complete, agnostic foundation** that can be built by separate developers in parallel. Once Phase 1 is done, you’ll have a platform where adding a new TTS or LLM provider takes less than an hour.

Which of these documents would you like me to expand into fully copy‑pastable code stubs? I can generate the backend adapter boilerplate, the frontend JS modules, or even a JSON communication contract for the team.
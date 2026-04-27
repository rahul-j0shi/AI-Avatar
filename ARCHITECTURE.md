# 3D AI Avatar - Architecture Documentation

## 1. Project Overview

**Project Name:** 3D AI Avatar
**Type:** Proof of Concept - Conversational AI System
**License:** Apache License 2.0
**Core Functionality:** Real-time voice conversational system with 3D animated avatar responding in Hinglish (Hindi in Roman script)

---

## 2. Technology Stack

### Backend (Python)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Speech-to-Text | OpenAI Whisper (`whisper-1`) via `openai` SDK | Audio transcription from microphone |
| LLM | MiniMax API (via OpenAI-compatible wrapper) | Response generation in Hinglish |
| TTS | MiniMax Text-to-Speech API (`speech-2.8-turbo`) | Audio synthesis for avatar |
| HTTP Server | Python `http.server.HTTPServer` | Proxy for TTS requests |
| Audio I/O | `pyaudio` | Microphone stream handling |
| Environment | `python-dotenv` | API key management |

### Frontend (Web)

| Component | Technology | Purpose |
|-----------|------------|---------|
| 3D Rendering | Three.js v0.170.0 (CDN) | Browser-based 3D graphics |
| Avatar System | TalkingHead library (CDN) | Lip-sync and facial animation |
| Avatar Model | GLB format (`avatar.glb`, 4.7MB) | 3D character mesh |
| UI | Vanilla CSS/JS | Basic styling and interaction |

### Third-Party APIs

1. **OpenAI API** - Whisper for speech-to-text
2. **MiniMax API** - LLM responses and TTS synthesis

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     JavaScript Frontend                              │   │
│  │  ┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐  │   │
│  │  │  TalkingHead│    │  Custom TTS      │    │  Polling Loop      │  │   │
│  │  │  (3D Avatar)│◄───│  Request Builder  │◄───│  (checkResponse)   │  │   │
│  │  └──────┬──────┘    └────────┬─────────┘    └─────────┬──────────┘  │   │
│  └─────────┼─────────────────────┼────────────────────────┼────────────┘   │
│            │                     │                        │                │
│            ▼                     ▼                        ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              HTTP Server (localhost:8000)                             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │   │
│  │  │ POST /tts  │  │POST/set_resp│  │GET /get_resp│  │POST /configure│  │   │
│  │  └──────┬─────┘  └──────┬──────┘  └──────┬──────┘  └───────────────┘  │   │
│  └─────────┼───────────────┼───────────────┼────────────────────────────┘   │
└────────────┼───────────────┼───────────────┼────────────────────────────────┘
             │               │               │
             ▼               │               │
    ┌────────────────┐       │               │
    │  MiniMax TTS   │       │               │
    │  API           │       │               │
    └────────────────┘       │               │
                             │               │
                          Main Process ◄─────┘
                          (main.py)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌───────────┐ ┌───────────┐ ┌─────────────┐
        │   STT     │ │   LLM     │ │ TTS Server  │
        │(speech_to │ │(llm_call) │ │  Config     │
        │ _text.py) │ │           │ │             │
        └─────┬─────┘ └─────┬─────┘ └──────┬──────┘
              │             │              │
              ▼             ▼              ▼
        ┌───────────┐ ┌───────────┐ ┌─────────────┐
        │ OpenAI    │ │ MiniMax   │ │ MiniMax     │
        │(Whisper)  │ │ (LLM)     │ │ (TTS)       │
        └───────────┘ └───────────┘ └─────────────┘
```

---

## 4. Directory Structure

```
AI-Avatar/
├── .env.example              # Environment variable template
├── .gitignore
├── main.py                   # Main orchestrator
├── speech_to_text.py         # Microphone & Whisper STT handler
├── llm_call.py               # MiniMax LLM integration
├── requirements.txt          # Python dependencies
├── talking-head/             # Frontend assets
│   ├── server.py            # HTTP server (TTS proxy)
│   ├── index.html           # Entry point
│   ├── avatar.glb           # 3D avatar model (4.7MB)
│   ├── js/
│   │   └── main.js          # Client-side JavaScript
│   └── css/
│       └── styles.css       # Styling
```

---

## 5. Component Details

### 5.1 main.py

**Purpose:** Main orchestrator - ties together STT and LLM components

**Key Class:** `ConversationSystem`

**Key Methods:**
- `__init__()` - Initializes STT handler, LLM handler, configures TTS server
- `handle_transcript()` - Callback that processes recognized speech
- `start()` - Begins listening loop

**Data Flow:**
```
User speaks → whisper → transcript → handle_transcript() → llm.generate_response() → POST to avatar server
```

### 5.2 speech_to_text.py

**Purpose:** Handles microphone input and speech-to-text conversion

**Key Classes:**
- `MicrophoneStream` - Context manager for audio capture using pyaudio
- `SpeechToTextHandler` - Manages recording, silence detection, transcription

**Key Methods:**
- `is_silent()` - Detects silence using amplitude threshold (500)
- `process_audio()` - Main recording loop with silence-based endpointing
- `transcribe_audio()` - Sends audio bytes to Whisper API
- `start()`/`stop()` - Thread management

**Audio Processing Pipeline:**
1. Captures raw PCM audio (16-bit, mono, 16kHz)
2. Converts to WAV format in memory
3. Sends to OpenAI Whisper-1 API
4. Language set to "hi" (Hindi)

### 5.3 llm_call.py

**Purpose:** Generates conversational responses using MiniMax LLM

**Key Class:** `LLMHandler`

**Configuration:**
- Model: `MiniMax-M2.7`
- Max tokens: 150
- Temperature: 0.7
- Top P: 1.0

**System Prompt:**
```
"You have to act as a helpful assistant...
...communicate in informal and casual tone...
...MUST only be in Hinglish (hindi in roman literals)...
...MUST NOT contain any hindi, devnagiri, unknown, or special characters"
```

### 5.4 talking-head/server.py

**Purpose:** HTTP server that proxies TTS requests to MiniMax API

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tts` | POST | Proxy TTS request to MiniMax |
| `/set_response` | POST | Store LLM response for avatar |
| `/get_response` | GET | Retrieve latest response |
| `/configure` | POST | Set MiniMax API key |

### 5.5 talking-head/js/main.js

**Purpose:** Client-side JavaScript for avatar initialization and control

**Key Functions:**
- `initializeAvatar()` - Sets up TalkingHead with TTS endpoint
- `checkForNewResponse()` - Polls server for new LLM responses
- `speak()` - Triggers avatar speech
- `customTTSRequestBuilder()` - Formats requests for MiniMax TTS
- `createInitButton()` - Creates start button

---

## 6. Data Flow

### 6.1 Conversation Flow Sequence

```
1. User clicks "Start Avatar" button
        ↓
2. JavaScript initializes TalkingHead with 3D model
        ↓
3. User speaks into microphone
        ↓
4. Audio captured at 16kHz, 1600-byte chunks
        ↓
5. Silence detection (30 frames of silence ends recording)
        ↓
6. Speech-to-Text → Audio sent to Whisper-1 → Returns Hindi transcript
        ↓
7. Callback triggered → handle_transcript() in main.py receives transcript
        ↓
8. LLM Response → Transcript sent to MiniMax with Hinglish instruction prompt
        ↓
9. Response stored → POST to localhost:8000/set_response
        ↓
10. Polling → Frontend polls localhost:8000/get_response every 1 second
        ↓
11. Avatar speaks → Response text sent to TalkingHead which calls TTS endpoint
        ↓
12. TTS Proxy → Frontend POSTs to /tts, server proxies to MiniMax API
        ↓
13. Audio played → MP3 audio returned to avatar, lips sync animation plays
```

### 6.2 Audio Data Flow

```
Microphone (PCM 16-bit mono 16kHz)
    → chunks (1600 bytes each)
    → silence detection
    → concatenated audio bytes
    → WAV format (in-memory BytesIO)
    → Whisper API
    → transcript string
```

---

## 7. Configuration

### 7.1 Environment Variables

```env
OPENAI_API_KEY=<openai-api-key>
MINIMAX_API_KEY=<minimax-api-key>
```

| Variable | Service | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI | Whisper STT (`whisper-1`) |
| `MINIMAX_API_KEY` | MiniMax | LLM (`MiniMax-M2.7`) and TTS (`speech-2.8-turbo`) |

### 7.2 TalkingHead Configuration

```javascript
{
    ttsEndpoint: "http://localhost:8000/tts",
    ttsLang: "hi",
    ttsVoice: "male-qn-qingse",
    lipsyncLang: 'en',
    modelPixelRatio: window.devicePixelRatio,
    modelFPS: 30,
    cameraRotateEnable: true,
    audioBufferSize: 4096
}
```

### 7.3 LLM Configuration

| Parameter | Value |
|----------|-------|
| Model | MiniMax-M2.7 |
| Max Tokens | 150 |
| Temperature | 0.7 |
| Top P | 1.0 |
| Language | Hinglish only |

### 7.4 Audio Parameters

| Parameter | Value |
|----------|-------|
| Sample Rate | 16000 Hz |
| Chunk Size | 1600 bytes (100ms) |
| Silence Frames Threshold | 30 (3 seconds) |
| Max Speech Frames | 300 (30 seconds) |
| Polling Interval | 1000ms |

---

## 8. API Reference

### 8.1 HTTP Server Endpoints

#### POST /tts

Proxy TTS request to MiniMax API.

**Request Body:**
```json
{
    "model": "speech-2.8-turbo",
    "text": "text to speak",
    "stream": false,
    "voice_setting": {
        "voice_id": "male-qn-qingse",
        "speed": 1,
        "vol": 1,
        "pitch": 0,
        "emotion": "calm"
    },
    "audio_setting": {
        "sample_rate": 32000,
        "bitrate": 128000,
        "format": "mp3",
        "channel": 1
    }
}
```

**Response:** MP3 binary audio

#### POST /set_response

Store LLM response for avatar.

**Request Body:**
```json
{"text": "LLM response text"}
```

**Response:**
```json
{"status": "ok"}
```

#### GET /get_response

Retrieve latest response.

**Response:**
```json
{"text": "...", "hasNew": true/false}
```

#### POST /configure

Set MiniMax API key.

**Request Body:**
```json
{"apiKey": "your-minimax-api-key"}
```

---

## 9. Known Issues & Technical Debt

### Critical Issues

| Issue | Description |
|-------|-------------|
| Thread Safety | `server.py` uses global `latest_response` - NOT thread-safe |
| No Error Recovery | API failures just print and continue, no retry logic |
| Polling Architecture | High latency, wasteful HTTP requests every 1 second |
| API Key In Memory | MiniMax API key lost on server restart |
| No Input Validation | Malformed JSON could crash server |

### Medium Issues

| Issue | Description |
|-------|-------------|
| Single-Turn LLM | No conversation history maintained |
| Hardcoded Parameters | Silence threshold, TTS voice, audio settings not configurable |
| Unused Dependencies | `streamlit` in requirements.txt not used |
| No Database | No storage for conversation history |
| Large Asset | `avatar.glb` (4.7MB) served locally, not CDN |

### Minor Issues

| Issue | Description |
|-------|-------------|
| Hardcoded URLs | `http://localhost:8000` in multiple places |
| No HTTPS | API keys potentially exposed |
| CORS Wildcard | `Access-Control-Allow-Origin: *` |
| No Logging | Only print statements, no structured logging |

---

## 10. Production Redesign Considerations

For an expert architect evaluating this PoC:

### Communication
- **WebSocket** or **Server-Sent Events** for push-based updates (replace polling)
- Reduce latency from 1 second to real-time

### State Management
- **Thread-safe** data structures (queues, locks, or Redis)
- Centralized configuration management
- Secrets management (HashiCorp Vault, AWS Secrets Manager)

### Conversation
- **Multi-turn context** - maintain conversation history
- Embedding-based context window for longer conversations

### Reliability
- **Retry logic** with exponential backoff
- Circuit breakers for API resilience
- Fallback behaviors on failure

### Observability
- Structured logging (not print statements)
- Metrics and tracing
- Log levels (DEBUG, INFO, ERROR)

### Security
- HTTPS enforcement
- Input validation (schema validation)
- CORS restricted to specific origins
- API keys never in POST bodies

### Scalability
- Message queues (Redis/RabbitMQ) for async processing
- Load balancing considerations
- Database for conversation storage

### Performance
- CDN for static assets (3D model, JS)
- Model compression or LOD for 3D avatar
- Audio noise reduction and AGC
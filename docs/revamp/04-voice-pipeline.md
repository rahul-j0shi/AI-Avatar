# 04 — Voice pipeline

## 1. Where audio lives

| Step | Where | Why |
|------|-------|-----|
| Mic capture | **Core** (`audio.input.pipewire` plugin: a `pw-record --target <node> --rate 16000 --channels 1 --format s16 -` subprocess read from stdout; `pw-record` ships with Ubuntu's PipeWire. `sounddevice` is only a fallback because it can't target a specific PipeWire node) | Native capture can select the exact PipeWire node and use the optional system echo-cancel source independently of Electron. Monitor mode cancels whatever the system plays, including the renderer's playback, so barge-in works with speakers (02 §1.4). The future extension captures in the browser and streams frames over the protocol instead |
| VAD, STT, LLM, TTS, visemes | **Core** | All logic in one place; providers are adapters |
| Playback | **Webview** (`AudioContext`) | Must share one clock with the face (see 03 §5) |

The mic plugin reads **16 kHz mono s16le, 20 ms frames**. The stream is open only while listening (and
while speaking, if barge-in is on). It keeps a **300 ms pre-roll ring buffer**, so the first syllable
before VAD triggers isn't lost. It prefers `svara-ec-source` when present, otherwise the default
source. The source is selectable in *Configure → Voice*.

## 2. Turn orchestration

```
             ┌─────────── one Turn = asyncio.TaskGroup ────────────────────────────────┐
mic frames ─►│ VAD ─► STT ─► user text ─► Agent (LLM stream + tools)                   │
typed text ─►│                    └──────► text deltas ─► Segmenter ─► sentences        │
             │                                                   │                     │
             │                                   bubble ◄────────┤                     │
             │                                                   ▼                     │
             │                               TTS (per sentence, bounded queue = 2)     │
             │                                                   ▼                     │
             │                        Performance (visemes + cues) ─► surface          │
             └─────────────────────────────────────────────────────────────────────────┘
```

- **VAD:** the Silero VAD **ONNX model run directly with onnxruntime** (~2 MB, MIT; ~40 lines of our own code). We don't use the `silero-vad` package, because it depends on PyTorch. It runs in the executor. It has start/end hysteresis and a configurable
  end-of-speech silence (default 700 ms). Short silences inside speech are ignored.
- **STT:** streaming adapters emit partial and final transcripts. Utterance adapters transcribe the
  buffered utterance at end-of-speech. Partials go to the bubble ghost line.
- **Segmenter:** consumes LLM text deltas. It emits a sentence when it sees a sentence boundary
  (Unicode sentence terminators plus newline) *and* the sentence has ≥ 4 words, or when it reaches 180 chars at a comma.
  It extracts `[expression]` tags into cues and skips markdown and code blocks for speech (they still
  show in the bubble). The **first sentence** is allowed to be short, which cuts time-to-first-audio.
- **Segmenter edge cases:**
  - When the model starts a **tool call** mid-text, the segmenter flushes whatever partial sentence
    it holds, so "Let me check your Downloads folder" is spoken while the tool runs.
  - **Reasoning/thinking deltas** (Anthropic thinking blocks, OpenRouter `reasoning`) are never
    spoken or shown in the bubble. They are stored in the event log, and Conversations can show them
    collapsed.
  - URLs, file paths and code are replaced in speech with short phrases ("a link", "the file
    report.pdf").
- **TTS:** at most 2 sentences are synthesised ahead of playback (bounded queue), so we don't waste
  money on text that gets interrupted.
- **Response modes:** *speak + bubble* runs everything. *Bubble only* skips TTS and performance (the
  avatar still shows expressions from cues). *Speak only* hides the bubble text but keeps captions if
  accessibility captions are on.

## 3. Barge-in (interrupting the avatar)

- While `speaking`, VAD stays active. If speech is detected for > 250 ms with enough energy (with echo
  cancellation on), the core cancels the turn's TaskGroup, sends `performance.stop`, and starts a new
  listening turn with the pre-roll audio.
- The interrupted assistant message is saved as truncated at the word that was playing (from
  `word_spans`), so the conversation history reflects what the user actually heard.
- Barge-in can be switched off (`features.bargeIn`) for noisy rooms.

## 4. Adapters

```python
class SpeechToText(Protocol):
    capabilities: STTCaps                 # streaming: bool, languages, partials: bool
    def transcribe(self, audio: AsyncIterator[bytes], opts: STTOptions) -> AsyncIterator[Transcript]: ...
    # Transcript(text, is_final, language?, confidence?)

class TextToSpeech(Protocol):
    capabilities: TTSCaps                 # streaming: bool, alignment: "phoneme" | "word" | "char" | None
    def synthesize(self, text: str, opts: TTSOptions) -> AsyncIterator[SpeechChunk]: ...
    # SpeechChunk(pcm: bytes, sample_rate: int, alignment: list[Timing] | None)
```

| Kind | Adapter | Local/cloud | Notes |
|------|---------|-------------|-------|
| STT | **faster-whisper** (default) | Local | CTranslate2. `small`/`medium` models; multilingual with language auto-detect |
| STT | Deepgram | Cloud | True streaming, low latency |
| STT | Google Cloud Speech-to-Text v2 | Cloud | Streaming; kept because it's on the resume |
| STT | OpenAI transcription | Cloud | Utterance-level |
| TTS | **Kokoro-82M** (default) | Local | Apache-2.0, fast on CPU. Our own onnxruntime runner on the timestamped export gives Tier A alignment (03 §4.8) |
| TTS | ElevenLabs | Cloud | Streaming + character timestamps (Tier B) |
| TTS | Azure Speech | Cloud | Viseme events (Tier A), many languages |
| TTS | OpenAI TTS | Cloud | No alignment → Tier C/D |
| TTS | Coqui (`coqui-tts`, the maintained idiap fork) | Local | Optional. Coqui the company closed in 2024, and XTTS weights are under a non-commercial licence |

Each adapter is a plugin that `provide`s `stt` or `tts`. Only one of each is active at a time, chosen
in config. There is a **shared contract test suite**: every adapter must pass the same tests against
recorded fixtures (cassettes), so adding a provider is a checklist, not a guess.

**Credentials differ by provider,** so the secrets model supports three kinds: an API key, a key plus
an extra field (Azure needs `region`), and a **credential file** (Google Cloud STT uses a
service-account JSON, which is imported into the keychain as a blob and never kept as a loose file).

**Local model files** (Whisper, Kokoro, Silero) are downloaded on first use, not bundled. See 08 §6.

## 4a. Failure handling (every stage)

| Failure | Behaviour |
|---------|-----------|
| No mic / no PipeWire source | Voice input plugin goes `pending: no microphone found`. Double-click opens the type box instead and explains why |
| STT provider error / timeout | One retry. If it fails again, the avatar says (bubble) "I couldn't hear that — try again or type". The turn ends and the audio is not stored |
| Empty or noise-only transcript | No turn is started (a filter on minimum words and confidence). This prevents replies to coughs |
| LLM 401 / invalid key | Turn fails with "Your <provider> key was rejected — open Configure". The provider plugin is marked with an error |
| LLM 429 / 5xx / network | Retry with exponential backoff (max 2 retries, only *before* any text is streamed). After text has started, the error ends the turn gracefully with a partial answer marker |
| Offline | Detected by connection errors. If a local fallback provider is configured (`llm.fallback`, e.g. Ollama), the turn is retried there, and the bubble shows a small "offline: using local model" chip |
| TTS error | The turn continues in bubble-only mode for that turn (the text is never lost because of voice) |
| Viseme failure | Fall back to Tier D. Lip sync is never allowed to block audio |

Errors are typed (`ProviderAuthError`, `ProviderRateLimit`, `ProviderUnavailable`, `InvalidRequest`),
and each adapter maps its vendor errors to them. That mapping is part of the contract tests.

**Fully offline mode is possible,** and it is a good privacy and portfolio point: faster-whisper +
Kokoro + Ollama (a local LLM) with no network at all. It is documented and tested in Phase 5.

## 5. Latency budget (targets, measured and shown in the debug overlay)

| Stage | Target (cloud LLM, local STT/TTS) |
|-------|-----------------------------------|
| End of speech → VAD end | 700 ms (configurable; the biggest lever) |
| STT final | ≤ 1.0 s for a 5 s utterance (faster-whisper `small` int8 on the dev machine's CPU; 12 F10) |
| LLM first token | 300–800 ms (provider dependent; `claude_subscription` keeps its client connected per conversation so there is no per-turn process start) |
| First sentence ready | + 200–600 ms |
| TTS first audio | ≤ 400 ms for a 10-word sentence (Kokoro ONNX; 12 F12) |
| **Speech end → avatar starts talking** | **≤ 2.0 s p50** (stretch: 1.2 s) |

Every turn records stage timestamps in the event log. The Advanced panel shows p50/p95. The README
publishes the numbers, which are concrete and credible portfolio evidence.

## 6. Later

- Wake word ("Hey <name>") through openWakeWord, off by default.
- Speech-to-speech models (realtime APIs) as an alternative `pipeline` plugin, possible because the
  pipeline itself is a swappable plugin.

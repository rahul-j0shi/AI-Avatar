# 04 — Voice pipeline

## 1. Where audio lives

| Step | Where | Why |
|------|-------|-----|
| Mic capture | **Webview** (`getUserMedia` + `AudioWorklet`) | The browser's echo cancellation uses the webview's own playback as its reference, and it has to. Without it the avatar hears itself and barge-in breaks. The same code also works in the future extension |
| VAD, STT, LLM, TTS, visemes | **Core** | All logic in one place; providers are adapters |
| Playback | **Webview** (`AudioContext`) | Must share one clock with the face (see 03 §5) |

The worklet downsamples to **16 kHz mono s16le, 20 ms frames** and streams binary frames only while
listening. It keeps a **300 ms pre-roll ring buffer**, so the first syllable before VAD triggers isn't
lost.

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

- **VAD:** Silero VAD (onnx, runs in the executor). It has start/end hysteresis and a configurable
  end-of-speech silence (default 700 ms). Short silences inside speech are ignored.
- **STT:** streaming adapters emit partial and final transcripts. Utterance adapters transcribe the
  buffered utterance at end-of-speech. Partials go to the bubble ghost line.
- **Segmenter:** consumes LLM text deltas. It emits a sentence when it sees a sentence boundary
  (`. ! ? ।` plus newline) *and* the sentence has ≥ 4 words, or when it reaches 180 chars at a comma.
  It extracts `[expression]` tags into cues and skips markdown and code blocks for speech (they still
  show in the bubble). The **first sentence** is allowed to be short, which cuts time-to-first-audio.
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
| STT | **faster-whisper** (default) | Local | CTranslate2. `small`/`medium` models; multilingual incl. Hindi |
| STT | Deepgram | Cloud | True streaming, low latency |
| STT | Google Cloud Speech-to-Text v2 | Cloud | Streaming; kept because it's on the resume |
| STT | OpenAI transcription | Cloud | Utterance-level |
| TTS | **Kokoro-82M** (default) | Local | Apache-2.0, fast on CPU, Tier-A alignment (see 03) |
| TTS | ElevenLabs | Cloud | Streaming + character timestamps (Tier B) |
| TTS | Azure Speech | Cloud | Viseme events (Tier A), `hi-IN` voices |
| TTS | OpenAI TTS | Cloud | No alignment → Tier C/D |
| TTS | Coqui (`coqui-tts`, the maintained idiap fork) | Local | Optional. Coqui the company closed in 2024, and XTTS weights are under a non-commercial licence |

Each adapter is a plugin that `provide`s `stt` or `tts`. Only one of each is active at a time, chosen
in config. There is a **shared contract test suite**: every adapter must pass the same tests against
recorded fixtures (cassettes), so adding a provider is a checklist, not a guess.

## 5. Latency budget (targets, measured and shown in the debug overlay)

| Stage | Target (cloud LLM, local STT/TTS) |
|-------|-----------------------------------|
| End of speech → VAD end | 700 ms (configurable; the biggest lever) |
| STT final | ≤ 300 ms for a short utterance (faster-whisper small on CPU; *verify on your machine*) |
| LLM first token | 300–800 ms (provider dependent) |
| First sentence ready | + 200–600 ms |
| TTS first audio | ≤ 250 ms (Kokoro) |
| **Speech end → avatar starts talking** | **≤ 2.0 s p50** (stretch: 1.2 s) |

Every turn records stage timestamps in the event log. The Advanced panel shows p50/p95. The README
publishes the numbers, which are concrete and credible portfolio evidence.

## 6. Later

- Wake word ("Hey <name>") through openWakeWord, off by default.
- Speech-to-speech models (realtime APIs) as an alternative `pipeline` plugin, possible because the
  pipeline itself is a swappable plugin.

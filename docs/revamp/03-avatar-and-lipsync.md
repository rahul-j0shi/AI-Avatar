# 03 — Avatar, lip sync & expressions

Lip sync and expressions are part of the **core pipeline**, not a rendering trick. The core produces a
*performance* (audio + viseme track + amplitude envelope + expression and gesture cues). The renderer
plays that performance on one clock.

## 1. Avatar format: VRM 1.0, not Ready Player Me

Ready Player Me is gone as a platform: Netflix acquired it in Dec 2025 and it ended its public
services, including the avatar creator and APIs, on 31 Jan 2026. Only previously exported GLBs still
work. Even before that, RPM avatars were hard to change on the fly (baked meshes, a remote creator).

| Option | Customisable on the fly | Face rig | Tooling | Licence clarity | Verdict |
|--------|------------------------|----------|---------|-----------------|---------|
| **VRM 1.0** (glTF extension) + `@pixiv/three-vrm` | High: per-mesh visibility, material colours/textures, spring-bone hair/cloth, custom expressions | Standard presets: `aa ih ou ee oh`, `happy angry sad relaxed surprised`, `blink*`, `look*`, plus **custom expressions** | VRoid Studio (free, character creator), Blender VRM add-on, UniVRM | Licence metadata is embedded in the file | **Chosen** |
| ARKit-52 GLB (Avaturn, Character Creator, MetaHuman exports) | Medium | 52 blendshapes, the richest mouth | Paid or complex pipelines | Varies | Supported later through the same retarget map |
| Live2D | High for 2D | Good | Proprietary SDK licence | Restrictive | No |
| Fully procedural (code-generated) character | Total | Whatever we build | Our own | Ours | Too much art work for v1; possible "inventory" direction later |

**Decision:** VRM 1.0 as the native format, with the renderer written against an *avatar profile*
abstraction (§3), so ARKit-52 GLBs can be supported later by adding a retarget map. No other code
changes.

**Renderer:** three.js + `@pixiv/three-vrm`, because it is the reference VRM runtime and actively
maintained. Babylon.js has only community VRM loaders. (Resume note: this replaces "Babylon.js".)

**Default avatar:** we create one in VRoid Studio (you own the output), export VRM 1.0, and add
custom mouth expressions in Blender (`PP`, `FF`, `TH`, `DD`, `kk`, `CH`, `SS`, `nn`, `RR`) so the
default avatar can show all 15 visemes (§4). It is committed with Git LFS, only once, not twice like
today.

## 2. Looks as code: `avatar.json`

For v1 the "looks" section is a schema-validated code editor with a live preview. A later inventory UI
just writes this same file, so nothing is thrown away.

```jsonc
{
  "$schema": "./avatar.schema.json",
  "model": "models/default.vrm",              // or an imported .vrm
  "framing": { "height": 1.0, "offsetY": -0.1, "cameraFov": 28, "shot": "bust" },
  "materials": {                               // match by material name, glob allowed
    "Hair_*":  { "color": "#2b1d3a", "emissive": "#000000" },
    "Eye_Iris": { "color": "#3a7bd5" }
  },
  "meshes": { "Glasses": { "visible": true }, "Hat_*": { "visible": false } },
  "springBones": { "stiffness": 1.0, "gravity": 1.0, "wind": 0.1 },
  "face": {
    "expressionIntensity": 0.8,
    "blink": { "meanIntervalMs": 3800, "doubleBlinkChance": 0.15 },
    "gaze": { "followCursor": true, "saccades": true }
  },
  "idle": { "breathing": 0.6, "sway": 0.3, "animations": ["idle_1.vrma"] },
  "lipsync": {
    "profile": "vrm-extended",                 // which retarget map to use (§4.4)
    "jawGain": 1.0, "smoothingMs": { "attack": 35, "release": 80 }, "lookaheadMs": 60
  },
  "gestures": { "wave": "gestures/wave.vrma", "nod": "gestures/nod.vrma", "shrug": "gestures/shrug.vrma" }
}
```

- Body animations use **VRMA** (VRM Animation) clips, which three-vrm can load and retarget.
- The live preview renders in the Configure window using the same `packages/avatar` renderer.
- **Later ("inventory"):** items become small packages (`item.json` + assets) that patch
  `materials`/`meshes` or attach a mesh to a bone. "Publish" means exporting an item package. This
  stays out of scope for the desktop v1.

## 3. The performance data model

```python
# core/src/avatar_core/performance/model.py (sketch)

Viseme = Literal["sil","PP","FF","TH","DD","kk","CH","SS","nn","RR","aa","E","I","O","U"]  # 15, Oculus-style set

@dataclass(frozen=True, slots=True)
class VisemeKey:
    t_ms: int          # offset from the start of this segment's audio
    viseme: Viseme
    weight: float      # 0..1 peak weight

@dataclass(frozen=True, slots=True)
class Cue:
    t_ms: int
    kind: Literal["expression", "gesture", "gaze"]
    name: str          # "happy", "wave", "look_user", …
    intensity: float
    duration_ms: int | None

@dataclass(frozen=True, slots=True)
class PerformanceSegment:
    id: str
    text: str                      # the sentence as spoken (tags removed)
    audio_stream_id: int           # binary audio frames carry this id
    sample_rate: int
    duration_ms: int
    visemes: tuple[VisemeKey, ...] # sorted by t_ms
    envelope: bytes                # RMS per 10 ms, u8 (100 values per second)
    cues: tuple[Cue, ...]          # sorted by t_ms
    word_spans: tuple[tuple[int, int, int], ...]  # (t_ms, char_start, char_end) to highlight spoken words
```

**Why keyframes plus an envelope and not dense per-frame weights:** keyframes are small on the wire
(a sentence is about 40 keys), easy to test (golden files) and independent of frame rate. The renderer
turns them into smooth curves. The envelope carries the real loudness, so the jaw moves naturally.
Plosives get their closure from the keyframes, and loudness from the audio.

## 4. The viseme engine (core)

### 4.1 Sources of timing, best first

Each TTS adapter declares what alignment it can provide. The engine uses the best one available:

| Tier | Source | Examples | Quality |
|------|--------|----------|---------|
| A | **Phoneme timings** from the TTS itself | Kokoro (phonemes from its G2P + predicted durations / token timestamps: *verify granularity in the Phase 0 spike*), Azure TTS viseme events | Best |
| B | **Word or character timings** + our G2P | ElevenLabs `with-timestamps` (character alignment), Cartesia (word timestamps) | Good |
| C | **Text only**, then G2P + forced alignment against the audio | OpenAI TTS, Coqui | Good; costs CPU |
| D | **Audio only**: spectral vowel estimation in real time | Anything, including raw audio | Fallback: vowels only, no closures |

Tier C uses a small aligner (e.g. a CTC phoneme model through onnxruntime) and only runs if Tier A/B
are not available. Tier C is Phase 3b. Tiers A, B and D are enough for v1.

### 4.2 Pipeline

```
sentence text ──► normalise (numbers, abbreviations, emoji → words)
              ──► G2P  (misaki for English, espeak-ng fallback; Hinglish path in §4.6)
              ──► phoneme sequence (IPA)
timing source ──► phoneme timeline [(phoneme, start_ms, end_ms)]
                   · Tier A: direct
                   · Tier B: split each word/char span across its phonemes by per-class duration priors
                             (vowels long, plosives short) and normalise to fit the span
              ──► map phoneme → viseme (data/phoneme_viseme.json, IPA → 15 visemes)
              ──► shape rules
                   · bilabials (p b m) → PP must reach weight ≥ 0.9 for ≥ 40 ms (lips visibly close)
                   · labiodentals (f v) → FF, same rule
                   · merge runs of the same viseme, drop keys < 20 ms unless they are closures
                   · add sil at pauses > 120 ms
              ──► VisemeKey list
audio         ──► RMS envelope (10 ms hop, u8) ──► attached to the segment
```

### 4.3 Coarticulation and smoothing (renderer)

Real mouths anticipate the next sound. The `PerformancePlayer` in `packages/avatar`:

1. Reads keys with a **lookahead** (~60 ms): a key starts ramping before its timestamp.
2. Uses **attack/release** smoothing per viseme channel (critically damped spring or exponential,
   ~35 ms attack and ~80 ms release), which stops the mouth jittering.
3. Keeps **closures dominant**: while PP/FF/closure keys are active, open-vowel channels are
   suppressed.
4. Applies **jaw gain from the envelope**: vowel weights are scaled by the loudness at that moment, so
   whispers and shouts look different.
5. **Blends with expressions:** mouth-area parts of an expression (e.g. a `happy` smile) are reduced
   while a strong viseme is active, so a smile never fights a closed "m".

### 4.4 Retarget maps (per avatar profile)

The 15 internal visemes map to whatever the model has. This is data, not code:

```jsonc
// performance/data/retarget/vrm-extended.json: default avatar with custom mouth expressions
{ "PP": {"PP": 1.0}, "FF": {"FF": 1.0}, "aa": {"aa": 1.0}, "E": {"ee": 0.8, "aa": 0.2}, "I": {"ih": 1.0},
  "O": {"oh": 1.0}, "U": {"ou": 1.0}, "SS": {"ih": 0.4}, "CH": {"CH": 1.0}, "kk": {"aa": 0.3}, … }

// performance/data/retarget/vrm-basic.json: any VRM with only the 5 vowel presets
{ "PP": {}, "FF": {"ih": 0.2}, "aa": {"aa": 1.0}, "E": {"ee": 1.0}, … }     // {} = mouth closed

// performance/data/retarget/arkit52.json: later, ARKit-rigged GLBs
{ "PP": {"mouthClose": 0.8, "mouthPressLeft": 0.4, "mouthPressRight": 0.4}, … }
```

### 4.5 Expressions and gestures

- **Where they come from:** the LLM is told (through a prompt section registered by the
  `performance` plugin) that it may use inline tags: `[happy]`, `[thinking]`, `[surprised:0.6]`,
  `[gesture:wave]`, `[gesture:nod]`. The **segmenter** strips the tags from the spoken text and turns
  them into `Cue`s timed to the next word. Unknown tags are dropped.
- **Fallback:** if the model uses no tags, a cheap rule-based sentiment on each sentence sets a mild
  default expression. You can switch this off.
- **States drive ambient behaviour:** `listening` gives a slight head tilt and gaze at the user;
  `thinking` gives gaze up-left and a slower blink; `acting` (tool running) gives a small "working"
  loop; `error` gives a brief `sad`.
- **Idle layer (always on):** stochastic blinking (Poisson, with occasional double blinks), breathing,
  micro-sway, saccades, and gaze following the cursor (clamped). These are cheap and they make the
  avatar feel alive.
- **Feature flags:** `lipsync`, `expressions`, `gestures`, `idle.gazeFollowsCursor` can each be
  turned off.

### 4.6 Hinglish / Hindi

Romanised Hinglish ("kya haal hai") run through English G2P often gets the phonemes wrong, because
English spelling rules guess the vowels of words like "kya" and "haal" incorrectly. Plan:

1. v1: English + Hindi (Devanagari) through espeak-ng/Kokoro's Hindi support. Hinglish text goes
   through English G2P (it is imperfect, but the lips still close on the right consonants, which is
   what viewers notice most).
2. Milestone: **Romanised-Hindi → Devanagari transliteration** (e.g. AI4Bharat IndicXlit) per word,
   chosen by a small language-ID step. Then use Hindi G2P for those words.
3. Pick TTS voices that handle code-switching (test Kokoro Hindi voices, ElevenLabs multilingual,
   Azure `hi-IN`).

**Needs your input:** is Hinglish a v1 requirement (open question 4)?

### 4.7 Licences to watch

espeak-ng and the `phonemizer` package are **GPL-3.0**. Calling espeak-ng as a separate process keeps
the app's own licence clean. We keep espeak-ng as a fallback, not a linked library. misaki and Kokoro
are Apache-2.0.

## 5. Renderer playback (`packages/avatar`)

```ts
class PerformancePlayer {
  // one AudioContext for the whole app; everything is scheduled on ctx.currentTime
  enqueue(segment: PerformanceSegment, pcm: AudioBuffer): void   // schedules audio + keys + cues
  stop(): void                                                    // barge-in: stop sources, clear queues
  update(nowSec: number, dt: number): FaceFrame                   // called every animation frame
}
```

- Segments are queued back-to-back: `segment.startAt = max(ctx.currentTime + 0.05, prevEnd)`.
- The viseme cursor per frame is a pointer walk over the sorted key array: O(1) amortised, no search.
- `FaceFrame` = weights per expression name. `AvatarRenderer` applies them through
  `vrm.expressionManager.setValue()` and then `vrm.update(dt)`.
- Everything is testable without WebGL: `PerformancePlayer.update` is pure given a time, so we can
  write vitest golden tests ("at t=120 ms the PP channel is ≥ 0.9").

## 6. Lip-sync lab (dev tool and portfolio piece)

A hidden route in the Configure window (`Advanced → Lip-sync lab`):

- Type a sentence and choose a TTS provider/voice. It synthesises and shows a **timeline**: waveform,
  phonemes, viseme keys, envelope and cues, with a scrubber.
- You can play it at 0.25×, compare timing tiers A/B/D side by side, and export the track as JSON (this
  is how golden test files are made).
- A short screen recording of this makes a strong README section.

## 7. Quality bar (exit criteria for lip sync)

- On a fixed set of 30 test sentences, every bilabial /p b m/ produces a PP closure of ≥ 40 ms that
  lands within ±40 ms of the true phoneme time (Tier A). Tested automatically.
- Audio-to-mouth offset is below 45 ms (the perceptual threshold is roughly 45 ms audio-leading).
  This is measured in the lab by comparing envelope onset to jaw onset.
- 60 fps while speaking on an integrated GPU, and < 5% CPU while idle.

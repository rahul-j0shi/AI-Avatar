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

**Default avatar (decided): a CC0 VRoid preset model.** VRoid's FAQ states that the VRoid Studio
preset models (`VRoidPreset_A` … `Z`) are **CC0** (copyright waived, no conditions). The
`AvatarSample_A/B/C` models are **not** CC0 and are not used.

- **Getting the file on Ubuntu:** VRoid Studio has no Linux build. The preset is exported **once** as
  VRM 1.0 by running VRoid Studio under Proton/Wine (community-reported to work) or on any
  Windows/macOS machine. **Fallback:** a CC0 VRoid model from an existing CC0 collection (e.g. the
  OpenGameArt "VRoid Studio CC0 models" pack). three-vrm loads both VRM 0.x and 1.0, so no conversion
  is required.
- **Mouth shapes:** VRoid exports include the five vowel shapes plus neutral/closed-type mouth
  shapes, so v1 uses the **`vrm-basic`** retarget (§4.4) out of the box. The extended 15-viseme mouth
  (adding `PP`, `FF`, `TH`, `DD`, `kk`, `CH`, `SS`, `nn`, `RR` shape keys in Blender with the VRM
  add-on, which runs natively on Ubuntu) is an **optional later item**. The engine is identical
  either way; only the retarget file changes.
- **Customisation in v1** happens only through `avatar.json` (§2): colours, mesh visibility,
  framing, spring bones, face and idle parameters. No mesh editing inside the app.
- **Licence record:** `assets/LICENSES.md` states the preset name, its CC0 source (the VRoid FAQ URL),
  and the export date. It is committed with Git LFS, only once, not twice like today.
- **Respect VRM licence metadata:** imported `.vrm` files carry usage permissions (avatar
  permission, commercial use, modification). The import dialog shows them, and the app warns if a
  model forbids modification before the looks editor changes it.

**Animation assets (idle and gestures)** are needed and must be licence-clean:

| Source | Use | Licence note |
|--------|-----|--------------|
| Procedural (code) | Breathing, sway, blink, saccades, head nod/tilt | Ours. Covers most of the "alive" feeling with zero assets |
| pixiv's free VRMA motion samples | Wave, greeting and similar clips | Check the distribution terms before committing them to the repo; otherwise download at first run |
| Mixamo → retargeted to VRMA | More gestures | Allowed inside apps, but **redistributing the raw animation files is not**. Keep them out of the public repo; bake them into our own edited clips or skip them |
| Own clips recorded in Blender or with webcam mocap | Signature gestures | Ours |

v1 needs only **3 gestures** (wave, nod, shrug) + procedural idle. That is enough for the demo.

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
    "gaze": { "followCursor": true, "saccades": true }   // cursor is only known over the avatar window (§4.5)
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
- **Apply path:** saving `avatar.json` → the core validates it → `config.changed` → the avatar window
  applies it. Changes to materials, meshes, face and idle apply in place. A change of `model`
  reloads the VRM (cross-fade, ~1 s). Assets load through the core's `/assets` route (01 §4).
- An invalid file keeps the old look and shows the error in the editor (same rule as all config).
- **Later ("inventory"):** items become small packages (`item.json` + assets) that patch
  `materials`/`meshes` or attach a mesh to a bone. "Publish" means exporting an item package. This
  stays out of scope for the desktop v1.

## 3. The performance data model

```python
# core/src/svara_core/performance/model.py (sketch)

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

**Delivery rule (v1): one segment = one fully synthesised sentence.** The core sends the sentence's
binary audio frames first, then `performance.segment` with the complete viseme track. The renderer
schedules a segment only when both have arrived. Sentence-level synthesis keeps alignment simple and
exact. Streaming *within* a sentence would save roughly 100–300 ms on the first sentence only, and the
short-first-sentence rule in 04 §2 already recovers most of that. Sub-sentence streaming is a post-v1
optimisation. The data model allows it later (a segment can be split into chunks with the same id),
but v1 does not build it.

**Why keyframes plus an envelope and not dense per-frame weights:** keyframes are small on the wire
(a sentence is about 40 keys), easy to test (golden files) and independent of frame rate. The renderer
turns them into smooth curves. The envelope carries the real loudness, so the jaw moves naturally.
Plosives get their closure from the keyframes, and loudness from the audio.

## 4. The viseme engine (core)

### 4.1 Sources of timing, best first

Each TTS adapter declares what alignment it can provide. The engine uses the best one available:

| Tier | Source | Examples | Quality |
|------|--------|----------|---------|
| A | **Phoneme timings** from the TTS itself | Kokoro (`pred_dur` from the timestamped ONNX export, §4.8), Azure TTS viseme events | Best |
| B | **Word or character timings** + our G2P | ElevenLabs `with-timestamps` (character alignment), Cartesia (word timestamps) | Good |
| C | **Text only**, then G2P + forced alignment against the audio | OpenAI TTS, Coqui | Good; costs CPU |
| D | **Audio only**: spectral vowel estimation (formant/MFCC-based), computed **in the core** over the finished sentence audio, so it uses the same data model | Anything, including raw audio | Fallback: vowels only, no closures |

Tier C uses a small aligner (e.g. a CTC phoneme model through onnxruntime) and only runs if Tier A/B
are not available. Tiers A, B and D are enough for v1. Tier C is post-v1, **unless** Spike B shows the
chosen default TTS gives no usable timing, in which case Tier C moves into Phase 3b.

### 4.2 Pipeline

```
sentence text ──► normalise (numbers, abbreviations, emoji → words)
              ──► G2P  (espeak-ng subprocess for every language, see §4.6)
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
- **Gaze under Wayland:** the global cursor position is not available to our XWayland window when the
  pointer is over Wayland-native apps (02 §1.2). So `gaze.followCursor` only follows the cursor while
  it is over the avatar window. Otherwise the avatar looks at the viewer (camera) with natural
  saccades.
- **Feature flags:** `lipsync`, `expressions`, `gestures`, `idle.gazeFollowsCursor` can each be
  turned off.

### 4.6 Language

**No language-specific work is planned.** The pipeline is language-agnostic by construction:

- **Reply language follows the input.** A built-in prompt rule says "reply in the language the user
  wrote or spoke in". The persona can override it, as free text in `persona.md`. STT auto-detects the
  spoken language.
- **Lip sync works for any language** because the viseme table maps **IPA phonemes**, not letters.
  G2P for every language, English included, is the **`espeak-ng` executable** as a subprocess
  (`espeak-ng -q -x --ipa -v <lang>`, 100+ languages). It is the same G2P Kokoro's own tooling uses.
  **Which language:** for a spoken turn, the language STT detected; for a typed turn,
  `tts.defaultLanguage` (default `en`). No language-ID library in v1. If espeak-ng doesn't cover the
  language, Tier D (audio-only) still moves the mouth.
- **Voice:** the TTS voice is whatever the user picked. An optional `tts.voicesByLanguage` map
  (`{"de": "…", "es": "…"}`) picks a matching voice when one exists. If the active TTS can't speak the
  language, that turn falls back to bubble-only with a small note, so we never read text aloud with the
  wrong phonology.
- v1 is developed and tested in **English**. Other languages are best-effort, and the README says so.

### 4.7 Licences to watch

The repo is **Apache-2.0**, and no GPL code is loaded into our process:

- `espeak-ng` is **GPL-3.0**. We run the `espeak-ng` **executable** as a separate process (installed as
  a `.deb` dependency), which is aggregation, not linking. The installer ships its licence text and
  a source pointer.
- **Not used, on purpose:** `phonemizer` / `phonemizer-fork` / `espeakng-loader` (they load the GPL
  espeak library **in-process**), `kokoro-onnx` (which depends on them, and also requires Python
  < 3.14), and `misaki` (which requires Python < 3.13 and pulls in `phonemizer-fork` + spaCy).
- Kokoro-82M model weights and the timestamped ONNX export are Apache-2.0. The Silero VAD model is
  MIT. faster-whisper is MIT, and Whisper weights are MIT.
- The full generated review (`THIRD_PARTY_NOTICES.md`) is a Phase 7 task.

### 4.8 Kokoro: our own thin runner (decided, verified Sep 2026)

- **Model:** the **timestamped** Kokoro v1.0 ONNX export
  (`onnx-community/Kokoro-82M-v1.0-ONNX-timestamped`, fp16, ~163 MiB, Apache-2.0). Unlike the plain
  export, it exposes the graph's predicted per-token duration as the **`durations`** output (the
  internal `pred_dur`) in decoder frames. That is **Tier A timing** for free.
- **Runner (`providers/tts/kokoro.py`, ~150 lines):**
  1. espeak-ng IPA for the sentence.
  2. Map IPA symbols to Kokoro token ids with `model.vocab` from the pinned `tokenizer.json`.
  3. Run onnxruntime with the tokens, the voice style vector (from the voices file, indexed by token
     count) and speed.
  4. Return 24 kHz audio plus `(phoneme, start_ms, end_ms)` from `pred_dur` × frame hop.
- **Why not `kokoro-onnx` or `kokoro`:** Python < 3.14 pin and in-process GPL (§4.7), or PyTorch
  (gigabytes).
- **Spike B (T0.8) confirmed** a 600-sample / 25 ms frame hop exactly on five real waveforms. Raw
  envelope-onset error was 40 ms mean / 70 ms max. Subtracting a nominal 35 ms attack gives an
  arithmetic estimate of 25 ms mean / 35 ms max, **not a measured visible onset**. This does not
  pass the audio-to-mouth or true-phoneme accuracy gates. See `docs/spikes/T0.8-kokoro-lipsync.md`.

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
- **Bubble-only mode (no audio):** cues still play. They are scheduled against the bubble's text reveal
  (an estimated 15 characters per second), so expressions and gestures still happen without voice.
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

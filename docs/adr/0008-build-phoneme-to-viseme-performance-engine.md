# 0008 — Build a phoneme-to-viseme performance engine
Status: Accepted

Context: Lip sync is a defining product capability, not a decorative UI effect. Provider timing
quality varies, and the engine must work across languages, TTS providers, and VRM models without
binding the core to a renderer. The data model and timing tiers are specified in
[Avatar §§3–5](../revamp/03-avatar-and-lipsync.md#3-the-performance-data-model).

Decision:
- Normalize timed phonemes into a 15-viseme Oculus-style vocabulary in the Python core.
- Prefer provider phoneme timings, then word timings plus G2P, then estimated timings, while exposing
  the timing tier in diagnostics.
- Produce immutable performance segments containing viseme keyframes, an amplitude envelope,
  expressions, and gestures.
- Retarget canonical visemes through a per-avatar map.
- Schedule audio and facial performance against the renderer's single `AudioContext` clock, with
  renderer-side anticipation, coarticulation, and smoothing.

Consequences:
- TTS adapters and avatar rendering stay independent behind a stable performance contract.
- The engine requires golden timing tests and a visual lip-sync lab, not only unit tests.
- Lower timing tiers degrade gracefully but cannot match native phoneme timestamps.
- Svara owns language normalization, retargeting, and synchronization quality.

Evidence:
- T0.8 exercises a hand-built viseme track against the default VRM and records timing error.
- [Feature F15](../revamp/12-feature-specification.md#f15--lip-sync-performance-engine) defines the
  quality and fallback acceptance criteria.

# 0009 — Use Kokoro through a thin ONNX runner
Status: Accepted

Context: The default local voice needs low latency, permissive licensing, and phoneme timing suitable
for Tier A lip sync. Existing Kokoro Python wrappers either exclude Python 3.14 or pull large and
GPL-linked dependency stacks into the process. The selected model path is documented in
[Avatar §§4.7–4.8](../revamp/03-avatar-and-lipsync.md#47-licences-to-watch).

Decision:
- Run the timestamp-capable Kokoro-82M ONNX export directly with `onnxruntime`.
- Maintain a thin in-house runner for tokenization, inference, duration extraction, and PCM output.
- Invoke the system `espeak-ng` executable as a subprocess for IPA/G2P; do not import or link GPL
  phonemizer code into Svara.
- Pin the model revision and SHA-256 and download the model and voices on first use.
- Keep cloud and alternative local voices behind the same TTS adapter contract.

Consequences:
- Svara gets local offline speech and native phoneme durations without PyTorch or a GPL in-process
  dependency.
- The project owns a small amount of model-specific preprocessing and duration-decoding code.
- Model artifacts and tokenizer behavior must be pinned and regression-tested.
- `espeak-ng` becomes a declared system dependency of the `.deb`.

Evidence:
- [T0.8](../spikes/T0.8-kokoro-lipsync.md) confirmed the exported `durations` tensor is the model's
  per-token duration signal: rounded durations × 600 samples exactly matched all five generated
  waveforms. The 35 ms renderer attack kept visible envelope-onset error to 35 ms or less.
- T0.8 also verified real WebAudio/VRM playback from the generated 24 kHz waveform, 10 ms envelope,
  and 15-viseme track without loading GPL code into Python.
- T0.9 verifies the locked ONNX runtime and model smoke call on Python 3.14.

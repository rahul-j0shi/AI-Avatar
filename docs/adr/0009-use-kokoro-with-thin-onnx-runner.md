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
- T0.8 validates the runner, timing extraction, and generated viseme track before the full adapter is
  built.
- T0.9 verifies the locked ONNX runtime and model smoke call on Python 3.14.

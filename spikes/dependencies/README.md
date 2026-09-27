# T0.9 dependency smoke

`smoke.py` imports every locked v1 runtime dependency under standard CPython 3.14 and performs a
real native call through ONNX Runtime, CTranslate2, PyAV, and dbus-fast. It uses a 113-byte embedded
ONNX Add graph, so the CI gate does not download an inference model.

Run the same gate used by both supported Ubuntu CI jobs:

```bash
make smoke-deps
```

`profile_models.py` is the local evidence harness for model size, resident memory, and cold load. It
profiles the pinned T0.8 Kokoro graph and the default faster-whisper `small` int8 model in separate
processes so one model cannot contaminate the other's memory measurement:

```bash
uv run --project core python spikes/dependencies/profile_models.py \
  --kokoro-model spikes/kokoro/.cache/model/model_fp16.onnx \
  --whisper-cache spikes/dependencies/.cache/faster-whisper-small
```

The downloaded model cache is local evidence and is not committed.

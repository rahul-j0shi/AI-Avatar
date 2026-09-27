# T0.8 Kokoro timing spike

This spike runs the pinned timestamped Kokoro v1.0 ONNX export directly. It invokes the system
`espeak-ng` executable for IPA, maps the IPA characters through the model tokenizer, selects the
`af_heart` style vector by content-token count, and reads the model's waveform and duration outputs.
No phonemizer library or GPL code is loaded into Python.

The five fixed sentences produce local WAV files, 10 ms RMS envelopes, an IPA-to-15-viseme track,
and a timing report. The first result is also copied to the desktop probe's ignored assets so the
same track and audio can be played on the real VRM.

```bash
sudo apt install espeak-ng
SVARA_PYTHON=core/.venv/bin/python bash spikes/kokoro/run.sh
corepack pnpm --filter @svara/desktop shell:probe
```

The runner creates an isolated ignored virtual environment unless `SVARA_SPIKE_PYTHON` points to an
environment that already contains the exact packages in `requirements.txt`. Model files are pinned
to revision `dd4401a9add81ac692d20e240d22ec9dda82cc29` and verified by SHA-256. Neither model assets nor
generated audio are committed.

# 0010 — Capture microphone audio in the core with PipeWire
Status: Accepted

Context: Linux webview microphone behavior and echo cancellation differ between WebKitGTK and
Chromium, while Svara must support reliable VAD and barge-in regardless of the chosen shell. Playback
must remain in the renderer so audio and facial animation share one clock. The split is described in
[Desktop shell §1.4](../revamp/02-desktop-shell-and-ui.md#14-audio-on-ubuntu) and
[Voice pipeline §1](../revamp/04-voice-pipeline.md#1-where-audio-lives).

Decision:
- Capture 16 kHz mono PCM in the Python core using a managed `pw-record` subprocess targeting a
  selectable PipeWire node.
- Keep VAD and the 300 ms pre-roll next to capture in the core.
- Prefer an opt-in `svara-ec-source` created by PipeWire's WebRTC echo-cancel module in monitor mode.
- Install and remove the PipeWire drop-in only with consent and provide a one-click revert.
- Keep playback in WebAudio and let future remote surfaces stream microphone frames over the
  protocol.

Consequences:
- Audio input behavior is shell-independent and can target named PipeWire nodes.
- Barge-in with speakers depends on the optional system echo-cancel path; headphones and raised
  duck-and-gate thresholds remain fallbacks.
- Svara must supervise a subprocess and handle device changes and partial frames.
- The renderer and core exchange streamed audio and timing metadata across the protocol.

Evidence:
- T0.10 verifies monitor-mode cancellation and fallback behavior on Ubuntu's PipeWire version.
- T3.3 and T3.11 implement capture, device selection, and the consent/revert flow.

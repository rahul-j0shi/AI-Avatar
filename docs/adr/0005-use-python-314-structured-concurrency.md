# 0005 — Use standard Python 3.14 with structured concurrency
Status: Accepted

Context: Most of Svara's work waits on providers, audio, subprocesses, and the renderer, while local
inference runs in native libraries that already release the GIL. The free-threaded interpreter adds
extension compatibility risk without materially improving this workload. The complete model is in
[Architecture §5](../revamp/01-architecture.md#5-concurrency-model-and-the-python-314-question).

Decision:
- Use uv-managed standard CPython 3.14, not the free-threaded `3.14t` build.
- Run one asyncio event loop and represent each conversational turn with an `asyncio.TaskGroup`.
- Connect streaming stages with bounded queues to provide backpressure.
- Treat barge-in as cancellation of the turn's task group.
- Run blocking native inference in a dedicated `ThreadPoolExecutor`, limited to one active job per
  model.
- Require plugin background tasks to use the kernel's tracked spawn mechanism.

Consequences:
- Cancellation and ownership are explicit, and a turn cannot leave orphaned async tasks.
- Cancelling Python cannot stop native work already executing in a thread; results from a cancelled
  turn are discarded, and inference units must remain short.
- Native dependencies must publish CPython 3.14 wheels before they enter the locked environment.
- Free-threading can be evaluated as an optional experiment without becoming a production
  requirement.

Evidence:
- T0.3 installs and tests the locked core on CPython 3.14 under Ubuntu 24.04 and an Ubuntu 26.04
  container.
- [T0.9](../spikes/T0.9-python314-dependencies.md) locked the complete v1 dependency set and passed
  all imports plus real ONNX Runtime, CTranslate2, PyAV, and dbus-fast calls on uv-managed standard
  CPython 3.14.7 under Ubuntu 24.04 and a clean Ubuntu 26.04 container. No Python 3.13 fallback is
  required.

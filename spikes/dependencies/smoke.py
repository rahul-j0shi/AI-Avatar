from __future__ import annotations

import base64
import importlib
import importlib.metadata
import json
import platform
import sys
import tempfile
import time
from pathlib import Path
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from collections.abc import Callable

EXPECTED_IMPORTS: Final = {
    "anthropic": "anthropic",
    "av": "av",
    "claude-agent-sdk": "claude_agent_sdk",
    "ctranslate2": "ctranslate2",
    "dbus-fast": "dbus_fast",
    "faster-whisper": "faster_whisper",
    "google-genai": "google.genai",
    "httpx": "httpx",
    "keyring": "keyring",
    "mcp": "mcp",
    "numpy": "numpy",
    "onnxruntime": "onnxruntime",
    "openai": "openai",
    "pydantic": "pydantic",
    "pypdf": "pypdf",
    "starlette": "starlette",
    "tokenizers": "tokenizers",
    "uvicorn": "uvicorn",
    "watchfiles": "watchfiles",
}

# A one-input Add graph generated with ONNX 1.20. It avoids making the ONNX authoring package a
# runtime dependency while still exercising real graph loading and CPU inference.
ONNX_ADD_ONE: Final = base64.b64decode(
    "CAgSCnN2YXJhLXQwLjk6WwoRCgF4CgRiaWFzEgF5IgNBZGQSEnN2YXJhX25hdGl2ZV9zbW9rZSoQ"
    "CAEQASIEAACAP0IEYmlhc1oPCgF4EgoKCAgBEgQKAggBYg8KAXkSCgoICAESBAoCCAFCBAoAEA0="
)


def timed_call[T](call: Callable[[], T]) -> tuple[T, float]:
    started_at = time.perf_counter()
    result = call()
    return result, round((time.perf_counter() - started_at) * 1_000, 2)


def smoke_onnxruntime() -> dict[str, object]:
    import numpy as np
    import onnxruntime as ort

    with tempfile.TemporaryDirectory(prefix="svara-onnx-smoke-") as directory:
        model_path = Path(directory) / "add-one.onnx"
        model_path.write_bytes(ONNX_ADD_ONE)
        session = ort.InferenceSession(
            str(model_path), providers=["CPUExecutionProvider"]
        )
        output = session.run(None, {"x": np.asarray([2], dtype=np.float32)})[0]
    if not isinstance(output, np.ndarray):
        raise TypeError("ONNX Runtime did not return a dense tensor")
    if output.tolist() != [3.0]:
        raise RuntimeError(f"ONNX Runtime returned {output!r}, expected [3.0]")
    return {"device": ort.get_device(), "output": output.tolist()}


def smoke_ctranslate2() -> dict[str, object]:
    import ctranslate2

    compute_types = sorted(ctranslate2.get_supported_compute_types("cpu"))
    if "float32" not in compute_types:
        raise RuntimeError(f"CTranslate2 CPU float32 unavailable: {compute_types}")
    return {"cpuComputeTypes": compute_types}


def smoke_av() -> dict[str, object]:
    import av

    frame = av.AudioFrame(format="s16", layout="mono", samples=160)
    frame.sample_rate = 16_000
    frame.planes[0].update(bytes(frame.planes[0].buffer_size))
    frames = av.AudioResampler(format="s16", layout="mono", rate=8_000).resample(frame)
    if not frames or frames[0].sample_rate != 8_000:
        raise RuntimeError("PyAV did not return an 8 kHz resampled audio frame")
    return {"inputSamples": frame.samples, "outputSamples": frames[0].samples}


def smoke_dbus_fast() -> dict[str, object]:
    from dbus_fast import Message

    message = Message(
        destination="org.freedesktop.DBus",
        path="/org/freedesktop/DBus",
        interface="org.freedesktop.DBus",
        member="ListNames",
    )
    wire_bytes = message._marshall(negotiate_unix_fd=False)
    if not wire_bytes or wire_bytes[:1] != b"l":
        raise RuntimeError("dbus-fast did not marshal a little-endian method call")
    return {"marshalledBytes": len(wire_bytes)}


def main() -> None:
    if sys.version_info[:2] != (3, 14):
        raise RuntimeError(f"expected Python 3.14, got {platform.python_version()}")
    if not sys._is_gil_enabled():
        raise RuntimeError("expected the standard GIL-enabled CPython build")

    imports: dict[str, dict[str, object]] = {}
    for distribution, module_name in EXPECTED_IMPORTS.items():
        _, elapsed_ms = timed_call(
            lambda name=module_name: importlib.import_module(name)
        )
        imports[distribution] = {
            "importMs": elapsed_ms,
            "version": importlib.metadata.version(distribution),
        }

    native: dict[str, dict[str, object]] = {}
    for name, call in (
        ("onnxruntime", smoke_onnxruntime),
        ("ctranslate2", smoke_ctranslate2),
        ("av", smoke_av),
        ("dbus-fast", smoke_dbus_fast),
    ):
        result, elapsed_ms = timed_call(call)
        native[name] = {"callMs": elapsed_ms, **result}

    print(
        json.dumps(
            {
                "architecture": platform.machine(),
                "gilEnabled": sys._is_gil_enabled(),
                "imports": imports,
                "native": native,
                "platform": platform.platform(),
                "python": platform.python_version(),
                "status": "passed",
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()

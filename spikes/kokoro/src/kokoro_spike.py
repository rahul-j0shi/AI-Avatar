from __future__ import annotations

import argparse
import json
import math
import subprocess
import time
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

import numpy as np
import numpy.typing as npt
import onnxruntime as ort

if TYPE_CHECKING:
    from collections.abc import Sequence

SAMPLE_RATE: Final = 24_000
FRAME_HOP_SAMPLES: Final = 600
FRAME_HOP_MS: Final = 25
ENVELOPE_HOP_MS: Final = 10
ATTACK_MS: Final = 35
PAD_TOKEN_ID: Final = 0
MODEL_REVISION: Final = "dd4401a9add81ac692d20e240d22ec9dda82cc29"

VISEME_MAP: Final[dict[str, str]] = {
    "p": "PP",
    "b": "PP",
    "m": "PP",
    "f": "FF",
    "v": "FF",
    "θ": "TH",
    "ð": "TH",
    "t": "DD",
    "d": "DD",
    "l": "DD",
    "k": "kk",
    "g": "kk",
    "ɡ": "kk",
    "ʃ": "CH",
    "ʒ": "CH",
    "ʧ": "CH",
    "ʤ": "CH",
    "s": "SS",
    "z": "SS",
    "n": "nn",
    "ŋ": "nn",
    "ɲ": "nn",
    "r": "RR",
    "ɹ": "RR",
    "ɻ": "RR",
    "ɾ": "RR",
    "ɑ": "aa",
    "ɐ": "aa",
    "ɒ": "aa",
    "a": "aa",
    "æ": "aa",
    "ʌ": "aa",
    "ə": "E",
    "e": "E",
    "ɛ": "E",
    "ɜ": "E",
    "ɚ": "E",
    "ɝ": "E",
    "i": "I",
    "ɪ": "I",
    "j": "I",
    "y": "I",
    "o": "O",
    "ɔ": "O",
    "u": "U",
    "ʊ": "U",
    "w": "U",
}

CLOSURES: Final = frozenset({"PP", "FF"})
VOWELS: Final = frozenset({"aa", "E", "I", "O", "U"})
SILENCE_TOKENS: Final = frozenset(' ;:,.!?—…"()“”')


@dataclass(frozen=True, slots=True)
class TokenTiming:
    end_ms: int
    ipa: str
    start_ms: int
    viseme: str


@dataclass(frozen=True, slots=True)
class CaseMeasurement:
    audio_duration_ms: int
    envelope_correlation: float
    envelope_offset_ms: int
    envelope_onset_ms: int
    inference_ms: int
    ipa: str
    onset_error_ms: int
    predicted_onset_ms: int
    rounded_duration_frames: int
    sentence: str
    token_count: int
    visible_onset_error_ms: int
    visible_onset_ms: int


def load_vocab(tokenizer_path: Path) -> dict[str, int]:
    payload = json.loads(tokenizer_path.read_text(encoding="utf-8"))
    return {str(key): int(value) for key, value in payload["model"]["vocab"].items()}


def phonemize(espeak: Path, text: str) -> str:
    result = subprocess.run(
        [str(espeak), "-q", "--ipa=3", "-v", "en-us", text],
        check=True,
        capture_output=True,
        text=True,
    )
    return " ".join(result.stdout.split())


def tokenize(
    ipa: str, vocab: dict[str, int]
) -> tuple[list[str], npt.NDArray[np.int64]]:
    characters = [
        character for character in ipa if character in vocab and character != "$"
    ]
    if not characters:
        raise ValueError("espeak-ng produced no Kokoro vocabulary tokens")
    if len(characters) > 510:
        raise ValueError(
            f"Kokoro accepts at most 510 content tokens, got {len(characters)}"
        )
    token_ids = np.asarray(
        [[PAD_TOKEN_ID, *(vocab[item] for item in characters), PAD_TOKEN_ID]]
    )
    return characters, token_ids.astype(np.int64)


def build_timeline(
    characters: Sequence[str], durations: npt.NDArray[np.float32]
) -> tuple[list[TokenTiming], int]:
    rounded_frames = np.rint(durations).astype(np.int64)
    if len(rounded_frames) != len(characters) + 2:
        raise ValueError("duration output does not match the padded token sequence")
    cursor_ms = int(rounded_frames[0]) * FRAME_HOP_MS
    timeline: list[TokenTiming] = []
    for character, frame_count in zip(characters, rounded_frames[1:-1], strict=True):
        start_ms = cursor_ms
        cursor_ms += int(frame_count) * FRAME_HOP_MS
        timeline.append(
            TokenTiming(
                end_ms=cursor_ms,
                ipa=character,
                start_ms=start_ms,
                viseme=VISEME_MAP.get(character, "sil"),
            )
        )
    total_frames = int(rounded_frames.sum())
    return timeline, total_frames


def build_viseme_keys(
    timeline: Sequence[TokenTiming],
) -> list[dict[str, int | float | str]]:
    keys: list[dict[str, int | float | str]] = []
    for timing in timeline:
        if timing.viseme == "sil":
            continue
        weight = (
            1.0
            if timing.viseme in CLOSURES
            else 0.9
            if timing.viseme in VOWELS
            else 0.65
        )
        attack_start = max(0, timing.start_ms - ATTACK_MS)
        release_end = max(timing.end_ms + 80, timing.start_ms + 40)
        keys.extend(
            (
                {"tMs": attack_start, "viseme": timing.viseme, "weight": 0.0},
                {"tMs": timing.start_ms, "viseme": timing.viseme, "weight": weight},
                {"tMs": release_end, "viseme": timing.viseme, "weight": 0.0},
            )
        )
    return sorted(keys, key=lambda item: (int(item["tMs"]), str(item["viseme"])))


def rms_envelope(waveform: npt.NDArray[np.float32]) -> npt.NDArray[np.uint8]:
    hop_samples = SAMPLE_RATE * ENVELOPE_HOP_MS // 1_000
    frame_count = math.ceil(len(waveform) / hop_samples)
    padded = np.pad(waveform, (0, frame_count * hop_samples - len(waveform)))
    frames = padded.reshape(frame_count, hop_samples)
    rms = np.sqrt(np.mean(np.square(frames, dtype=np.float64), axis=1))
    peak = float(rms.max(initial=0.0))
    if peak == 0:
        return np.zeros(frame_count, dtype=np.uint8)
    return np.rint(np.clip(rms / peak, 0, 1) * 255).astype(np.uint8)


def measure_envelope_alignment(
    timeline: Sequence[TokenTiming], envelope: npt.NDArray[np.uint8]
) -> tuple[int, int, int, float]:
    predicted = np.zeros(len(envelope), dtype=np.float64)
    for timing in timeline:
        if timing.ipa in SILENCE_TOKENS:
            continue
        start = max(0, timing.start_ms // ENVELOPE_HOP_MS)
        end = min(
            len(predicted), max(start + 1, math.ceil(timing.end_ms / ENVELOPE_HOP_MS))
        )
        predicted[start:end] = 1.0

    observed = envelope.astype(np.float64) / 255
    predicted_indices = np.flatnonzero(predicted > 0)
    observed_indices = np.flatnonzero(observed >= 0.08)
    predicted_onset_ms = int(predicted_indices[0]) * ENVELOPE_HOP_MS
    envelope_onset_ms = int(observed_indices[0]) * ENVELOPE_HOP_MS

    best_offset = 0
    best_correlation = -1.0
    for offset_ms in range(-200, 201, ENVELOPE_HOP_MS):
        shift = offset_ms // ENVELOPE_HOP_MS
        shifted = np.roll(predicted, shift)
        if shift > 0:
            shifted[:shift] = 0
        elif shift < 0:
            shifted[shift:] = 0
        if shifted.std() == 0 or observed.std() == 0:
            correlation = 0.0
        else:
            correlation = float(np.corrcoef(shifted, observed)[0, 1])
        if correlation > best_correlation or (
            math.isclose(correlation, best_correlation)
            and abs(offset_ms) < abs(best_offset)
        ):
            best_correlation = correlation
            best_offset = offset_ms
    return predicted_onset_ms, envelope_onset_ms, best_offset, best_correlation


def write_wav(path: Path, waveform: npt.NDArray[np.float32]) -> None:
    pcm = np.rint(np.clip(waveform, -1, 1) * np.iinfo(np.int16).max).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


def infer_case(
    session: ort.InferenceSession,
    voices: npt.NDArray[np.float32],
    vocab: dict[str, int],
    espeak: Path,
    sentence: str,
) -> tuple[CaseMeasurement, npt.NDArray[np.float32], dict[str, object]]:
    ipa = phonemize(espeak, sentence)
    characters, token_ids = tokenize(ipa, vocab)
    style = voices[len(characters)]
    started_at = time.perf_counter()
    waveform_output, duration_output = session.run(
        None,
        {
            "input_ids": token_ids,
            "speed": np.ones(1, dtype=np.float32),
            "style": style,
        },
    )
    inference_ms = round((time.perf_counter() - started_at) * 1_000)
    waveform = np.asarray(waveform_output[0], dtype=np.float32)
    durations = np.asarray(duration_output[0], dtype=np.float32)
    timeline, rounded_frames = build_timeline(characters, durations)
    expected_samples = rounded_frames * FRAME_HOP_SAMPLES
    if expected_samples != len(waveform):
        raise ValueError(
            f"600-sample frame hop mismatch: durations imply {expected_samples}, "
            f"waveform has {len(waveform)}"
        )
    envelope = rms_envelope(waveform)
    predicted_onset, envelope_onset, offset, correlation = measure_envelope_alignment(
        timeline, envelope
    )
    duration_ms = round(len(waveform) / SAMPLE_RATE * 1_000)
    measurement = CaseMeasurement(
        audio_duration_ms=duration_ms,
        envelope_correlation=round(correlation, 4),
        envelope_offset_ms=offset,
        envelope_onset_ms=envelope_onset,
        inference_ms=inference_ms,
        ipa=ipa,
        onset_error_ms=envelope_onset - predicted_onset,
        predicted_onset_ms=predicted_onset,
        rounded_duration_frames=rounded_frames,
        sentence=sentence,
        token_count=len(characters),
        visible_onset_error_ms=envelope_onset - max(0, predicted_onset - ATTACK_MS),
        visible_onset_ms=max(0, predicted_onset - ATTACK_MS),
    )
    track = {
        "durationMs": duration_ms,
        "envelope": envelope.tolist(),
        "envelopeHopMs": ENVELOPE_HOP_MS,
        "visemes": build_viseme_keys(timeline),
    }
    return measurement, waveform, track


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the timestamped Kokoro lip-sync spike"
    )
    parser.add_argument("--espeak", required=True, type=Path)
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--publish-dir", required=True, type=Path)
    parser.add_argument("--sentences", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.publish_dir.mkdir(parents=True, exist_ok=True)
    sentences = [
        line.strip() for line in args.sentences.read_text().splitlines() if line.strip()
    ]
    if len(sentences) != 5:
        raise ValueError(
            f"Spike B requires exactly five fixed sentences, got {len(sentences)}"
        )

    vocab = load_vocab(args.model_dir / "tokenizer.json")
    voices = np.fromfile(args.model_dir / "af_heart.bin", dtype=np.float32).reshape(
        -1, 1, 256
    )
    session = ort.InferenceSession(
        str(args.model_dir / "model_fp16.onnx"), providers=["CPUExecutionProvider"]
    )
    measurements: list[CaseMeasurement] = []
    for index, sentence in enumerate(sentences, start=1):
        measurement, waveform, track = infer_case(
            session, voices, vocab, args.espeak, sentence
        )
        measurements.append(measurement)
        write_wav(args.output_dir / f"sentence-{index}.wav", waveform)
        (args.output_dir / f"sentence-{index}.json").write_text(
            json.dumps({"measurement": asdict(measurement), "track": track}, indent=2)
            + "\n",
            encoding="utf-8",
        )
        if index == 1:
            write_wav(args.publish_dir / "sample.wav", waveform)
            (args.publish_dir / "sample.json").write_text(
                json.dumps(
                    {
                        "audioUrl": "/spike-assets/kokoro/sample.wav",
                        "sampleRate": SAMPLE_RATE,
                        "text": sentence,
                        "track": track,
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

    absolute_onset_errors = [abs(item.onset_error_ms) for item in measurements]
    absolute_visible_errors = [
        abs(item.visible_onset_error_ms) for item in measurements
    ]
    summary = {
        "attackMs": ATTACK_MS,
        "frameHopMs": FRAME_HOP_MS,
        "frameHopSamples": FRAME_HOP_SAMPLES,
        "maxAbsoluteOnsetErrorMs": max(absolute_onset_errors),
        "meanAbsoluteOnsetErrorMs": round(float(np.mean(absolute_onset_errors)), 2),
        "maxAbsoluteVisibleOnsetErrorMs": max(absolute_visible_errors),
        "meanAbsoluteVisibleOnsetErrorMs": round(
            float(np.mean(absolute_visible_errors)), 2
        ),
        "modelRevision": MODEL_REVISION,
        "sampleRate": SAMPLE_RATE,
        "sentences": [asdict(item) for item in measurements],
    }
    (args.output_dir / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

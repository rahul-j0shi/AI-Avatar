from __future__ import annotations

import unittest

import numpy as np
from kokoro_spike import (
    TokenTiming,
    build_timeline,
    build_viseme_keys,
    measure_envelope_alignment,
    rms_envelope,
    tokenize,
)


class KokoroSpikeTests(unittest.TestCase):
    def test_tokenize_adds_model_pad_tokens(self) -> None:
        characters, token_ids = tokenize("pa", {"$": 0, "p": 58, "a": 43})
        self.assertEqual(characters, ["p", "a"])
        self.assertEqual(token_ids.tolist(), [[0, 58, 43, 0]])

    def test_timeline_uses_rounded_25_ms_model_frames(self) -> None:
        timeline, total_frames = build_timeline(
            ["p", "a"], np.asarray([2.1, 1.6, 3.2, 1.1], dtype=np.float32)
        )
        self.assertEqual(total_frames, 8)
        self.assertEqual((timeline[0].start_ms, timeline[0].end_ms), (50, 100))
        self.assertEqual((timeline[1].start_ms, timeline[1].end_ms), (100, 175))

        keys = build_viseme_keys(timeline)
        closure = [item for item in keys if item["viseme"] == "PP"]
        self.assertEqual(closure[1]["weight"], 1.0)
        self.assertEqual(closure[2]["weight"], 1.0)
        self.assertGreaterEqual(int(closure[2]["tMs"]) - int(closure[1]["tMs"]), 40)

    def test_short_closures_have_a_full_weight_plateau(self) -> None:
        for viseme in ("PP", "FF"):
            keys = build_viseme_keys([TokenTiming(110, "p", 100, viseme)])
            self.assertEqual(
                [(key["tMs"], key["weight"]) for key in keys],
                [(65, 0.0), (100, 1.0), (140, 1.0), (220, 0.0)],
            )

    def test_same_channel_overlaps_do_not_insert_zeroes(self) -> None:
        keys = build_viseme_keys(
            [
                TokenTiming(125, "p", 100, "PP"),
                TokenTiming(170, "b", 125, "PP"),
            ]
        )
        self.assertEqual(
            [(key["tMs"], key["weight"]) for key in keys],
            [(65, 0.0), (100, 1.0), (170, 1.0), (250, 0.0)],
        )
        self.assertEqual(len({key["tMs"] for key in keys}), len(keys))

    def test_silence_has_no_measurable_onset(self) -> None:
        with self.assertRaisesRegex(ValueError, "onset comparison"):
            measure_envelope_alignment([], np.zeros(5, dtype=np.uint8))

    def test_envelope_has_ten_millisecond_hops(self) -> None:
        waveform = np.concatenate(
            (np.zeros(240, dtype=np.float32), np.ones(240, dtype=np.float32))
        )
        self.assertEqual(rms_envelope(waveform).tolist(), [0, 255])


if __name__ == "__main__":
    unittest.main()

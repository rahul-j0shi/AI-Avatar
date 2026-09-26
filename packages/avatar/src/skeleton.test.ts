import { describe, expect, test } from "vitest";

import { FrameProbe } from "./metrics";

describe("@svara/avatar workspace", () => {
  test("measures an on-time 60 fps rendering window", () => {
    const probe = new FrameProbe(60);
    for (let frame = 0; frame <= 60; frame += 1) {
      probe.record((frame * 1_000) / 60);
    }

    const result = probe.snapshot();
    expect(result.fps).toBeCloseTo(60, 0);
    expect(result.droppedFrames).toBe(0);
  });

  test("counts missed render deadlines", () => {
    const probe = new FrameProbe(30);
    probe.record(0);
    probe.record(100 / 3);
    probe.record(400 / 3);

    expect(probe.snapshot().droppedFrames).toBe(2);
  });
});

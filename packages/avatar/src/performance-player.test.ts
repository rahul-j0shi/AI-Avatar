import { describe, expect, it } from "vitest";

import { PerformancePlayer, type PerformanceTrack } from "./performance-player";

const track: PerformanceTrack = {
  durationMs: 300,
  envelope: [0, 128, 255],
  envelopeHopMs: 100,
  visemes: [
    { tMs: 0, viseme: "aa", weight: 0 },
    { tMs: 100, viseme: "aa", weight: 1 },
    { tMs: 200, viseme: "aa", weight: 0 },
    { tMs: 100, viseme: "PP", weight: 1 },
    { tMs: 150, viseme: "PP", weight: 0 },
  ],
};

describe("PerformancePlayer", () => {
  it("interpolates keyframes and reads the shared envelope clock", () => {
    const player = new PerformancePlayer();
    player.play(track, 1_000);

    const frame = player.update(1_050);
    expect(frame.ended).toBe(false);
    expect(frame.weights.aa).toBeCloseTo(0.5);
    expect(frame.jaw).toBe(0);

    const loudFrame = player.update(1_250);
    expect(loudFrame.jaw).toBe(1);
  });

  it("keeps closures dominant and stops at the track boundary", () => {
    const player = new PerformancePlayer();
    player.play(track, 0);

    const closure = player.update(100);
    expect(closure.weights.PP).toBe(1);
    expect(closure.weights.aa).toBe(0);

    expect(player.update(300).ended).toBe(true);
    expect(player.update(301).jaw).toBe(0);
  });
});

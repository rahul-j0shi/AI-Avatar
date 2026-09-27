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
    expect(closure.jaw).toBe(0);

    expect(player.update(300).ended).toBe(true);
    expect(player.update(301).jaw).toBe(0);
  });

  it("starts neutral, cancels cleanly, and does not retain caller mutations", () => {
    const player = new PerformancePlayer();
    const mutable = structuredClone(track);
    player.play(mutable, 1_000);
    const vowel = mutable.visemes[1];
    if (!vowel) throw new Error("Missing test key");
    vowel.weight = 0;
    mutable.envelope[2] = 0;
    expect(player.update(999).jaw).toBe(0);
    expect(player.update(1_050).weights.aa).toBeCloseTo(0.5);
    expect(player.update(1_250).jaw).toBe(1);
    player.stop();
    expect(player.update(1_100).ended).toBe(true);
  });

  it("rejects invalid tracks and duplicate channel timestamps", () => {
    const player = new PerformancePlayer();
    expect(() => player.play({ ...track, envelopeHopMs: 0 }, 0)).toThrow();
    expect(() => player.play({ ...track, envelope: [NaN] }, 0)).toThrow();
    expect(() =>
      player.play({ ...track, visemes: [...track.visemes, ...track.visemes] }, 0),
    ).toThrow();
  });
});

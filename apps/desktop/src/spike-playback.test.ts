import { afterEach, describe, expect, it, vi } from "vitest";
import { SpikePlayback } from "./spike-playback";

const track = { durationMs: 200, envelope: [], envelopeHopMs: 10, visemes: [] };
const target = () => ({ playPerformance: vi.fn(), setMode: vi.fn() });
function fakeContext() {
  const source = {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const context = {
    state: "running",
    currentTime: 5,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => ({})),
    createBufferSource: vi.fn(() => source),
  };
  return { context, source, create: () => context as unknown as AudioContext };
}
afterEach(() => vi.unstubAllGlobals());
describe("spike playback ownership", () => {
  it("uses the audio clock and cleans up on stop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ArrayBuffer(0))),
    );
    const fake = fakeContext();
    const output = target();
    const player = new SpikePlayback(fake.create);
    expect(await player.play("/audio.wav", track, output)).toBe(true);
    expect(fake.source.start).toHaveBeenCalledWith(5.08);
    expect(output.playPerformance.mock.calls[0]?.[1]).toBe(5080);
    fake.context.currentTime = 6;
    expect(output.playPerformance.mock.calls[0]?.[2]()).toBe(6000);
    player.stop();
    player.stop();
    expect(fake.source.stop).toHaveBeenCalledTimes(1);
    expect(fake.context.close).toHaveBeenCalledTimes(1);
    expect(output.setMode).toHaveBeenCalledWith("idle");
  });
  it("does not start a late decode after cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new ArrayBuffer(0))),
    );
    const fake = fakeContext();
    let finish: (value: object) => void = () => {};
    fake.context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const player = new SpikePlayback(fake.create);
    const pending = player.play("/audio.wav", track, target());
    await vi.waitFor(() => expect(fake.context.decodeAudioData).toHaveBeenCalled());
    player.stop();
    finish({});
    expect(await pending).toBe(false);
    expect(fake.source.start).not.toHaveBeenCalled();
  });
  it("closes the context when an audio request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    const fake = fakeContext();
    const player = new SpikePlayback(fake.create);
    await expect(player.play("/missing", track, target())).rejects.toThrow("404");
    expect(fake.context.close).toHaveBeenCalledTimes(1);
  });
});

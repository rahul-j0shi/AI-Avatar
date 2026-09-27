import type { PerformanceTrack } from "@svara/avatar";

interface PlaybackTarget {
  playPerformance(track: PerformanceTrack, startAtMs: number, clock: () => number): void;
  setMode(mode: "idle"): void;
}

// Development probe only: owns one live source, including asynchronous decoding.
export class SpikePlayback {
  #context: AudioContext | undefined;
  #source: AudioBufferSourceNode | undefined;
  #sourceStarted = false;
  #target: PlaybackTarget | undefined;
  #abort: AbortController | undefined;

  constructor(private readonly createContext = () => new AudioContext()) {}

  stop(): void {
    this.#abort?.abort();
    this.#abort = undefined;
    const source = this.#source;
    this.#source = undefined;
    if (source) {
      source.onended = null;
      if (this.#sourceStarted) source.stop();
      source.disconnect();
    }
    this.#sourceStarted = false;
    const context = this.#context;
    this.#context = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    this.#target?.setMode("idle");
    this.#target = undefined;
  }

  async play(url: string, track: PerformanceTrack, target: PlaybackTarget): Promise<boolean> {
    this.stop();
    const context = this.createContext();
    const abort = new AbortController();
    this.#context = context;
    this.#abort = abort;
    this.#target = target;
    try {
      await context.resume();
      if (this.#context !== context) return false;
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      if (this.#context !== context) return false;
      const source = context.createBufferSource();
      this.#source = source;
      source.buffer = audio;
      source.connect(context.destination);
      const start = context.currentTime + 0.08;
      target.playPerformance(track, start * 1_000, () => context.currentTime * 1_000);
      source.onended = () => {
        if (this.#context === context) this.stop();
      };
      source.start(start);
      this.#sourceStarted = true;
      return true;
    } catch (error) {
      if (this.#context !== context) return false;
      this.stop();
      throw error;
    }
  }
}

export interface RenderMeasurement {
  durationMs: number;
  droppedFrames: number;
  fps: number;
  renderedFrames: number;
  targetFps: number;
}

export class FrameProbe {
  readonly #targetFrameMs: number;
  #droppedFrames = 0;
  #firstFrameAt: number | undefined;
  #lastFrameAt: number | undefined;
  #renderedFrames = 0;

  constructor(readonly targetFps: number) {
    this.#targetFrameMs = 1_000 / targetFps;
  }

  record(timestamp: number): void {
    this.#firstFrameAt ??= timestamp;

    if (this.#lastFrameAt !== undefined) {
      const elapsed = timestamp - this.#lastFrameAt;
      const missedIntervals = Math.max(0, Math.round(elapsed / this.#targetFrameMs) - 1);
      this.#droppedFrames += missedIntervals;
    }

    this.#lastFrameAt = timestamp;
    this.#renderedFrames += 1;
  }

  snapshot(fallbackDurationMs = 0): RenderMeasurement {
    const measuredDuration =
      this.#firstFrameAt !== undefined && this.#lastFrameAt !== undefined
        ? this.#lastFrameAt - this.#firstFrameAt
        : fallbackDurationMs;
    const durationMs = Math.max(measuredDuration, fallbackDurationMs);

    return {
      durationMs,
      droppedFrames: this.#droppedFrames,
      fps: durationMs > 0 ? (Math.max(0, this.#renderedFrames - 1) * 1_000) / durationMs : 0,
      renderedFrames: this.#renderedFrames,
      targetFps: this.targetFps,
    };
  }
}

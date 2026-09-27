export const VISEMES = [
  "sil",
  "PP",
  "FF",
  "TH",
  "DD",
  "kk",
  "CH",
  "SS",
  "nn",
  "RR",
  "aa",
  "E",
  "I",
  "O",
  "U",
] as const;

export type Viseme = (typeof VISEMES)[number];

export interface VisemeKey {
  tMs: number;
  viseme: Viseme;
  weight: number;
}

export interface PerformanceTrack {
  durationMs: number;
  envelope: number[];
  envelopeHopMs: number;
  visemes: VisemeKey[];
}

export interface FaceFrame {
  ended: boolean;
  jaw: number;
  weights: Record<Viseme, number>;
}

const emptyWeights = (): Record<Viseme, number> =>
  Object.fromEntries(VISEMES.map((viseme) => [viseme, 0])) as Record<Viseme, number>;

export class PerformancePlayer {
  #channels = new Map<Viseme, VisemeKey[]>();
  #startAtMs = 0;
  #track: PerformanceTrack | undefined;

  play(track: PerformanceTrack, startAtMs: number): void {
    this.#track = track;
    this.#startAtMs = startAtMs;
    this.#channels = new Map();
    for (const key of track.visemes) {
      const channel = this.#channels.get(key.viseme) ?? [];
      channel.push(key);
      this.#channels.set(key.viseme, channel);
    }
    for (const channel of this.#channels.values()) {
      channel.sort((left, right) => left.tMs - right.tMs);
    }
  }

  stop(): void {
    this.#track = undefined;
    this.#channels.clear();
  }

  update(nowMs: number): FaceFrame {
    const weights = emptyWeights();
    const track = this.#track;
    if (!track) {
      return { ended: true, jaw: 0, weights };
    }

    const elapsedMs = nowMs - this.#startAtMs;
    if (elapsedMs < 0) {
      return { ended: false, jaw: 0, weights };
    }
    if (elapsedMs >= track.durationMs) {
      this.stop();
      return { ended: true, jaw: 0, weights };
    }

    for (const [viseme, keys] of this.#channels) {
      weights[viseme] = this.#sample(keys, elapsedMs);
    }

    const closureWeight = Math.max(weights.PP, weights.FF);
    if (closureWeight > 0.5) {
      const suppression = 1 - closureWeight;
      for (const vowel of ["aa", "E", "I", "O", "U"] as const) {
        weights[vowel] *= suppression;
      }
    }

    const envelopeIndex = Math.min(
      track.envelope.length - 1,
      Math.max(0, Math.floor(elapsedMs / track.envelopeHopMs)),
    );
    const jaw = track.envelope.length > 0 ? (track.envelope[envelopeIndex] ?? 0) / 255 : 0;
    return { ended: false, jaw, weights };
  }

  #sample(keys: VisemeKey[], elapsedMs: number): number {
    if (keys.length === 0 || elapsedMs < (keys[0]?.tMs ?? 0)) {
      return 0;
    }
    for (let index = 1; index < keys.length; index += 1) {
      const next = keys[index];
      const previous = keys[index - 1];
      if (next && previous && elapsedMs <= next.tMs) {
        const span = Math.max(1, next.tMs - previous.tMs);
        const progress = (elapsedMs - previous.tMs) / span;
        return previous.weight + (next.weight - previous.weight) * progress;
      }
    }
    return keys.at(-1)?.weight ?? 0;
  }
}

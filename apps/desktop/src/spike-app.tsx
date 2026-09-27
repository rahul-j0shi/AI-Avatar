import {
  type AvatarMode,
  AvatarRenderer,
  type PerformanceTrack,
  type RenderMeasurement,
} from "@svara/avatar";
import { useCallback, useEffect, useRef, useState } from "react";

interface InputRegion {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface SpikeReport {
  generatedAt: string;
  idle?: RenderMeasurement;
  speaking?: RenderMeasurement;
  userAgent: string;
  webAudio: "not-tested" | "passed" | "failed";
}

interface KokoroSample {
  audioUrl: string;
  sampleRate: number;
  text: string;
  track: PerformanceTrack;
}

declare global {
  interface Window {
    svaraSpike?: {
      kind: "electron";
      recordEvent: (name: string, details: unknown) => Promise<void>;
      setInputRegions: (regions: InputRegion[]) => Promise<string>;
    };
  }
}

const shellKind = () => window.svaraSpike?.kind ?? "browser";

const invokeShell = async <T,>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T | null> => {
  const bridge = window.svaraSpike;
  if (!bridge) {
    return null;
  }
  if (command === "set_input_regions") {
    return bridge.setInputRegions((args?.regions as InputRegion[]) ?? []) as Promise<T>;
  }
  if (command === "record_event") {
    await bridge.recordEvent(String(args?.name), args?.details);
    return null;
  }
  throw new Error(`Unsupported Electron spike command: ${command}`);
};

const collectInputRegions = (): InputRegion[] =>
  [...document.querySelectorAll<HTMLElement>("[data-input-region]")]
    .filter((element) => element.offsetParent !== null)
    .map((element) => {
      const box = element.getBoundingClientRect();
      return {
        height: Math.ceil(box.height),
        width: Math.ceil(box.width),
        x: Math.floor(box.x),
        y: Math.floor(box.y),
      };
    });

export function SpikeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AvatarRenderer | null>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  const [mode, setModeState] = useState<AvatarMode>("idle");
  const [kokoroSample, setKokoroSample] = useState<KokoroSample | null>(null);
  const [modelStatus, setModelStatus] = useState(
    "Procedural stand-in (load a VRM for the real test)",
  );
  const [report, setReport] = useState<SpikeReport>({
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    webAudio: "not-tested",
  });
  const [running, setRunning] = useState<AvatarMode | null>(null);
  const [shellStatus, setShellStatus] = useState(
    window.svaraSpike ? "Electron IPC connected" : "Browser preview",
  );

  const updateInputRegions = useCallback(async () => {
    try {
      const result = await invokeShell<string>("set_input_regions", {
        regions: collectInputRegions(),
      });
      if (result) {
        setShellStatus(result);
      }
    } catch (error) {
      setShellStatus(`Input region failed: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const renderer = new AvatarRenderer(canvas, {
      onError: (error) => setModelStatus(`VRM load failed: ${error.message}`),
      onModelLoaded: (name) => setModelStatus(`VRM loaded: ${name}`),
    });
    rendererRef.current = renderer;

    void fetch("/spike-assets/avatar.vrm")
      .then(async (response) => {
        if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
          setModelStatus(
            `Ignored test VRM unavailable (${response.status} ${response.headers.get("content-type") ?? "unknown type"})`,
          );
          return;
        }
        setModelStatus("Loading ignored test VRM…");
        const objectUrl = URL.createObjectURL(await response.blob());
        objectUrlRef.current = objectUrl;
        return renderer.loadVrm(objectUrl);
      })
      .catch((error: unknown) => {
        setModelStatus(`Ignored test VRM unavailable: ${String(error)}`);
      });

    const resizeObserver = new ResizeObserver(() => void updateInputRegions());
    resizeObserver.observe(document.body);
    const timeout = window.setTimeout(() => void updateInputRegions(), 250);

    return () => {
      window.clearTimeout(timeout);
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [updateInputRegions]);

  useEffect(() => {
    void fetch("/spike-assets/kokoro/sample.json")
      .then(async (response) => {
        if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
          return;
        }
        setKokoroSample((await response.json()) as KokoroSample);
        window.setTimeout(() => void updateInputRegions(), 0);
      })
      .catch(() => {
        // The generated T0.8 sample is optional outside the lip-sync spike.
      });
  }, [updateInputRegions]);

  const setMode = (nextMode: AvatarMode) => {
    rendererRef.current?.setMode(nextMode);
    setModeState(nextMode);
  };

  const loadFile = async (file: File) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setModelStatus(`Loading ${file.name}…`);
    try {
      await rendererRef.current?.loadVrm(objectUrl);
    } catch {
      // The renderer's callback provides the useful error in the UI.
    }
  };

  const measure = async (measurementMode: AvatarMode) => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    setMode(measurementMode);
    setRunning(measurementMode);
    const result = await renderer.measure(10_000);
    await invokeShell("record_event", {
      details: result,
      name: `${measurementMode}-render`,
    });
    setReport((current) => ({
      ...current,
      [measurementMode]: result,
      generatedAt: new Date().toISOString(),
    }));
    setRunning(null);
  };

  const testAudio = async () => {
    try {
      const context = new AudioContext();
      await context.resume();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
      oscillator.frequency.value = 440;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.82);
      oscillator.addEventListener("ended", () => void context.close());
      await invokeShell("record_event", {
        details: { audioContextState: context.state, sampleRate: context.sampleRate },
        name: "web-audio",
      });
      setReport((current) => ({ ...current, webAudio: "passed" }));
    } catch {
      setReport((current) => ({ ...current, webAudio: "failed" }));
    }
  };

  const playKokoro = async () => {
    const renderer = rendererRef.current;
    if (!renderer || !kokoroSample) {
      return;
    }
    try {
      const context = new AudioContext();
      await context.resume();
      const response = await fetch(kokoroSample.audioUrl);
      const audio = await context.decodeAudioData(await response.arrayBuffer());
      const source = context.createBufferSource();
      source.buffer = audio;
      source.connect(context.destination);
      const delaySeconds = 0.08;
      renderer.playPerformance(kokoroSample.track, performance.now() + delaySeconds * 1_000);
      setModeState("speaking");
      source.addEventListener("ended", () => {
        setMode("idle");
        void context.close();
      });
      source.start(context.currentTime + delaySeconds);
      await invokeShell("record_event", {
        details: {
          durationMs: kokoroSample.track.durationMs,
          sampleRate: kokoroSample.sampleRate,
          text: kokoroSample.text,
          visemeKeys: kokoroSample.track.visemes.length,
        },
        name: "kokoro-performance",
      });
    } catch (error) {
      setModelStatus(`Kokoro playback failed: ${String(error)}`);
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `svara-${shellKind()}-spike-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={`shell-${shellKind()}`}>
      <section aria-label="Draggable avatar" className="avatar-hit-region" data-input-region>
        <canvas ref={canvasRef} />
        <div className={`status-orb ${mode}`} aria-label={`${mode} mode`} role="status" />
      </section>

      <section className="controls" data-input-region>
        <header>
          <div>
            <p className="eyebrow">SPIKE A · {shellKind().toUpperCase()}</p>
            <h1>Svara shell probe</h1>
          </div>
          <span className="shell-pill">{shellStatus}</span>
        </header>

        <p className="model-status">{modelStatus}</p>
        <div className="button-row">
          <label className="button file-button">
            Load VRM
            <input
              accept=".vrm,model/gltf-binary"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void loadFile(file);
                }
              }}
              type="file"
            />
          </label>
          <button onClick={() => setMode(mode === "idle" ? "speaking" : "idle")} type="button">
            {mode === "idle" ? "Speak" : "Go idle"}
          </button>
          <button onClick={() => void testAudio()} type="button">
            Test WebAudio
          </button>
        </div>

        <div className="measurements">
          <button disabled={running !== null} onClick={() => void measure("idle")} type="button">
            {running === "idle" ? "Measuring 10s…" : "Measure idle · 30 fps"}
          </button>
          <button
            disabled={running !== null}
            onClick={() => void measure("speaking")}
            type="button"
          >
            {running === "speaking" ? "Measuring 10s…" : "Measure speaking · 60 fps"}
          </button>
        </div>

        {kokoroSample ? (
          <button className="download" onClick={() => void playKokoro()} type="button">
            Play timestamped Kokoro track
          </button>
        ) : null}

        <pre aria-live="polite">{JSON.stringify(report, null, 2)}</pre>
        <button className="download" onClick={downloadReport} type="button">
          Download JSON report
        </button>
      </section>
    </main>
  );
}

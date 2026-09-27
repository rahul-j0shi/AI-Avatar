import {
  type AvatarMode,
  AvatarRenderer,
  type PerformanceTrack,
  type RenderMeasurement,
} from "@svara/avatar";
import { useCallback, useEffect, useRef, useState } from "react";
import { SpikePlayback } from "./spike-playback";

interface InputRegion {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface Point {
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
      getWindowPosition: () => Promise<Point>;
      kind: "electron";
      recordEvent: (name: string, details: unknown) => Promise<void>;
      setFocusable: (focusable: boolean) => Promise<string>;
      setInputRegions: (regions: InputRegion[]) => Promise<string>;
      setWindowPosition: (position: Point) => Promise<void>;
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
  const dragRef = useRef<{ pointer: Point; window?: Point; id: number } | null>(null);
  const playbackRef = useRef(new SpikePlayback());
  const toneContextsRef = useRef(new Set<AudioContext>());
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
    const abort = new AbortController();
    const playback = playbackRef.current;
    const toneContexts = toneContextsRef.current;

    void fetch("/spike-assets/avatar.vrm", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
          setModelStatus(
            `Ignored test VRM unavailable (${response.status} ${response.headers.get("content-type") ?? "unknown type"})`,
          );
          return;
        }
        setModelStatus("Loading ignored test VRM…");
        const objectUrl = URL.createObjectURL(await response.blob());
        if (abort.signal.aborted) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        objectUrlRef.current = objectUrl;
        return renderer.loadVrm(objectUrl);
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setModelStatus(`Ignored test VRM unavailable: ${String(error)}`);
      });

    const resizeObserver = new ResizeObserver(() => void updateInputRegions());
    resizeObserver.observe(document.body);
    const timeout = window.setTimeout(() => void updateInputRegions(), 250);

    return () => {
      abort.abort();
      playback.stop();
      for (const context of toneContexts) void context.close().catch(() => {});
      toneContexts.clear();
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
    playbackRef.current.stop();
    rendererRef.current?.setMode(nextMode);
    setModeState(nextMode);
  };

  const setWindowFocusable = async (focusable: boolean) => {
    if (!window.svaraSpike) {
      setModelStatus("Native focus probe is unavailable in the browser harness");
      return;
    }
    try {
      setModelStatus(await window.svaraSpike.setFocusable(focusable));
    } catch (error) {
      setModelStatus(`Focus probe failed: ${String(error)}`);
    }
  };

  const startWindowDrag = async (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !window.svaraSpike) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag = {
      pointer: { x: event.screenX, y: event.screenY },
      id: event.pointerId,
    };
    dragRef.current = drag;
    try {
      const position = await window.svaraSpike.getWindowPosition();
      if (dragRef.current === drag) dragRef.current.window = position;
    } catch (error) {
      if (dragRef.current === drag) dragRef.current = null;
      setModelStatus(`Drag failed: ${String(error)}`);
    }
  };

  const moveWindowDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag?.window || drag.id !== event.pointerId || !window.svaraSpike) {
      return;
    }
    if (Math.hypot(event.screenX - drag.pointer.x, event.screenY - drag.pointer.y) <= 4) return;
    void window.svaraSpike
      .setWindowPosition({
        x: drag.window.x + event.screenX - drag.pointer.x,
        y: drag.window.y + event.screenY - drag.pointer.y,
      })
      .catch((error: unknown) => setModelStatus(`Drag failed: ${String(error)}`));
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
    const context = new AudioContext();
    toneContextsRef.current.add(context);
    try {
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
      oscillator.addEventListener("ended", () => {
        toneContextsRef.current.delete(context);
        if (context.state !== "closed") void context.close().catch(() => {});
      });
      await invokeShell("record_event", {
        details: { audioContextState: context.state, sampleRate: context.sampleRate },
        name: "web-audio",
      });
      setReport((current) => ({ ...current, webAudio: "passed" }));
    } catch {
      toneContextsRef.current.delete(context);
      if (context.state !== "closed") void context.close().catch(() => {});
      setReport((current) => ({ ...current, webAudio: "failed" }));
    }
  };

  const playKokoro = async () => {
    const renderer = rendererRef.current;
    if (!renderer || !kokoroSample) {
      return;
    }
    try {
      const played = await playbackRef.current.play(kokoroSample.audioUrl, kokoroSample.track, {
        playPerformance: (track, start, clock) => renderer.playPerformance(track, start, clock),
        setMode: () => {
          renderer.setMode("idle");
          setModeState("idle");
        },
      });
      if (!played) return;
      setModeState("speaking");
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
      <section
        aria-label="Draggable avatar"
        className="avatar-hit-region"
        data-input-region
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onLostPointerCapture={() => {
          dragRef.current = null;
        }}
        onPointerDown={(event) => void startWindowDrag(event)}
        onPointerMove={moveWindowDrag}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      >
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

        <div className="measurements">
          <button onClick={() => void setWindowFocusable(true)} type="button">
            Request keyboard focus
          </button>
          <button onClick={() => void setWindowFocusable(false)} type="button">
            Release keyboard focus
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

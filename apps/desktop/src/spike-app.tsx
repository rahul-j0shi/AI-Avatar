import { type AvatarMode, AvatarRenderer, type RenderMeasurement } from "@svara/avatar";
import { invoke } from "@tauri-apps/api/core";
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

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () => window.__TAURI_INTERNALS__ !== undefined;

const invokeIfTauri = async <T,>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T | null> => {
  if (!isTauri()) {
    return null;
  }
  return invoke<T>(command, args);
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
    isTauri() ? "Tauri IPC connected" : "Browser preview",
  );

  const updateInputRegions = useCallback(async () => {
    try {
      const result = await invokeIfTauri<string>("set_input_regions", {
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
    await invokeIfTauri("record_event", {
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
      await invokeIfTauri("record_event", {
        details: { audioContextState: context.state, sampleRate: context.sampleRate },
        name: "web-audio",
      });
      setReport((current) => ({ ...current, webAudio: "passed" }));
    } catch {
      setReport((current) => ({ ...current, webAudio: "failed" }));
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `svara-tauri-spike-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startDrag = async (event: React.PointerEvent) => {
    if (event.button !== 0 || !isTauri()) {
      return;
    }
    try {
      await invoke("start_drag");
    } catch (error) {
      setShellStatus(`Native drag failed: ${String(error)}`);
    }
  };

  return (
    <main>
      <section
        aria-label="Draggable avatar"
        className="avatar-hit-region"
        data-input-region
        onPointerDown={startDrag}
      >
        <canvas ref={canvasRef} />
        <div className={`status-orb ${mode}`} aria-label={`${mode} mode`} role="status" />
      </section>

      <section className="controls" data-input-region>
        <header>
          <div>
            <p className="eyebrow">SPIKE A · TAURI</p>
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

        <pre aria-live="polite">{JSON.stringify(report, null, 2)}</pre>
        <button className="download" onClick={downloadReport} type="button">
          Download JSON report
        </button>
      </section>
    </main>
  );
}

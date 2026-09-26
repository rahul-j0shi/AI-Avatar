const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const WIDTH = 480;
const HEIGHT = 640;
const MAX_REGIONS = 16;

app.commandLine.appendSwitch("ozone-platform", "x11");

const normalizeRegions = (regions) => {
  if (!Array.isArray(regions) || regions.length > MAX_REGIONS) {
    throw new Error(`Expected at most ${MAX_REGIONS} input regions.`);
  }

  return regions.map((region) => {
    const x = Math.max(0, Math.trunc(Number(region.x)));
    const y = Math.max(0, Math.trunc(Number(region.y)));
    const width = Math.min(WIDTH - x, Math.max(1, Math.trunc(Number(region.width))));
    const height = Math.min(HEIGHT - y, Math.max(1, Math.trunc(Number(region.height))));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error("Input regions must be finite, positive rectangles inside the window.");
    }
    return { x, y, width, height };
  });
};

const createWindow = async () => {
  const window = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: WIDTH,
    minHeight: HEIGHT,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    center: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  window.setAlwaysOnTop(true);
  await window.loadURL(process.env.SVARA_SPIKE_URL ?? "http://127.0.0.1:1420");
};

ipcMain.handle("svara-spike:set-input-regions", (event, regions) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("The Electron spike window is unavailable.");
  }
  const normalized = normalizeRegions(regions);
  window.setShape(normalized);
  return `native input shape · ${normalized.length} regions`;
});

ipcMain.handle("svara-spike:record-event", (_event, name, details) => {
  console.log("SVARA_SPIKE_EVENT", JSON.stringify({ name, details }));
});

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.exit(1);
});

app.on("window-all-closed", () => app.quit());

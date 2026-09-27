const path = require("node:path");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  WIDTH,
  HEIGHT,
  normalizeRegions,
  normalizePosition,
  validateUrl,
} = require("./validation.cjs");

app.commandLine.appendSwitch("ozone-platform", "x11");
app.setPath("userData", path.join(app.getPath("temp"), "svara-electron-spike"));

const createWindow = async () => {
  const window = new BrowserWindow({
    title: "Svara Electron shell spike",
    width: WIDTH,
    height: HEIGHT,
    minWidth: WIDTH,
    minHeight: HEIGHT,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    center: true,
    // Non-focusable creation changes X11 window management. Keep it opt-in until
    // above/drag/typing are proven together on the target Wayland desktops.
    focusable: process.env.SVARA_SPIKE_FOCUS_MODE !== "nonfocusable",
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
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  await window.loadURL(validateUrl(process.env.SVARA_SPIKE_URL ?? "http://127.0.0.1:1420"));
  console.log(
    "SVARA_SPIKE_EVENT",
    JSON.stringify({
      name: "window-contract",
      details: {
        alwaysOnTop: window.isAlwaysOnTop(),
        bounds: window.getBounds(),
        focusable: window.isFocusable(),
        sessionType: process.env.XDG_SESSION_TYPE ?? null,
      },
    }),
  );
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

ipcMain.handle("svara-spike:get-window-position", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("The Electron spike window is unavailable.");
  }
  const [x, y] = window.getPosition();
  return { x, y };
});

ipcMain.handle("svara-spike:set-window-position", (event, position) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("The Electron spike window is unavailable.");
  }
  const { x, y } = normalizePosition(position);
  window.setPosition(x, y);
});

ipcMain.handle("svara-spike:set-focusable", (event, focusable) => {
  if (typeof focusable !== "boolean") {
    throw new TypeError("Focusable state must be a boolean.");
  }
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error("The Electron spike window is unavailable.");
  }
  window.setFocusable(focusable);
  if (focusable) {
    window.focus();
  }
  return `native focusable · ${window.isFocusable()} · focused · ${window.isFocused()}`;
});

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });

app.on("window-all-closed", () => app.quit());

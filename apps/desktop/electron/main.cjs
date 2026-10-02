const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { app, BrowserWindow, ipcMain } = require("electron");

const {
  WIDTH,
  HEIGHT,
  normalizeRegions,
  normalizePosition,
  validateUrl,
} = require("./validation.cjs");

const execFileAsync = promisify(execFile);
const focusMode = process.env.SVARA_SPIKE_FOCUS_MODE ?? "managed";
if (!["managed", "nonfocusable", "managed-hints"].includes(focusMode)) {
  throw new Error("Unknown SVARA_SPIKE_FOCUS_MODE.");
}
let spikeWindow;
let focusChange = Promise.resolve();

const setInputHint = async (window, enabled) => {
  const helper = process.env.SVARA_SPIKE_INPUT_HINT_HELPER;
  if (!helper || !path.isAbsolute(helper)) {
    throw new Error("managed-hints requires an absolute SVARA_SPIKE_INPUT_HINT_HELPER path.");
  }
  const handle = window.getNativeWindowHandle();
  // Electron's X11 handle is the 32-bit XID, even on Linux x86-64.
  const id = handle.readUInt32LE(0);
  const { stdout } = await execFileAsync(helper, [String(id), enabled ? "on" : "off"], {
    timeout: 3000,
    maxBuffer: 4096,
  });
  return JSON.parse(stdout);
};

const ownWindow = (event) => {
  if (!spikeWindow || spikeWindow.isDestroyed() || event.sender !== spikeWindow.webContents) {
    throw new Error("Only the owned spike renderer may use this bridge.");
  }
  return spikeWindow;
};

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
    focusable: focusMode !== "nonfocusable",
    show: false,
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
  spikeWindow = window;

  window.setAlwaysOnTop(true);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  await window.loadURL(validateUrl(process.env.SVARA_SPIKE_URL ?? "http://127.0.0.1:1420"));
  if (focusMode === "managed-hints") await setInputHint(window, false);
  window.showInactive();
  console.log(
    "SVARA_SPIKE_EVENT",
    JSON.stringify({
      name: "window-contract",
      details: {
        alwaysOnTop: window.isAlwaysOnTop(),
        bounds: window.getBounds(),
        focusable: window.isFocusable(),
        focusMode,
        sessionType: process.env.XDG_SESSION_TYPE ?? null,
      },
    }),
  );
};

ipcMain.handle("svara-spike:set-input-regions", (event, regions) => {
  const window = ownWindow(event);
  const normalized = normalizeRegions(regions);
  window.setShape(normalized);
  return `native input shape · ${normalized.length} regions`;
});

ipcMain.handle("svara-spike:record-event", (event, name, details) => {
  ownWindow(event);
  console.log("SVARA_SPIKE_EVENT", JSON.stringify({ name, details }));
});

ipcMain.handle("svara-spike:get-window-position", (event) => {
  const window = ownWindow(event);
  const [x, y] = window.getPosition();
  return { x, y };
});

ipcMain.handle("svara-spike:set-window-position", (event, position) => {
  const window = ownWindow(event);
  const { x, y } = normalizePosition(position);
  window.setPosition(x, y);
});

ipcMain.handle("svara-spike:set-focusable", (event, focusable) => {
  if (typeof focusable !== "boolean") {
    throw new TypeError("Focusable state must be a boolean.");
  }
  const window = ownWindow(event);
  if (focusMode === "managed-hints") {
    throw new Error(
      "Use the interaction probe in managed-hints mode; no Linux setFocusable toggle.",
    );
  }
  window.setFocusable(focusable);
  if (focusable) {
    window.focus();
  }
  return `native focusable · ${window.isFocusable()} · focused · ${window.isFocused()}`;
});

ipcMain.handle("svara-spike:set-interaction", (event, open) => {
  if (typeof open !== "boolean") throw new TypeError("Interaction state must be boolean.");
  const window = ownWindow(event);
  if (focusMode !== "managed-hints") {
    throw new Error("The interaction experiment requires managed-hints mode.");
  }
  // Serialize native subprocesses: a delayed open must never overtake Escape/close.
  const change = focusChange.then(async () => {
    if (window.isDestroyed()) throw new Error("Spike closed before focus change.");
    const hints = await setInputHint(window, open);
    if (window.isDestroyed()) throw new Error("Spike closed during focus change.");
    if (open) window.focus();
    else window.blur();
    console.log(
      "SVARA_SPIKE_EVENT",
      JSON.stringify({ name: "interaction", details: { open, ...hints } }),
    );
    return { open, ...hints, focused: window.isFocused(), alwaysOnTop: window.isAlwaysOnTop() };
  });
  focusChange = change.catch(() => {});
  return change;
});

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });

app.on("window-all-closed", () => app.quit());

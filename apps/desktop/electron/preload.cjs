const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("svaraSpike", {
  getWindowPosition: () => ipcRenderer.invoke("svara-spike:get-window-position"),
  kind: "electron",
  recordEvent: (name, details) => ipcRenderer.invoke("svara-spike:record-event", name, details),
  setFocusable: (focusable) => ipcRenderer.invoke("svara-spike:set-focusable", focusable),
  setInputRegions: (regions) => ipcRenderer.invoke("svara-spike:set-input-regions", regions),
  setWindowPosition: (position) => ipcRenderer.invoke("svara-spike:set-window-position", position),
});

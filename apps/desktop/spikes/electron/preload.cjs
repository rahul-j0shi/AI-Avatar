const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("svaraSpike", {
  kind: "electron",
  recordEvent: (name, details) =>
    ipcRenderer.invoke("svara-spike:record-event", name, details),
  setInputRegions: (regions) =>
    ipcRenderer.invoke("svara-spike:set-input-regions", regions),
});

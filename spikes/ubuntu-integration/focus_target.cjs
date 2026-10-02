// Own-window keyboard fixture; never sends a model request or accesses clipboard/mic.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

app.commandLine.appendSwitch("ozone-platform", "x11");
app.setPath("userData", path.join(app.getPath("temp"), "svara-focus-target"));
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    title: "Svara focus target",
    x: 20,
    y: 70,
    width: 600,
    height: 300,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  await window.loadURL(
    'data:text/html,<title>Svara focus target</title><label>Focus test sentinel<textarea id="sentinel" autofocus></textarea></label>',
  );
  window.focus();
});
app.on("window-all-closed", () => app.quit());

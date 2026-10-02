// Interactive, opt-in check against TWO Svara test windows. Not a CI/Wayland acceptance test.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const xdo = (...args) => execFileSync("xdotool", args, { encoding: "utf8", timeout: 3000 }).trim();

const windowId = (title) => {
  // xdotool search also returns Mutter's frame window; use managed client IDs.
  const line = execFileSync("wmctrl", ["-l"], { encoding: "utf8", timeout: 3000 })
    .split("\n")
    .find((entry) => entry.endsWith(` ${title}`));
  if (!line) throw new Error(`Missing owned fixture window: ${title}`);
  return String(Number.parseInt(line.split(" ")[0], 16));
};

async function client(port, expectedUrl) {
  const pages = await (
    await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })
  ).json();
  const page = pages.find((entry) => entry.type === "page" && entry.url.startsWith(expectedUrl));
  if (!page) throw new Error(`Missing expected test page on port ${port}`);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP connection timeout")), 3000);
    socket.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
  });
  let id = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const response = JSON.parse(event.data);
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timer);
    if (response.error || response.result.exceptionDetails) request.reject(response);
    else request.resolve(response.result.result?.value ?? response.result);
  };
  return {
    close: () => socket.close(),
    evaluate: (expression) =>
      new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error("CDP request timeout"));
        }, 5000);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(
          JSON.stringify({
            id: requestId,
            method: "Runtime.evaluate",
            params: { expression, awaitPromise: true, returnByValue: true },
          }),
        );
      }),
  };
}

async function main() {
  if (!process.argv.includes("--allow-test-input") || process.env.XDG_SESSION_TYPE !== "x11") {
    throw new Error(
      "Requires --allow-test-input and an X11 session; Wayland uses the manual matrix.",
    );
  }
  const previous = xdo("getactivewindow");
  const pointer = xdo("getmouselocation", "--shell");
  const pointerX = pointer.match(/^X=(\d+)$/m)?.[1];
  const pointerY = pointer.match(/^Y=(\d+)$/m)?.[1];
  const spike = await client(9223, "http://127.0.0.1:1420/");
  let target;
  let position;
  try {
    target = await client(9224, "data:text/html,");
    const targetId = windowId("Svara focus target");
    const spikeId = windowId("Svara shell spike");
    await spike.evaluate(
      'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Close interaction (Esc)")?.click()',
    );
    await spike.evaluate("window.svaraSpike.setInteraction(false)");
    const open = async (kind) => {
      await spike.evaluate(
        `Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Probe ${kind} interaction").click()`,
      );
      await wait(300);
    };
    await target.evaluate('document.querySelector("textarea").value=""');
    xdo("windowactivate", "--sync", targetId);
    await target.evaluate('document.querySelector("textarea").focus()');
    position = await spike.evaluate("window.svaraSpike.getWindowPosition()");
    const region = await spike.evaluate(
      '(()=>{const b=document.querySelector("canvas").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()',
    );
    const x = Math.round(position.x + region.x);
    const y = Math.round(position.y + region.y);
    xdo("mousemove", String(x), String(y));
    xdo("click", "1");
    await wait(200);
    assert.equal(xdo("getactivewindow"), targetId, "idle click stole focus");
    xdo("type", "--clearmodifiers", "idle-sentinel");
    assert.equal(
      await target.evaluate('document.querySelector("textarea").value'),
      "idle-sentinel",
    );
    xdo("mousedown", "1");
    xdo("mousemove", String(x + 60), String(y + 35));
    await wait(200);
    xdo("mouseup", "1");
    await wait(200);
    assert.deepEqual(await spike.evaluate("window.svaraSpike.getWindowPosition()"), {
      x: position.x + 60,
      y: position.y + 35,
    });
    assert.equal(xdo("getactivewindow"), targetId, "drag stole focus");
    await open("Type");
    assert.equal(xdo("getactivewindow"), spikeId, "Type did not activate");
    xdo("key", "ctrl+a");
    xdo("key", "BackSpace");
    xdo("type", "--clearmodifiers", "typed-sentinel");
    assert.equal(
      await spike.evaluate('document.querySelector("input[aria-label]").value'),
      "typed-sentinel",
    );
    xdo("key", "Escape");
    await wait(300);
    assert.equal(await spike.evaluate('document.querySelector("[role=dialog]") === null'), true);
    const hints = execFileSync(
      "xprop",
      ["-id", spikeId, "WM_HINTS", "WM_PROTOCOLS", "_NET_WM_STATE"],
      { encoding: "utf8", timeout: 3000 },
    );
    assert.match(hints, /Client accepts input or input focus: False/);
    assert.doesNotMatch(hints, /WM_TAKE_FOCUS/);
    assert.match(hints, /_NET_WM_STATE_ABOVE/);
    await open("approval");
    assert.equal(xdo("getactivewindow"), spikeId);
    assert.equal(await spike.evaluate("document.activeElement.textContent"), "Allow once");
    xdo("key", "Tab");
    assert.equal(await spike.evaluate("document.activeElement.textContent"), "Always allow");
    xdo("key", "Tab");
    xdo("key", "Return");
    await wait(300);
    assert.match(
      await spike.evaluate('document.querySelector(".model-status").textContent'),
      /Deny/,
    );
    const final = await spike.evaluate(
      "Promise.all([window.svaraSpike.setInteraction(true),window.svaraSpike.setInteraction(false)]).then(r=>r[1])",
    );
    assert.equal(final.inputHint, false);
    assert.equal(final.overrideRedirect, false);
    assert.equal(final.alwaysOnTop, true);
    await assert.rejects(spike.evaluate('window.svaraSpike.setInteraction("true")'));
    await spike.evaluate(`window.svaraSpike.setWindowPosition(${JSON.stringify(position)})`);
    console.log(
      JSON.stringify({
        sessionType: "x11",
        status: "passed",
        checks: 10,
        waylandAcceptance: false,
      }),
    );
  } finally {
    // Release any synthetic pointer hold, close only our CDP sockets, restore prior focus best-effort.
    try {
      xdo("mouseup", "1");
    } catch {}
    try {
      await spike.evaluate(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Close interaction (Esc)")?.click()',
      );
      await spike.evaluate("window.svaraSpike.setInteraction(false)");
      if (position) {
        await spike.evaluate(`window.svaraSpike.setWindowPosition(${JSON.stringify(position)})`);
      }
      xdo("windowactivate", previous);
      if (pointerX && pointerY) xdo("mousemove", pointerX, pointerY);
    } catch {}
    target?.close();
    spike.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Development page only: sample submitted render frames, never record screen/microphone content.
const assert = require("node:assert/strict");
const { client } = require("./focus_check.cjs");

async function main() {
  if (!process.argv.includes("--allow-render-probe")) {
    throw new Error(
      "Use --allow-render-probe to start the owned page's 10-second idle measurement.",
    );
  }
  const page = await client(9223, "http://127.0.0.1:1420/");
  try {
    const context = await page.evaluate(`(() => {
      const canvas = document.querySelector("canvas");
      const gl = canvas.getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        hidden: document.hidden,
        dpr: devicePixelRatio,
        model: document.querySelector(".model-status").textContent,
        canvas: {width: canvas.width, height: canvas.height},
        gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
        before: JSON.parse(document.querySelector("pre").textContent).generatedAt
      };
    })()`);
    assert.match(context.model, /^VRM loaded:/, "Load the real VRM before measuring");
    let replacements = 0;
    if (process.argv.includes("--replace-20")) {
      assert.equal(context.hidden, false, "Restore the owned window before replacement testing");
      for (let index = 0; index < 20; index++) {
        await page.evaluate(`(async () => {
          const response = await fetch("/spike-assets/avatar.vrm");
          if (!response.ok) throw new Error("Missing local VRM fixture");
          const transfer = new DataTransfer();
          transfer.items.add(new File([await response.blob()], "replacement-${index}.vrm"));
          const input = document.querySelector('input[type="file"]');
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", {bubbles: true}));
        })()`);
        let loaded = false;
        for (let attempt = 0; attempt < 40; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          loaded = await page.evaluate(
            '/^VRM loaded:/.test(document.querySelector(".model-status").textContent)',
          );
          if (loaded) break;
        }
        assert.ok(loaded, `VRM replacement ${index + 1} failed/timed out`);
        replacements++;
      }
    }
    await page.evaluate(`(() => {
      const button = Array.from(document.querySelectorAll("button"))
        .find(b => b.textContent === "Measure idle · 30 fps");
      if (!button || button.disabled) throw new Error("Idle probe is not ready");
      button.click();
    })()`);
    let result;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      result = await page.evaluate('JSON.parse(document.querySelector("pre").textContent)');
      if (result.generatedAt !== context.before) break;
    }
    assert.notEqual(result.generatedAt, context.before, "Render probe timed out");
    const hiddenAfter = await page.evaluate("document.hidden");
    assert.equal(hiddenAfter, context.hidden, "Visibility changed during frame sample");
    const { before: _before, ...metadata } = context;
    console.log(
      JSON.stringify({
        ...metadata,
        replacements,
        idle: result.idle,
        limitation: "Ten-second submitted-frame sample, not presented-frame or CPU acceptance",
      }),
    );
  } finally {
    page.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

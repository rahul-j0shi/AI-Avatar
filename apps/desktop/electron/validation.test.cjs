const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalizeRegions, normalizePosition, validateUrl } = require("./validation.cjs");

test("input rectangles clip to the fixed window and allow empty click-through", () => {
  assert.deepEqual(normalizeRegions([]), []);
  assert.deepEqual(normalizeRegions([{ x: -10, y: -10, width: 20, height: 20 }]), [
    { x: 0, y: 0, width: 10, height: 10 },
  ]);
  assert.deepEqual(normalizeRegions([{ x: 470, y: 630, width: 40, height: 40 }]), [
    { x: 470, y: 630, width: 10, height: 10 },
  ]);
});
test("invalid input rectangles are rejected, not coerced", () => {
  for (const region of [
    null,
    {},
    { x: "1", y: 0, width: 2, height: 2 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: Infinity, y: 0, width: 1, height: 1 },
    { x: 480, y: 0, width: 1, height: 1 },
  ]) {
    assert.throws(() => normalizeRegions([region]));
  }
  assert.throws(() => normalizeRegions(Array(17).fill({})));
});
test("positions allow negative monitors but reject coercion", () => {
  assert.deepEqual(normalizePosition({ x: -50.9, y: 10.2 }), { x: -50, y: 10 });
  for (const value of [null, {}, { x: null, y: 1 }, { x: "1", y: 2 }, { x: NaN, y: 2 }]) {
    assert.throws(() => normalizePosition(value));
  }
});
test("only the loopback spike origin can be loaded", () => {
  assert.equal(validateUrl("http://127.0.0.1:1420"), "http://127.0.0.1:1420/");
  for (const url of [
    "https://example.com",
    "file:///tmp/index.html",
    "http://127.0.0.1:9999",
    "http://user:pass@127.0.0.1:1420",
  ]) {
    assert.throws(() => validateUrl(url));
  }
});

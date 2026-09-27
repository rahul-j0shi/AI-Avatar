const WIDTH = 480;
const HEIGHT = 640;

const normalizeRegions = (regions) => {
  if (!Array.isArray(regions) || regions.length > 16) {
    throw new TypeError("Expected at most 16 input regions.");
  }
  return regions.map((region) => {
    if (!region || ![region.x, region.y, region.width, region.height].every(Number.isFinite)) {
      throw new TypeError("Input regions must contain finite numeric coordinates.");
    }
    const rawX = Math.trunc(region.x);
    const rawY = Math.trunc(region.y);
    const x = Math.max(0, rawX);
    const y = Math.max(0, rawY);
    const width = Math.min(WIDTH, rawX + Math.trunc(region.width)) - x;
    const height = Math.min(HEIGHT, rawY + Math.trunc(region.height)) - y;
    if (width <= 0 || height <= 0) {
      throw new RangeError("Input regions must intersect the window with positive size.");
    }
    return { x, y, width, height };
  });
};
const normalizePosition = (position) => {
  if (!position || ![position.x, position.y].every(Number.isFinite)) {
    throw new TypeError("Window position must contain finite numeric x and y coordinates.");
  }
  return { x: Math.trunc(position.x), y: Math.trunc(position.y) };
};
const validateUrl = (value) => {
  const url = new URL(value);
  if (url.origin !== "http://127.0.0.1:1420" || url.username || url.password) {
    throw new Error("The development spike only loads http://127.0.0.1:1420.");
  }
  return url.href;
};
module.exports = { WIDTH, HEIGHT, normalizeRegions, normalizePosition, validateUrl };

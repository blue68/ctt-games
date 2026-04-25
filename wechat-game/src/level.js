import { TOTAL_LEVELS } from "./config";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getLevelConfig(level) {
  const calculatedMax = Math.round(10 + 4.3 * (Math.pow(1.047, level - 1) - 1) + level * 1.1);
  const maxNumber = level >= TOTAL_LEVELS ? 100 : clamp(calculatedMax, 12, 99);
  const cells = Math.max(maxNumber, Math.ceil(maxNumber * (1.08 + level * 0.004)));
  const cols = clamp(Math.ceil(Math.sqrt(cells * 0.82)), 4, 11);
  const rows = Math.ceil(cells / cols);
  return {
    level,
    maxNumber,
    cols,
    rows,
    fontSize: clamp(34 - level * 0.42, 14, 34),
    hitRadius: clamp(34 - level * 0.32, 20, 34),
    seed: level * 971,
  };
}

export function createTargets(level, width, height, seedOffset = 0) {
  const config = getLevelConfig(level);
  const random = mulberry32(config.seed + seedOffset);
  const centers = makeCenters(config, random);
  const pool = shuffle(centers, random).slice(0, config.maxNumber);
  const numbers = shuffle(Array.from({ length: config.maxNumber }, (_, index) => index + 1), random);
  return numbers.map((number, index) => ({
    number,
    found: false,
    x: pool[index].x * width,
    y: pool[index].y * height,
    color: pickColor(random),
    tilt: (random() - 0.5) * Math.min(level, 26) * 0.018,
  }));
}

function makeCenters(config, random) {
  const variant = config.level % 6;
  if (variant === 1) return makeGridCenters(config, random, 0.42);
  if (variant === 2) return makeRingCenters(config, random, false);
  if (variant === 3) return makeRibbonCenters(config, random);
  if (variant === 4) return makeRingCenters(config, random, true);
  if (variant === 5) return makeBubbleCenters(config, random);
  return makeGridCenters(config, random, 0.62);
}

function makeGridCenters(config, random, jitter) {
  const centers = [];
  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.cols; x += 1) {
      centers.push({
        x: clamp((x + 0.5 + (random() - 0.5) * jitter) / config.cols, 0.04, 0.96),
        y: clamp((y + 0.5 + (random() - 0.5) * jitter) / config.rows, 0.04, 0.96),
      });
    }
  }
  return centers;
}

function makeRingCenters(config, random, spiral) {
  const centers = [];
  const rings = clamp(Math.ceil(Math.sqrt(config.maxNumber / 1.45)) + 2, 4, 10);
  const baseSegments = Math.ceil(config.maxNumber / rings);
  for (let r = 0; r < rings; r += 1) {
    const radius = 0.08 + ((r + 0.5) / rings) * 0.42;
    const segments = Math.max(5 + r, baseSegments + Math.floor(r * 1.15));
    const offset = spiral ? r * 0.34 + random() * 0.18 : random() * 0.16;
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * Math.PI * 2 + offset;
      centers.push({
        x: clamp(0.5 + Math.cos(angle) * radius, 0.04, 0.96),
        y: clamp(0.5 + Math.sin(angle) * radius, 0.04, 0.96),
      });
    }
  }
  return centers;
}

function makeRibbonCenters(config, random) {
  const centers = [];
  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.cols; x += 1) {
      const offset = y % 2 === 0 ? 0 : 0.5;
      centers.push({
        x: clamp((x + 0.5 + offset + (random() - 0.5) * 0.52) / config.cols, 0.04, 0.96),
        y: clamp((y + 0.5 + (random() - 0.5) * 0.22) / config.rows, 0.04, 0.96),
      });
    }
  }
  return centers;
}

function makeBubbleCenters(config, random) {
  return makeGridCenters(config, random, 0.78);
}

function pickColor(random) {
  const colors = ["#191816", "#1727a4", "#12813b", "#d93b3b", "#d3a00f"];
  return colors[Math.floor(random() * colors.length)];
}


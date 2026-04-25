const TOTAL_LEVELS = 49;
const COLORS = ["#191816", "#1727a4", "#12813b", "#d93b3b", "#d3a00f"];
const PATTERNS = ["plain", "cream", "stripe", "dot", "wash"];
const STORAGE_KEY = "focus-grid-best-v1";
const QUOTES = [
  { type: "励志格言", text: "真正的速度，来自一次只做一件事的专注。" },
  { type: "哲学格言", text: "世界很吵，能把目光收回来的人，已经赢了一半。" },
  { type: "励志格言", text: "每一次准确点击，都是大脑在练习更清醒地选择。" },
  { type: "哲学格言", text: "所谓成长，是在混乱中仍能看见下一个正确目标。" },
  { type: "励志格言", text: "别急着追赶所有答案，先稳稳找到眼前的 1。" },
  { type: "哲学格言", text: "注意力投向哪里，人生的形状就从哪里开始改变。" },
  { type: "励志格言", text: "快不是慌张，快是判断清楚之后毫不犹豫。" },
  { type: "哲学格言", text: "秩序不是世界给的，是你在纷杂里亲手整理出来的。" },
  { type: "励志格言", text: "专注不是天赋，是一次次回到目标的训练。" },
  { type: "哲学格言", text: "看见细节的人，更容易穿过生活的迷雾。" },
  { type: "励志格言", text: "今天比昨天更快一秒，都是值得记录的进步。" },
  { type: "哲学格言", text: "人的心越安静，越能在复杂里发现简单。" },
];

const $ = (id) => document.getElementById(id);

const els = {
  startPanel: $("startPanel"),
  gamePanel: $("gamePanel"),
  resultPanel: $("resultPanel"),
  pausePanel: $("pausePanel"),
  board: $("board"),
  levelLabel: $("levelLabel"),
  nextLabel: $("nextLabel"),
  rangeLabel: $("rangeLabel"),
  timerLabel: $("timerLabel"),
  progressBar: $("progressBar"),
  comboLabel: $("comboLabel"),
  bestLabel: $("bestLabel"),
  starLabel: $("starLabel"),
  resultKicker: $("resultKicker"),
  resultTitle: $("resultTitle"),
  resultText: $("resultText"),
  resultStars: $("resultStars"),
  resultRank: $("resultRank"),
  quoteType: $("quoteType"),
  quoteText: $("quoteText"),
  shareCopy: $("shareCopy"),
  posterWrap: $("posterWrap"),
  posterImg: $("posterImg"),
};

const state = {
  level: 1,
  maxNumber: 12,
  next: 1,
  combo: 0,
  startedAt: 0,
  pausedAt: 0,
  pausedMs: 0,
  timerId: 0,
  lastResult: null,
  lastPosterUrl: "",
  isPractice: false,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getLevelConfig(level, isPractice = false) {
  if (isPractice) {
    return {
      level: 1,
      isPractice: true,
      maxNumber: 12,
      cols: 4,
      rows: 4,
      fontSize: 30,
      tapSize: 54,
      colorNoise: 0.3,
      patternNoise: 0.1,
      clutterNoise: 0.08,
      time3: 13,
      time2: 19,
    };
  }

  const calculatedMax = Math.round(10 + 4.3 * (Math.pow(1.047, level - 1) - 1) + level * 1.1);
  const maxNumber = level >= TOTAL_LEVELS ? 100 : clamp(calculatedMax, 12, 99);
  const cells = Math.max(maxNumber, Math.ceil(maxNumber * (1.08 + level * 0.004)));
  const cols = clamp(Math.ceil(Math.sqrt(cells * 0.82)), 4, 11);
  const rows = Math.ceil(cells / cols);
  const density = maxNumber / 100;

  return {
    level,
    isPractice: false,
    maxNumber,
    cols,
    rows,
    fontSize: clamp(32 - level * 0.4, 13, 32),
    tapSize: clamp(58 - level * 0.56, 31, 58),
    colorNoise: clamp(0.22 + level * 0.019, 0.22, 0.86),
    patternNoise: clamp(0.1 + level * 0.017, 0.1, 0.78),
    clutterNoise: clamp(0.08 + level * 0.012, 0.08, 0.56),
    time3: clamp(maxNumber * (0.95 - density * 0.28), 28, 74),
    time2: clamp(maxNumber * (1.34 - density * 0.22), 42, 112),
  };
}

function getBest(level) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return data[level] || null;
  } catch {
    return null;
  }
}

function setBest(level, seconds) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!data[level] || seconds < data[level]) {
      data[level] = seconds;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // localStorage can be unavailable in private embedded browsers.
  }
}

function getElapsedSeconds() {
  return (performance.now() - state.startedAt - state.pausedMs) / 1000;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  return `${seconds.toFixed(1)}s`;
}

function getStars(seconds, config) {
  if (seconds <= config.time3) return 3;
  if (seconds <= config.time2) return 2;
  return 1;
}

function getRank(stars, level) {
  if (level >= TOTAL_LEVELS && stars >= 2) return "鹰眼大师";
  if (level >= 40) return "闪电观察者";
  if (level >= 25) return "专注高手";
  if (stars === 3) return "反应达人";
  return "专注新星";
}

function getRewardQuote(level, stars, seconds) {
  const seed = Math.round(level * 17 + stars * 31 + seconds);
  return QUOTES[seed % QUOTES.length];
}

function updateTimer() {
  els.timerLabel.textContent = formatTime(getElapsedSeconds());
}

function startTimer() {
  clearInterval(state.timerId);
  state.startedAt = performance.now();
  state.pausedMs = 0;
  state.pausedAt = 0;
  updateTimer();
  state.timerId = setInterval(updateTimer, 100);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = 0;
}

function makeBoardSvg(config, random) {
  const variant = config.isPractice ? 0 : config.level % 8;
  if (variant === 1) return makeTriangleBoardSvg(config, random);
  if (variant === 2) return makeRingBoardSvg(config, random, false);
  if (variant === 3) return makeRibbonBoardSvg(config, random);
  if (variant === 4) return makeRingBoardSvg(config, random, true);
  if (variant === 5) return makeDiagonalShardBoardSvg(config, random);
  if (variant === 6) return makeBubbleBoardSvg(config, random);
  if (variant === 7) return makeMixedShapeBoardSvg(config, random);
  return makeGridBoardSvg(config, random);
}

function wrapSvg(polygons, centers, config, random) {
  const clutter = config && random ? makeVisualClutter(config, random) : "";
  return {
    svg: `<svg class="cell-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${makePatternDefs()}${polygons.join("")}${clutter}</svg>`,
    centers,
  };
}

function makeGridBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const colW = width / config.cols;
  const rowH = height / config.rows;
  const points = [];

  for (let y = 0; y <= config.rows; y += 1) {
    const row = [];
    for (let x = 0; x <= config.cols; x += 1) {
      const edge = x === 0 || y === 0 || x === config.cols || y === config.rows;
      row.push({
        x: x * colW + (edge ? 0 : (random() - 0.5) * colW * 0.38),
        y: y * rowH + (edge ? 0 : (random() - 0.5) * rowH * 0.38),
      });
    }
    points.push(row);
  }

  const polygons = [];
  const centers = [];

  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.cols; x += 1) {
      const p1 = points[y][x];
      const p2 = points[y][x + 1];
      const p3 = points[y + 1][x + 1];
      const p4 = points[y + 1][x];
      const fill = makeCellFill(config, random);
      polygons.push(`<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}" fill="${fill}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`);
      centers.push({
        x: ((p1.x + p2.x + p3.x + p4.x) / 4 / width) * 100,
        y: ((p1.y + p2.y + p3.y + p4.y) / 4 / height) * 100,
      });
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeTriangleBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const colW = width / config.cols;
  const rowH = height / config.rows;
  const points = [];
  const polygons = [];
  const centers = [];

  for (let y = 0; y <= config.rows; y += 1) {
    const row = [];
    for (let x = 0; x <= config.cols; x += 1) {
      const edge = x === 0 || y === 0 || x === config.cols || y === config.rows;
      row.push({
        x: x * colW + (edge ? 0 : (random() - 0.5) * colW * 0.52),
        y: y * rowH + (edge ? 0 : (random() - 0.5) * rowH * 0.52),
      });
    }
    points.push(row);
  }

  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.cols; x += 1) {
      const p1 = points[y][x];
      const p2 = points[y][x + 1];
      const p3 = points[y + 1][x + 1];
      const p4 = points[y + 1][x];
      const tris = random() > 0.5 ? [[p1, p2, p3], [p1, p3, p4]] : [[p1, p2, p4], [p2, p3, p4]];

      tris.forEach((tri) => {
        polygons.push(`<polygon points="${tri.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${makeCellFill(config, random)}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`);
        centers.push({
          x: (tri.reduce((sum, p) => sum + p.x, 0) / 3 / width) * 100,
          y: (tri.reduce((sum, p) => sum + p.y, 0) / 3 / height) * 100,
        });
      });
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeRibbonBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const rows = Math.max(4, config.rows);
  const cols = Math.max(4, config.cols);
  const rowH = height / rows;
  const polygons = [];
  const centers = [];

  for (let y = 0; y < rows; y += 1) {
    const top = y * rowH;
    const bottom = y === rows - 1 ? height : (y + 1) * rowH + (random() - 0.5) * rowH * 0.24;
    const offset = y % 2 === 0 ? 0 : width / cols / 2;
    const bounds = [];

    for (let x = 0; x <= cols; x += 1) {
      const edge = x === 0 || x === cols;
      bounds.push(clamp(x * (width / cols) + (edge ? 0 : offset + (random() - 0.5) * 54), 0, width));
    }

    bounds.sort((a, b) => a - b);

    for (let x = 0; x < cols; x += 1) {
      const left = bounds[x];
      const right = bounds[x + 1];
      const skew = (random() - 0.5) * 46;
      const p1 = { x: left, y: top + (random() - 0.5) * 24 };
      const p2 = { x: right, y: top + skew };
      const p3 = { x: clamp(right - skew * 0.35, 0, width), y: bottom };
      const p4 = { x: clamp(left - skew * 0.25, 0, width), y: bottom + (random() - 0.5) * 24 };
      const quad = [p1, p2, p3, p4];
      polygons.push(`<polygon points="${quad.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${makeCellFill(config, random)}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`);
      centers.push({
        x: (quad.reduce((sum, p) => sum + p.x, 0) / 4 / width) * 100,
        y: (quad.reduce((sum, p) => sum + p.y, 0) / 4 / height) * 100,
      });
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeDiagonalShardBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const cols = Math.max(config.cols, 5);
  const rows = Math.max(config.rows, 5);
  const cellW = width / cols;
  const cellH = height / rows;
  const polygons = [];
  const centers = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const left = x * cellW;
      const top = y * cellH;
      const right = x === cols - 1 ? width : (x + 1) * cellW;
      const bottom = y === rows - 1 ? height : (y + 1) * cellH;
      const lean = (random() - 0.5) * cellW * 0.42;
      const p1 = { x: left + (random() - 0.5) * 18, y: top };
      const p2 = { x: right + lean, y: top + (random() - 0.5) * 20 };
      const p3 = { x: right - lean * 0.45, y: bottom };
      const p4 = { x: left - lean * 0.35, y: bottom + (random() - 0.5) * 20 };

      if (random() > 0.45) {
        const mid = {
          x: (left + right) / 2 + (random() - 0.5) * cellW * 0.35,
          y: (top + bottom) / 2 + (random() - 0.5) * cellH * 0.35,
        };
        [[p1, p2, mid], [p2, p3, mid], [p3, p4, mid], [p4, p1, mid]].forEach((shape) => {
          polygons.push(makePolygon(shape, config, random));
          centers.push(getShapeCenter(shape, width, height));
        });
      } else {
        const shape = [p1, p2, p3, p4];
        polygons.push(makePolygon(shape, config, random));
        centers.push(getShapeCenter(shape, width, height));
      }
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeBubbleBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const cols = config.cols;
  const rows = config.rows;
  const cellW = width / cols;
  const cellH = height / rows;
  const polygons = [];
  const centers = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cx = x * cellW + cellW / 2 + (random() - 0.5) * cellW * 0.32;
      const cy = y * cellH + cellH / 2 + (random() - 0.5) * cellH * 0.32;
      const rx = cellW * (0.42 + random() * 0.22);
      const ry = cellH * (0.36 + random() * 0.24);
      const rotate = (random() - 0.5) * 46;
      const fill = makeCellFill(config, random);
      polygons.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})" fill="${fill}" stroke="rgba(25,24,22,.48)" stroke-width="3" />`);
      centers.push({
        x: clamp((cx / width) * 100, 4, 96),
        y: clamp((cy / height) * 100, 4, 96),
      });

      if (random() < config.clutterNoise) {
        const r = Math.min(rx, ry) * (0.34 + random() * 0.22);
        polygons.push(`<circle cx="${cx + (random() - 0.5) * rx}" cy="${cy + (random() - 0.5) * ry}" r="${r}" fill="none" stroke="rgba(25,24,22,.16)" stroke-width="3" />`);
      }
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeMixedShapeBoardSvg(config, random) {
  const width = 1000;
  const height = 1000;
  const cols = config.cols;
  const rows = config.rows;
  const cellW = width / cols;
  const cellH = height / rows;
  const polygons = [];
  const centers = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cx = x * cellW + cellW / 2 + (random() - 0.5) * cellW * 0.24;
      const cy = y * cellH + cellH / 2 + (random() - 0.5) * cellH * 0.24;
      const mode = Math.floor(random() * 4);

      if (mode === 0) {
        const rx = cellW * 0.46;
        const ry = cellH * 0.36;
        polygons.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${(random() - 0.5) * 60} ${cx} ${cy})" fill="${makeCellFill(config, random)}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`);
        centers.push({ x: (cx / width) * 100, y: (cy / height) * 100 });
      } else if (mode === 1) {
        const points = makeStarPoints(cx, cy, Math.min(cellW, cellH) * 0.42, 5 + Math.floor(random() * 3), random);
        polygons.push(makePolygon(points, config, random));
        centers.push(getShapeCenter(points, width, height));
      } else if (mode === 2) {
        const points = makeBlobPoints(cx, cy, cellW * 0.5, cellH * 0.44, random);
        polygons.push(makePolygon(points, config, random));
        centers.push(getShapeCenter(points, width, height));
      } else {
        const points = [
          { x: cx, y: cy - cellH * 0.44 },
          { x: cx + cellW * 0.46, y: cy },
          { x: cx, y: cy + cellH * 0.44 },
          { x: cx - cellW * 0.46, y: cy },
        ];
        polygons.push(makePolygon(points, config, random));
        centers.push(getShapeCenter(points, width, height));
      }
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeRingBoardSvg(config, random, spiral) {
  const width = 1000;
  const height = 1000;
  const cx = 500;
  const cy = 500;
  const minRadius = spiral ? 76 : 58;
  const maxRadius = spiral ? 492 : 476;
  const rings = clamp(Math.ceil(Math.sqrt(config.maxNumber / 1.45)) + 2, 4, 10);
  const baseSegments = Math.ceil(config.maxNumber / rings);
  const polygons = [];
  const centers = [];

  for (let r = 0; r < rings; r += 1) {
    const inner = minRadius + (r / rings) * (maxRadius - minRadius);
    const outer = minRadius + ((r + 1) / rings) * (maxRadius - minRadius);
    const segments = Math.max(5 + r, baseSegments + Math.floor(r * 1.15));
    const offset = spiral ? r * 0.34 + random() * 0.18 : random() * 0.16;

    for (let s = 0; s < segments; s += 1) {
      const a1 = ((s / segments) * Math.PI * 2) + offset;
      const a2 = (((s + 1) / segments) * Math.PI * 2) + offset + (random() - 0.5) * 0.035;
      const path = makeSectorPath(cx, cy, inner, outer, a1, a2);
      const midAngle = (a1 + a2) / 2;
      const midRadius = (inner + outer) / 2;
      polygons.push(`<path d="${path}" fill="${makeCellFill(config, random)}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`);
      centers.push({
        x: clamp(((cx + Math.cos(midAngle) * midRadius) / width) * 100, 4, 96),
        y: clamp(((cy + Math.sin(midAngle) * midRadius) / height) * 100, 4, 96),
      });
    }
  }

  return wrapSvg(polygons, centers, config, random);
}

function makeSectorPath(cx, cy, inner, outer, a1, a2) {
  const largeArc = a2 - a1 > Math.PI ? 1 : 0;
  const o1 = { x: cx + Math.cos(a1) * outer, y: cy + Math.sin(a1) * outer };
  const o2 = { x: cx + Math.cos(a2) * outer, y: cy + Math.sin(a2) * outer };

  if (inner <= 1) {
    return `M ${cx} ${cy} L ${o1.x} ${o1.y} A ${outer} ${outer} 0 ${largeArc} 1 ${o2.x} ${o2.y} Z`;
  }

  const i1 = { x: cx + Math.cos(a1) * inner, y: cy + Math.sin(a1) * inner };
  const i2 = { x: cx + Math.cos(a2) * inner, y: cy + Math.sin(a2) * inner };
  return `M ${o1.x} ${o1.y} A ${outer} ${outer} 0 ${largeArc} 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${inner} ${inner} 0 ${largeArc} 0 ${i1.x} ${i1.y} Z`;
}

function makePolygon(points, config, random) {
  const safePoints = points.map((point) => ({
    x: clamp(point.x, 0, 1000),
    y: clamp(point.y, 0, 1000),
  }));
  return `<polygon points="${safePoints.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${makeCellFill(config, random)}" stroke="rgba(25,24,22,.5)" stroke-width="3" />`;
}

function getShapeCenter(points, width, height) {
  return {
    x: clamp((points.reduce((sum, point) => sum + point.x, 0) / points.length / width) * 100, 4, 96),
    y: clamp((points.reduce((sum, point) => sum + point.y, 0) / points.length / height) * 100, 4, 96),
  };
}

function makeStarPoints(cx, cy, radius, spikes, random) {
  const points = [];
  const start = random() * Math.PI;
  for (let i = 0; i < spikes * 2; i += 1) {
    const currentRadius = i % 2 === 0 ? radius : radius * (0.44 + random() * 0.14);
    const angle = start + (i / (spikes * 2)) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * currentRadius,
      y: cy + Math.sin(angle) * currentRadius,
    });
  }
  return points;
}

function makeBlobPoints(cx, cy, rx, ry, random) {
  const points = [];
  const total = 7 + Math.floor(random() * 4);
  const start = random() * Math.PI;
  for (let i = 0; i < total; i += 1) {
    const angle = start + (i / total) * Math.PI * 2;
    const wobble = 0.72 + random() * 0.46;
    points.push({
      x: cx + Math.cos(angle) * rx * wobble,
      y: cy + Math.sin(angle) * ry * wobble,
    });
  }
  return points;
}

function makeVisualClutter(config, random) {
  const count = Math.floor(config.maxNumber * config.clutterNoise);
  const pieces = [];

  for (let i = 0; i < count; i += 1) {
    const x = 30 + random() * 940;
    const y = 30 + random() * 940;
    const color = COLORS[Math.floor(random() * COLORS.length)];
    const opacity = 0.07 + random() * 0.1;

    if (random() < 0.42) {
      const x2 = clamp(x + (random() - 0.5) * 180, 0, 1000);
      const y2 = clamp(y + (random() - 0.5) * 180, 0, 1000);
      pieces.push(`<path d="M ${x} ${y} L ${x2} ${y2}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${2 + random() * 4}" />`);
    } else if (random() < 0.72) {
      pieces.push(`<circle cx="${x}" cy="${y}" r="${8 + random() * 22}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="3" />`);
    } else {
      pieces.push(`<text x="${x}" y="${y}" fill="${color}" fill-opacity="${opacity}" font-size="${32 + random() * 42}" font-weight="900" transform="rotate(${(random() - 0.5) * 80} ${x} ${y})">${1 + Math.floor(random() * config.maxNumber)}</text>`);
    }
  }

  return pieces.join("");
}

function makePatternDefs() {
  return `
    <defs>
      <pattern id="pat-stripe-a" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <rect width="32" height="32" fill="#fffdfa" />
        <rect width="8" height="32" fill="rgba(211,160,15,.14)" />
      </pattern>
      <pattern id="pat-stripe-b" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <rect width="28" height="28" fill="#fffdfa" />
        <rect width="5" height="28" fill="rgba(18,129,59,.12)" />
      </pattern>
      <pattern id="pat-dot-a" width="34" height="34" patternUnits="userSpaceOnUse">
        <rect width="34" height="34" fill="#fffdfa" />
        <circle cx="8" cy="8" r="3" fill="rgba(217,59,59,.16)" />
        <circle cx="25" cy="23" r="2.5" fill="rgba(23,39,164,.13)" />
      </pattern>
      <pattern id="pat-grid-a" width="36" height="36" patternUnits="userSpaceOnUse">
        <rect width="36" height="36" fill="#fffdfa" />
        <path d="M0 18h36M18 0v36" stroke="rgba(25,24,22,.09)" stroke-width="2" />
      </pattern>
      <pattern id="pat-cross-a" width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <rect width="42" height="42" fill="#fffdfa" />
        <path d="M6 6l30 30M36 6L6 36" stroke="rgba(217,59,59,.1)" stroke-width="4" />
      </pattern>
      <pattern id="pat-wave-a" width="52" height="30" patternUnits="userSpaceOnUse">
        <rect width="52" height="30" fill="#fffdfa" />
        <path d="M0 15c13-18 26 18 39 0s26 18 39 0" fill="none" stroke="rgba(23,39,164,.12)" stroke-width="4" />
      </pattern>
    </defs>`;
}

function makeCellFill(config, random) {
  if (random() > config.patternNoise) return "#fffdfa";
  const hue = Math.floor(35 + random() * 120);
  const alpha = 0.08 + random() * 0.13;
  const pattern = PATTERNS[Math.floor(random() * PATTERNS.length)];

  if (pattern === "cream") return `hsla(${hue}, 72%, 74%, ${alpha})`;
  if (pattern === "stripe") return random() > 0.5 ? "url(#pat-stripe-a)" : "url(#pat-stripe-b)";
  if (pattern === "dot") return random() > 0.5 ? "url(#pat-dot-a)" : "url(#pat-cross-a)";
  if (pattern === "wash") return `hsla(${hue + 30}, 76%, 70%, ${alpha + 0.02})`;
  return random() > 0.5 ? "url(#pat-grid-a)" : "url(#pat-wave-a)";
}

function renderLevel() {
  const config = getLevelConfig(state.level, state.isPractice);
  const random = mulberry32(state.level * 971 + (state.isPractice ? 17 : 0));
  const { svg, centers } = makeBoardSvg(config, random);
  const numbers = shuffle(Array.from({ length: config.maxNumber }, (_, index) => index + 1), random);
  const centerPool = shuffle(centers, random).slice(0, config.maxNumber);

  state.maxNumber = config.maxNumber;
  state.next = 1;
  state.combo = 0;

  els.levelLabel.textContent = state.isPractice ? "体验关" : `第 ${state.level} / ${TOTAL_LEVELS} 关`;
  els.nextLabel.textContent = "找 1";
  els.rangeLabel.textContent = `快速从 1 找到 ${config.maxNumber}`;
  els.comboLabel.textContent = "0";
  els.starLabel.textContent = "--";
  els.progressBar.style.width = "0%";

  const best = getBest(state.level);
  els.bestLabel.textContent = best ? formatTime(best) : "--";
  els.board.style.setProperty("--font-size", `${config.fontSize}px`);
  els.board.style.setProperty("--tap", `${config.tapSize}px`);
  els.board.innerHTML = svg;

  numbers.forEach((number, index) => {
    const point = centerPool[index];
    const button = document.createElement("button");
    button.className = "tile";
    button.type = "button";
    button.textContent = number;
    button.dataset.number = String(number);
    button.style.left = `${point.x}%`;
    button.style.top = `${point.y}%`;
    button.style.setProperty("--tilt", `${(random() - 0.5) * Math.min(state.level, 24) * 0.8}deg`);
    button.style.setProperty("--tile-color", chooseColor(config, random));
    button.setAttribute("aria-label", `数字 ${number}`);
    button.addEventListener("click", onTileClick);
    els.board.appendChild(button);
  });
}

function chooseColor(config, random) {
  if (random() > config.colorNoise) return COLORS[0];
  return COLORS[Math.floor(random() * COLORS.length)];
}

function onTileClick(event) {
  const tile = event.currentTarget;
  const value = Number(tile.dataset.number);

  if (value !== state.next) {
    tile.classList.remove("is-wrong");
    window.requestAnimationFrame(() => tile.classList.add("is-wrong"));
    state.combo = 0;
    els.comboLabel.textContent = "0";
    return;
  }

  tile.classList.add("is-found");
  tile.disabled = true;
  state.combo += 1;
  state.next += 1;

  els.comboLabel.textContent = String(state.combo);
  els.nextLabel.textContent = state.next <= state.maxNumber ? `找 ${state.next}` : "完成";
  els.progressBar.style.width = `${((state.next - 1) / state.maxNumber) * 100}%`;

  if (state.next > state.maxNumber) {
    completeLevel();
  }
}

function completeLevel() {
  stopTimer();
  const seconds = getElapsedSeconds();
  const config = getLevelConfig(state.level, state.isPractice);
  const stars = getStars(seconds, config);
  const rank = getRank(stars, state.level);
  const quote = getRewardQuote(state.level, stars, seconds);

  if (!state.isPractice) setBest(state.level, seconds);

  state.lastResult = { seconds, stars, rank, quote, maxNumber: state.maxNumber, level: state.level };
  state.lastPosterUrl = "";

  els.starLabel.textContent = "★".repeat(stars);
  els.resultKicker.textContent = state.level >= TOTAL_LEVELS && !state.isPractice ? "全部通关" : "闯关成功";
  els.resultTitle.textContent = state.isPractice ? "体验完成" : `第 ${state.level} 关完成`;
  els.resultText.textContent = `从 1 找到 ${state.maxNumber}，用时 ${formatTime(seconds)}。`;
  els.resultStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  els.resultRank.textContent = rank;
  els.quoteType.textContent = quote.type;
  els.quoteText.textContent = quote.text;
  els.shareCopy.classList.add("is-hidden");
  els.posterWrap.classList.add("is-hidden");
  els.posterImg.removeAttribute("src");
  showPanel("result");
}

function showPanel(name) {
  els.startPanel.classList.toggle("is-hidden", name !== "start");
  els.gamePanel.classList.toggle("is-hidden", name !== "game");
  els.resultPanel.classList.toggle("is-hidden", name !== "result");
  els.pausePanel.classList.toggle("is-hidden", name !== "pause");
}

function startLevel(level, isPractice = false) {
  state.level = clamp(level, 1, TOTAL_LEVELS);
  state.isPractice = isPractice;
  renderLevel();
  showPanel("game");
  startTimer();
}

function pauseGame() {
  if (!state.timerId) return;
  state.pausedAt = performance.now();
  stopTimer();
  showPanel("pause");
}

function resumeGame() {
  if (state.pausedAt) {
    state.pausedMs += performance.now() - state.pausedAt;
    state.pausedAt = 0;
  }
  showPanel("game");
  state.timerId = setInterval(updateTimer, 100);
}

function nextLevel() {
  if (state.isPractice) {
    startLevel(1, false);
    return;
  }

  if (state.level >= TOTAL_LEVELS) {
    showPanel("start");
    return;
  }

  startLevel(state.level + 1);
}

function makeShareCopy() {
  const result = state.lastResult;
  if (!result) return "";
  const prefix = result.level >= TOTAL_LEVELS ? "我通关了 49 关视觉专注力训练" : `我完成了第 ${result.level} 关视觉专注力训练`;
  return `${prefix}：从 1 找到 ${result.maxNumber} 只用了 ${formatTime(result.seconds)}，评级 ${"★".repeat(result.stars)}。\n${result.quote.type}：${result.quote.text}\n你也来试试？`;
}

function generatePoster() {
  const result = state.lastResult;
  if (!result) return "";

  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1920;
  const dpr = 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  drawPosterBackground(ctx, width, height);
  drawPosterCard(ctx, result, width, height);

  state.lastPosterUrl = canvas.toDataURL("image/png");
  els.posterImg.src = state.lastPosterUrl;
  els.posterWrap.classList.remove("is-hidden");
  return state.lastPosterUrl;
}

function drawPosterBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff7ea");
  gradient.addColorStop(0.55, "#f4e0c5");
  gradient.addColorStop(1, "#dfe9d8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(25,24,22,.13)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.arc(920, 250 + i * 34, 240 + i * 68, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(211,160,15,.18)";
  ctx.beginPath();
  ctx.arc(120, 230, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(18,129,59,.12)";
  ctx.beginPath();
  ctx.arc(960, 1600, 340, 0, Math.PI * 2);
  ctx.fill();
}

function drawPosterCard(ctx, result, width) {
  const x = 72;
  const y = 96;
  const cardW = width - x * 2;
  const cardH = 1728;

  ctx.fillStyle = "rgba(255,250,241,.94)";
  ctx.fillRect(x, y, cardW, cardH);
  ctx.strokeStyle = "#191816";
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, cardW, cardH);

  ctx.fillStyle = "#191816";
  ctx.font = "900 44px Songti SC, serif";
  ctx.fillText("FOCUS GRID", x + 54, y + 86);
  ctx.font = "900 86px Songti SC, serif";
  ctx.fillText("视觉专注力训练", x + 54, y + 190);

  ctx.fillStyle = "#d3a00f";
  ctx.fillRect(x + 54, y + 236, 360, 72);
  ctx.fillStyle = "#191816";
  ctx.font = "900 38px Songti SC, serif";
  ctx.fillText(result.level >= TOTAL_LEVELS ? "49 关全部通关" : `第 ${result.level} 关挑战成功`, x + 76, y + 284);

  drawPosterMetric(ctx, x + 54, y + 374, "目标", `1-${result.maxNumber}`);
  drawPosterMetric(ctx, x + 366, y + 374, "用时", formatTime(result.seconds));
  drawPosterMetric(ctx, x + 678, y + 374, "评级", "★".repeat(result.stars));

  ctx.strokeStyle = "rgba(25,24,22,.5)";
  ctx.lineWidth = 4;
  drawPosterMaze(ctx, x + 54, y + 600, cardW - 108, 430, result);

  ctx.fillStyle = "#191816";
  ctx.font = "900 46px Songti SC, serif";
  ctx.fillText(result.quote.type, x + 54, y + 1138);
  ctx.font = "900 62px Songti SC, serif";
  wrapCanvasText(ctx, `“${result.quote.text}”`, x + 54, y + 1230, cardW - 108, 82, 4);

  ctx.fillStyle = "#746d62";
  ctx.font = "700 34px Songti SC, serif";
  wrapCanvasText(ctx, "长按保存海报，发朋友圈邀请好友挑战你的专注力。", x + 54, y + 1508, cardW - 108, 48, 2);

  ctx.fillStyle = "#191816";
  ctx.fillRect(x + 54, y + 1632, cardW - 108, 4);
  ctx.font = "900 36px Songti SC, serif";
  ctx.fillText("扫码入口可替换为正式上线二维码", x + 54, y + 1704);
  ctx.fillStyle = "#746d62";
  ctx.font = "700 28px Songti SC, serif";
  wrapCanvasText(ctx, getShareUrl(), x + 54, y + 1756, cardW - 108, 38, 2);
}

function drawPosterMetric(ctx, x, y, label, value) {
  ctx.strokeStyle = "#191816";
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, 258, 146);
  ctx.fillStyle = "#746d62";
  ctx.font = "800 30px Songti SC, serif";
  ctx.fillText(label, x + 24, y + 48);
  ctx.fillStyle = "#191816";
  ctx.font = "900 52px Arial Black, Songti SC, serif";
  ctx.fillText(value, x + 24, y + 112);
}

function drawPosterMaze(ctx, x, y, width, height, result) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#fffdfa";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(25,24,22,.5)";
  ctx.lineWidth = 4;

  const random = mulberry32(result.level * 131 + result.maxNumber);
  const cols = 8;
  const rows = 5;
  const cellW = width / cols;
  const cellH = height / rows;
  const samples = shuffle(Array.from({ length: result.maxNumber }, (_, index) => index + 1), random).slice(0, cols * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = col * cellW;
      const top = row * cellH;
      const right = left + cellW;
      const bottom = top + cellH;
      const tilt = (random() - 0.5) * 20;
      ctx.beginPath();
      ctx.moveTo(left, top + (random() - 0.5) * 18);
      ctx.lineTo(right, top + (random() - 0.5) * 18);
      ctx.lineTo(right + (random() - 0.5) * 18, bottom);
      ctx.lineTo(left + (random() - 0.5) * 18, bottom);
      ctx.closePath();
      ctx.stroke();

      ctx.save();
      ctx.translate(left + cellW / 2, top + cellH / 2);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.fillStyle = COLORS[Math.floor(random() * COLORS.length)];
      ctx.font = "900 36px Arial Black, Songti SC, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(samples[row * cols + col] || ""), 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 10) {
  const chars = Array.from(text);
  let line = "";
  let lineCount = 0;

  for (const char of chars) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = char;
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = testLine;
    }
  }

  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

function getShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("level");
  return url.toString();
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

async function sharePoster() {
  const posterUrl = state.lastPosterUrl || generatePoster();
  if (!posterUrl) return;

  const file = dataUrlToFile(posterUrl, "focus-grid-poster.png");
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: "视觉专注力训练",
      text: makeShareCopy(),
      files: [file],
    });
    return;
  }

  els.shareCopy.textContent = "当前浏览器不支持直接分享图片。请长按海报保存后发朋友圈。";
  els.shareCopy.classList.remove("is-hidden");
}

function bindEvents() {
  $("startBtn").addEventListener("click", () => startLevel(1));
  $("practiceBtn").addEventListener("click", () => startLevel(1, true));
  $("backBtn").addEventListener("click", () => {
    stopTimer();
    showPanel("start");
  });
  $("pauseBtn").addEventListener("click", pauseGame);
  $("resumeBtn").addEventListener("click", resumeGame);
  $("restartBtn").addEventListener("click", () => startLevel(state.level, state.isPractice));
  $("nextBtn").addEventListener("click", nextLevel);
  $("replayBtn").addEventListener("click", () => startLevel(state.level, state.isPractice));
  $("posterBtn").addEventListener("click", generatePoster);
  $("systemShareBtn").addEventListener("click", () => {
    sharePoster().catch(() => {
      els.shareCopy.textContent = "系统分享被浏览器拦截，请长按海报保存后分享。";
      els.shareCopy.classList.remove("is-hidden");
    });
  });
  $("shareBtn").addEventListener("click", async () => {
    const copy = makeShareCopy();
    els.shareCopy.textContent = copy;
    els.shareCopy.classList.remove("is-hidden");

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(copy);
        els.shareCopy.textContent = `${copy}\n已复制，可粘贴到朋友圈。`;
      } catch {
        // Some embedded browsers block clipboard writes without a user setting.
      }
    }
  });
}

bindEvents();
initFromUrl();

function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const level = Number(params.get("level"));
  if (!Number.isInteger(level)) return;
  startLevel(clamp(level, 1, TOTAL_LEVELS));
}

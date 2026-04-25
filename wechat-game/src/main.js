import { TOTAL_LEVELS, STORAGE_KEYS } from "./config";
import { createBoardShapes, createTargets, getLevelConfig, clamp } from "./level";
import { SoundManager } from "./audio";
import { CloudService } from "./cloud";
import { createSharePoster } from "./poster";

const MODES = {
  HOME: "home",
  SELECT: "select",
  MARATHON: "marathon",
  GAME: "game",
  RANK: "rank",
  PK: "pk",
  PAUSE: "pause",
  RESULT: "result",
};

export class FocusGame {
  constructor() {
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext("2d");
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.sound = new SoundManager();
    this.cloud = new CloudService();
    this.mode = MODES.HOME;
    this.level = 1;
    this.next = 1;
    this.combo = 0;
    this.targets = [];
    this.boardShapes = [];
    this.boardRect = { left: 24, top: 168, size: 0 };
    this.startedAt = 0;
    this.elapsed = 0;
    this.seedOffset = 0;
    this.isMarathon = false;
    this.pkRoom = null;
    this.previousMode = MODES.HOME;
    this.pauseStartedAt = 0;
    this.rankList = [];
    this.authButton = null;
    this.best = wx.getStorageSync(STORAGE_KEYS.best) || {};
    this.marathon = wx.getStorageSync(STORAGE_KEYS.marathon) || { level: 1, bestLevel: 1 };
    this.user = wx.getStorageSync(STORAGE_KEYS.user) || null;
  }

  start() {
    this.cloud.init();
    this.cloud.login().catch(() => {});
    this.bindTouch();
    this.setupShare();
    const options = wx.getLaunchOptionsSync?.();
    if (options?.query?.pkRoom) {
      this.pkRoom = options.query.pkRoom;
      const level = Number(options.query.level || 1);
      const seed = Number(options.query.seed || 0);
      this.startLevel(clamp(level, 1, TOTAL_LEVELS), false, seed);
      this.mode = MODES.PK;
    }
    this.loop();
  }

  bindTouch() {
    wx.onTouchStart((event) => {
      const touch = event.touches[0];
      if (!touch) return;
      this.handleTap(touch.clientX, touch.clientY);
    });
  }

  setupShare() {
    wx.showShareMenu?.({ withShareTicket: true });
    wx.onShareAppMessage?.(() => ({
      title: "我在挑战 49 关视觉专注力训练，你也来试试？",
      imageUrl: this.makeShareImage(),
      query: "",
    }));
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    if (this.mode === MODES.GAME || this.mode === MODES.MARATHON || this.mode === MODES.PK) {
      this.elapsed = (Date.now() - this.startedAt) / 1000;
    }
    this.syncAuthButton();
  }

  handleTap(x, y) {
    if (this.mode === MODES.HOME) return this.tapHome(x, y);
    if (this.mode === MODES.SELECT) return this.tapSelect(x, y);
    if (this.mode === MODES.RANK) return this.tapRank(x, y);
    if (this.mode === MODES.PAUSE) return this.tapPause(x, y);
    if (this.mode === MODES.RESULT) return this.tapResult(x, y);
    if (this.mode === MODES.GAME || this.mode === MODES.MARATHON || this.mode === MODES.PK) return this.tapGame(x, y);
  }

  tapHome(x, y) {
    const metrics = this.getHomeMetrics();
    if (this.hitRect(x, y, metrics.start)) return this.startLevel(1, false);
    if (this.hitRect(x, y, metrics.select)) return this.openSelect();
    if (this.hitRect(x, y, metrics.marathon)) return this.startLevel(this.marathon.level || 1, true);
    if (this.hitRect(x, y, metrics.rank)) return this.openRank();
    if (this.hitRect(x, y, metrics.pk)) return this.startPk();
    if (this.hitRect(x, y, metrics.sound)) this.sound.toggle();
  }

  tapSelect(x, y) {
    if (this.hit(x, y, 24, 30, 70, 42)) return (this.mode = MODES.HOME);
    const cols = 7;
    const cell = (this.w - 40) / cols;
    for (let index = 0; index < TOTAL_LEVELS; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const left = 20 + col * cell;
      const top = 112 + row * 56;
      if (this.hit(x, y, left, top, cell - 8, 44)) {
        return this.startLevel(index + 1, false);
      }
    }
  }

  tapRank(x, y) {
    if (this.hit(x, y, 24, 30, 70, 42)) this.mode = MODES.HOME;
  }

  tapResult(x, y) {
    if (this.hit(x, y, 40, this.h - 178, this.w - 80, 56)) {
      if (this.isMarathon && this.level < TOTAL_LEVELS) return this.startLevel(this.level + 1, true);
      return (this.mode = MODES.HOME);
    }
    if (this.hit(x, y, 40, this.h - 106, this.w - 80, 56)) this.sharePoster();
  }

  tapPause(x, y) {
    const width = this.w - 80;
    const top = this.h / 2 - 34;
    if (this.hit(x, y, 40, top, width, 56)) {
      this.startedAt += Date.now() - this.pauseStartedAt;
      this.mode = this.previousMode;
      return;
    }
    if (this.hit(x, y, 40, top + 72, width, 56)) {
      this.startLevel(this.level, this.isMarathon, this.seedOffset);
      return;
    }
    if (this.hit(x, y, 40, top + 144, width, 56)) this.mode = MODES.HOME;
  }

  tapGame(x, y) {
    const metrics = this.getGameMetrics();
    if (this.hit(x, y, metrics.back.left, metrics.back.top, metrics.back.size, metrics.back.size)) return (this.mode = MODES.HOME);
    if (this.hit(x, y, metrics.pause.left, metrics.pause.top, metrics.pause.size, metrics.pause.size)) return this.pauseGame();
    const target = this.findNearestTarget(x, y);
    if (!target) return;
    if (target.number !== this.next) {
      this.sound.play("wrong");
      this.combo = 0;
      return;
    }
    target.found = true;
    this.next += 1;
    this.combo += 1;
    this.sound.play("tap");
    if (this.next > this.maxNumber) this.finishLevel();
  }

  startLevel(level, marathon, seedOffset = 0) {
    const config = getLevelConfig(level);
    const metrics = this.getGameMetrics();
    this.level = level;
    this.maxNumber = config.maxNumber;
    this.next = 1;
    this.combo = 0;
    this.elapsed = 0;
    this.isMarathon = marathon;
    this.seedOffset = seedOffset;
    this.boardRect = metrics.board;
    this.boardShapes = createBoardShapes(level, metrics.board.size, metrics.board.size, seedOffset);
    this.targets = createTargets(level, metrics.board.size, metrics.board.size, seedOffset).map((target) => ({
      ...target,
      x: target.x + metrics.board.left,
      y: target.y + metrics.board.top,
    }));
    this.startedAt = Date.now();
    this.mode = marathon ? MODES.MARATHON : MODES.GAME;
  }

  pauseGame() {
    this.previousMode = this.mode;
    this.pauseStartedAt = Date.now();
    this.mode = MODES.PAUSE;
  }

  finishLevel() {
    this.sound.play("pass");
    const score = {
      level: this.level,
      maxNumber: this.maxNumber,
      elapsed: Number(this.elapsed.toFixed(2)),
      mode: this.isMarathon ? "marathon" : this.mode,
      userInfo: this.user?.userInfo || null,
      updatedAt: Date.now(),
    };
    this.best[this.level] = Math.min(this.best[this.level] || Infinity, score.elapsed);
    wx.setStorageSync(STORAGE_KEYS.best, this.best);
    if (this.isMarathon) {
      this.marathon.level = clamp(this.level + 1, 1, TOTAL_LEVELS);
      this.marathon.bestLevel = Math.max(this.marathon.bestLevel || 1, this.level);
      wx.setStorageSync(STORAGE_KEYS.marathon, this.marathon);
    }
    this.cloud.submitScore(score).catch(() => {});
    if (this.mode === MODES.PK || this.pkRoom) {
      this.cloud.submitPkResult({ roomId: this.pkRoom, score }).catch(() => {});
    }
    this.lastScore = score;
    this.mode = MODES.RESULT;
  }

  findNearestTarget(x, y) {
    let nearest = null;
    let distance = Infinity;
    this.targets.forEach((target) => {
      if (target.found) return;
      const current = Math.hypot(target.x - x, target.y - y);
      if (current < distance) {
        nearest = target;
        distance = current;
      }
    });
    return nearest;
  }

  openSelect() {
    this.mode = MODES.SELECT;
  }

  async openRank() {
    this.mode = MODES.RANK;
    wx.showLoading?.({ title: "加载中" });
    try {
      const res = await this.cloud.top100();
      this.rankList = res.result?.list || [];
    } finally {
      wx.hideLoading?.();
    }
  }

  async startPk() {
    const level = Math.max(1, this.marathon.bestLevel || 1);
    const seedOffset = Date.now() % 100000;
    const room = await this.cloud.createPkRoom({ level, seedOffset });
    this.pkRoom = room.result?.roomId || `local-${seedOffset}`;
    wx.shareAppMessage({
      title: `我发起了第 ${level} 关专注力 PK，来战！`,
      imageUrl: this.makeShareImage(),
      query: `pkRoom=${this.pkRoom}&level=${level}&seed=${seedOffset}`,
    });
    this.startLevel(level, false, seedOffset);
    this.mode = MODES.PK;
  }

  createAuthButton() {
    if (this.authButton) return;
    const metrics = this.getHomeMetrics();
    const button = wx.createUserInfoButton({
      type: "text",
      text: this.user?.userInfo ? "已授权" : "微信授权",
      style: {
        left: metrics.auth.left,
        top: metrics.auth.top,
        width: metrics.auth.width,
        height: metrics.auth.height,
        lineHeight: metrics.auth.height,
        backgroundColor: "#191816",
        color: "#fffaf1",
        textAlign: "center",
        fontSize: 16,
        borderRadius: 14,
      },
    });
    button.onTap((res) => {
      if (res.userInfo) {
        this.user = { ...(this.user || {}), userInfo: res.userInfo };
        wx.setStorageSync(STORAGE_KEYS.user, this.user);
        button.destroy();
        this.authButton = null;
      }
    });
    this.authButton = button;
  }

  destroyAuthButton() {
    if (!this.authButton) return;
    this.authButton.destroy();
    this.authButton = null;
  }

  syncAuthButton() {
    if (this.mode === MODES.HOME && !this.user?.userInfo) {
      this.createAuthButton();
      return;
    }
    if (this.mode !== MODES.HOME || this.user?.userInfo) this.destroyAuthButton();
  }

  sharePoster() {
    wx.shareAppMessage({
      title: `我完成了第 ${this.lastScore.level} 关，用时 ${this.lastScore.elapsed}s`,
      imageUrl: this.makeShareImage(),
      query: "",
    });
  }

  makeShareImage() {
    try {
      const poster = wx.createCanvas();
      poster.width = 500;
      poster.height = 400;
      return createSharePoster(poster, {
        level: this.level,
        maxNumber: this.maxNumber || 12,
        elapsed: this.elapsed || 0,
        next: this.next || 1,
        nickname: this.user?.userInfo?.nickName || "眼力挑战者",
      });
    } catch (error) {
      return "";
    }
  }

  hit(x, y, left, top, width, height) {
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  hitRect(x, y, rect) {
    return this.hit(x, y, rect.left, rect.top, rect.width, rect.height);
  }

  getHomeMetrics() {
    const left = 24;
    const width = this.w - left * 2;
    return {
      brand: { left, top: 44, width: 124, height: 34 },
      titleY: 134,
      card: { left, top: 220, width, height: 96 },
      start: { left, top: 344, width, height: 58 },
      select: { left, top: 416, width: (width - 12) / 2, height: 56 },
      marathon: { left: left + (width + 12) / 2, top: 416, width: (width - 12) / 2, height: 56 },
      rank: { left, top: 486, width: (width - 12) / 2, height: 56 },
      pk: { left: left + (width + 12) / 2, top: 486, width: (width - 12) / 2, height: 56 },
      auth: { left, top: 558, width: (width - 12) / 2, height: 56 },
      sound: { left: left + (width + 12) / 2, top: 558, width: (width - 12) / 2, height: 56 },
    };
  }

  getGameMetrics() {
    const safeTop = 24;
    const horizontal = 14;
    const maxWidth = Math.min(this.w - horizontal * 2, 560);
    const left = (this.w - maxWidth) / 2;
    const headerTop = safeTop;
    const progress = {
      left,
      top: headerTop + 92,
      width: maxWidth,
      height: 92,
    };
    const footerHeight = 58;
    const footerTop = this.h - footerHeight - 18;
    const availableBoard = footerTop - (progress.top + progress.height) - 26;
    const boardSize = Math.max(260, Math.min(maxWidth, availableBoard));
    const board = {
      left: (this.w - boardSize) / 2,
      top: progress.top + progress.height + 24,
      size: boardSize,
    };
    return {
      headerTop,
      back: { left, top: safeTop + 6, size: 50 },
      pause: { left: left + maxWidth - 50, top: safeTop + 6, size: 50 },
      progress,
      board,
      footer: { left, top: board.top + board.size + 14, width: maxWidth, height: footerHeight },
    };
  }

  render() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawBackground();
    if (this.mode === MODES.HOME) this.drawHome();
    if (this.mode === MODES.SELECT) this.drawSelect();
    if (this.mode === MODES.RANK) this.drawRank();
    if (this.mode === MODES.PAUSE) this.drawPause();
    if (this.mode === MODES.RESULT) this.drawResult();
    if (this.mode === MODES.GAME || this.mode === MODES.MARATHON || this.mode === MODES.PK) this.drawGame();
  }

  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.w, this.h);
    gradient.addColorStop(0, "#fff7ea");
    gradient.addColorStop(0.5, "#f3dfb9");
    gradient.addColorStop(1, "#dfe9d8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.strokeStyle = "rgba(25,24,22,.08)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(this.w * 0.8, 120 + i * 34, 140 + i * 72, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawHome() {
    const ctx = this.ctx;
    const metrics = this.getHomeMetrics();
    this.roundRect(metrics.brand.left, metrics.brand.top, metrics.brand.width, metrics.brand.height, 18, "rgba(255,250,241,.72)", "rgba(25,24,22,.22)", 1);
    ctx.fillStyle = "#191816";
    ctx.font = "14px serif";
    ctx.fillText("FOCUS GRID", metrics.brand.left + 14, metrics.brand.top + 23);

    ctx.font = "bold 44px serif";
    ctx.fillText("眼力冲关王", 24, metrics.titleY);
    ctx.font = "17px serif";
    ctx.fillStyle = "#746d62";
    this.wrapText("在复杂图形中快速找数，49 关递进训练专注力。", 26, metrics.titleY + 34, this.w - 52, 28, 2);

    this.drawHeroStats(metrics.card);
    this.primaryButton("开始训练", metrics.start.left, metrics.start.top, metrics.start.width, metrics.start.height);
    this.softButton("自主选关", metrics.select);
    this.softButton(`连续冲关 ${this.marathon.level || 1}`, metrics.marathon);
    this.softButton("TOP100", metrics.rank);
    this.softButton("对战 PK", metrics.pk);
    if (this.user?.userInfo) this.softButton(this.user.userInfo.nickName || "已授权", metrics.auth);
    else this.drawAuthPlaceholder(metrics.auth);
    this.softButton(this.sound.enabled ? "音效开" : "音效关", metrics.sound);
  }

  drawSelect() {
    this.backButton();
    this.ctx.fillStyle = "#191816";
    this.ctx.font = "bold 28px serif";
    this.ctx.fillText("自主选关", 116, 64);
    const cols = 7;
    const cell = (this.w - 40) / cols;
    for (let index = 0; index < TOTAL_LEVELS; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      this.button(String(index + 1), 20 + col * cell, 112 + row * 56, cell - 8, 44);
    }
  }

  drawHeroStats(rect) {
    this.roundRect(rect.left, rect.top, rect.width, rect.height, 18, "rgba(255,250,241,.88)", "#191816", 3);
    const stats = [
      ["49", "训练关卡"],
      ["1-100", "数字挑战"],
      ["PK", "好友对战"],
    ];
    const colW = rect.width / 3;
    stats.forEach((item, index) => {
      const cx = rect.left + colW * index + colW / 2;
      if (index > 0) {
        this.ctx.strokeStyle = "#191816";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.left + colW * index, rect.top);
        this.ctx.lineTo(rect.left + colW * index, rect.top + rect.height);
        this.ctx.stroke();
      }
      this.ctx.textAlign = "center";
      this.ctx.fillStyle = "#191816";
      this.ctx.font = "bold 28px serif";
      this.ctx.fillText(item[0], cx, rect.top + 42);
      this.ctx.fillStyle = "#746d62";
      this.ctx.font = "13px serif";
      this.ctx.fillText(item[1], cx, rect.top + 66);
    });
    this.ctx.textAlign = "left";
  }

  primaryButton(text, x, y, width, height) {
    this.ctx.save();
    this.ctx.fillStyle = "#d3a00f";
    this.roundRect(x + 7, y + 7, width, height, 14, "#d3a00f", null, 0);
    this.roundRect(x, y, width, height, 14, "#191816", "#191816", 2);
    this.ctx.fillStyle = "#fffaf1";
    this.ctx.font = "bold 22px serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, x + width / 2, y + height / 2);
    this.ctx.restore();
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
  }

  softButton(text, rect) {
    this.roundRect(rect.left, rect.top, rect.width, rect.height, 14, "rgba(255,250,241,.84)", "#191816", 2);
    this.ctx.fillStyle = "#191816";
    this.ctx.font = "bold 16px serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
  }

  drawAuthPlaceholder(rect) {
    this.roundRect(rect.left, rect.top, rect.width, rect.height, 14, "#191816", "#191816", 2);
    this.ctx.fillStyle = "#fffaf1";
    this.ctx.font = "bold 16px serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("微信授权", rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
  }

  drawGame() {
    const ctx = this.ctx;
    const metrics = this.getGameMetrics();
    this.boardRect = metrics.board;
    this.drawIconButton("←", metrics.back.left, metrics.back.top, metrics.back.size);
    this.drawIconButton("Ⅱ", metrics.pause.left, metrics.pause.top, metrics.pause.size);

    ctx.fillStyle = "#746d62";
    ctx.font = "18px serif";
    ctx.textAlign = "center";
    ctx.fillText(`第 ${this.level} / ${TOTAL_LEVELS} 关`, this.w / 2, metrics.headerTop + 18);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 38px serif";
    ctx.fillText(this.next <= this.maxNumber ? `找 ${this.next}` : "完成", this.w / 2, metrics.headerTop + 62);
    ctx.textAlign = "left";

    this.drawProgressCard(metrics.progress);
    this.drawBoard();
    this.drawGameFooter(metrics.footer);
  }

  drawBoard() {
    const ctx = this.ctx;
    const { left, top, size } = this.boardRect;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(left, top, size, size);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 4;
    ctx.strokeRect(left, top, size, size);
    this.drawBoardShapes(left, top, size);
    this.targets.forEach((target) => {
      if (target.found) ctx.globalAlpha = 0.18;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(target.tilt);
      ctx.fillStyle = target.color;
      ctx.font = `bold ${getLevelConfig(this.level).fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(target.number), 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    });
  }

  drawBoardShapes(left, top, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(left, top);
    this.boardShapes.forEach((shape) => {
      ctx.beginPath();
      ctx.fillStyle = shape.fill || "#fffdfa";
      ctx.strokeStyle = "rgba(25,24,22,.42)";
      ctx.lineWidth = 1.8;
      if (shape.type === "ellipse") {
        ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      } else if (shape.type === "sector") {
        ctx.arc(shape.cx, shape.cy, shape.outer, shape.a1, shape.a2);
        ctx.lineTo(shape.cx + Math.cos(shape.a2) * shape.inner, shape.cy + Math.sin(shape.a2) * shape.inner);
        ctx.arc(shape.cx, shape.cy, shape.inner, shape.a2, shape.a1, true);
        ctx.closePath();
      } else {
        shape.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    });

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#d3a00f";
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.min(16 + this.level, 54); i += 1) {
      const x = (i * 71) % size;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo((x + 140) % size, size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawProgressCard(rect) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,250,241,.78)";
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 3;
    ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);

    ctx.fillStyle = "#746d62";
    ctx.font = "bold 19px serif";
    ctx.textAlign = "left";
    ctx.fillText(`快速从 1 找到 ${this.maxNumber}`, rect.left + 18, rect.top + 36);
    ctx.textAlign = "right";
    ctx.fillText(`${this.elapsed.toFixed(1)}s`, rect.left + rect.width - 18, rect.top + 36);
    ctx.textAlign = "left";

    const barX = rect.left + 18;
    const barY = rect.top + 58;
    const barW = rect.width - 36;
    const barH = 12;
    ctx.fillStyle = "rgba(25,24,22,.08)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);
    const progress = Math.max(0, Math.min(1, (this.next - 1) / this.maxNumber));
    const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    gradient.addColorStop(0, "#12813b");
    gradient.addColorStop(0.58, "#d3a00f");
    gradient.addColorStop(1, "#d93b3b");
    ctx.fillStyle = gradient;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, (barW - 4) * progress), barH - 4);
  }

  drawGameFooter(rect) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,250,241,.82)";
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);

    const items = [
      ["连击", String(Math.max(0, this.next - 1))],
      ["最佳", this.best[this.level] ? `${this.best[this.level].toFixed(1)}s` : "--"],
      ["星级", "--"],
    ];
    const colW = rect.width / 3;
    items.forEach((item, index) => {
      const cx = rect.left + colW * index + colW / 2;
      ctx.textAlign = "center";
      ctx.fillStyle = "#746d62";
      ctx.font = "12px serif";
      ctx.fillText(item[0], cx, rect.top + 20);
      ctx.fillStyle = "#191816";
      ctx.font = "bold 18px serif";
      ctx.fillText(item[1], cx, rect.top + 44);
    });
    ctx.textAlign = "left";
  }

  drawPause() {
    this.drawGame();
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(25,24,22,.42)";
    ctx.fillRect(0, 0, this.w, this.h);
    const card = { left: 30, top: this.h / 2 - 150, width: this.w - 60, height: 300 };
    this.roundRect(card.left, card.top, card.width, card.height, 24, "rgba(255,250,241,.96)", "#191816", 4);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 34px serif";
    ctx.textAlign = "center";
    ctx.fillText("训练暂停", this.w / 2, card.top + 64);
    ctx.fillStyle = "#746d62";
    ctx.font = "16px serif";
    ctx.fillText("保持节奏，继续后从当前数字接着找。", this.w / 2, card.top + 102);
    ctx.textAlign = "left";
    const width = this.w - 80;
    const top = this.h / 2 - 34;
    this.primaryButton("继续", 40, top, width, 56);
    this.softButton("重开本关", { left: 40, top: top + 72, width, height: 56 });
    this.softButton("返回首页", { left: 40, top: top + 144, width, height: 56 });
  }

  drawIconButton(text, x, y, size) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,250,241,.78)";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 28px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + size / 2, y + size / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawRank() {
    this.backButton();
    const ctx = this.ctx;
    ctx.fillStyle = "#191816";
    ctx.font = "bold 28px serif";
    ctx.fillText("TOP100 排行榜", 96, 64);
    ctx.font = "16px sans-serif";
    const list = this.rankList.slice(0, 12);
    if (!list.length) ctx.fillText("暂无云排行榜数据，请先配置云环境。", 32, 130);
    list.forEach((item, index) => {
      const name = item.nickName || item.userInfo?.nickName || "匿名玩家";
      ctx.fillText(`${index + 1}. ${name}  第${item.level}关  ${item.elapsed}s`, 32, 126 + index * 34);
    });
  }

  drawResult() {
    const ctx = this.ctx;
    const card = { left: 24, top: 90, width: this.w - 48, height: this.h - 150 };
    this.roundRect(card.left, card.top, card.width, card.height, 24, "rgba(255,250,241,.94)", "#191816", 4);
    this.roundRect(card.left + 22, card.top + 24, 112, 34, 16, "#d3a00f", "#191816", 2);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 15px serif";
    ctx.fillText("闯关成功", card.left + 44, card.top + 47);
    ctx.font = "bold 38px serif";
    ctx.fillText("眼力不错", card.left + 24, card.top + 112);
    ctx.font = "20px serif";
    ctx.fillText(`第 ${this.lastScore.level} 关 · 用时 ${this.lastScore.elapsed}s`, card.left + 24, card.top + 154);
    this.drawResultMetric(card.left + 24, card.top + 190, "目标", `1-${this.lastScore.maxNumber}`);
    this.drawResultMetric(card.left + card.width / 2 + 8, card.top + 190, "称号", this.lastScore.level >= 40 ? "鹰眼大师" : "专注高手");
    ctx.fillStyle = "#191816";
    ctx.font = "bold 22px serif";
    this.wrapText("“真正的速度，来自一次只做一件事的专注。”", card.left + 24, card.top + 304, card.width - 48, 34, 3);
    this.primaryButton(this.isMarathon && this.level < TOTAL_LEVELS ? "下一关" : "返回首页", 40, this.h - 178, this.w - 80, 56);
    this.softButton("生成微信分享海报", { left: 40, top: this.h - 106, width: this.w - 80, height: 56 });
  }

  drawResultMetric(x, y, label, value) {
    const width = this.w / 2 - 44;
    this.roundRect(x, y, width, 82, 14, "rgba(255,255,255,.58)", "#191816", 2);
    this.ctx.fillStyle = "#746d62";
    this.ctx.font = "13px serif";
    this.ctx.fillText(label, x + 16, y + 28);
    this.ctx.fillStyle = "#191816";
    this.ctx.font = "bold 22px serif";
    this.ctx.fillText(value, x + 16, y + 58);
  }

  backButton() {
    this.button("←", 24, 30, 70, 42);
  }

  button(text, x, y, width = this.w - 80, height = 58) {
    const ctx = this.ctx;
    ctx.fillStyle = "#fffaf1";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 19px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, y + height / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  roundRect(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
    const ctx = this.ctx;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  wrapText(text, x, y, maxWidth, lineHeight, maxLines = 4) {
    const chars = Array.from(text);
    let line = "";
    let lineCount = 0;
    chars.forEach((char) => {
      if (lineCount >= maxLines) return;
      const test = line + char;
      if (this.ctx.measureText(test).width > maxWidth && line) {
        this.ctx.fillText(line, x, y + lineCount * lineHeight);
        line = char;
        lineCount += 1;
      } else {
        line = test;
      }
    });
    if (line && lineCount < maxLines) this.ctx.fillText(line, x, y + lineCount * lineHeight);
  }
}

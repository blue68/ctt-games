import { TOTAL_LEVELS, STORAGE_KEYS } from "./config";
import { createTargets, getLevelConfig, clamp } from "./level";
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
    this.targets = [];
    this.startedAt = 0;
    this.elapsed = 0;
    this.seedOffset = 0;
    this.isMarathon = false;
    this.pkRoom = null;
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
  }

  handleTap(x, y) {
    if (this.mode === MODES.HOME) return this.tapHome(x, y);
    if (this.mode === MODES.SELECT) return this.tapSelect(x, y);
    if (this.mode === MODES.RANK) return this.tapRank(x, y);
    if (this.mode === MODES.RESULT) return this.tapResult(x, y);
    if (this.mode === MODES.GAME || this.mode === MODES.MARATHON || this.mode === MODES.PK) return this.tapGame(x, y);
  }

  tapHome(x, y) {
    if (this.hit(x, y, 40, 210, this.w - 80, 58)) return this.startLevel(1, false);
    if (this.hit(x, y, 40, 286, this.w - 80, 58)) return this.openSelect();
    if (this.hit(x, y, 40, 362, this.w - 80, 58)) return this.startLevel(this.marathon.level || 1, true);
    if (this.hit(x, y, 40, 438, this.w - 80, 58)) return this.openRank();
    if (this.hit(x, y, 40, 514, this.w - 80, 58)) return this.startPk();
    if (this.hit(x, y, 40, 590, this.w - 80, 58)) return this.createAuthButton();
    if (this.hit(x, y, this.w - 92, 38, 64, 40)) this.sound.toggle();
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

  tapGame(x, y) {
    if (this.hit(x, y, 24, 28, 64, 48)) return (this.mode = MODES.HOME);
    const target = this.findNearestTarget(x, y);
    if (!target) return;
    if (target.number !== this.next) {
      this.sound.play("wrong");
      this.combo = 0;
      return;
    }
    target.found = true;
    this.next += 1;
    this.sound.play("tap");
    if (this.next > this.maxNumber) this.finishLevel();
  }

  startLevel(level, marathon, seedOffset = 0) {
    const config = getLevelConfig(level);
    this.level = level;
    this.maxNumber = config.maxNumber;
    this.next = 1;
    this.elapsed = 0;
    this.isMarathon = marathon;
    this.seedOffset = seedOffset;
    this.targets = createTargets(level, this.w - 48, this.w - 48, seedOffset).map((target) => ({
      ...target,
      x: target.x + 24,
      y: target.y + 168,
    }));
    this.startedAt = Date.now();
    this.mode = marathon ? MODES.MARATHON : MODES.GAME;
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
    const button = wx.createUserInfoButton({
      type: "text",
      text: "授权微信头像昵称",
      style: {
        left: 40,
        top: 590,
        width: this.w - 80,
        height: 58,
        lineHeight: 58,
        backgroundColor: "#191816",
        color: "#fffaf1",
        textAlign: "center",
        fontSize: 18,
        borderRadius: 0,
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
      });
    } catch (error) {
      return "";
    }
  }

  hit(x, y, left, top, width, height) {
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  render() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawBackground();
    if (this.mode === MODES.HOME) this.drawHome();
    if (this.mode === MODES.SELECT) this.drawSelect();
    if (this.mode === MODES.RANK) this.drawRank();
    if (this.mode === MODES.RESULT) this.drawResult();
    if (this.mode === MODES.GAME || this.mode === MODES.MARATHON || this.mode === MODES.PK) this.drawGame();
  }

  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, this.w, this.h);
    gradient.addColorStop(0, "#fff7ea");
    gradient.addColorStop(1, "#dfe9d8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawHome() {
    const ctx = this.ctx;
    ctx.fillStyle = "#191816";
    ctx.font = "bold 38px serif";
    ctx.fillText("视觉专注力训练", 32, 110);
    ctx.font = "18px serif";
    ctx.fillText("49 关 · 选关 · 连续闯关 · PK 对战", 34, 150);
    this.button("开始训练", 40, 210);
    this.button("自主选关", 40, 286);
    this.button(`连续冲关：第 ${this.marathon.level || 1} 关`, 40, 362);
    this.button("TOP100 排行榜", 40, 438);
    this.button("发起对战 PK", 40, 514);
    this.button("微信授权", 40, 590);
    this.button(this.sound.enabled ? "音效开" : "音效关", this.w - 92, 38, 64, 40);
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

  drawGame() {
    const ctx = this.ctx;
    this.backButton();
    ctx.fillStyle = "#746d62";
    ctx.font = "18px serif";
    ctx.fillText(`第 ${this.level} / ${TOTAL_LEVELS} 关`, this.w / 2 - 56, 48);
    ctx.fillStyle = "#191816";
    ctx.font = "bold 34px serif";
    ctx.fillText(`找 ${this.next}`, this.w / 2 - 44, 88);
    ctx.font = "18px serif";
    ctx.fillText(`快速从 1 找到 ${this.maxNumber}`, 24, 136);
    ctx.fillText(`${this.elapsed.toFixed(1)}s`, this.w - 92, 136);
    this.drawBoard();
  }

  drawBoard() {
    const ctx = this.ctx;
    const size = this.w - 48;
    const left = 24;
    const top = 168;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(left, top, size, size);
    ctx.strokeStyle = "#191816";
    ctx.lineWidth = 4;
    ctx.strokeRect(left, top, size, size);
    this.drawPattern(left, top, size);
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

  drawPattern(left, top, size) {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(25,24,22,.28)";
    ctx.lineWidth = 1.5;
    const randomLines = 10 + this.level;
    for (let i = 0; i < randomLines; i += 1) {
      const x = left + ((i * 37) % size);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(left + ((x + 120) % size), top + size);
      ctx.stroke();
    }
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
    ctx.fillStyle = "#191816";
    ctx.font = "bold 36px serif";
    ctx.fillText("挑战成功", 40, 130);
    ctx.font = "22px serif";
    ctx.fillText(`第 ${this.lastScore.level} 关 · ${this.lastScore.elapsed}s`, 40, 180);
    ctx.fillText("真正的速度，来自一次只做一件事的专注。", 40, 230);
    this.button(this.isMarathon && this.level < TOTAL_LEVELS ? "下一关" : "返回首页", 40, this.h - 178);
    this.button("微信海报分享", 40, this.h - 106);
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
}

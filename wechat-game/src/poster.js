export function createSharePoster(canvas, gameState) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff7ea");
  gradient.addColorStop(0.55, "#f1d7a5");
  gradient.addColorStop(1, "#dfe9d8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(25,24,22,.12)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(width - 60, 64 + i * 18, 90 + i * 42, 0, Math.PI * 2);
    ctx.stroke();
  }

  roundRect(ctx, 24, 24, width - 48, height - 48, 26, "rgba(255,250,241,.94)", "#191816", 6);
  roundRect(ctx, 48, 48, 126, 34, 17, "#191816", null, 0);
  ctx.fillStyle = "#fffaf1";
  ctx.font = "bold 15px serif";
  ctx.fillText("FOCUS GRID", 62, 70);

  ctx.fillStyle = "#191816";
  ctx.font = "bold 42px serif";
  ctx.fillText("眼力冲关王", 48, 124);
  ctx.font = "18px serif";
  ctx.fillStyle = "#746d62";
  ctx.fillText("视觉观察小游戏成绩记录", 50, 158);

  drawEye(ctx, width - 138, 88);
  drawMetric(ctx, 48, 192, "关卡", `${gameState.level}/49`);
  drawMetric(ctx, 190, 192, "目标", `1-${gameState.maxNumber}`);
  drawMetric(ctx, 332, 192, "用时", `${gameState.elapsed.toFixed(1)}s`);

  ctx.fillStyle = "#191816";
  ctx.font = "bold 24px serif";
  ctx.fillText("在复杂图形中快速找数", 48, 306);
  ctx.font = "16px serif";
  ctx.fillStyle = "#746d62";
  ctx.fillText("49 个关卡，记录观察速度与完成进度。", 48, 334);

  roundRect(ctx, 48, height - 94, width - 96, 52, 16, "#d3a00f", "#191816", 3);
  ctx.fillStyle = "#191816";
  ctx.font = "bold 20px serif";
  ctx.textAlign = "center";
  ctx.fillText("打开小程序查看游戏", width / 2, height - 61);
  ctx.textAlign = "left";
  ctx.restore();
  return canvas.toTempFilePathSync({
    x: 0,
    y: 0,
    width,
    height,
    destWidth: 500,
    destHeight: 400,
  });
}

function drawMetric(ctx, x, y, label, value) {
  roundRect(ctx, x, y, 118, 78, 14, "rgba(255,255,255,.64)", "#191816", 2);
  ctx.fillStyle = "#746d62";
  ctx.font = "14px serif";
  ctx.fillText(label, x + 16, y + 27);
  ctx.fillStyle = "#191816";
  ctx.font = "bold 25px serif";
  ctx.fillText(value, x + 16, y + 58);
}

function drawEye(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#fffdfa";
  ctx.strokeStyle = "#191816";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-58, 22);
  ctx.quadraticCurveTo(0, -32, 58, 22);
  ctx.quadraticCurveTo(0, 64, -58, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#191816";
  ctx.beginPath();
  ctx.arc(0, 24, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d3a00f";
  ctx.beginPath();
  ctx.arc(0, 24, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffdfa";
  ctx.beginPath();
  ctx.arc(7, 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke, lineWidth = 1) {
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

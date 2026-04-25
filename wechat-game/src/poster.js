export function createSharePoster(canvas, gameState) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.save();
  ctx.fillStyle = "#f8efe2";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#191816";
  ctx.font = "bold 34px serif";
  ctx.fillText("视觉专注力训练", 36, 72);
  ctx.font = "bold 24px serif";
  ctx.fillText(`第 ${gameState.level} 关挑战`, 36, 124);
  ctx.fillText(`目标 1-${gameState.maxNumber}`, 36, 164);
  ctx.fillText(`用时 ${gameState.elapsed.toFixed(1)}s`, 36, 204);
  ctx.strokeStyle = "#191816";
  ctx.lineWidth = 8;
  ctx.strokeRect(28, 28, width - 56, height - 56);
  ctx.fillStyle = "#d3a00f";
  ctx.fillRect(36, height - 116, width - 72, 58);
  ctx.fillStyle = "#191816";
  ctx.font = "bold 22px serif";
  ctx.fillText("长按进入，挑战你的专注力", 58, height - 78);
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


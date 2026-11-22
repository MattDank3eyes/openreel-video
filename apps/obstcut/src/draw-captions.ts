import { renderAnimatedCaption } from "@openreel/core/text/caption-animation-renderer";
import type { Subtitle } from "@openreel/core/types";

export function drawWordCaptions(
  ctx: CanvasRenderingContext2D,
  subtitles: readonly Subtitle[],
  time: number,
  width: number,
  height: number,
): void {
  const cue = subtitles.find((item) => time >= item.startTime && time < item.endTime);
  if (!cue) return;
  const frame = renderAnimatedCaption(cue, time);
  if (!frame.visible || frame.segments.length === 0) return;
  const fontSize = cue.style?.fontSize ?? Math.round(height * 0.06);
  ctx.save();
  ctx.font = `700 ${fontSize}px ${cue.style?.fontFamily ?? "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = frame.segments.map((segment) => segment.text).join(" ");
  const y = height * 0.86 + frame.segments[0].offsetY;
  const widthPx = ctx.measureText(text).width;
  const padX = fontSize * 0.45;
  const padY = fontSize * 0.28;
  ctx.fillStyle = cue.style?.backgroundColor ?? "rgba(20, 14, 8, 0.72)";
  ctx.beginPath();
  ctx.roundRect(width / 2 - widthPx / 2 - padX, y - fontSize / 2 - padY, widthPx + padX * 2, fontSize + padY * 2, 10);
  ctx.fill();
  const segment = frame.segments[0];
  ctx.globalAlpha = segment.opacity;
  ctx.fillStyle = segment.color ?? cue.style?.highlightColor ?? cue.style?.color ?? "#fff8ea";
  ctx.fillText(text, width / 2, y);
  ctx.restore();
}

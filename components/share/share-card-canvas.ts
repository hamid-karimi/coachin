/**
 * Canvas share-card renderer (share-progress plan phase 1 handoff spec).
 * Client-only, deterministic — NO AI image editing: cards must render
 * instantly, look identical every time, and stay on-brand. Colors mirror
 * the design tokens in app/globals.css (canvas can't read CSS vars).
 */
import type { ShareCardData } from "@/lib/share-card";

export type ShareCardFormat = "story" | "square";

// Brand palette (globals.css tokens; volt/ember also in use-confetti-burst).
const PANEL_BG = "#0B0B0C";
const GRADIENT_TINT = "#1A2005";
const VOLT = "#D4F531";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SOFT = "#E4E4E7";
const TEXT_MUTED = "#A1A1AA";
const TEXT_FAINT = "#71717A";

const FONT_STACK = "Inter, system-ui, -apple-system, sans-serif";
const SIDE_PAD = 64;

const FORMATS: Record<
  ShareCardFormat,
  { width: number; height: number; photoRatio: number; bridge: number }
> = {
  story: { width: 1080, height: 1920, photoRatio: 0.62, bridge: 240 },
  square: { width: 1080, height: 1080, photoRatio: 0.55, bridge: 160 },
};

export type RenderShareCardOptions = {
  format: ShareCardFormat;
  /** Backdrop photo; omitted → brand gradient background. */
  photo?: Blob | null;
  /** Two-photo compare layout (progress cards) — overrides `photo`. */
  comparePhotos?: [Blob, Blob] | null;
};

/** Render a card to a PNG File. Throws on decode/export failure — callers
 *  surface a toast and keep the sheet open. */
export async function renderShareCard(
  data: ShareCardData,
  options: RenderShareCardOptions,
): Promise<File> {
  const spec = FORMATS[options.format];
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");

  const photoHeight = Math.round(spec.height * spec.photoRatio);

  if (options.comparePhotos) {
    const [before, after] = await Promise.all(
      options.comparePhotos.map((blob) => createImageBitmap(blob)),
    );
    drawCover(ctx, before, 0, 0, spec.width / 2, photoHeight);
    drawCover(ctx, after, spec.width / 2, 0, spec.width / 2, photoHeight);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(spec.width / 2 - 3, 0, 6, photoHeight);
    before.close();
    after.close();
  } else if (options.photo) {
    const bitmap = await createImageBitmap(options.photo);
    drawCover(ctx, bitmap, 0, 0, spec.width, photoHeight);
    bitmap.close();
  } else {
    // No photo: full-bleed diagonal brand gradient.
    const gradient = ctx.createLinearGradient(0, 0, spec.width, spec.height);
    gradient.addColorStop(0, PANEL_BG);
    gradient.addColorStop(1, GRADIENT_TINT);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, spec.width, spec.height);
  }

  const hasPhoto = Boolean(options.photo || options.comparePhotos);

  // Bottom panel + gradient bridge over the photo seam.
  if (hasPhoto) {
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(0, photoHeight, spec.width, spec.height - photoHeight);
    const bridge = ctx.createLinearGradient(
      0,
      photoHeight - spec.bridge,
      0,
      photoHeight,
    );
    bridge.addColorStop(0, "rgba(11, 11, 12, 0)");
    bridge.addColorStop(1, PANEL_BG);
    ctx.fillStyle = bridge;
    ctx.fillRect(0, photoHeight - spec.bridge, spec.width, spec.bridge);
  }

  // --- Panel content ---
  const panelTop = hasPhoto ? photoHeight : Math.round(spec.height * 0.42);
  let y = panelTop + 96;
  const maxTextWidth = spec.width - SIDE_PAD * 2;

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = `bold 64px ${FONT_STACK}`;
  for (const line of wrapText(ctx, data.headline, maxTextWidth, 2)) {
    ctx.fillText(line, SIDE_PAD, y);
    y += 78;
  }
  y += 40;

  // Stat row: value (volt, big) over uppercase label.
  let x = SIDE_PAD;
  for (const stat of data.stats) {
    ctx.fillStyle = VOLT;
    ctx.font = `bold 96px ${FONT_STACK}`;
    ctx.fillText(stat.value, x, y);
    const valueWidth = ctx.measureText(stat.value).width;

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = `500 36px ${FONT_STACK}`;
    const label = stat.label.toUpperCase();
    ctx.fillText(label, x, y + 52);
    const labelWidth = ctx.measureText(label).width;

    x += Math.max(valueWidth, labelWidth) + 72;
  }
  if (data.stats.length > 0) y += 52 + 88;

  if (data.equivalence) {
    ctx.fillStyle = TEXT_SOFT;
    ctx.font = `400 40px ${FONT_STACK}`;
    ctx.fillText(
      truncate(ctx, data.equivalence, maxTextWidth),
      SIDE_PAD,
      y,
    );
  }

  // Footer: date left, watermark right (NOT removable — growth loop).
  const footerY = spec.height - 72;
  ctx.fillStyle = TEXT_FAINT;
  ctx.font = `400 36px ${FONT_STACK}`;
  ctx.fillText(data.dateLabel, SIDE_PAD, footerY);

  ctx.font = `600 40px ${FONT_STACK}`;
  const wordmark = "coachin";
  const wordmarkWidth = ctx.measureText(wordmark).width;
  const dotRadius = 10;
  const wordmarkX = spec.width - SIDE_PAD - wordmarkWidth;
  ctx.fillStyle = VOLT;
  ctx.beginPath();
  ctx.arc(wordmarkX - dotRadius * 2.4, footerY - 13, dotRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.fillText(wordmark, wordmarkX, footerY);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not export the card image");
  return new File([blob], "coachin-card.png", { type: "image/png" });
}

/** Cover-fit draw (like CSS object-fit: cover, center). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const scale = Math.max(dw / image.width, dh / image.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      if (lines.length === maxLines - 1) {
        // Last allowed line: take everything left and ellipsize.
        current = words.slice(index).join(" ");
        break;
      }
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines
    .slice(0, maxLines)
    .map((line) => truncate(ctx, line, maxWidth));
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

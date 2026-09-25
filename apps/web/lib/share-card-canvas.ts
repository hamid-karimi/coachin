"use client";

/**
 * Canvas share-card renderer: client-only and deterministic (no AI image editing) —
 * cards render instantly, look the same every time, and stay on-brand. Always the dark
 * look: colors are read from the `.dark` theme tokens in `app/globals.css` (a canvas
 * can't read CSS classes), the font from the page.
 */
import type { ShareCardData } from "@/lib/share-card";

export type ShareCardFormat = "story" | "square";

/** Canvas pixels, not CSS: the exported image size per format. */
export const SHARE_FORMATS: Record<
  ShareCardFormat,
  { width: number; height: number; photoRatio: number; bridge: number }
> = {
  story: { width: 1080, height: 1920, photoRatio: 0.62, bridge: 240 },
  square: { width: 1080, height: 1080, photoRatio: 0.55, bridge: 160 },
};

const SIDE_PAD = 64;
const WORDMARK = "coachin";

type Palette = { panel: string; tint: string; brand: string; text: string; muted: string };

/** The dark theme's tokens, via a throwaway `.dark` element. */
function darkPalette(): Palette {
  const probe = document.createElement("div");
  probe.className = "dark";
  probe.hidden = true;
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const palette = {
    panel: token("--background"),
    tint: token("--brand-tint"),
    brand: token("--brand"),
    text: token("--foreground"),
    muted: token("--muted-foreground"),
  };
  probe.remove();
  return palette;
}

export type RenderShareCardOptions = {
  format: ShareCardFormat;
  /** Backdrop photo; none → the brand gradient. */
  photo?: Blob | null;
  /** Two-photo then-vs-now layout (progress cards); wins over `photo`. */
  comparePhotos?: readonly [Blob, Blob] | null;
};

/** Render a card to a PNG file. Throws on a decode / export failure. */
export async function renderShareCard(data: ShareCardData, options: RenderShareCardOptions): Promise<File> {
  const spec = SHARE_FORMATS[options.format];
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  // A canvas silently falls back when the page font hasn't loaded yet.
  await document.fonts.ready;
  const colors = darkPalette();
  const font = getComputedStyle(document.body).fontFamily;
  const photoHeight = Math.round(spec.height * spec.photoRatio);

  ctx.fillStyle = colors.panel;
  ctx.fillRect(0, 0, spec.width, spec.height);
  const hasPhoto = await drawBackdrop(ctx, spec, photoHeight, colors, options);

  const maxWidth = spec.width - SIDE_PAD * 2;
  let y = (hasPhoto ? photoHeight : Math.round(spec.height * 0.42)) + 96;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = colors.text;
  ctx.font = `bold 64px ${font}`;
  for (const line of wrapText(ctx, data.headline, maxWidth, 2)) {
    ctx.fillText(line, SIDE_PAD, y);
    y += 78;
  }
  y += 40;

  // Stat row: the value (volt, big) over its uppercase label.
  let x = SIDE_PAD;
  for (const stat of data.stats) {
    ctx.fillStyle = colors.brand;
    ctx.font = `bold 96px ${font}`;
    ctx.fillText(stat.value, x, y);
    const valueWidth = ctx.measureText(stat.value).width;
    ctx.fillStyle = colors.muted;
    ctx.font = `500 36px ${font}`;
    const label = stat.label.toUpperCase();
    ctx.fillText(label, x, y + 52);
    x += Math.max(valueWidth, ctx.measureText(label).width) + 72;
  }
  if (data.stats.length > 0) y += 140;

  if (data.equivalence) {
    ctx.fillStyle = colors.text;
    ctx.font = `400 40px ${font}`;
    ctx.fillText(truncate(ctx, data.equivalence, maxWidth), SIDE_PAD, y);
  }

  // Footer: the date left, the watermark right (always on the image).
  const footerY = spec.height - 72;
  ctx.fillStyle = colors.muted;
  ctx.font = `400 36px ${font}`;
  ctx.fillText(data.dateLabel, SIDE_PAD, footerY);
  ctx.font = `600 40px ${font}`;
  const wordmarkX = spec.width - SIDE_PAD - ctx.measureText(WORDMARK).width;
  ctx.fillStyle = colors.brand;
  ctx.beginPath();
  ctx.arc(wordmarkX - 24, footerY - 13, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.fillText(WORDMARK, wordmarkX, footerY);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export the card image");
  return new File([blob], "coachin-card.png", { type: "image/png" });
}

/** Photo(s) on top with a fade into the panel, or the brand gradient. True when photos were drawn. */
async function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  spec: (typeof SHARE_FORMATS)[ShareCardFormat],
  photoHeight: number,
  colors: Palette,
  options: RenderShareCardOptions,
): Promise<boolean> {
  const photos = options.comparePhotos ?? (options.photo ? [options.photo] : []);
  if (photos.length === 0) {
    const gradient = ctx.createLinearGradient(0, 0, spec.width, spec.height);
    gradient.addColorStop(0, colors.panel);
    gradient.addColorStop(1, colors.tint);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, spec.width, spec.height);
    return false;
  }
  const bitmaps = await Promise.all(photos.map((blob) => createImageBitmap(blob)));
  const slot = spec.width / bitmaps.length;
  bitmaps.forEach((bitmap, index) => {
    drawCover(ctx, bitmap, index * slot, slot, photoHeight);
    bitmap.close();
  });
  ctx.fillStyle = colors.panel;
  if (bitmaps.length === 2) ctx.fillRect(slot - 3, 0, 6, photoHeight);
  const bridge = ctx.createLinearGradient(0, photoHeight - spec.bridge, 0, photoHeight);
  bridge.addColorStop(0, "transparent");
  bridge.addColorStop(1, colors.panel);
  ctx.fillStyle = bridge;
  ctx.fillRect(0, photoHeight - spec.bridge, spec.width, spec.bridge);
  return true;
}

/** Cover-fit (CSS `object-fit: cover`, centered) into a column at the top. */
function drawCover(ctx: CanvasRenderingContext2D, image: ImageBitmap, dx: number, dw: number, dh: number) {
  const scale = Math.max(dw / image.width, dh / image.height);
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, dx, 0, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let index = 0; index < words.length; index++) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    if (lines.length === maxLines - 1) {
      // The last allowed line takes the rest; truncate() ellipsizes it.
      current = words.slice(index).join(" ");
      break;
    }
    current = words[index];
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).map((line) => truncate(ctx, line, maxWidth));
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

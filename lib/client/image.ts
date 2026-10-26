// Client-side image preparation: HEIC fallback, EXIF orientation, resize, JPEG compression.

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.8;

function isHeic(file: Blob & { name?: string }) {
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name ?? "");
}

async function decode(file: Blob & { name?: string }): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    // Safari decodes HEIC natively; other browsers need a converter (lazy-loaded, ~1 MB).
    if (!isHeic(file)) throw e;
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    return createImageBitmap(Array.isArray(converted) ? converted[0] : converted);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image encoding failed"))), type, quality),
  );
}

/** Resizes so the longest side is at most `maxSide` and re-encodes. */
export async function prepareImage(
  file: Blob & { name?: string },
  { maxSide = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY, type = "image/jpeg" } = {},
): Promise<Blob> {
  const bmp = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toBlob(canvas, type, quality);
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type });
}

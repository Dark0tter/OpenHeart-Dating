import { createHash } from "crypto";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "heif",
]);

export type ProcessedImage = {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  contentHash: string;
};

export class ImageError extends Error {}

/**
 * Re-encodes an upload as WebP. Re-encoding drops every bit of metadata
 * (EXIF GPS location, camera serials) and anything hidden in the file, and
 * guarantees what we store really is an image.
 */
export async function processUpload(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageError("Photos must be smaller than 12 MB.");
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new ImageError("That file isn't a photo we can read.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageError(
      "Please upload a JPEG, PNG, WebP, HEIC, or AVIF photo.",
    );
  }
  if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
    throw new ImageError("Photos need to be at least 200 × 200 pixels.");
  }

  const base = sharp(input, { animated: false, limitInputPixels: 50_000_000 })
    .rotate()
    .toColorspace("srgb");

  const { data: full, info } = await base
    .clone()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize({ width: 480, height: 480, fit: "cover", position: "attention" })
    .webp({ quality: 76 })
    .toBuffer();

  return {
    full,
    thumb,
    width: info.width,
    height: info.height,
    contentHash: createHash("sha256").update(input).digest("hex"),
  };
}

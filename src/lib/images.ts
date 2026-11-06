import sharp from "sharp";
import { access, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assetPath } from "./media";

// The service owns a single local disk. Keep native image work bounded even
// when several preview requests arrive together.
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 32 });
type ImageState = {
  tail: Promise<void>;
  thumbnails: Map<string, Promise<string>>;
};
const imageGlobal = globalThis as typeof globalThis & {
  narino360ImageWork?: ImageState;
};
const state = (imageGlobal.narino360ImageWork ??= {
  tail: Promise.resolve(),
  thumbnails: new Map(),
});
export async function imageTask<T>(work: () => Promise<T>): Promise<T> {
  const before = state.tail;
  let release!: () => void;
  state.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await before;
  try {
    return await work();
  } finally {
    release();
  }
}
export async function previewBuffer(input: Buffer | string) {
  return sharp(input, { limitInputPixels: 40000000, animated: false })
    .rotate()
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();
}
export function thumbnailPath(filename: string) {
  return assetPath(path.parse(filename).name + "-thumb.webp");
}
const inProgress = state.thumbnails;
export async function ensureThumbnail(filename: string): Promise<string> {
  const target = thumbnailPath(filename);
  try {
    await access(target);
    return target;
  } catch {}
  const existing = inProgress.get(target);
  if (existing) return existing;
  const job = imageTask(async () => {
    try {
      await access(target);
      return target;
    } catch {}
    const encoded = await previewBuffer(assetPath(filename));
    const temporary = target + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, encoded, { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => {});
    }
    return target;
  });
  inProgress.set(target, job);
  try {
    return await job;
  } finally {
    inProgress.delete(target);
  }
}

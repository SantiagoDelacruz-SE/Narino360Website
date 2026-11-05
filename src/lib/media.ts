import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "./db";
import type { Asset } from "./domain";
export const mediaDir = path.join(dataDir, "media");
const index = path.join(dataDir, "media.json");
export function readAssets(): Asset[] {
  return existsSync(index) ? JSON.parse(readFileSync(index, "utf8")) : [];
}
export function writeAssets(items: Asset[]) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const tmp = index + "." + randomUUID() + ".tmp";
  writeFileSync(tmp, JSON.stringify(items, null, 2), { mode: 0o600 });
  renameSync(tmp, index);
}
export function assetPath(filename: string) {
  return path.join(mediaDir, filename);
}

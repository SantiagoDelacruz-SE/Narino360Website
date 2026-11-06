import { NextResponse } from "next/server";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { readAssets, assetPath } from "@/lib/media";
import { ensureThumbnail } from "@/lib/images";
import { identity, errorResponse } from "@/lib/http";
import { AppError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await identity();
    const { id } = await context.params;
    const asset = readAssets().find((a) => a.id === id);
    if (!asset) throw new AppError("Archivo no encontrado.", 404);
    const variant = new URL(request.url).searchParams.get("size");
    if (variant && variant !== "thumbnail")
      throw new AppError("Tamaño de imagen no válido.");
    const isPdf = asset.kind === "documento" || asset.kind === "publicacion";
    if (variant && isPdf)
      throw new AppError("Este documento no tiene miniatura.");
    const filename = variant
      ? await ensureThumbnail(asset.filename)
      : assetPath(asset.filename);
    const file = await open(filename, "r");
    try {
      const info = await file.stat();
      const etag =
        '"' +
        asset.id +
        "-" +
        (variant || "original") +
        "-" +
        info.size.toString(16) +
        "-" +
        Math.trunc(info.mtimeMs).toString(16) +
        '"';
      const headers: Record<string, string> = {
        "Content-Type": isPdf ? "application/pdf" : "image/webp",
        "Content-Length": String(info.size),
        "Cache-Control": "private, no-cache",
        Vary: "Cookie",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
        ...(isPdf
          ? {
              "Content-Disposition":
                'attachment; filename="' + asset.filename + '"',
              "Content-Security-Policy": "sandbox",
            }
          : {}),
      };
      if (request.headers.get("if-none-match") === etag) {
        await file.close();
        return new NextResponse(null, { status: 304, headers });
      }
      const stream = Readable.toWeb(
        file.createReadStream({ autoClose: true }),
      ) as ReadableStream<Uint8Array>;
      return new NextResponse(stream, { headers });
    } catch (e) {
      await file.close().catch(() => {});
      throw e;
    }
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT")
      return errorResponse(new AppError("Archivo no encontrado.", 404));
    return errorResponse(e);
  }
}

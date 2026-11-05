import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { readAssets, assetPath } from "@/lib/media";
import { identity, errorResponse } from "@/lib/http";
import { AppError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await identity();
    const { id } = await context.params;
    const asset = readAssets().find((a) => a.id === id);
    if (!asset || !existsSync(assetPath(asset.filename)))
      throw new AppError("Archivo no encontrado.", 404);
    return new NextResponse(readFileSync(assetPath(asset.filename)), {
      headers: {
        "Content-Type":
          asset.kind === "documento" ? "application/pdf" : "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(asset.kind === "documento"
          ? {
              "Content-Disposition":
                'attachment; filename="' + asset.filename + '"',
              "Content-Security-Policy": "sandbox",
            }
          : {}),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

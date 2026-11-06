import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { readAssets, writeAssets, mediaDir, assetPath } from "@/lib/media";
import { audit, db } from "@/lib/db";
import {
  body,
  identity,
  editor,
  sameOrigin,
  actor,
  errorResponse,
} from "@/lib/http";
import {
  AppError,
  textField,
  publicationMetadata,
  PROGRAMS,
  MUNICIPALITIES,
  type Asset,
} from "@/lib/domain";
export const runtime = "nodejs";
export async function GET() {
  try {
    await identity();
    return NextResponse.json({ assets: readAssets() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  let createdPath: string | undefined;
  try {
    sameOrigin(request);
    const user = await editor();
    const limit = 16 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > limit)
      throw new AppError("El archivo supera el máximo de 15 MB.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new AppError("Archivo requerido.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("El archivo supera el máximo de 15 MB.", 413);
      }
      chunks.push(r.value);
    }
    const data = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") || "" },
    }).formData();
    const file = data.get("file");
    if (
      !(file instanceof File) ||
      file.size > 15 * 1024 * 1024 ||
      file.size === 0
    )
      throw new AppError("Selecciona un archivo de hasta 15 MB.");
    const kind = textField(data.get("kind"), "Tipo");
    if (
      !["evidencia", "diapositiva", "documento", "publicacion"].includes(kind)
    )
      throw new AppError("Tipo de archivo no válido.");
    const title = textField(data.get("title"), "Título", 200),
      caption = textField(data.get("caption") || "", "Descripción", 2000, 0);
    const municipality = textField(
        data.get("municipality") || "",
        "Municipio",
        100,
        0,
      ),
      program = textField(data.get("program") || "", "Programa", 100, 0);
    if (municipality && !MUNICIPALITIES.some((m) => m === municipality))
      throw new AppError("Municipio no válido.");
    if (program && !PROGRAMS.some((p) => p === program))
      throw new AppError("Programa no válido.");
    const activityId = data.get("activityId")
      ? Number(data.get("activityId"))
      : null;
    if (
      activityId !== null &&
      (!Number.isSafeInteger(activityId) ||
        !db().prepare("SELECT id FROM jornadas WHERE id=?").get(activityId))
    )
      throw new AppError("Jornada asociada no válida.");
    const metadata =
      kind === "publicacion"
        ? publicationMetadata({
            publicationType: data.get("publicationType"),
            publicationDate: data.get("publicationDate"),
          })
        : {};
    const id = randomUUID(),
      buffer = Buffer.from(await file.arrayBuffer());
    let encoded: Buffer, ext: string;
    if (kind === "documento" || kind === "publicacion") {
      if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new AppError("Los soportes documentales deben ser PDF.");
      encoded = buffer;
      ext = "pdf";
    } else {
      try {
        const format = (
          await sharp(buffer, { limitInputPixels: 40000000 }).metadata()
        ).format;
        if (!format || !["jpeg", "png", "webp"].includes(format))
          throw new Error("Formato no permitido");
        encoded = await sharp(buffer, {
          limitInputPixels: 40000000,
          animated: false,
        })
          .rotate()
          .resize({
            width: 4096,
            height: 4096,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toBuffer();
      } catch {
        throw new AppError(
          "No se pudo leer la imagen. Usa JPG, PNG o WebP de hasta 40 megapíxeles.",
        );
      }
      ext = "webp";
    }
    mkdirSync(mediaDir, { recursive: true, mode: 0o700 });
    const filename = id + "." + ext;
    createdPath = assetPath(filename);
    writeFileSync(createdPath, encoded, { mode: 0o600 });
    const asset: Asset = {
      id,
      kind: kind as Asset["kind"],
      title,
      caption,
      municipality,
      program,
      activityId,
      filename,
      createdAt: new Date().toISOString(),
      ...metadata,
    };
    writeAssets([...readAssets(), asset]);
    createdPath = undefined;
    audit(actor(user), user.role, "archivo.cargado", id);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (e) {
    if (createdPath && existsSync(/*turbopackIgnore: true*/ createdPath))
      unlinkSync(/*turbopackIgnore: true*/ createdPath);
    return errorResponse(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    const value = await body(request);
    const items = readAssets();
    if (!Array.isArray(value.order)) throw new AppError("Orden no válido.");
    const slides = items.filter((a) => a.kind === "diapositiva");
    if (
      value.order.length !== slides.length ||
      new Set(value.order).size !== slides.length ||
      value.order.some((id: unknown) => !slides.find((s) => s.id === id))
    )
      throw new AppError(
        "La lista de diapositivas cambió. Actualiza e intenta de nuevo.",
      );
    writeAssets([
      ...items.filter((a) => a.kind !== "diapositiva"),
      ...value.order.map((id: string) => slides.find((s) => s.id === id)!),
    ]);
    audit(actor(user), user.role, "diapositivas.ordenadas");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    const value = await body(request);
    const items = readAssets(),
      asset = items.find((a) => a.id === value.id);
    if (!asset) throw new AppError("Archivo no encontrado.", 404);
    writeAssets(items.filter((a) => a.id !== asset.id));
    if (existsSync(assetPath(asset.filename)))
      unlinkSync(assetPath(asset.filename));
    audit(actor(user), user.role, "archivo.eliminado", asset.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { imageTask, previewBuffer, thumbnailPath } from "@/lib/images";
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
  let createdPreview: string | undefined;
  const requestId = randomUUID(),
    started = Date.now();
  let phase = "authorization";
  const trace = (
    event: string,
    details: Record<string, string | number> = {},
  ) =>
    console.info(
      "[media-upload] " +
        JSON.stringify({
          requestId,
          event,
          phase,
          elapsedMs: Date.now() - started,
          rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
          ...details,
        }),
    );
  try {
    sameOrigin(request);
    const user = await editor();
    phase = "receiving";
    trace("started");
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
    const uploadId = data.get("uploadId")
      ? textField(data.get("uploadId"), "Identificador de carga", 36)
      : undefined;
    if (
      uploadId &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        uploadId,
      )
    )
      throw new AppError("Identificador de carga no válido.");
    const previousUpload = () => {
      const asset = uploadId
        ? readAssets().find((item) => item.uploadId === uploadId)
        : undefined;
      if (asset && asset.kind !== kind)
        throw new AppError("El identificador corresponde a otra carga.", 409);
      return asset;
    };
    const reusedResponse = (asset: Asset) => {
      trace("confirmed");
      return NextResponse.json(
        { asset },
        { headers: { "X-Request-ID": requestId } },
      );
    };
    const previous = previousUpload();
    if (previous) return reusedResponse(previous);
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
    trace("received", { kind, bytes: file.size });
    const id = randomUUID(),
      buffer = Buffer.from(await file.arrayBuffer());
    let encoded: Buffer, ext: string;
    let preview: Buffer | undefined;
    if (kind === "documento" || kind === "publicacion") {
      if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
        throw new AppError("Los soportes documentales deben ser PDF.");
      encoded = buffer;
      ext = "pdf";
    } else {
      phase = "processing";
      try {
        const result = await imageTask(async () => {
          const imageMetadata = await sharp(buffer, {
            limitInputPixels: 40000000,
          }).metadata();
          const format = imageMetadata.format;
          trace("processing", {
            width: imageMetadata.width || 0,
            height: imageMetadata.height || 0,
          });
          if (!format || !["jpeg", "png", "webp"].includes(format))
            throw new Error("Formato no permitido");
          const full = await sharp(buffer, {
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
          return { encoded: full, preview: await previewBuffer(full) };
        });
        encoded = result.encoded;
        preview = result.preview;
      } catch {
        throw new AppError(
          "No se pudo leer la imagen. Usa JPG, PNG o WebP de hasta 40 megapíxeles.",
        );
      }
      ext = "webp";
    }
    // Another request with this ID may have finished during image processing.
    // The check and synchronous catalog write below cannot interleave within
    // the single service process that owns this disk.
    const concurrent = previousUpload();
    if (concurrent) return reusedResponse(concurrent);
    phase = "persisting";
    trace("persisting", { bytes: encoded.length });
    mkdirSync(mediaDir, { recursive: true, mode: 0o700 });
    const filename = id + "." + ext;
    createdPath = assetPath(filename);
    writeFileSync(createdPath, encoded, { mode: 0o600 });
    if (preview) {
      createdPreview = thumbnailPath(filename);
      writeFileSync(createdPreview, preview, { mode: 0o600 });
    }
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
      ...(uploadId ? { uploadId } : {}),
    };
    writeAssets([...readAssets(), asset]);
    createdPath = undefined;
    createdPreview = undefined;
    audit(actor(user), user.role, "archivo.cargado", id);
    trace("completed");
    return NextResponse.json(
      { asset },
      { status: 201, headers: { "X-Request-ID": requestId } },
    );
  } catch (e) {
    if (phase !== "authorization")
      trace("failed", {
        status: e instanceof AppError ? e.status : 500,
        errorType: e instanceof Error ? e.name : "Unknown",
        code:
          e &&
          typeof e === "object" &&
          "code" in e &&
          typeof e.code === "string"
            ? e.code
            : "none",
      });
    if (createdPreview && existsSync(/*turbopackIgnore: true*/ createdPreview))
      unlinkSync(/*turbopackIgnore: true*/ createdPreview);
    if (createdPath && existsSync(/*turbopackIgnore: true*/ createdPath))
      unlinkSync(/*turbopackIgnore: true*/ createdPath);
    const response = errorResponse(e);
    response.headers.set("X-Request-ID", requestId);
    return response;
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
    await imageTask(async () => {
      if (existsSync(assetPath(asset.filename)))
        unlinkSync(assetPath(asset.filename));
      const preview = thumbnailPath(asset.filename);
      if (existsSync(preview)) unlinkSync(preview);
    });
    audit(actor(user), user.role, "archivo.eliminado", asset.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

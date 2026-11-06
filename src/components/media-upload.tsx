"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import {
  MUNICIPALITIES,
  PROGRAMS,
  PUBLICATION_TYPES,
  type Activity,
  type Asset,
} from "@/lib/domain";
import { api, ApiError } from "./api";
export default function MediaUpload({
  kind,
  activities,
  onSaved,
  onRefresh,
}: {
  kind: Asset["kind"];
  activities: Activity[];
  onSaved: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      files = form
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0);
    let count = 0;
    try {
      if (files.length < 1 || files.length > 20)
        throw new Error("Selecciona de 1 a 20 archivos por carga.");
      const oversized = files.find((file) => file.size > 15 * 1024 * 1024);
      if (oversized)
        throw new Error(
          'El archivo "' +
            oversized.name +
            '" supera los 15 MB. Reduce su tamaño antes de cargarlo.',
        );
      for (const file of files) {
        setProgress("Cargando " + (count + 1) + " de " + files.length + "…");
        const data = new FormData();
        for (const [key, value] of form)
          if (key !== "files") data.set(key, value);
        const uploadId = crypto.randomUUID();
        data.set("uploadId", uploadId);
        data.set("file", file);
        data.set("kind", kind);
        if (files.length > 1)
          data.set("title", String(form.get("title")) + " · " + (count + 1));
        try {
          await api("/api/media", { method: "POST", body: data });
        } catch (error) {
          if (
            error instanceof ApiError &&
            error.status &&
            error.status >= 400 &&
            error.status < 500
          )
            throw error;
          const confirmation = await api<{ assets: Asset[] }>("/api/media", {
            timeoutMs: 5000,
          }).catch(() => null);
          if (
            !confirmation?.assets.some((asset) => asset.uploadId === uploadId)
          )
            throw new Error(
              (error as Error).message +
                " No se pudo confirmar que este archivo quedara guardado; revisa el listado antes de volver a cargarlo.",
            );
        }
        count++;
      }
      await onSaved();
    } catch (e) {
      if (count) await onRefresh().catch(() => {});
      setError(
        (count ? count + " archivos quedaron guardados. " : "") +
          (e as Error).message,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="notice">
        {" "}
        {kind === "publicacion"
          ? "Publica boletines y otros productos del observatorio en PDF. Indica su tipo y fecha de publicación para facilitar la consulta."
          : kind === "diapositiva"
            ? "Carga imágenes de tu presentación oficial, preferiblemente en formato 16:9. Se mostrarán en el orden de carga."
            : "Los archivos se guardan por separado de la base de datos y estarán disponibles para los usuarios con sesión."}
      </div>
      <label>
        Título
        <input
          name="title"
          required
          maxLength={200}
          placeholder={
            kind === "publicacion"
              ? "Título del boletín o producto"
              : kind === "diapositiva"
                ? "Título de la diapositiva"
                : "Nombre de la evidencia"
          }
        />
      </label>
      <label>
        Descripción o fuente
        <textarea
          name="caption"
          maxLength={2000}
          rows={3}
          placeholder="Contexto, fecha, entidad o referencia documental"
        />
      </label>
      {kind === "publicacion" && (
        <div className="field-grid">
          <label>
            Tipo de publicación
            <select
              name="publicationType"
              aria-label="Tipo de publicación"
              required
            >
              <option value="">Selecciona una categoría</option>
              {PUBLICATION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Fecha de publicación
            <input name="publicationDate" type="date" required />
          </label>
        </div>
      )}
      {kind !== "diapositiva" && kind !== "publicacion" && (
        <>
          <div className="field-grid">
            <label>
              Municipio
              <select name="municipality">
                <option value="">Sin municipio asociado</option>
                {MUNICIPALITIES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Programa
              <select name="program">
                <option value="">Sin programa asociado</option>
                {PROGRAMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Jornada asociada
            <select name="activityId">
              <option value="">Sin jornada asociada</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.municipality}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="upload-zone">
        <Upload size={28} />
        <strong>
          {kind === "documento" || kind === "publicacion"
            ? "Seleccionar soportes PDF"
            : "Seleccionar imágenes"}
        </strong>
        <span>Hasta 20 archivos · 15 MB por archivo</span>
        <input
          name="files"
          type="file"
          multiple
          required
          accept={
            kind === "documento" || kind === "publicacion"
              ? "application/pdf"
              : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          }
        />
      </label>
      <p className="form-help">
        {kind === "documento" || kind === "publicacion"
          ? "Los PDF se entregan como descarga."
          : "Las imágenes se convierten a WebP HD (hasta 4096 px) y se eliminan sus metadatos de ubicación."}{" "}
        Verifica la autorización para compartir los archivos antes de cargarlas.
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary" disabled={busy}>
        <Upload size={16} />
        {busy ? progress : "Cargar archivos"}
      </button>
    </form>
  );
}

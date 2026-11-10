"use client";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  MUNICIPALITIES,
  COMPONENTS,
  type Component,
  PUBLICATION_TYPES,
  type Activity,
  type Asset,
} from "@/lib/domain";
import { api, ApiError } from "./api";
import { prepareImage } from "./prepare-image";
type UploadBatch = {
  form: FormData;
  entries: { file: File; uploadId: string }[];
  completed: number;
};
export default function MediaUpload({
  kind,
  initialProgram,
  activities,
  onSaved,
  onRefresh,
}: {
  kind: Asset["kind"];
  initialProgram?: Component;
  activities: Activity[];
  onSaved: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [batch, setBatch] = useState<UploadBatch | null>(null);
  const maxFiles = kind === "diapositiva" ? 100 : 20;
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    let current = batch;
    const signal = lifecycle.current?.signal;
    const form = batch?.form || new FormData(e.currentTarget);
    try {
      if (!current) {
        const files = form
          .getAll("files")
          .filter((f): f is File => f instanceof File && f.size > 0);
        if (files.length < 1 || files.length > maxFiles)
          throw new Error(
            "Selecciona de 1 a " + maxFiles + " archivos por carga.",
          );
        const oversized = files.find((file) => file.size > 15 * 1024 * 1024);
        if (oversized)
          throw new Error(
            'El archivo "' +
              oversized.name +
              '" supera los 15 MB. Reduce su tamaño antes de cargarlo.',
          );
        if (kind === "diapositiva")
          files.sort((a, b) =>
            a.name.localeCompare(b.name, "es", { numeric: true }),
          );
        current = {
          form,
          entries: files.map((file) => ({
            file,
            uploadId: crypto.randomUUID(),
          })),
          completed: 0,
        };
        setBatch(current);
      }
      const total = current.entries.length;
      for (let index = current.completed; index < total; index++) {
        const { file, uploadId } = current.entries[index];
        const label = index + 1 + " de " + total + ": " + file.name;
        setProgress("Comprobando " + label);
        // Before a manual retry, check whether its earlier attempt was saved.
        // If the server cannot be reached, stop without submitting another body.
        const confirmation = await api<{ assets: Asset[] }>("/api/media", {
          timeoutMs: 15000,
          signal,
        });
        if (confirmation.assets.some((asset) => asset.uploadId === uploadId)) {
          current = { ...current, completed: index + 1 };
          setBatch(current);
          continue;
        }
        setProgress("Preparando " + label);
        const prepared =
          kind === "diapositiva" || kind === "evidencia"
            ? await prepareImage(file)
            : file;
        signal?.throwIfAborted();
        const data = new FormData();
        for (const [key, value] of form)
          if (key !== "files") data.set(key, value);
        data.set("uploadId", uploadId);
        data.set("file", prepared);
        data.set("kind", kind);
        if (total > 1)
          data.set(
            "title",
            String(form.get("title")).slice(0, 190) + " · " + (index + 1),
          );
        setProgress("Cargando " + label);
        try {
          await api("/api/media", { method: "POST", body: data, signal });
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
            signal,
          }).catch(() => null);
          if (
            !confirmation?.assets.some((asset) => asset.uploadId === uploadId)
          )
            throw new Error(
              (error as Error).message +
                " No se pudo confirmar que este archivo quedara guardado; revisa el listado antes de volver a cargarlo.",
            );
        }
        current = { ...current, completed: index + 1 };
        setBatch(current);
      }
      await onSaved();
    } catch (e) {
      if (signal?.aborted) return;
      if (current?.completed) await onRefresh().catch(() => {});
      setError(
        (current
          ? current.completed +
            " de " +
            current.entries.length +
            " archivos confirmados. "
          : "") +
          (e as Error).message +
          (current
            ? " Mantén esta ventana abierta y pulsa «Reanudar pendientes» cuando vuelva la conexión."
            : ""),
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <fieldset
        disabled={busy || !!batch}
        className="form-stack"
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="notice">
          {" "}
          {kind === "publicacion"
            ? "Publica boletines y otros productos del observatorio en PDF. Indica su tipo y fecha de publicación para facilitar la consulta."
            : kind === "diapositiva"
              ? "Selecciona hasta 100 diapositivas, preferiblemente en formato 16:9. Se cargarán de una en una, ordenadas por nombre (01, 02, 03…)."
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
        {kind !== "diapositiva" && (
          <label>
            Componente
            <select
              name="program"
              aria-label="Componente del archivo"
              required={kind === "publicacion"}
              defaultValue={
                initialProgram ?? (kind === "publicacion" ? "Observatorio" : "")
              }
            >
              <option value="">Sin componente asociado</option>
              {COMPONENTS.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
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
          <span>Hasta {maxFiles} archivos · 15 MB por archivo</span>
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
            : "Las imágenes se preparan en este navegador antes del envío, hasta 4096 px. El servidor las convierte a WebP HD y elimina sus metadatos de ubicación."}{" "}
          Verifica la autorización para compartir los archivos antes de
          cargarlas.
        </p>
      </fieldset>
      <p className="form-help">
        Mantén esta ventana abierta hasta completar la carga. Si se interrumpe,
        podrás reanudar las pendientes aquí.
      </p>
      {batch && (
        <div className="form-stack" role="status" aria-live="polite">
          <span>
            {batch.completed} de {batch.entries.length} archivos confirmados.
          </span>
          <progress
            aria-label="Archivos confirmados"
            value={batch.completed}
            max={batch.entries.length}
            style={{ width: "100%" }}
          />
          <details>
            <summary>Ver orden de carga</summary>
            <ol>
              {batch.entries.map((entry, index) => (
                <li key={entry.uploadId}>
                  {entry.file.name}
                  {index < batch.completed ? " · Guardado" : " · Pendiente"}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary" disabled={busy}>
        <Upload size={16} />
        {busy ? progress : batch ? "Reanudar pendientes" : "Cargar archivos"}
      </button>
      {batch && !busy && (
        <button
          type="button"
          className="button"
          onClick={(event) => {
            event.currentTarget.form?.reset();
            setBatch(null);
            setError("");
          }}
        >
          Elegir otros archivos
        </button>
      )}
    </form>
  );
}

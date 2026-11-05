"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import {
  MUNICIPALITIES,
  PROGRAMS,
  type Activity,
  type Asset,
} from "@/lib/domain";
import { api } from "./api";
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
      for (const file of files) {
        setProgress("Cargando " + (count + 1) + " de " + files.length + "…");
        const data = new FormData();
        for (const [key, value] of form)
          if (key !== "files") data.set(key, value);
        data.set("file", file);
        data.set("kind", kind);
        if (files.length > 1)
          data.set("title", String(form.get("title")) + " · " + (count + 1));
        await api("/api/media", { method: "POST", body: data });
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
        {kind === "diapositiva"
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
            kind === "diapositiva"
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
      {kind !== "diapositiva" && (
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
          {kind === "documento"
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
            kind === "documento"
              ? "application/pdf"
              : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          }
        />
      </label>
      <p className="form-help">
        {kind === "documento"
          ? "Los PDF se entregan como descarga."
          : "Las imágenes se convierten a WebP HD (hasta 4096 px) y se eliminan sus metadatos de ubicación."}{" "}
        Verifica la autorización para compartir las evidencias antes de
        cargarlas.
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

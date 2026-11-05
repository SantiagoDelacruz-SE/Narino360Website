"use client";
import { useState } from "react";
import { Save, Sparkles, FileJson, Upload } from "lucide-react";
import {
  MUNICIPALITIES,
  PROGRAMS,
  parseBulletin,
  validateActivity,
  type Activity,
} from "@/lib/domain";
import { api } from "./api";
export default function ActivityForm({
  activity,
  onSaved,
}: {
  activity?: Activity;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string | number>>({
      ...activity,
    }),
    [report, setReport] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [importRows, setImportRows] = useState<unknown[] | null>(null);
  const field = (key: string) => ({
    value: draft[key] ?? "",
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => setDraft({ ...draft, [key]: event.target.value }),
  });
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const numbers = [
        "latitude",
        "longitude",
        "people",
        "families",
        "weaponsSeized",
        "weaponsVoluntary",
        "budgetApproved",
        "budgetExecuted",
      ];
      for (const name of numbers)
        (data as Record<string, unknown>)[name] = Number(data[name]);
      const validated = validateActivity(data);
      await api("/api/jornadas", {
        method: activity ? "PUT" : "POST",
        body: JSON.stringify({
          ...validated,
          ...(activity ? { id: activity.id } : {}),
        }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function readJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_500_000)
        throw new Error("El JSON debe pesar menos de 1,5 MB.");
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.length || data.length > 200)
        throw new Error("El JSON debe contener una lista de 1 a 200 jornadas.");
      data.forEach(validateActivity);
      setImportRows(data);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      {!activity && (
        <details className="import-panel">
          <summary>
            <Sparkles size={16} /> Asistir carga desde boletín o archivo
          </summary>
          <div className="form-stack">
            <label>
              Boletín o reporte de WhatsApp
              <textarea
                rows={4}
                value={report}
                maxLength={8000}
                onChange={(e) => setReport(e.target.value)}
                placeholder="Pega el reporte con municipio, fecha, participantes y coordenadas…"
              />
            </label>
            <button
              type="button"
              className="button secondary"
              disabled={!report.trim()}
              onClick={() => {
                setDraft({ ...draft, ...parseBulletin(report) });
                setError("");
              }}
            >
              Extraer sugerencias
            </button>
            <p className="form-help">
              Extracción por patrones, sin IA generativa. Revisa las sugerencias
              y completa los datos antes de guardar. No se inventan coordenadas
              ni cifras.
            </p>
            <label className="file-label">
              <FileJson size={18} /> Importar jornadas desde JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void readJson(e.target.files?.[0])}
              />
            </label>
            <a href="/plantilla-jornadas.json" download className="text-link">
              Descargar estructura de ejemplo (no contiene jornadas reales)
            </a>
            {importRows && (
              <div className="notice">
                <strong>{importRows.length} jornadas validadas</strong>
                <p>
                  Se incorporarán todas en una sola operación. Los registros
                  existentes se conservan.
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  type="button"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api("/api/jornadas", {
                        method: "POST",
                        body: JSON.stringify(importRows),
                      });
                      await onSaved();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Upload size={16} />
                  Confirmar importación
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setImportRows(null)}
                >
                  Cancelar importación
                </button>
              </div>
            )}
          </div>
        </details>
      )}
      <form onSubmit={save} className="form-stack">
        <label>
          Título de la jornada
          <input
            name="title"
            required
            maxLength={200}
            {...field("title")}
            placeholder="Nombre de la actividad o intervención"
          />
        </label>
        <div className="field-grid">
          <label>
            Fecha
            <input name="date" type="date" required {...field("date")} />
          </label>
          <label>
            Municipio
            <select name="municipality" required {...field("municipality")}>
              <option value="">Selecciona un municipio</option>
              {MUNICIPALITIES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Programa
            <select name="program" required {...field("program")}>
              <option value="">Selecciona un programa</option>
              {PROGRAMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Meta PISCC
            <input
              name="pisccGoal"
              maxLength={1000}
              {...field("pisccGoal")}
              placeholder="Código o descripción de la meta"
            />
          </label>
          <label>
            Latitud
            <input
              name="latitude"
              type="number"
              step="any"
              min="0"
              max="3.5"
              required
              {...field("latitude")}
              placeholder="Ej. 1.21"
            />
          </label>
          <label>
            Longitud
            <input
              name="longitude"
              type="number"
              step="any"
              min="-79.5"
              max="-75.5"
              required
              {...field("longitude")}
              placeholder="Ej. -77.28"
            />
          </label>
        </div>
        <p className="form-help">
          Usa coordenadas decimales de la ubicación real. La validación de rango
          es aproximada y no certifica límites municipales.
        </p>
        <div className="form-section-title">Resultados de la intervención</div>
        <div className="field-grid">
          {[
            ["people", "Personas beneficiadas"],
            ["families", "Familias beneficiadas"],
            ["weaponsSeized", "Armas incautadas"],
            ["weaponsVoluntary", "Armas entregadas voluntariamente"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                step="1"
                min="0"
                max="10000000"
                required
                value={draft[key] ?? 0}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          Objetivo
          <textarea
            name="objective"
            rows={2}
            maxLength={4000}
            required
            {...field("objective")}
          />
        </label>
        <label>
          Resumen operativo y resultados
          <textarea
            name="summary"
            rows={4}
            maxLength={8000}
            required
            {...field("summary")}
          />
        </label>
        <div className="form-section-title">Control presupuestal · COP</div>
        <div className="field-grid">
          {[
            ["budgetApproved", "Presupuesto aprobado"],
            ["budgetExecuted", "Presupuesto ejecutado"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                step=".01"
                min="0"
                max="100000000000000"
                required
                value={draft[key] ?? 0}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="form-help">
          Si no hay asignación presupuestal registrada, conserva cero.
        </p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          <Save size={17} />
          {busy
            ? "Guardando…"
            : activity
              ? "Guardar cambios"
              : "Registrar jornada"}
        </button>
      </form>
    </div>
  );
}

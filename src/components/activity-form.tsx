"use client";
import { useState } from "react";
import { Save, Sparkles, FileJson, Upload } from "lucide-react";
import {
  MUNICIPALITIES,
  COMPONENTS,
  RECORD_TYPES,
  recordTypeOf,
  activityMunicipalities,
  normalize,
  type Component,
  type RecordType,
  parseBulletin,
  validateActivity,
  type Activity,
} from "@/lib/domain";
import { api } from "./api";
export default function ActivityForm({
  activity,
  initialProgram,
  initialRecordType,
  onSaved,
}: {
  activity?: Activity;
  initialProgram?: Component;
  initialRecordType?: RecordType;
  onSaved: () => Promise<void>;
}) {
  const { municipalities: _members, ...activityFields } = activity ?? {};
  void _members;
  const [municipalities, setMunicipalities] = useState<string[]>(() =>
    activity ? activityMunicipalities(activity) : [],
  );
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string | number | null>>({
      program: initialProgram ?? "",
      recordType: initialRecordType ?? recordTypeOf(activity ?? {}),
      ...activityFields,
    }),
    [report, setReport] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [importRows, setImportRows] = useState<unknown[] | null>(null);
  const multiple =
    draft.program === "Banco de Alimentos" || municipalities.length > 1;
  const field = (key: string) => ({
    value: draft[key] ?? "",
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setDraft({ ...draft, [key]: event.target.value });
      if (key === "municipality")
        setMunicipalities(event.target.value ? [event.target.value] : []);
    },
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
      ];
      for (const name of numbers)
        (data as Record<string, unknown>)[name] =
          (name === "latitude" || name === "longitude" || name === "people") &&
          data[name] === ""
            ? null
            : Number(data[name]);
      const validated = validateActivity({
        ...data,
        ...(multiple
          ? { municipalities }
          : activity?.municipalities
            ? { municipalities: [String(data.municipality)] }
            : {}),
        budgetApproved: activity?.budgetApproved ?? 0,
        budgetExecuted: activity?.budgetExecuted ?? 0,
      });
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
                const { municipalities: suggested, ...fields } =
                  parseBulletin(report);
                setDraft({ ...draft, ...fields });
                if (suggested) setMunicipalities(suggested);
                else if (fields.municipality)
                  setMunicipalities([fields.municipality]);
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
          Tipo de registro
          <select
            name="recordType"
            aria-label="Tipo de registro"
            required
            {...field("recordType")}
          >
            {RECORD_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Título del registro
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
          {!multiple && (
            <label>
              Municipio
              <select
                name="municipality"
                aria-label="Municipio"
                required
                {...field("municipality")}
              >
                <option value="">Selecciona un municipio</option>
                {MUNICIPALITIES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Componente
            <select
              name="program"
              aria-label="Componente"
              required
              {...field("program")}
              onChange={(e) => {
                setDraft({ ...draft, program: e.target.value });
                if (
                  e.target.value === "Banco de Alimentos" &&
                  !municipalities.length &&
                  draft.municipality
                )
                  setMunicipalities([String(draft.municipality)]);
              }}
            >
              <option value="">Selecciona un componente</option>
              {COMPONENTS.map((p) => (
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
            Latitud de referencia (opcional)
            <input
              name="latitude"
              type="number"
              step="any"
              min="0"
              max="3.5"
              {...field("latitude")}
              placeholder="Ej. 1.21"
            />
          </label>
          <label>
            Longitud de referencia (opcional)
            <input
              name="longitude"
              type="number"
              step="any"
              min="-79.5"
              max="-75.5"
              {...field("longitude")}
              placeholder="Ej. -77.28"
            />
          </label>
        </div>
        {multiple && (
          <fieldset className="activity-municipalities">
            <legend>
              Municipios de la actividad ({municipalities.length} seleccionados)
            </legend>
            {municipalities.length > 0 && (
              <p className="activity-selected-municipalities">
                Seleccionados: {municipalities.join(" · ")}
              </p>
            )}
            <input
              aria-label="Buscar municipio de la actividad"
              placeholder="Buscar municipio"
              value={municipalitySearch}
              onChange={(e) => setMunicipalitySearch(e.target.value)}
            />
            <div>
              {MUNICIPALITIES.filter((m) =>
                normalize(m).includes(normalize(municipalitySearch)),
              ).map((m) => (
                <label key={m}>
                  <input
                    type="checkbox"
                    checked={municipalities.includes(m)}
                    onChange={(e) => {
                      const selected = e.target.checked
                        ? [...municipalities, m]
                        : municipalities.filter((value) => value !== m);
                      setMunicipalities(selected);
                      setDraft({ ...draft, municipality: selected[0] ?? "" });
                    }}
                  />
                  {m}
                </label>
              ))}
            </div>
            <p className="form-help">
              Marca uno o varios municipios. Se guarda una sola actividad y se
              muestra su presencia en cada municipio, sin distribuir personas ni
              otros resultados.
            </p>
          </fieldset>
        )}
        <p className="form-help">
          El mapa usa los municipios seleccionados. Puedes dejar ambas
          coordenadas vacías o conservar una referencia municipal en formato
          decimal; no se presenta como lugar exacto de ejecución. Las noticias
          no se incluyen en el mapa ni en los indicadores de intervenciones.
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
                required={key !== "people"}
                placeholder={key === "people" ? "Sin desagregar" : undefined}
                value={draft[key] ?? (key === "people" ? "" : 0)}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <p className="form-help">
          Si no tienes la cifra de personas para esta jornada, deja el campo
          vacío. Se mostrará «Sin desagregar». Registra los totales por línea en
          Entregas e impactos, sin repetirlos en cada evento.
        </p>
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
              : draft.recordType === "Noticia"
                ? "Publicar noticia"
                : draft.recordType === "Operativo"
                  ? "Registrar operativo"
                  : draft.recordType === "Feria"
                    ? "Registrar feria"
                    : "Registrar jornada"}
        </button>
      </form>
    </div>
  );
}

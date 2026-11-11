"use client";
import { useRef, useState } from "react";
import {
  MUNICIPALITIES,
  activityMunicipalities,
  normalize,
  recordTypeOf,
  type Activity,
  type Asset,
  type Component,
} from "@/lib/domain";
import {
  IMPACT_AUDIENCES,
  reportTotal,
  validateDelivery,
  validateImpactReport,
  type Delivery,
  type DeliveryInput,
  type ImpactImport,
  type ImpactReport,
  type ImpactReportInput,
} from "@/lib/impact-domain";
import { api, number } from "./api";

export function ReportForm({
  component,
  report,
  bundle,
  assets,
  onSaved,
}: {
  component: Component;
  report?: ImpactReport;
  bundle?: ImpactImport;
  assets: Asset[];
  onSaved: (id: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ImpactReportInput>(
    () =>
      report ??
      bundle?.report ?? {
        sourceKey: crypto.randomUUID(),
        title: "",
        component,
        sourceTitle: "",
        sourceAssetId: null,
        sourceReference: "",
        periodStatus: "Pendiente",
        periodStart: null,
        periodEnd: null,
        periodNotes: "",
        audience: "No especificado",
        lines: [
          { id: crypto.randomUUID(), name: "", people: 0, sourcePage: null },
        ],
      },
  );
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const uploadId = useRef("");
  const pdfs = assets.filter((a) => a.filename.endsWith(".pdf"));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      let input = validateImpactReport(draft);
      if (file) {
        if (file.size > 15 * 1024 * 1024)
          throw new Error("El PDF debe pesar hasta 15 MB.");
        const data = new FormData();
        data.set("kind", "documento");
        data.set("program", component);
        data.set("title", draft.sourceTitle || draft.title);
        data.set("file", file);
        data.set("uploadId", uploadId.current);
        const { asset } = await api<{ asset: Asset }>("/api/media", {
          method: "POST",
          body: data,
          timeoutMs: 120000,
        });
        input = { ...input, sourceAssetId: asset.id };
        setDraft(input);
        setFile(null);
      }
      const result = await api<{ id: number }>("/api/impactos", {
        method: report ? "PUT" : "POST",
        body: JSON.stringify(
          report
            ? { ...input, id: report.id }
            : bundle
              ? { ...bundle, report: input }
              : input,
        ),
      });
      await onSaved(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {bundle && (
        <div className="notice impact-import-preview">
          <strong>Revisar importación</strong>
          <p>
            {bundle.report.lines.length} líneas · {number(reportTotal(draft))}{" "}
            personas reportadas · {bundle.deliveries.length} referencias de
            entregas. No se crearán jornadas ni se distribuirán beneficiarios.
          </p>
        </div>
      )}
      <label>
        Título del informe
        <input
          required
          maxLength={200}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Documento fuente
        <input
          required
          maxLength={300}
          value={draft.sourceTitle}
          onChange={(e) => setDraft({ ...draft, sourceTitle: e.target.value })}
        />
      </label>
      <label>
        Referencia o identificación documental
        <input
          maxLength={1000}
          value={draft.sourceReference}
          onChange={(e) =>
            setDraft({ ...draft, sourceReference: e.target.value })
          }
        />
      </label>
      <label>
        Documento soporte (PDF)
        <select
          aria-label="Documento soporte (PDF)"
          value={draft.sourceAssetId ?? ""}
          onChange={(e) => {
            setDraft({ ...draft, sourceAssetId: e.target.value || null });
            setFile(null);
          }}
        >
          <option value="">Sin PDF vinculado</option>
          {pdfs.map((a) => (
            <option value={a.id} key={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Adjuntar informe general PDF (opcional)
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            uploadId.current = crypto.randomUUID();
          }}
        />
      </label>
      <p className="form-help">
        Puedes vincular un documento existente o adjuntar uno de hasta 15 MB. El
        PDF conserva el acceso privado y se podrá previsualizar.
      </p>
      <div className="field-grid">
        <label>
          Estado del período
          <select
            aria-label="Estado del período"
            value={draft.periodStatus}
            onChange={(e) =>
              setDraft({
                ...draft,
                periodStatus: e.target
                  .value as ImpactReportInput["periodStatus"],
              })
            }
          >
            <option>Pendiente</option>
            <option>Confirmado</option>
          </select>
        </label>
        <label>
          Alcance del impacto
          <select
            aria-label="Alcance del impacto"
            value={draft.audience}
            onChange={(e) =>
              setDraft({
                ...draft,
                audience: e.target.value as ImpactReportInput["audience"],
              })
            }
          >
            {IMPACT_AUDIENCES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Inicio del período
          <input
            type="date"
            required={draft.periodStatus === "Confirmado"}
            value={draft.periodStart ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, periodStart: e.target.value || null })
            }
          />
        </label>
        <label>
          Fin del período
          <input
            type="date"
            required={draft.periodStatus === "Confirmado"}
            value={draft.periodEnd ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, periodEnd: e.target.value || null })
            }
          />
        </label>
      </div>
      <label>
        Observaciones del período
        <textarea
          aria-label="Observaciones del período"
          rows={3}
          maxLength={4000}
          value={draft.periodNotes}
          onChange={(e) => setDraft({ ...draft, periodNotes: e.target.value })}
        />
      </label>
      <div className="form-section-title">Impacto consolidado por línea</div>
      {draft.lines.map((line, index) => (
        <fieldset className="impact-line-editor" key={line.id}>
          <legend>Línea {index + 1}</legend>
          <label>
            Nombre de la línea
            <input
              required
              maxLength={200}
              value={line.name}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  lines: draft.lines.map((l, i) =>
                    i === index ? { ...l, name: e.target.value } : l,
                  ),
                })
              }
            />
          </label>
          <div className="field-grid">
            <label>
              Personas reportadas
              <input
                type="number"
                min="0"
                max="100000000"
                step="1"
                required
                value={line.people}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    lines: draft.lines.map((l, i) =>
                      i === index
                        ? { ...l, people: Number(e.target.value) }
                        : l,
                    ),
                  })
                }
              />
            </label>
            <label>
              Página del impacto
              <input
                type="number"
                min="1"
                step="1"
                value={line.sourcePage ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    lines: draft.lines.map((l, i) =>
                      i === index
                        ? {
                            ...l,
                            sourcePage: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : l,
                    ),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="text-link"
            disabled={draft.lines.length === 1}
            onClick={() =>
              setDraft({
                ...draft,
                lines: draft.lines.filter((_, i) => i !== index),
              })
            }
          >
            Quitar línea {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={draft.lines.length >= 30}
        onClick={() =>
          setDraft({
            ...draft,
            lines: [
              ...draft.lines,
              {
                id: crypto.randomUUID(),
                name: "",
                people: 0,
                sourcePage: null,
              },
            ],
          })
        }
      >
        Añadir línea
      </button>
      <p className="form-help">
        Total del informe: {number(reportTotal(draft))} personas reportadas.
        Este total se conserva separado de las cifras de jornadas y de otros
        informes que podrían incluir la misma población.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy
          ? "Guardando…"
          : bundle
            ? "Guardar informe e importar entregas"
            : "Guardar informe"}
      </button>
    </form>
  );
}

export function DeliveryForm({
  report,
  delivery,
  activities,
  onSaved,
}: {
  report: ImpactReport;
  delivery?: Delivery;
  activities: Activity[];
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DeliveryInput>(
    () =>
      delivery ?? {
        reportId: report.id,
        lineId: report.lines[0].id,
        actNumber: "",
        title: "",
        sourceDateText: "",
        dates: [],
        municipalities: [],
        otherDestinations: "",
        sourcePages: "",
        notes: "",
        reviewStatus: "Pendiente",
        activityIds: [],
        items: [],
      },
  );
  const [date, setDate] = useState(""),
    [municipalitySearch, setMunicipalitySearch] = useState(""),
    [activitySearch, setActivitySearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const options = activities.filter(
    (a) =>
      recordTypeOf(a) !== "Noticia" &&
      (!activitySearch ||
        normalize(
          a.title + " " + activityMunicipalities(a).join(" ") + " " + a.id,
        ).includes(normalize(activitySearch)) ||
        draft.activityIds.includes(a.id)),
  );
  const visibleOptions = options.slice(0, 100);
  for (const selectedActivity of activities.filter((a) =>
    draft.activityIds.includes(a.id),
  )) {
    if (!visibleOptions.some((a) => a.id === selectedActivity.id))
      visibleOptions.unshift(selectedActivity);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const input = validateDelivery({
        ...draft,
        dates: [...draft.dates, ...(date ? [date] : [])],
      });
      await api("/api/entregas", {
        method: delivery ? "PUT" : "POST",
        body: JSON.stringify({
          ...input,
          ...(delivery ? { id: delivery.id } : {}),
        }),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label>
        Nombre de la entrega
        <input
          required
          maxLength={300}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <div className="field-grid">
        <label>
          Número de acta (opcional)
          <input
            maxLength={80}
            value={draft.actNumber}
            onChange={(e) => setDraft({ ...draft, actNumber: e.target.value })}
          />
        </label>
        <label>
          Línea del informe
          <select
            aria-label="Línea del informe"
            value={draft.lineId}
            onChange={(e) => setDraft({ ...draft, lineId: e.target.value })}
          >
            {report.lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="form-help">
        La referencia de acta es opcional. No se solicita ningún archivo de
        acta.
      </p>
      <label>
        Fecha literal del documento
        <textarea
          aria-label="Fecha literal del documento"
          maxLength={1000}
          rows={2}
          value={draft.sourceDateText}
          onChange={(e) =>
            setDraft({ ...draft, sourceDateText: e.target.value })
          }
        />
      </label>
      <label>
        Añadir fecha confirmada
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="button secondary"
        disabled={!date}
        onClick={() => {
          setDraft({
            ...draft,
            dates: [...new Set([...draft.dates, date])].sort(),
          });
          setDate("");
        }}
      >
        Añadir fecha
      </button>
      <div className="delivery-tags">
        {draft.dates.map((d) => (
          <button
            key={d}
            type="button"
            className="program-tag"
            aria-label={"Quitar fecha " + d}
            onClick={() =>
              setDraft({ ...draft, dates: draft.dates.filter((v) => v !== d) })
            }
          >
            {d} ×
          </button>
        ))}
      </div>
      <fieldset className="delivery-destinations">
        <legend>Municipios de destino ({draft.municipalities.length})</legend>
        <input
          aria-label="Buscar municipio de destino"
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
                checked={draft.municipalities.includes(m)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    municipalities: e.target.checked
                      ? [...draft.municipalities, m]
                      : draft.municipalities.filter((v) => v !== m),
                  })
                }
              />
              {m}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Otros destinos o lugares por confirmar
        <textarea
          aria-label="Otros destinos o lugares por confirmar"
          rows={2}
          maxLength={1000}
          placeholder="Localidades, destinos fuera de Nariño o lugar pendiente de verificar"
          value={draft.otherDestinations}
          onChange={(e) =>
            setDraft({ ...draft, otherDestinations: e.target.value })
          }
        />
      </label>
      <div className="form-section-title">Productos entregados</div>
      {draft.items.map((item, index) => (
        <fieldset className="delivery-item" key={index}>
          <legend>Producto {index + 1}</legend>
          <label>
            Producto
            <input
              required
              maxLength={200}
              value={item.product}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  items: draft.items.map((p, i) =>
                    i === index ? { ...p, product: e.target.value } : p,
                  ),
                })
              }
            />
          </label>
          <div className="field-grid">
            <label>
              Cantidad
              <input
                required
                type="number"
                min="0.001"
                max="100000000"
                step="any"
                value={item.quantity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    items: draft.items.map((p, i) =>
                      i === index
                        ? { ...p, quantity: Number(e.target.value) }
                        : p,
                    ),
                  })
                }
              />
            </label>
            <label>
              Unidad
              <input
                required
                maxLength={80}
                placeholder="Bultos, cajas, unidades, kilos…"
                value={item.unit}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    items: draft.items.map((p, i) =>
                      i === index ? { ...p, unit: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() =>
              setDraft({
                ...draft,
                items: draft.items.filter((_, i) => i !== index),
              })
            }
          >
            Quitar producto {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={draft.items.length >= 100}
        onClick={() =>
          setDraft({
            ...draft,
            items: [...draft.items, { product: "", quantity: 1, unit: "" }],
          })
        }
      >
        Añadir producto
      </button>
      <label>
        Buscar jornada existente
        <input
          value={activitySearch}
          onChange={(e) => setActivitySearch(e.target.value)}
          placeholder="Título, municipio o número de registro"
        />
      </label>
      <fieldset className="delivery-activities">
        <legend>Jornadas vinculadas ({draft.activityIds.length})</legend>
        <p className="form-help">
          Selecciona todas las jornadas que respalda esta acta.
        </p>
        <div>
          {visibleOptions.map((a) => (
            <label key={a.id}>
              <input
                type="checkbox"
                aria-label={"Vincular jornada " + a.id}
                checked={draft.activityIds.includes(a.id)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    activityIds: e.target.checked
                      ? [...draft.activityIds, a.id]
                      : draft.activityIds.filter((id) => id !== a.id),
                  })
                }
              />
              <span>
                #{a.id} · {a.title} · {activityMunicipalities(a).join(", ")} ·{" "}
                {a.program}
              </span>
            </label>
          ))}
        </div>
        {!visibleOptions.length && (
          <p className="form-help">
            No hay jornadas para esta búsqueda. Puedes dejar el acta pendiente
            de vincular.
          </p>
        )}
      </fieldset>
      <p className="form-help">
        Vincula las jornadas existentes para conservar cada evento una sola vez,
        aunque haya varias entregas o componentes participantes. Las fechas y
        destinos de la entrega no cambian los datos de la jornada.
      </p>
      <label>
        Páginas de soporte
        <input
          maxLength={100}
          value={draft.sourcePages}
          onChange={(e) => setDraft({ ...draft, sourcePages: e.target.value })}
        />
      </label>
      <label>
        Observaciones de revisión
        <textarea
          aria-label="Observaciones de revisión"
          rows={3}
          maxLength={8000}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <label>
        Estado de revisión
        <select
          aria-label="Estado de revisión"
          value={draft.reviewStatus}
          onChange={(e) =>
            setDraft({
              ...draft,
              reviewStatus: e.target.value as DeliveryInput["reviewStatus"],
            })
          }
        >
          <option>Pendiente</option>
          <option>Revisada</option>
        </select>
      </label>
      <p className="form-help">
        Las cantidades de productos no se convierten en personas beneficiadas.
        El impacto de la línea permanece consolidado.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Guardando…" : "Guardar entrega"}
      </button>
    </form>
  );
}

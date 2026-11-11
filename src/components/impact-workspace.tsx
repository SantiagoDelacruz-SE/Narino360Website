"use client";
import { useEffect, useState } from "react";
import {
  normalize,
  type Activity,
  type Asset,
  type Component,
} from "@/lib/domain";
import {
  reportTotal,
  validateImpactImport,
  type Delivery,
  type ImpactImport,
  type ImpactReport,
} from "@/lib/impact-domain";
import { api, csvDownload, number } from "./api";
import Modal from "./modal";
import { DeliveryForm, ReportForm } from "./impact-forms";

type FormState =
  | { kind: "report"; report?: ImpactReport }
  | { kind: "import"; bundle: ImpactImport }
  | { kind: "delivery"; delivery?: Delivery }
  | null;
export default function ImpactWorkspace({
  component,
  activities,
  assets,
  canEdit,
  isAdmin,
  onPreview,
  onOpen,
  onRefresh,
}: {
  component: Component;
  activities: Activity[];
  assets: Asset[];
  canEdit: boolean;
  isAdmin: boolean;
  onPreview: (asset: Asset) => void;
  onOpen: (activity: Activity) => void;
  onRefresh: () => Promise<void>;
}) {
  const [reports, setReports] = useState<ImpactReport[]>([]),
    [deliveries, setDeliveries] = useState<Delivery[] | null>(null),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [form, setForm] = useState<FormState>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [line, setLine] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ reports: ImpactReport[] }>("/api/impactos", {
      signal: controller.signal,
    })
      .then((r) => {
        setReports(r.reports.filter((v) => v.component === component));
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [component, revision]);
  useEffect(() => {
    if (selectedId === null) return;
    const controller = new AbortController();
    api<{ deliveries: Delivery[] }>("/api/entregas?reportId=" + selectedId, {
      signal: controller.signal,
    })
      .then((r) => setDeliveries(r.deliveries))
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => controller.abort();
  }, [selectedId, revision]);
  const report = reports.find((r) => r.id === selectedId);
  const support = assets.find((a) => a.id === report?.sourceAssetId);
  const visible = (deliveries ?? []).filter(
    (d) =>
      (!line || d.lineId === line) &&
      (!status || d.reviewStatus === status) &&
      (!search ||
        normalize(
          d.title +
            " " +
            d.actNumber +
            " " +
            d.municipalities.join(" ") +
            " " +
            d.otherDestinations,
        ).includes(normalize(search))),
  );
  async function refresh(id = selectedId) {
    setSelectedId(id);
    setDeliveries(null);
    setRevision((v) => v + 1);
    await onRefresh();
  }
  async function saved(id = selectedId) {
    setForm(null);
    setError("");
    await refresh(id);
  }
  async function readImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1500000)
        throw new Error("El informe JSON debe pesar menos de 1,5 MB.");
      const bundle = validateImpactImport(JSON.parse(await file.text()));
      if (bundle.report.component !== component)
        throw new Error(
          "Abre el componente " +
            bundle.report.component +
            " para importar este informe.",
        );
      if (reports.some((r) => r.sourceKey === bundle.report.sourceKey))
        throw new Error(
          "Este informe ya está registrado. Abre el existente para revisarlo.",
        );
      setError("");
      setForm({
        kind: "import",
        bundle: {
          ...bundle,
          report: { ...bundle.report, sourceAssetId: null },
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(kind: "report" | "delivery", id: number) {
    if (
      !window.confirm(
        kind === "report"
          ? "¿Eliminar este informe y todas sus entregas? Las jornadas vinculadas se conservarán."
          : "¿Eliminar esta entrega? Las jornadas vinculadas se conservarán.",
      )
    )
      return;
    try {
      await api(kind === "report" ? "/api/impactos" : "/api/entregas", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await refresh(kind === "report" ? null : selectedId);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="impact-workspace">
      <div className="section-heading">
        <div>
          <h3>Entregas e impactos consolidados</h3>
          <p>
            Vincula las entregas a jornadas existentes y conserva el impacto por
            línea, sin duplicar eventos ni repartir cifras.
          </p>
        </div>
        {canEdit && (
          <div className="impact-actions">
            <button
              className="button primary"
              onClick={() => setForm({ kind: "report" })}
            >
              Nuevo informe
            </button>
            <label className="button secondary impact-import-label">
              Importar informe JSON
              <input
                aria-label="Importar informe JSON"
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  void readImport(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <a
              className="text-link"
              href="/plantilla-informe-impacto.json"
              download
            >
              Descargar estructura vacía
            </a>
          </div>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}{" "}
          <button
            className="text-link"
            onClick={() => {
              setError("");
              setLoading(true);
              setRevision((r) => r + 1);
            }}
          >
            Reintentar consulta
          </button>
        </div>
      )}
      {loading && <p role="status">Consultando informes…</p>}
      {!report && !loading && (
        <div className="impact-report-grid">
          {reports.map((r) => (
            <article className="panel impact-report-card" key={r.id}>
              <span
                className={
                  "impact-status " +
                  (r.periodStatus === "Pendiente" ? "pending" : "")
                }
              >
                {r.periodStatus === "Pendiente"
                  ? "Período pendiente de aclarar"
                  : "Período confirmado"}
              </span>
              <h3>{r.title}</h3>
              <strong className="impact-value">{number(reportTotal(r))}</strong>
              <p>Personas reportadas · {r.audience.toLowerCase()}</p>
              <p>
                {r.lines.length} líneas · {r.deliveryCount} referencias de
                entregas
              </p>
              <button
                className="button secondary"
                aria-label={"Abrir informe " + r.title}
                onClick={() => {
                  setSelectedId(r.id);
                  setDeliveries(null);
                  setLine("");
                  setSearch("");
                  setStatus("");
                }}
              >
                Abrir informe
              </button>
            </article>
          ))}
          {!reports.length && (
            <div className="empty-state">
              <h3>Aún no hay informes consolidados</h3>
              <p>
                Crea un informe o importa las líneas de impacto y referencias de
                entregas. Las jornadas existentes permanecen como registros
                individuales.
              </p>
            </div>
          )}
        </div>
      )}
      {report && (
        <div className="impact-report-detail">
          <button
            className="text-link"
            onClick={() => {
              setSelectedId(null);
              setDeliveries(null);
            }}
          >
            ← Todos los informes
          </button>
          <div className="section-heading">
            <div>
              <h3>{report.title}</h3>
              <p>
                {report.sourceTitle}
                {report.sourceReference ? " · " + report.sourceReference : ""}
              </p>
            </div>
            <div className="impact-actions">
              {support && (
                <button
                  className="button secondary"
                  onClick={() => onPreview(support)}
                >
                  Previsualizar soporte PDF
                </button>
              )}
              {canEdit && (
                <button
                  className="button secondary"
                  onClick={() => setForm({ kind: "report", report })}
                >
                  Editar informe
                </button>
              )}
              {isAdmin && (
                <button
                  className="button ghost"
                  onClick={() => void remove("report", report.id)}
                >
                  Eliminar informe
                </button>
              )}
            </div>
          </div>
          <div className="notice impact-scope">
            <strong>
              {number(reportTotal(report))} personas de impacto reportado ·{" "}
              {report.audience.toLowerCase()}
            </strong>
            <p>
              {report.periodStatus === "Pendiente"
                ? "Período pendiente de aclarar"
                : report.periodStart + " — " + report.periodEnd}
              . {report.periodNotes}
            </p>
            <p>
              Este total no se suma a los beneficiarios de jornadas ni a otros
              informes. No acredita personas únicas y no se distribuye por
              entrega, municipio o mes.
            </p>
            {!support && (
              <p>
                PDF aún no vinculado. Puedes adjuntarlo desde Editar informe.
              </p>
            )}
          </div>
          <div className="table-wrap">
            <table className="impact-line-table">
              <thead>
                <tr>
                  <th>Línea del informe</th>
                  <th>Impacto reportado</th>
                  <th>Entregas registradas</th>
                  <th>Página del impacto</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{number(l.people)} personas</td>
                    <td>
                      {deliveries
                        ? deliveries.filter((d) => d.lineId === l.id).length
                        : "…"}
                    </td>
                    <td>{l.sourcePage ?? "Sin referencia"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-heading">
            <div>
              <h3>Entregas</h3>
              <p>
                {deliveries
                  ? visible.length +
                    " de " +
                    deliveries.length +
                    " entregas · " +
                    new Set(deliveries.flatMap((d) => d.activityIds)).size +
                    " jornadas vinculadas"
                  : "Consultando entregas…"}
              </p>
            </div>
            <div className="impact-actions">
              {canEdit && (
                <button
                  className="button primary"
                  onClick={() => setForm({ kind: "delivery" })}
                >
                  Nueva entrega
                </button>
              )}
              <button
                className="button secondary"
                disabled={!visible.length}
                onClick={() =>
                  csvDownload(
                    visible.map((d) => ({
                      Acta: d.actNumber,
                      Entrega: d.title,
                      Linea: report.lines.find((l) => l.id === d.lineId)?.name,
                      Fechas_confirmadas: d.dates.join("; "),
                      Fecha_literal: d.sourceDateText,
                      Municipios: d.municipalities.join("; "),
                      Otros_destinos: d.otherDestinations,
                      Jornadas: d.activityIds.join("; "),
                      Estado: d.reviewStatus,
                      Paginas: d.sourcePages,
                      Productos: d.items
                        .map(
                          (p) => p.product + ": " + p.quantity + " " + p.unit,
                        )
                        .join("; "),
                      Observaciones: d.notes,
                    })),
                    "entregas-informe-" + report.id + ".csv",
                  )
                }
              >
                Exportar entregas CSV
              </button>
            </div>
          </div>
          <div className="impact-filters">
            <label>
              Buscar entrega
              <input
                placeholder="Acta, título o destino"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Filtrar línea
              <select
                aria-label="Filtrar línea"
                value={line}
                onChange={(e) => setLine(e.target.value)}
              >
                <option value="">Todas las líneas</option>
                {report.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtrar revisión
              <select
                aria-label="Filtrar revisión"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option>Pendiente</option>
                <option>Revisada</option>
              </select>
            </label>
          </div>
          <div className="delivery-list">
            {visible.map((d) => {
              const linkedActivities = activities.filter((a) =>
                d.activityIds.includes(a.id),
              );
              return (
                <article
                  key={d.id}
                  className="panel delivery-card"
                  data-delivery-id={d.id}
                >
                  <div className="delivery-card-heading">
                    <span
                      className={
                        "impact-status " +
                        (d.reviewStatus === "Pendiente" ? "pending" : "")
                      }
                    >
                      {d.actNumber
                        ? "Acta " + d.actNumber
                        : "Sin referencia de acta"}{" "}
                      · {d.reviewStatus}
                    </span>
                    <span>
                      {report.lines.find((l) => l.id === d.lineId)?.name}
                    </span>
                  </div>
                  <h4>{d.title}</h4>
                  <dl>
                    <div>
                      <dt>Fechas confirmadas</dt>
                      <dd>{d.dates.join(", ") || "Pendientes de confirmar"}</dd>
                    </div>
                    <div>
                      <dt>Fecha en el documento</dt>
                      <dd>{d.sourceDateText || "Sin referencia"}</dd>
                    </div>
                    <div>
                      <dt>Destinos</dt>
                      <dd>
                        {[...d.municipalities, d.otherDestinations]
                          .filter(Boolean)
                          .join(" · ") || "Pendientes de confirmar"}
                      </dd>
                    </div>
                    <div>
                      <dt>Beneficiarios de esta entrega</dt>
                      <dd>Sin desagregar · impacto disponible por línea</dd>
                    </div>
                  </dl>
                  {d.items.length ? (
                    <ul className="delivery-products">
                      {d.items.map((p, i) => (
                        <li key={i}>
                          {p.product}: {number(p.quantity)} {p.unit}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="form-help">
                      Productos pendientes de transcribir o validar contra el
                      acta.
                    </p>
                  )}
                  {d.notes && <p className="delivery-notes">{d.notes}</p>}
                  <p className="form-help">
                    Páginas de soporte: {d.sourcePages || "Sin referencia"}
                  </p>
                  <div className="impact-actions">
                    {linkedActivities.length ? (
                      linkedActivities.map((activity) => (
                        <button
                          key={activity.id}
                          className="text-link"
                          onClick={() => onOpen(activity)}
                        >
                          Ver jornada vinculada #{activity.id}: {activity.title}
                        </button>
                      ))
                    ) : (
                      <span className="form-help">Sin jornadas vinculadas</span>
                    )}
                    {canEdit && (
                      <button
                        className="button secondary"
                        aria-label={
                          "Editar entrega " + (d.actNumber || d.title)
                        }
                        onClick={() =>
                          setForm({ kind: "delivery", delivery: d })
                        }
                      >
                        Editar entrega
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="button ghost"
                        aria-label={
                          "Eliminar entrega " + (d.actNumber || d.title)
                        }
                        onClick={() => void remove("delivery", d.id)}
                      >
                        Eliminar entrega
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {deliveries && !visible.length && (
            <p className="empty-state">No hay entregas para esta selección.</p>
          )}
        </div>
      )}
      {form && (
        <Modal
          title={
            form.kind === "delivery"
              ? form.delivery
                ? "Editar entrega"
                : "Nueva entrega"
              : form.kind === "import"
                ? "Revisar importación del informe"
                : form.report
                  ? "Editar informe"
                  : "Nuevo informe"
          }
          wide
          onClose={() => setForm(null)}
        >
          {form.kind === "delivery" && report ? (
            <DeliveryForm
              report={report}
              delivery={form.delivery}
              activities={activities}
              onSaved={() => saved()}
            />
          ) : form.kind !== "delivery" ? (
            <ReportForm
              component={component}
              report={form.kind === "report" ? form.report : undefined}
              bundle={form.kind === "import" ? form.bundle : undefined}
              assets={assets}
              onSaved={saved}
            />
          ) : null}
        </Modal>
      )}
    </div>
  );
}

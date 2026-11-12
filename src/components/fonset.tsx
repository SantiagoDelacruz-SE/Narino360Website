"use client";
import { useEffect, useId, useState } from "react";
import { Building2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { canEditContent, normalize, type Identity } from "@/lib/domain";
import {
  fonsetCostInput,
  formatFonsetCost,
  validateFonsetProject,
  type FonsetProject,
} from "@/lib/fonset-domain";
import { api, csvDownload, number } from "./api";
import Modal from "./modal";

type ProjectModal =
  | { kind: "create" }
  | { kind: "edit" | "detail" | "delete"; project: FonsetProject }
  | null;
export default function Fonset({ user }: { user: Identity }) {
  const [projects, setProjects] = useState<FonsetProject[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [modal, setModal] = useState<ProjectModal>(null),
    [deleting, setDeleting] = useState(false);
  const canEdit = canEditContent(user.role);
  useEffect(() => {
    const controller = new AbortController();
    api<{ projects: FonsetProject[] }>("/api/fonset", {
      signal: controller.signal,
    })
      .then((r) => {
        setProjects(r.projects);
        setLoading(false);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [revision]);
  const states = [
    ...new Map(projects.map((p) => [normalize(p.status), p.status])).values(),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const visible = projects.filter(
    (p) =>
      (!status || normalize(p.status) === normalize(status)) &&
      (!search ||
        normalize(p.name + " " + p.objective + " " + p.status).includes(
          normalize(search),
        )),
  );
  const total = visible.reduce(
    (sum, p) => sum + BigInt(p.costCents),
    BigInt(0),
  );
  const unavailable = loading || Boolean(error && !projects.length);
  function refreshed() {
    setModal(null);
    setSearch("");
    setStatus("");
    setLoading(true);
    setRevision((v) => v + 1);
  }
  async function remove(project: FonsetProject) {
    setDeleting(true);
    setError("");
    try {
      await api("/api/fonset", {
        method: "DELETE",
        body: JSON.stringify({ id: project.id }),
      });
      refreshed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className="fonset-workspace" aria-label="Proyectos FONSET">
      <div className="section-heading">
        <div>
          <span className="overline">
            FONDO TERRITORIAL DE SEGURIDAD Y CONVIVENCIA CIUDADANA
          </span>
          <h2>Proyectos FONSET</h2>
          <p>
            Consulta el objetivo, el costo y el estado actual de cada proyecto.
          </p>
        </div>
        <div className="fonset-actions">
          <button
            className="button secondary"
            disabled={!visible.length}
            onClick={() =>
              csvDownload(
                visible.map((p) => ({
                  Nombre: p.name,
                  Objetivo: p.objective,
                  Costo_COP: fonsetCostInput(p.costCents),
                  Estado: p.status,
                })),
                "proyectos-fonset.csv",
              )
            }
          >
            Exportar proyectos CSV
          </button>
          {canEdit && (
            <button
              className="button primary"
              onClick={() => {
                setError("");
                setModal({ kind: "create" });
              }}
            >
              <Plus size={16} />
              Nuevo proyecto
            </button>
          )}
        </div>
      </div>
      <div className="fonset-summary">
        <article>
          <span>Proyectos en la consulta</span>
          <strong data-fonset-stat="count">
            {unavailable ? "…" : number(visible.length)}
          </strong>
        </article>
        <article>
          <span>Costo total registrado</span>
          <strong data-fonset-stat="cost">
            {unavailable ? "…" : formatFonsetCost(total)}
          </strong>
          <small>Pesos colombianos · proyectos de esta consulta</small>
        </article>
        <article>
          <span>Estados en la consulta</span>
          <strong data-fonset-stat="states">
            {unavailable
              ? "…"
              : number(new Set(visible.map((p) => normalize(p.status))).size)}
          </strong>
        </article>
      </div>
      <div className="fonset-filters">
        <label>
          Buscar proyecto
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, objetivo o estado"
          />
        </label>
        <label>
          Filtrar proyectos por estado
          <select
            aria-label="Filtrar proyectos por estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {(search || status) && (
          <button
            className="button secondary"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
          <button
            className="text-link"
            onClick={() => {
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            Reintentar consulta
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Consultando proyectos FONSET…</p>
      ) : error && !projects.length ? null : (
        <>
          <p className="fonset-result-count" role="status">
            {visible.length} de {projects.length} proyectos registrados
          </p>
          <div className="fonset-project-grid">
            {visible.map((project) => (
              <article
                className="panel fonset-project-card"
                key={project.id}
                data-project-id={project.id}
              >
                <div className="fonset-project-heading">
                  <span className="fonset-project-icon">
                    <Building2 size={22} />
                  </span>
                  <span className="fonset-status">{project.status}</span>
                </div>
                <h3>{project.name}</h3>
                <span className="fonset-label">Costo del proyecto · COP</span>
                <strong className="fonset-cost">
                  {formatFonsetCost(project.costCents)}
                </strong>
                <h4>Objetivo</h4>
                <p className="fonset-objective">
                  {project.objective.length > 240
                    ? project.objective.slice(0, 240) + "…"
                    : project.objective}
                </p>
                <div className="fonset-project-actions">
                  <button
                    className="text-link"
                    aria-label={"Ver proyecto " + project.name}
                    onClick={() => setModal({ kind: "detail", project })}
                  >
                    <Eye size={15} />
                    Ver proyecto
                  </button>
                  {canEdit && (
                    <button
                      className="button secondary"
                      aria-label={"Editar proyecto " + project.name}
                      onClick={() => {
                        setError("");
                        setModal({ kind: "edit", project });
                      }}
                    >
                      <Pencil size={15} />
                      Editar
                    </button>
                  )}
                  {user.role === "Administrador" && (
                    <button
                      className="icon-button"
                      aria-label={"Eliminar proyecto " + project.name}
                      onClick={() => {
                        setError("");
                        setModal({ kind: "delete", project });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="panel empty-state">
              <Building2 size={32} />
              <h3>
                {projects.length
                  ? "No hay proyectos para estos filtros"
                  : "Aún no hay proyectos FONSET registrados"}
              </h3>
              <p>
                {projects.length
                  ? "Cambia el nombre o el estado para consultar otros proyectos."
                  : "Los proyectos aparecerán aquí cuando se registren con su nombre, objetivo, costo y estado."}
              </p>
            </div>
          )}
        </>
      )}
      {modal && (
        <Modal
          title={
            modal.kind === "create"
              ? "Nuevo proyecto FONSET"
              : modal.kind === "edit"
                ? "Editar proyecto FONSET"
                : modal.kind === "delete"
                  ? "Eliminar proyecto FONSET"
                  : "Detalle del proyecto FONSET"
          }
          onClose={() => {
            if (!deleting) setModal(null);
          }}
          wide
        >
          {modal.kind === "create" || modal.kind === "edit" ? (
            <ProjectForm
              project={modal.kind === "edit" ? modal.project : undefined}
              states={states}
              onSaved={refreshed}
            />
          ) : modal.kind === "detail" ? (
            <div className="fonset-detail">
              <span className="fonset-status">{modal.project.status}</span>
              <h3>{modal.project.name}</h3>
              <span className="fonset-label">Costo del proyecto · COP</span>
              <strong className="fonset-cost">
                {formatFonsetCost(modal.project.costCents)}
              </strong>
              <h4>Objetivo</h4>
              <p>{modal.project.objective}</p>
            </div>
          ) : (
            <div className="form-stack">
              <p>
                Se eliminará del registro el proyecto{" "}
                <strong>{modal.project.name}</strong>.
              </p>
              <p>
                Costo: {formatFonsetCost(modal.project.costCents)} · Estado:{" "}
                {modal.project.status}
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="fonset-actions">
                <button
                  className="button secondary"
                  disabled={deleting}
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button primary"
                  disabled={deleting}
                  onClick={() => void remove(modal.project)}
                >
                  {deleting ? "Eliminando…" : "Eliminar proyecto"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

function ProjectForm({
  project,
  states,
  onSaved,
}: {
  project?: FonsetProject;
  states: string[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(project?.name ?? ""),
    [objective, setObjective] = useState(project?.objective ?? ""),
    [cost, setCost] = useState(
      project ? fonsetCostInput(project.costCents) : "",
    ),
    [status, setStatus] = useState(project?.status ?? "");
  const [submissionId] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const statesId = useId();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      validateFonsetProject({ name, objective, cost, status });
      await api("/api/fonset", {
        method: project ? "PUT" : "POST",
        body: JSON.stringify({
          name,
          objective,
          cost,
          status,
          ...(project ? { id: project.id } : { submissionId }),
        }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <label>
        Nombre del proyecto
        <input
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Objetivo del proyecto
        <textarea
          aria-label="Objetivo del proyecto"
          required
          maxLength={8000}
          rows={5}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </label>
      <div className="field-grid">
        <label>
          Costo del proyecto (COP)
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={cost}
            placeholder="Ej. 125000000.50"
            onChange={(e) => setCost(e.target.value)}
          />
        </label>
        <label>
          Estado del proyecto
          <input
            aria-label="Estado del proyecto"
            required
            maxLength={100}
            list={statesId}
            value={status}
            placeholder="Escribe el estado actual"
            onChange={(e) => setStatus(e.target.value)}
          />
          <datalist id={statesId}>
            {states.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>
      <p className="form-help">
        Costo en pesos colombianos, sin separadores de miles y con hasta dos
        decimales. El estado es libre: puedes usar los nombres que maneja tu
        equipo.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Guardando…" : "Guardar proyecto"}
      </button>
    </form>
  );
}

import { randomUUID } from "node:crypto";
import { audit, db } from "./db";
import { AppError } from "./domain";
import type { FonsetInput, FonsetProject } from "./fonset-domain";
type ProjectRow = {
  id: number;
  name: string;
  objective: string;
  cost_cents: number;
  status: string;
  author: string;
  created_at: string;
  updated_at: string;
};
function project(row: ProjectRow): FonsetProject {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    costCents: row.cost_cents,
    status: row.status,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function transaction<T>(work: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const value = work();
    database.exec("COMMIT");
    return value;
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }
}
export function listFonsetProjects(): FonsetProject[] {
  return (
    db()
      .prepare("SELECT * FROM fonset_proyectos ORDER BY id DESC")
      .all() as ProjectRow[]
  ).map(project);
}
function existingProject(id: number): FonsetProject {
  const row = db()
    .prepare("SELECT * FROM fonset_proyectos WHERE id=?")
    .get(id) as ProjectRow | undefined;
  if (!row) throw new AppError("Proyecto FONSET no encontrado.", 404);
  return project(row);
}
const financialDetail = (p: FonsetInput) => ({
  name: p.name,
  costCents: p.costCents,
  status: p.status,
});
export function createFonsetProject(
  input: FonsetInput,
  actor: string,
  role: string,
  submissionId?: string,
) {
  return transaction(() => {
    const key = submissionId ?? randomUUID();
    const previous = db()
      .prepare("SELECT * FROM fonset_proyectos WHERE submission_key=?")
      .get(key) as ProjectRow | undefined;
    if (previous) {
      if (
        previous.name !== input.name ||
        previous.objective !== input.objective ||
        previous.cost_cents !== input.costCents ||
        previous.status !== input.status
      )
        throw new AppError(
          "Este envío ya corresponde a un proyecto guardado. Actualiza la lista antes de volver a enviarlo.",
          409,
        );
      return { project: project(previous), reused: true };
    }
    const id = Number(
      db()
        .prepare(
          "INSERT INTO fonset_proyectos(submission_key,name,objective,cost_cents,status,author) VALUES(?,?,?,?,?,?)",
        )
        .run(
          key,
          input.name,
          input.objective,
          input.costCents,
          input.status,
          actor,
        ).lastInsertRowid,
    );
    audit(
      actor,
      role,
      "fonset.proyecto_creado",
      JSON.stringify({ id, ...financialDetail(input) }),
    );
    return { project: existingProject(id), reused: false };
  });
}
export function updateFonsetProject(
  id: number,
  input: FonsetInput,
  actor: string,
  role: string,
) {
  return transaction(() => {
    const previous = existingProject(id);
    db()
      .prepare(
        "UPDATE fonset_proyectos SET name=?,objective=?,cost_cents=?,status=?,updated_at=datetime('now') WHERE id=?",
      )
      .run(input.name, input.objective, input.costCents, input.status, id);
    audit(
      actor,
      role,
      "fonset.proyecto_actualizado",
      JSON.stringify({
        id,
        before: financialDetail(previous),
        after: financialDetail(input),
        objectiveChanged: previous.objective !== input.objective,
      }),
    );
    return existingProject(id);
  });
}
export function deleteFonsetProject(id: number, actor: string, role: string) {
  transaction(() => {
    const previous = existingProject(id);
    db().prepare("DELETE FROM fonset_proyectos WHERE id=?").run(id);
    audit(
      actor,
      role,
      "fonset.proyecto_eliminado",
      JSON.stringify({ id, ...financialDetail(previous) }),
    );
  });
}

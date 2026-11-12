import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Activity, ActivityInput } from "./domain";
import { migrateUserRoles } from "./migrations";
import { ensureImpactSchema } from "./impact-schema";
import { ensureFonsetSchema } from "./fonset-schema";
export const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
let connection: DatabaseSync | undefined;
export function db() {
  if (connection) return connection;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const opened = new DatabaseSync(path.join(dataDir, "observatorio.sqlite"));
  try {
    opened.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS usuarios(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Administrador','Editor','Consulta')), active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS registro_invitados(id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, apellido TEXT NOT NULL, entidad TEXT NOT NULL, cargo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
 CREATE TABLE IF NOT EXISTS sesiones(token_hash TEXT PRIMARY KEY, user_id INTEGER REFERENCES usuarios(id), guest_id INTEGER REFERENCES registro_invitados(id), expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS registro_accesos_usuarios(id INTEGER PRIMARY KEY, actor TEXT NOT NULL, role TEXT NOT NULL, event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
 CREATE TABLE IF NOT EXISTS intentos_login(username TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS jornadas(id INTEGER PRIMARY KEY, payload TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
 `);
    migrateUserRoles(opened);
    ensureImpactSchema(opened);
    ensureFonsetSchema(opened);
    connection = opened;
    return connection;
  } catch (error) {
    opened.close();
    throw error;
  }
}
export function audit(actor: string, role: string, event: string, detail = "") {
  db()
    .prepare(
      "INSERT INTO registro_accesos_usuarios(actor,role,event,detail) VALUES(?,?,?,?)",
    )
    .run(actor, role, event, detail);
}
export function listActivities(): Activity[] {
  const rows = db()
    .prepare(
      "SELECT * FROM jornadas ORDER BY json_extract(payload,'$.date') DESC, id DESC",
    )
    .all() as {
    id: number;
    payload: string;
    author: string;
    created_at: string;
    updated_at: string;
  }[];
  return rows.map((r) => ({
    ...JSON.parse(r.payload),
    id: r.id,
    author: r.author,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
export function saveActivities(
  items: ActivityInput[],
  actor: string,
  role: string,
  id?: number,
) {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    if (id !== undefined) {
      const result = d
        .prepare(
          "UPDATE jornadas SET payload=?, updated_at=datetime('now') WHERE id=?",
        )
        .run(JSON.stringify(items[0]), id);
      if (!result.changes) throw new Error("Jornada no encontrada.");
    } else
      for (const a of items)
        d.prepare("INSERT INTO jornadas(payload,author) VALUES(?,?)").run(
          JSON.stringify(a),
          actor,
        );
    audit(
      actor,
      role,
      id ? "jornada.editada" : "jornadas.creadas",
      id ? String(id) : String(items.length),
    );
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

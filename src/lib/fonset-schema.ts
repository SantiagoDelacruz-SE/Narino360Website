import type { DatabaseSync } from "node:sqlite";
export function ensureFonsetSchema(database: DatabaseSync) {
  database.exec(`CREATE TABLE IF NOT EXISTS fonset_proyectos (
    id INTEGER PRIMARY KEY,
    submission_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    objective TEXT NOT NULL,
    cost_cents INTEGER NOT NULL CHECK(cost_cents >= 0),
    status TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
}

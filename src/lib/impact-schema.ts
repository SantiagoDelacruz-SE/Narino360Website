import type { DatabaseSync } from "node:sqlite";
export function ensureImpactSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS impactos_informes (
      id INTEGER PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
      author TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS donacion_entregas (
      id INTEGER PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES impactos_informes(id) ON DELETE CASCADE,
      act_number TEXT NOT NULL, activity_id INTEGER REFERENCES jornadas(id) ON DELETE SET NULL,
      payload TEXT NOT NULL, author TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(report_id, act_number)
    );
    CREATE INDEX IF NOT EXISTS donacion_entregas_activity ON donacion_entregas(activity_id);
    CREATE TABLE IF NOT EXISTS donacion_entrega_jornadas (
      delivery_id INTEGER NOT NULL REFERENCES donacion_entregas(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
      PRIMARY KEY(delivery_id, activity_id)
    );
    INSERT OR IGNORE INTO donacion_entrega_jornadas(delivery_id,activity_id)
      SELECT id,activity_id FROM donacion_entregas WHERE activity_id IS NOT NULL;
    UPDATE donacion_entregas SET activity_id=NULL WHERE activity_id IS NOT NULL;
  `);
}

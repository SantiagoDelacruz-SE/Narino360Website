import type { DatabaseSync } from "node:sqlite";

// SQLite cannot extend a CHECK constraint in place. Rebuild only usuarios,
// preserving primary keys so existing sessions still refer to the same users.
export function migrateUserRoles(database: DatabaseSync) {
  const table = database
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE type='table' AND name='usuarios'",
    )
    .get() as { sql: string } | undefined;
  if (!table || table.sql.includes("'Consulta'")) return;
  const foreignKeys = database.prepare("PRAGMA foreign_keys").get() as {
    foreign_keys: number;
  };
  database.exec("PRAGMA foreign_keys=OFF");
  try {
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(`
        CREATE TABLE usuarios_with_consulta (
          id INTEGER PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('Administrador','Editor','Consulta')),
          active INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO usuarios_with_consulta(id,username,name,password_hash,role,active)
          SELECT id,username,name,password_hash,role,active FROM usuarios;
        DROP TABLE usuarios;
        ALTER TABLE usuarios_with_consulta RENAME TO usuarios;
      `);
      if (database.prepare("PRAGMA foreign_key_check").all().length)
        throw new Error(
          "No se pudo actualizar el esquema de roles: referencias no válidas.",
        );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    if (foreignKeys.foreign_keys) database.exec("PRAGMA foreign_keys=ON");
  }
}

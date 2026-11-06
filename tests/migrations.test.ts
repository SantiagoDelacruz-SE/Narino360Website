import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateUserRoles } from "../src/lib/migrations";

function legacyDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE usuarios(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Administrador','Editor')), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE sesiones(token_hash TEXT PRIMARY KEY, user_id INTEGER REFERENCES usuarios(id), guest_id INTEGER, expires_at INTEGER NOT NULL);
    CREATE TABLE jornadas(id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE registro_accesos_usuarios(id INTEGER PRIMARY KEY, actor TEXT NOT NULL);
    INSERT INTO usuarios VALUES(41,'admin','Administradora','hash-original','Administrador',1);
    INSERT INTO usuarios VALUES(73,'editor','Editor inactivo','otro-hash','Editor',0);
    INSERT INTO sesiones VALUES('sesion-anterior',41,NULL,9999999999999);
    INSERT INTO jornadas VALUES(8,'{"title":"Jornada existente"}');
    INSERT INTO registro_accesos_usuarios VALUES(4,'admin');
  `);
  return database;
}

test("La migración admite Consulta y conserva usuarios, hashes, sesiones y datos anteriores al repetirse", () => {
  const database = legacyDatabase();
  try {
    const before = database.prepare("SELECT * FROM usuarios ORDER BY id").all();
    migrateUserRoles(database);
    assert.deepEqual(
      database.prepare("SELECT * FROM usuarios ORDER BY id").all(),
      before,
    );
    assert.equal(
      database
        .prepare(
          "SELECT u.username FROM sesiones s JOIN usuarios u ON s.user_id=u.id WHERE token_hash='sesion-anterior'",
        )
        .get()!.username,
      "admin",
    );
    assert.equal(
      database.prepare("SELECT payload FROM jornadas WHERE id=8").get()!
        .payload,
      '{"title":"Jornada existente"}',
    );
    assert.equal(
      database
        .prepare("SELECT actor FROM registro_accesos_usuarios WHERE id=4")
        .get()!.actor,
      "admin",
    );
    database
      .prepare(
        "INSERT INTO usuarios(username,name,password_hash,role) VALUES(?,?,?,?)",
      )
      .run("gobernador", "Gobernador", "hash-consulta", "Consulta");
    assert.throws(
      () =>
        database
          .prepare(
            "INSERT INTO usuarios(username,name,password_hash,role) VALUES(?,?,?,?)",
          )
          .run("invalido", "Inválido", "hash", "Superusuario"),
      /CHECK/,
    );
    assert.throws(
      () =>
        database
          .prepare(
            "INSERT INTO usuarios(username,name,password_hash,role) VALUES(?,?,?,?)",
          )
          .run("admin", "Duplicado", "hash", "Consulta"),
      /UNIQUE/,
    );
    migrateUserRoles(database);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS total FROM usuarios").get()!.total,
      3,
    );
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      database.prepare("PRAGMA foreign_keys").get()!.foreign_keys,
      1,
    );
  } finally {
    database.close();
  }
});

test("Una migración fallida revierte la tabla de usuarios y restaura las restricciones", () => {
  const database = legacyDatabase();
  try {
    database.exec(
      "PRAGMA foreign_keys=OFF; INSERT INTO sesiones VALUES('referencia-invalida',999,NULL,9999999999999); PRAGMA foreign_keys=ON;",
    );
    const schema = database
      .prepare("SELECT sql FROM sqlite_schema WHERE name='usuarios'")
      .get()!.sql;
    const users = database.prepare("SELECT * FROM usuarios ORDER BY id").all();
    assert.throws(() => migrateUserRoles(database), /referencias no válidas/);
    assert.equal(
      database
        .prepare("SELECT sql FROM sqlite_schema WHERE name='usuarios'")
        .get()!.sql,
      schema,
    );
    assert.deepEqual(
      database.prepare("SELECT * FROM usuarios ORDER BY id").all(),
      users,
    );
    assert.equal(
      database.prepare("PRAGMA foreign_keys").get()!.foreign_keys,
      1,
    );
    assert.equal(
      database
        .prepare(
          "SELECT COUNT(*) AS total FROM sqlite_schema WHERE name='usuarios_with_consulta'",
        )
        .get()!.total,
      0,
    );
  } finally {
    database.close();
  }
});

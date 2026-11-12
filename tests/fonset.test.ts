import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  fonsetCostCents,
  fonsetCostInput,
  formatFonsetCost,
  validateFonsetProject,
  fonsetSubmissionId,
} from "../src/lib/fonset-domain";
import { ensureFonsetSchema } from "../src/lib/fonset-schema";

test("FONSET valida sus cuatro campos y permite estados propios", () => {
  const result = validateFonsetProject({
    name: "  Proyecto  de prueba ",
    objective: "Objetivo de prueba",
    cost: "120000000.50",
    status: "En revisión  del comité",
  });
  assert.deepEqual(result, {
    name: "Proyecto de prueba",
    objective: "Objetivo de prueba",
    costCents: 12000000050,
    status: "En revisión del comité",
  });
  for (const value of [
    { name: "" },
    { objective: "" },
    { status: "" },
    { cost: null },
    { cost: -1 },
    { cost: 1.234 },
    { cost: "1.000.000" },
  ])
    assert.throws(() =>
      validateFonsetProject({
        name: "Proyecto",
        objective: "Objetivo",
        cost: 0,
        status: "Sin contratar",
        ...value,
      }),
    );
  assert.equal(
    validateFonsetProject({
      name: "Proyecto",
      objective: "Objetivo",
      cost: 0,
      status: "Sin contratar",
    }).costCents,
    0,
  );
  assert.throws(() => fonsetSubmissionId("no-es-un-identificador"));
});
test("los costos y su suma conservan centavos sin redondeos de coma flotante", () => {
  assert.equal(fonsetCostCents(0.29), 29);
  const sum = BigInt(fonsetCostCents("0.10")) + BigInt(fonsetCostCents("0.20"));
  assert.equal(sum, BigInt(30));
  assert.match(formatFonsetCost(sum), /0,30$/);
  assert.equal(
    fonsetCostInput(fonsetCostCents("125000000.50")),
    "125000000.50",
  );
  assert.equal(fonsetCostCents("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(fonsetCostInput(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.throws(() => fonsetCostCents("90071992547409.92"));
  for (const invalid of [NaN, Infinity, -1, "", true, "1,23", "0.001", "1e6"])
    assert.throws(() => fonsetCostCents(invalid));
});
test("el esquema FONSET es aditivo y repetible sin alterar jornadas ni proyectos anteriores", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(
      "CREATE TABLE jornadas(id INTEGER PRIMARY KEY,payload TEXT); INSERT INTO jornadas VALUES(7,'datos existentes');",
    );
    ensureFonsetSchema(database);
    database
      .prepare(
        "INSERT INTO fonset_proyectos(submission_key,name,objective,cost_cents,status,author) VALUES(?,?,?,?,?,?)",
      )
      .run("prueba", "Proyecto", "Objetivo", 12345, "Estado propio", "prueba");
    const before = database.prepare("SELECT * FROM fonset_proyectos").all();
    ensureFonsetSchema(database);
    assert.deepEqual(
      database.prepare("SELECT * FROM fonset_proyectos").all(),
      before,
    );
    assert.equal(
      database.prepare("SELECT payload FROM jornadas WHERE id=7").get()!
        .payload,
      "datos existentes",
    );
  } finally {
    database.close();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureImpactSchema } from "../src/lib/impact-schema";
import {
  reportTotal,
  validateDelivery,
  validateImpactImport,
  validateImpactReport,
} from "../src/lib/impact-domain";
import { impactFixture } from "./impact-fixture";

test("49 actas conservan fecha literal e impacto sin generar personas ni fechas por entrega", () => {
  const input = impactFixture("fuente-unica");
  const before = structuredClone(input),
    validated = validateImpactImport(input);
  assert.equal(validated.deliveries.length, 49);
  assert.equal(reportTotal(validated.report), 1000);
  assert.equal(validated.report.periodStart, null);
  assert.equal(validated.deliveries[0].sourceDateText, "13 de agosto de 20206");
  assert(
    validated.deliveries.every(
      (d) =>
        d.dates.length === 0 && d.activityIds.length === 0 && !("people" in d),
    ),
  );
  assert.deepEqual(input, before);
});
test("importación valida todo el lote, referencias y actas normalizadas antes de escribir", () => {
  const input = impactFixture("fuente");
  assert.throws(() =>
    validateImpactImport({
      ...input,
      deliveries: [
        input.deliveries[0],
        { ...input.deliveries[1], actNumber: "1" },
      ],
    }),
  );
  assert.throws(() =>
    validateImpactImport({
      ...input,
      deliveries: [{ ...input.deliveries[0], lineId: "desconocida" }],
    }),
  );
  assert.throws(() =>
    validateImpactImport({
      ...input,
      deliveries: [{ ...input.deliveries[0], activityIds: [1] }],
    }),
  );
  assert.throws(() =>
    validateImpactImport({
      ...input,
      deliveries: [{ ...input.deliveries[0], dates: ["2026-02-31"] }],
    }),
  );
  assert.throws(() =>
    validateImpactReport({
      ...input.report,
      lines: [{ ...input.report.lines[0], people: -1 }],
    }),
  );
  assert.throws(() =>
    validateImpactReport({
      ...input.report,
      lines: [input.report.lines[0], input.report.lines[0]],
    }),
  );
  assert.throws(() =>
    validateImpactReport({ ...input.report, periodStatus: "Confirmado" }),
  );
  assert.throws(() =>
    validateImpactReport({
      ...input.report,
      periodStart: "2026-12-01",
      periodEnd: "2026-01-01",
    }),
  );
});
test("una entrega revisada exige fechas, destinos y productos, con unidades independientes", () => {
  const source = { ...impactFixture("fuente", 1).deliveries[0], reportId: 1 };
  assert.throws(() =>
    validateDelivery({ ...source, reviewStatus: "Revisada" }),
  );
  const validated = validateDelivery({
    ...source,
    reviewStatus: "Revisada",
    dates: ["2026-05-20", "2026-05-20"],
    municipalities: ["Pasto", "Tumaco", "Pasto"],
    items: [{ product: "Arroz", quantity: 2.5, unit: "kilos" }],
  });
  assert.deepEqual(validated.municipalities, ["Pasto", "Tumaco"]);
  assert.deepEqual(validated.dates, ["2026-05-20"]);
  assert.deepEqual(
    validateDelivery({ ...source, activityIds: [4, 4, 8] }).activityIds,
    [4, 8],
  );
  assert.equal(validated.items[0].quantity, 2.5);
  assert.throws(() =>
    validateDelivery({ ...source, municipalities: ["Buenaventura"] }),
  );
  assert.doesNotThrow(() =>
    validateDelivery({
      ...source,
      otherDestinations: "Buenaventura, Valle del Cauca",
    }),
  );
  assert.throws(() =>
    validateDelivery({
      ...source,
      items: [{ product: "Arroz", quantity: 0, unit: "bultos" }],
    }),
  );
});
test("la ampliación es aditiva, repetible y conserva jornadas al borrar entregas o informes", () => {
  const d = new DatabaseSync(":memory:");
  try {
    d.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE jornadas(id INTEGER PRIMARY KEY,payload TEXT NOT NULL); INSERT INTO jornadas VALUES(7,'{\"people\":125}');",
    );
    ensureImpactSchema(d);
    d.exec(
      "INSERT INTO impactos_informes(id,source_key,payload,author) VALUES(1,'fuente','{}','prueba'); INSERT INTO donacion_entregas(report_id,act_number,activity_id,payload,author) VALUES(1,'001',7,'{}','prueba');",
    );
    ensureImpactSchema(d);
    assert.equal(
      d.prepare("SELECT COUNT(*) AS n FROM donacion_entrega_jornadas").get()!.n,
      1,
    );
    assert.equal(
      d.prepare("SELECT payload FROM jornadas WHERE id=7").get()!.payload,
      '{"people":125}',
    );
    assert.equal(
      d.prepare("SELECT COUNT(*) AS n FROM donacion_entregas").get()!.n,
      1,
    );
    d.exec("DELETE FROM jornadas WHERE id=7");
    assert.equal(
      d.prepare("SELECT COUNT(*) AS n FROM donacion_entrega_jornadas").get()!.n,
      0,
    );
    assert.equal(
      d.prepare("SELECT activity_id FROM donacion_entregas").get()!.activity_id,
      null,
    );
    d.exec(
      "INSERT INTO jornadas VALUES(8,'{}'); INSERT INTO jornadas VALUES(9,'{}'); UPDATE donacion_entregas SET activity_id=8",
    );
    ensureImpactSchema(d);
    d.exec(
      "INSERT INTO donacion_entrega_jornadas(delivery_id,activity_id) SELECT id,9 FROM donacion_entregas",
    );
    assert.equal(
      d.prepare("SELECT COUNT(*) AS n FROM donacion_entrega_jornadas").get()!.n,
      2,
    );
    d.exec("DELETE FROM impactos_informes WHERE id=1");
    assert.equal(
      d.prepare("SELECT COUNT(*) AS n FROM donacion_entregas").get()!.n,
      0,
    );
    assert.equal(d.prepare("SELECT COUNT(*) AS n FROM jornadas").get()!.n, 2);
  } finally {
    d.close();
  }
});

test("Las entregas se pueden registrar e importar sin referencia ni archivo de acta", () => {
  const source = impactFixture("sin-actas", 2);
  const input = {
    ...source,
    deliveries: source.deliveries.map((d) => ({ ...d, actNumber: "" })),
  };
  const result = validateImpactImport(input);
  assert.equal(result.deliveries.length, 2);
  assert(result.deliveries.every((d) => d.actNumber === ""));
  assert.equal(
    validateDelivery({
      ...source.deliveries[0],
      reportId: 1,
      actNumber: undefined,
    }).actNumber,
    "",
  );
});

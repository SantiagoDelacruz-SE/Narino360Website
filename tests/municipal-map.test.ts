import { test } from "node:test";
import assert from "node:assert/strict";
import { MUNICIPALITIES, type Activity } from "../src/lib/domain";
import {
  cartography,
  recurrenceColor,
  summarizeMunicipalities,
} from "../src/lib/municipal-map";

function inside(point: number[], ring: number[][]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x, y] = ring[i],
      [u, v] = ring[j];
    if (
      y > point[1] !== v > point[1] &&
      point[0] < ((u - x) * (point[1] - y)) / (v - y) + x
    )
      result = !result;
  }
  return result;
}
test("64 municipios: nombres y códigos únicos, referencias interiores a su geometría", () => {
  assert.equal(cartography.features.length, 64);
  assert.deepEqual(
    new Set(cartography.features.map((f) => f.properties.name)),
    new Set(MUNICIPALITIES),
  );
  assert.equal(
    new Set(cartography.features.map((f) => f.properties.code)).size,
    64,
  );
  for (const { properties, geometry } of cartography.features) {
    assert.match(properties.code, /^52\d{3}$/);
    const polygons =
      geometry.type === "MultiPolygon"
        ? (geometry.coordinates as number[][][][])
        : [geometry.coordinates as number[][][]];
    assert(
      polygons.some(
        (p) =>
          inside(properties.anchor, p[0]) &&
          !p.slice(1).some((hole) => inside(properties.anchor, hole)),
      ),
      properties.name,
    );
  }
});
test("recurrencia cuenta cada acción, usa el municipio declarado y conserva coordenadas", () => {
  const records = Array.from(
    { length: 36 },
    (_, i) =>
      ({
        id: i + 1,
        municipality: i < 28 ? "Pasto" : "Tumaco",
        program: i % 2 ? "PISCC" : "Banco de Alimentos",
        recordType: (["Actividad", "Operativo", "Feria"] as const)[i % 3],
        latitude: i === 0 ? null : 1.2136,
        longitude: i === 0 ? null : -77.2811,
        people: i < 28 ? 0 : 10000,
      }) as Activity,
  );
  const news = { ...records[0], id: 37, recordType: "Noticia" } as Activity;
  const before = structuredClone(records);
  const summaries = summarizeMunicipalities([...records, news]);
  const pasto = summaries.find((s) => s.name === "Pasto")!;
  const tumaco = summaries.find((s) => s.name === "Tumaco")!;
  assert.equal(pasto.records.length, 28);
  assert.equal(tumaco.records.length, 8);
  assert.equal(summaries.flatMap((s) => s.records).length, 36);
  assert.equal(
    pasto.components.reduce((sum, c) => sum + c.count, 0),
    28,
  );
  assert.equal(recurrenceColor(pasto.records.length), "#DA1C24");
  assert.equal(recurrenceColor(tumaco.records.length), "#FFD500");
  assert.deepEqual(records, before);
  assert.equal(
    summarizeMunicipalities(
      records.filter((a) => a.program === "PISCC"),
    ).flatMap((s) => s.records).length,
    18,
  );
});
test("escala de recurrencia absoluta, incluidos cero y límites de cada intervalo", () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 100].map(recurrenceColor), [
    "#FFFFFF",
    "#80BEFF",
    "#10A13B",
    "#10A13B",
    "#FFD500",
    "#FFD500",
    "#DA1C24",
    "#DA1C24",
  ]);
});

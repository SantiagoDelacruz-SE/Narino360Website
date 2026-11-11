import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MUNICIPALITIES,
  activityMunicipalities,
  activityMetrics,
  validateActivity,
  parseBulletin,
  type Activity,
} from "../src/lib/domain";
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

const destinations = [
  "Linares",
  "Guaitarilla",
  "El Peñol",
  "La Florida",
  "Taminango",
  "Policarpa",
  "Buesaco",
  "Belén",
  "Arboleda",
];
const multiInput = {
  recordType: "Actividad",
  title: "Actividad de prueba en varios municipios",
  date: "2026-09-03",
  program: "Banco de Alimentos",
  municipality: "Pasto",
  municipalities: destinations,
  latitude: 1.2136,
  longitude: -77.2811,
  people: 90,
  families: 9,
  weaponsSeized: 0,
  weaponsVoluntary: 0,
  objective: "Atención comunitaria",
  summary: "Resultados de prueba compartidos",
  pisccGoal: "",
};
test("una actividad en nueve municipios cuenta una vez y aparece en cada municipio sin repartir personas", () => {
  const input = validateActivity({
    ...multiInput,
    municipalities: [...destinations, "Linares"],
  });
  const a = {
    ...input,
    id: 901,
    author: "prueba",
    createdAt: "2026-09-03",
    updatedAt: "2026-09-03",
  };
  const before = structuredClone(a);
  assert.deepEqual(activityMunicipalities(a), destinations);
  assert.equal(a.municipality, "Linares");
  const metrics = activityMetrics([a]);
  assert.equal(metrics.activityCount, 1);
  assert.equal(metrics.municipalityCount, 9);
  assert.equal(metrics.people, 90);
  assert.equal(metrics.families, 9);
  const summaries = summarizeMunicipalities([a]);
  assert.equal(summaries.filter((s) => s.records.length).length, 9);
  for (const name of destinations) {
    const summary = summaries.find((s) => s.name === name)!;
    assert.deepEqual(
      summary.records.map((record) => record.id),
      [901],
    );
    assert.equal(recurrenceColor(summary.records.length), "#80BEFF");
    const filtered = activityMetrics([a], name);
    assert.equal(filtered.activityCount, 1);
    assert.equal(filtered.municipalityCount, 1);
    assert.equal(filtered.people, null);
    assert.equal(filtered.families, null);
    assert.equal(filtered.sharedResultCount, 1);
    assert.equal(
      summarizeMunicipalities([a], name).filter((s) => s.records.length).length,
      1,
    );
  }
  const local = {
    ...a,
    id: 902,
    municipalities: undefined,
    municipality: "Linares",
    people: 7,
    families: 2,
  };
  assert.equal(activityMetrics([a, local]).people, 97);
  assert.equal(activityMetrics([a, local], "Linares").people, 7);
  assert.equal(activityMetrics([a, local], "Linares").sharedResultCount, 1);
  assert.deepEqual(a, before);
});
test("municipios múltiples validados, noticias excluidas y compatibilidad con el campo único", () => {
  for (const bad of [
    [],
    ["Bogotá"],
    [""],
    [42],
    null,
    "Pasto",
    Array(65).fill("Linares"),
  ])
    assert.throws(() =>
      validateActivity({ ...multiInput, municipalities: bad }),
    );
  const { municipalities: _members, ...legacy } = multiInput;
  void _members;
  const single = validateActivity(legacy);
  assert.deepEqual(activityMunicipalities(single), ["Pasto"]);
  assert.equal(single.municipalities, undefined);
  const news = {
    ...validateActivity(multiInput),
    id: 903,
    recordType: "Noticia",
  } as Activity;
  assert.equal(activityMetrics([news]).activityCount, 0);
  assert(summarizeMunicipalities([news]).every((s) => s.records.length === 0));
});
test("la asistencia extrae la lista municipal explícita sin confundir el departamento con el municipio Nariño", () => {
  const parsed = parseBulletin(
    "Gobernación de Nariño. Ayudas destinadas a los municipios de Linares, Guaitarilla, El Peñol, La Florida, Taminango, Policarpa, Buesaco, Belén y Arboleda, teniendo en cuenta las necesidades del territorio.",
  );
  assert.deepEqual(parsed.municipalities, destinations);
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

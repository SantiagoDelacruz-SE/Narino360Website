import type { ImpactImport } from "../src/lib/impact-domain";
// Synthetic data only. Uploaded institutional reports are never bundled here.
export function impactFixture(sourceKey: string, count = 49): ImpactImport {
  return {
    version: 1,
    report: {
      sourceKey,
      title: "Informe sintético de entregas",
      component: "Banco de Alimentos",
      sourceTitle: "Soporte de prueba",
      sourceAssetId: null,
      sourceReference: "Referencia de prueba",
      periodStatus: "Pendiente",
      periodStart: null,
      periodEnd: null,
      periodNotes:
        "El corte debe verificarse; no corregir fechas de la fuente automáticamente.",
      audience: "Directo e indirecto",
      lines: Array.from({ length: 4 }, (_, i) => ({
        id: "linea-" + i,
        name: "Línea de prueba " + (i + 1),
        people: (i + 1) * 100,
        sourcePage: i + 1,
      })),
    },
    deliveries: Array.from({ length: count }, (_, i) => ({
      lineId: "linea-" + (i % 4),
      actNumber: String(i + 1).padStart(3, "0"),
      title: "Entrega sintética " + (i + 1),
      sourceDateText: i === 0 ? "13 de agosto de 20206" : "Fecha por verificar",
      dates: [],
      municipalities: [],
      otherDestinations: "",
      sourcePages: String(i + 1),
      notes: "Referencia pendiente de cotejar con la jornada existente.",
      reviewStatus: "Pendiente",
      activityIds: [],
      items: [],
    })),
  };
}

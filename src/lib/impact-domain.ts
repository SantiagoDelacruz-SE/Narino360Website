import {
  AppError,
  COMPONENTS,
  MUNICIPALITIES,
  textField,
  type Component,
} from "./domain";

export const IMPACT_AUDIENCES = [
  "Directo e indirecto",
  "Directo",
  "Indirecto",
  "No especificado",
] as const;
export type ImpactLine = {
  id: string;
  name: string;
  people: number;
  sourcePage: number | null;
};
export type ImpactReportInput = {
  sourceKey: string;
  title: string;
  component: Component;
  sourceTitle: string;
  sourceAssetId: string | null;
  sourceReference: string;
  periodStatus: "Pendiente" | "Confirmado";
  periodStart: string | null;
  periodEnd: string | null;
  periodNotes: string;
  audience: (typeof IMPACT_AUDIENCES)[number];
  lines: ImpactLine[];
};
export type ImpactReport = ImpactReportInput & {
  id: number;
  author: string;
  createdAt: string;
  updatedAt: string;
  deliveryCount: number;
};
export type DeliveryItem = { product: string; quantity: number; unit: string };
export type DeliveryInput = {
  reportId: number;
  lineId: string;
  actNumber: string;
  title: string;
  sourceDateText: string;
  dates: string[];
  municipalities: string[];
  otherDestinations: string;
  sourcePages: string;
  notes: string;
  reviewStatus: "Pendiente" | "Revisada";
  activityIds: number[];
  items: DeliveryItem[];
};
export type Delivery = DeliveryInput & {
  id: number;
  author: string;
  createdAt: string;
  updatedAt: string;
};
export type ImpactImport = {
  version: 1;
  report: ImpactReportInput;
  deliveries: Omit<DeliveryInput, "reportId">[];
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("Registro no válido.");
  return value as Record<string, unknown>;
}
export function positiveId(value: unknown, label = "Identificador") {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new AppError(label + " no válido.");
  return value;
}
function integer(value: unknown, label: string, max = 100000000) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new AppError(label + ": valor no válido.");
  return value;
}
export function validDate(value: unknown): string {
  const date = textField(value, "Fecha", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new AppError("Fecha no válida.");
  return date;
}
export function reportTotal(report: Pick<ImpactReportInput, "lines">) {
  return report.lines.reduce((n, line) => n + line.people, 0);
}
export function normalizeAct(value: unknown) {
  const text = textField(
    value ?? "",
    "Referencia de acta",
    80,
    0,
  ).toUpperCase();
  return /^\d{1,10}$/.test(text) ? String(Number(text)).padStart(3, "0") : text;
}
export function validateImpactReport(value: unknown): ImpactReportInput {
  const a = object(value);
  const component = textField(a.component, "Componente") as Component;
  if (!COMPONENTS.includes(component))
    throw new AppError("Componente no válido.");
  if (a.periodStatus !== "Pendiente" && a.periodStatus !== "Confirmado")
    throw new AppError("Estado del período no válido.");
  const periodStart =
    a.periodStart == null || a.periodStart === ""
      ? null
      : validDate(a.periodStart);
  const periodEnd =
    a.periodEnd == null || a.periodEnd === "" ? null : validDate(a.periodEnd);
  if (
    (periodStart === null) !== (periodEnd === null) ||
    (periodStart && periodEnd && periodStart > periodEnd)
  )
    throw new AppError("Completa un período válido con inicio y fin.");
  if (a.periodStatus === "Confirmado" && (!periodStart || !periodEnd))
    throw new AppError("Confirma las fechas de inicio y fin del período.");
  if (!IMPACT_AUDIENCES.some((v) => v === a.audience))
    throw new AppError("Alcance del impacto no válido.");
  if (!Array.isArray(a.lines) || !a.lines.length || a.lines.length > 30)
    throw new AppError("Incluye de 1 a 30 líneas de impacto.");
  const lines = a.lines.map((v): ImpactLine => {
    const line = object(v);
    return {
      id: textField(line.id, "Identificador de línea", 80),
      name: textField(line.name, "Línea", 200),
      people: integer(line.people, "Personas"),
      sourcePage:
        line.sourcePage == null ? null : positiveId(line.sourcePage, "Página"),
    };
  });
  if (
    new Set(lines.map((l) => l.id)).size !== lines.length ||
    new Set(lines.map((l) => l.name.toLocaleLowerCase("es"))).size !==
      lines.length
  )
    throw new AppError("Las líneas no pueden repetirse.");
  return {
    sourceKey: textField(a.sourceKey, "Identificador del informe", 120),
    title: textField(a.title, "Título", 200),
    component,
    sourceTitle: textField(a.sourceTitle, "Documento fuente", 300),
    sourceAssetId:
      a.sourceAssetId == null || a.sourceAssetId === ""
        ? null
        : textField(a.sourceAssetId, "PDF", 100),
    sourceReference: textField(
      a.sourceReference ?? "",
      "Referencia documental",
      1000,
      0,
    ),
    periodStatus: a.periodStatus,
    periodStart,
    periodEnd,
    periodNotes: textField(a.periodNotes ?? "", "Notas del período", 4000, 0),
    audience: a.audience as ImpactReportInput["audience"],
    lines,
  };
}
export function validateDelivery(value: unknown): DeliveryInput {
  const a = object(value);
  const links = a.activityIds ?? (a.activityId == null ? [] : [a.activityId]);
  if (!Array.isArray(links) || links.length > 100)
    throw new AppError("Vincula hasta 100 jornadas existentes por entrega.");
  const activityIds = [
    ...new Set(links.map((id) => positiveId(id, "Jornada"))),
  ];
  if (
    !Array.isArray(a.dates) ||
    a.dates.length > 100 ||
    !Array.isArray(a.municipalities) ||
    a.municipalities.length > 64 ||
    !Array.isArray(a.items) ||
    a.items.length > 100
  )
    throw new AppError("Fechas, municipios o productos no válidos.");
  const dates = [...new Set(a.dates.map(validDate))].sort();
  const municipalities = [
    ...new Set(a.municipalities.map((m) => textField(m, "Municipio", 100))),
  ];
  if (municipalities.some((m) => !MUNICIPALITIES.some((known) => known === m)))
    throw new AppError("Municipio de Nariño no válido.");
  if (a.reviewStatus !== "Pendiente" && a.reviewStatus !== "Revisada")
    throw new AppError("Estado de revisión no válido.");
  const items = a.items.map((v): DeliveryItem => {
    const item = object(v);
    if (
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000000
    )
      throw new AppError("Cantidad de producto no válida.");
    return {
      product: textField(item.product, "Producto", 200),
      quantity: item.quantity,
      unit: textField(item.unit, "Unidad", 80),
    };
  });
  const otherDestinations = textField(
    a.otherDestinations ?? "",
    "Otros destinos",
    1000,
    0,
  );
  if (
    a.reviewStatus === "Revisada" &&
    (!dates.length ||
      (!municipalities.length && !otherDestinations) ||
      !items.length)
  )
    throw new AppError(
      "Para marcar Revisada, completa fechas, destinos y productos.",
    );
  return {
    reportId: positiveId(a.reportId, "Informe"),
    lineId: textField(a.lineId, "Línea", 80),
    actNumber: normalizeAct(a.actNumber),
    title: textField(a.title, "Entrega", 300),
    sourceDateText: textField(
      a.sourceDateText ?? "",
      "Fecha en la fuente",
      1000,
      0,
    ),
    dates,
    municipalities,
    otherDestinations,
    sourcePages: textField(a.sourcePages ?? "", "Páginas", 100, 0),
    notes: textField(a.notes ?? "", "Observaciones", 8000, 0),
    reviewStatus: a.reviewStatus,
    activityIds,
    items,
  };
}
export function validateImpactImport(value: unknown): ImpactImport {
  const a = object(value);
  if (
    a.version !== 1 ||
    !Array.isArray(a.deliveries) ||
    a.deliveries.length > 500
  )
    throw new AppError("Formato de informe no válido; máximo 500 entregas.");
  const report = validateImpactReport(a.report);
  const deliveries = a.deliveries.map((v) => {
    const d = validateDelivery({ ...object(v), reportId: 1 });
    if (!report.lines.some((l) => l.id === d.lineId))
      throw new AppError(
        "Una entrega hace referencia a una línea inexistente.",
      );
    if (d.activityIds.length)
      throw new AppError(
        "Vincula las jornadas después de importar, usando los registros de este servidor.",
      );
    const { reportId: _reportId, ...delivery } = d;
    void _reportId;
    return delivery;
  });
  const references = deliveries.map((d) => d.actNumber).filter(Boolean);
  if (new Set(references).size !== references.length)
    throw new AppError("El archivo repite números de acta.");
  return { version: 1, report, deliveries };
}

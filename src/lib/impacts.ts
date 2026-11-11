import { audit, db } from "./db";
import { randomUUID } from "node:crypto";
import { readAssets } from "./media";
import { AppError, recordTypeOf } from "./domain";
import type {
  Delivery,
  DeliveryInput,
  ImpactImport,
  ImpactReport,
  ImpactReportInput,
} from "./impact-domain";

type Row = {
  id: number;
  payload: string;
  author: string;
  created_at: string;
  updated_at: string;
};
function metadata(row: Row) {
  return {
    id: row.id,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function transaction<T>(work: () => T): T {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
export function listImpactReports(): ImpactReport[] {
  return (
    db()
      .prepare(
        "SELECT i.*, (SELECT COUNT(*) FROM donacion_entregas e WHERE e.report_id=i.id) AS delivery_count FROM impactos_informes i ORDER BY i.id DESC",
      )
      .all() as (Row & { delivery_count: number })[]
  ).map((row) => ({
    ...JSON.parse(row.payload),
    ...metadata(row),
    deliveryCount: row.delivery_count,
  }));
}
export function listDeliveries(reportId: number): Delivery[] {
  const links = db()
    .prepare(
      "SELECT j.delivery_id,j.activity_id FROM donacion_entrega_jornadas j JOIN donacion_entregas e ON e.id=j.delivery_id WHERE e.report_id=? ORDER BY j.activity_id",
    )
    .all(reportId) as { delivery_id: number; activity_id: number }[];
  const byDelivery = new Map<number, number[]>();
  for (const link of links)
    byDelivery.set(link.delivery_id, [
      ...(byDelivery.get(link.delivery_id) ?? []),
      link.activity_id,
    ]);
  return (
    db()
      .prepare(
        "SELECT * FROM donacion_entregas WHERE report_id=? ORDER BY act_number,id",
      )
      .all(reportId) as (Row & {
      report_id: number;
      activity_id: number | null;
    })[]
  ).map((row) => ({
    ...JSON.parse(row.payload),
    ...metadata(row),
    reportId: row.report_id,
    activityIds: byDelivery.get(row.id) ?? [],
  }));
}
function checkSource(report: ImpactReportInput) {
  if (
    report.sourceAssetId &&
    !readAssets().some(
      (asset) =>
        asset.id === report.sourceAssetId && asset.filename.endsWith(".pdf"),
    )
  )
    throw new AppError("Selecciona un PDF existente como soporte.");
}
function reportRow(id: number) {
  const row = db()
    .prepare("SELECT * FROM impactos_informes WHERE id=?")
    .get(id) as Row | undefined;
  if (!row) throw new AppError("Informe no encontrado.", 404);
  return JSON.parse(row.payload) as ImpactReportInput;
}
function insertReport(input: ImpactReportInput, actor: string) {
  checkSource(input);
  if (
    db()
      .prepare("SELECT id FROM impactos_informes WHERE source_key=?")
      .get(input.sourceKey)
  )
    throw new AppError(
      "Este informe ya está registrado. Actualiza el existente para evitar duplicaciones.",
      409,
    );
  return Number(
    db()
      .prepare(
        "INSERT INTO impactos_informes(source_key,payload,author) VALUES(?,?,?)",
      )
      .run(input.sourceKey, JSON.stringify(input), actor).lastInsertRowid,
  );
}
function checkDelivery(input: DeliveryInput, id?: number) {
  const report = reportRow(input.reportId);
  if (!report.lines.some((line) => line.id === input.lineId))
    throw new AppError("La línea no pertenece al informe.");
  if (
    report.periodStatus === "Confirmado" &&
    input.reviewStatus === "Revisada" &&
    input.dates.some(
      (date) => date < report.periodStart! || date > report.periodEnd!,
    )
  )
    throw new AppError(
      "La entrega tiene fechas fuera del período confirmado del informe. Revisa el período o conserva la entrega pendiente.",
    );
  const duplicate = input.actNumber
    ? db()
        .prepare(
          "SELECT id FROM donacion_entregas WHERE report_id=? AND act_number=? AND id<>?",
        )
        .get(input.reportId, input.actNumber, id ?? -1)
    : undefined;
  if (duplicate)
    throw new AppError("El acta ya está registrada en este informe.", 409);
  for (const activityId of input.activityIds) {
    const row = db()
      .prepare("SELECT payload FROM jornadas WHERE id=?")
      .get(activityId) as { payload: string } | undefined;
    if (!row || recordTypeOf(JSON.parse(row.payload)) === "Noticia")
      throw new AppError(
        "Selecciona una jornada existente; las noticias no son intervenciones.",
      );
  }
}
function insertDelivery(input: DeliveryInput, actor: string) {
  checkDelivery(input);
  const id = Number(
    db()
      .prepare(
        "INSERT INTO donacion_entregas(report_id,act_number,activity_id,payload,author) VALUES(?,?,?,?,?)",
      )
      .run(
        input.reportId,
        input.actNumber || "unreferenced:" + randomUUID(),
        null,
        JSON.stringify(input),
        actor,
      ).lastInsertRowid,
  );
  writeLinks(id, input.activityIds);
  return id;
}
function writeLinks(id: number, activityIds: number[]) {
  db()
    .prepare("DELETE FROM donacion_entrega_jornadas WHERE delivery_id=?")
    .run(id);
  for (const activityId of activityIds)
    db()
      .prepare(
        "INSERT INTO donacion_entrega_jornadas(delivery_id,activity_id) VALUES(?,?)",
      )
      .run(id, activityId);
}
export function saveImpactReport(
  input: ImpactReportInput,
  actor: string,
  role: string,
  id?: number,
) {
  return transaction(() => {
    checkSource(input);
    if (id !== undefined) {
      const previous = reportRow(id);
      if (previous.sourceKey !== input.sourceKey)
        throw new AppError("Conserva el identificador original del informe.");
      const referenced = listDeliveries(id).map((d) => d.lineId);
      if (
        referenced.some((lineId) => !input.lines.some((l) => l.id === lineId))
      )
        throw new AppError(
          "No puedes quitar una línea que tiene entregas vinculadas.",
          409,
        );
      if (
        input.periodStatus === "Confirmado" &&
        listDeliveries(id).some(
          (d) =>
            d.reviewStatus === "Revisada" &&
            d.dates.some(
              (date) => date < input.periodStart! || date > input.periodEnd!,
            ),
        )
      )
        throw new AppError(
          "Hay entregas revisadas fuera del período propuesto. Aclara las fechas antes de confirmarlo.",
          409,
        );
      db()
        .prepare(
          "UPDATE impactos_informes SET payload=?,updated_at=datetime('now') WHERE id=?",
        )
        .run(JSON.stringify(input), id);
    } else id = insertReport(input, actor);
    audit(actor, role, "impacto.guardado", String(id));
    return id;
  });
}
export function importImpactReport(
  input: ImpactImport,
  actor: string,
  role: string,
) {
  return transaction(() => {
    const id = insertReport(input.report, actor);
    for (const delivery of input.deliveries)
      insertDelivery({ ...delivery, reportId: id }, actor);
    audit(
      actor,
      role,
      "impacto.importado",
      JSON.stringify({ id, entregas: input.deliveries.length }),
    );
    return id;
  });
}
export function saveDelivery(
  input: DeliveryInput,
  actor: string,
  role: string,
  id?: number,
) {
  return transaction(() => {
    checkDelivery(input, id);
    if (id !== undefined) {
      const result = db()
        .prepare(
          "UPDATE donacion_entregas SET report_id=?,act_number=?,activity_id=?,payload=?,updated_at=datetime('now') WHERE id=?",
        )
        .run(
          input.reportId,
          input.actNumber || "unreferenced:" + randomUUID(),
          null,
          JSON.stringify(input),
          id,
        );
      if (!result.changes) throw new AppError("Entrega no encontrada.", 404);
      writeLinks(id, input.activityIds);
    } else id = insertDelivery(input, actor);
    audit(actor, role, "entrega.guardada", String(id));
    return id;
  });
}
export function deleteImpactReport(id: number, actor: string, role: string) {
  transaction(() => {
    reportRow(id);
    db().prepare("DELETE FROM impactos_informes WHERE id=?").run(id);
    audit(actor, role, "impacto.eliminado", String(id));
  });
}
export function deleteDelivery(id: number, actor: string, role: string) {
  transaction(() => {
    if (
      !db().prepare("DELETE FROM donacion_entregas WHERE id=?").run(id).changes
    )
      throw new AppError("Entrega no encontrada.", 404);
    audit(actor, role, "entrega.eliminada", String(id));
  });
}

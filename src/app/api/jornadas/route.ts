import { NextResponse } from "next/server";
import { listActivities, saveActivities, db, audit } from "@/lib/db";
import {
  body,
  identity,
  editor,
  sameOrigin,
  actor,
  errorResponse,
} from "@/lib/http";
import { AppError, validateActivity } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET() {
  try {
    await identity();
    return NextResponse.json({ activities: listActivities() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    const value = await body(request);
    const rows = Array.isArray(value) ? value : [value];
    if (rows.length < 1 || rows.length > 200)
      throw new AppError("Carga de 1 a 200 jornadas por archivo.");
    const validated = rows.map(validateActivity);
    saveActivities(validated, actor(user), user.role);
    return NextResponse.json({ ok: true, count: rows.length }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    const value = await body(request);
    if (!Number.isSafeInteger(value.id) || value.id < 1)
      throw new AppError("Identificador no válido.");
    const row = db()
      .prepare("SELECT payload FROM jornadas WHERE id=?")
      .get(value.id) as { payload: string } | undefined;
    if (!row) throw new AppError("Jornada no encontrada.", 404);
    const previous = JSON.parse(row.payload);
    let input = value;
    if (
      value.municipalities === undefined &&
      previous.municipalities?.length > 1
    ) {
      if (value.municipality !== previous.municipality)
        throw new AppError(
          "Esta actividad tiene varios municipios. Actualiza el formulario para editar su selección completa.",
          409,
        );
      input = { ...value, municipalities: previous.municipalities };
    }
    saveActivities([validateActivity(input)], actor(user), user.role, value.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    if (user.role !== "Administrador")
      throw new AppError("Solo el administrador puede eliminar jornadas.", 403);
    const value = await body(request);
    if (!Number.isSafeInteger(value.id))
      throw new AppError("Identificador no válido.");
    db().prepare("DELETE FROM jornadas WHERE id=?").run(value.id);
    audit(actor(user), user.role, "jornada.eliminada", String(value.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

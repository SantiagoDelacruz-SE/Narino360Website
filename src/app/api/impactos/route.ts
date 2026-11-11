import { NextResponse } from "next/server";
import {
  actor,
  body,
  editor,
  errorResponse,
  identity,
  sameOrigin,
} from "@/lib/http";
import { AppError } from "@/lib/domain";
import {
  positiveId,
  validateImpactImport,
  validateImpactReport,
} from "@/lib/impact-domain";
import {
  deleteImpactReport,
  importImpactReport,
  listImpactReports,
  saveImpactReport,
} from "@/lib/impacts";
export const runtime = "nodejs";
export async function GET() {
  try {
    await identity();
    return NextResponse.json({ reports: listImpactReports() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor(),
      value = await body(request);
    const id =
      value.version === 1
        ? importImpactReport(
            validateImpactImport(value),
            actor(user),
            user.role,
          )
        : saveImpactReport(validateImpactReport(value), actor(user), user.role);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor(),
      value = await body(request);
    const id = positiveId(value.id);
    saveImpactReport(validateImpactReport(value), actor(user), user.role, id);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    if (user.role !== "Administrador")
      throw new AppError("Solo el administrador puede eliminar informes.", 403);
    const value = await body(request);
    deleteImpactReport(positiveId(value.id), actor(user), user.role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

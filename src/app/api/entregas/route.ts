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
import { positiveId, validateDelivery } from "@/lib/impact-domain";
import { deleteDelivery, listDeliveries, saveDelivery } from "@/lib/impacts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await identity();
    const id = positiveId(
      Number(new URL(request.url).searchParams.get("reportId")),
      "Informe",
    );
    return NextResponse.json({ deliveries: listDeliveries(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await editor();
    const id = saveDelivery(
      validateDelivery(await body(request)),
      actor(user),
      user.role,
    );
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
    saveDelivery(validateDelivery(value), actor(user), user.role, id);
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
      throw new AppError("Solo el administrador puede eliminar entregas.", 403);
    const value = await body(request);
    deleteDelivery(positiveId(value.id), actor(user), user.role);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

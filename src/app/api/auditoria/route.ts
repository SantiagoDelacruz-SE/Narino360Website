import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { identity, errorResponse } from "@/lib/http";
import { AppError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await identity();
    if (user.role !== "Administrador")
      throw new AppError("Acceso reservado al administrador.", 403);
    return NextResponse.json({
      events: db()
        .prepare(
          "SELECT * FROM registro_accesos_usuarios ORDER BY id DESC LIMIT 500",
        )
        .all(),
      guests: db()
        .prepare("SELECT * FROM registro_invitados ORDER BY id DESC LIMIT 500")
        .all(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

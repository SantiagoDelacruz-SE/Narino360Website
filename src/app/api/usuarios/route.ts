import { NextResponse } from "next/server";
import { db, audit } from "@/lib/db";
import { createUser } from "@/lib/auth";
import { body, identity, sameOrigin, errorResponse } from "@/lib/http";
import { AppError, textField, passwordField } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET() {
  try {
    const u = await identity();
    if (u.role !== "Administrador")
      throw new AppError("Acceso reservado al administrador.", 403);
    return NextResponse.json({
      users: db()
        .prepare(
          "SELECT id,username,name,role,active FROM usuarios ORDER BY name",
        )
        .all(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await identity();
    if (u.role !== "Administrador")
      throw new AppError("Acceso reservado al administrador.", 403);
    const v = await body(request);
    const role = v.role;
    if (role !== "Administrador" && role !== "Editor")
      throw new AppError("Rol no válido.");
    if (
      db()
        .prepare("SELECT id FROM usuarios WHERE username=?")
        .get(String(v.username).trim().toLowerCase())
    )
      throw new AppError("El nombre de usuario ya existe.", 409);
    createUser(
      textField(v.username, "Usuario", 60),
      textField(v.name, "Nombre", 120),
      passwordField(v.password),
      role,
    );
    audit(
      u.username!,
      u.role,
      "usuario.provisionado",
      String(v.username).trim().toLowerCase(),
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

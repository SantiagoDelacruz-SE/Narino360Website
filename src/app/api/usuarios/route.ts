import { NextResponse } from "next/server";
import { db, audit } from "@/lib/db";
import { createUser } from "@/lib/auth";
import { body, identity, sameOrigin, errorResponse } from "@/lib/http";
import {
  AppError,
  textField,
  passwordField,
  isAccountRole,
} from "@/lib/domain";
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
    if (!isAccountRole(role)) throw new AppError("Rol no válido.");
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

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const actor = await identity();
    if (actor.role !== "Administrador")
      throw new AppError("Acceso reservado al administrador.", 403);
    const value = await body(request);
    if (!Number.isSafeInteger(value.id) || value.id < 1)
      throw new AppError("Identificador no válido.");
    if (!isAccountRole(value.role)) throw new AppError("Rol no válido.");
    if (typeof value.active !== "boolean")
      throw new AppError("Estado no válido.");
    const name = textField(value.name, "Nombre", 120);
    const active = value.active ? 1 : 0;
    const database = db();
    database.exec("BEGIN IMMEDIATE");
    let accessChanged = false;
    try {
      // Recheck inside the transaction: permissions may have changed while
      // the request body was arriving. Serialize last-administrator checks.
      const administrator = database
        .prepare("SELECT role,active FROM usuarios WHERE id=?")
        .get(actor.id);
      if (
        !administrator ||
        administrator.role !== "Administrador" ||
        !administrator.active
      )
        throw new AppError("Acceso reservado al administrador.", 403);
      const previous = database
        .prepare("SELECT id,username,name,role,active FROM usuarios WHERE id=?")
        .get(value.id);
      if (!previous) throw new AppError("Cuenta no encontrada.", 404);
      if (
        previous.role === "Administrador" &&
        previous.active &&
        (value.role !== "Administrador" || !active)
      ) {
        const count = database
          .prepare(
            "SELECT COUNT(*) AS total FROM usuarios WHERE role='Administrador' AND active=1",
          )
          .get()!;
        if (Number(count.total) <= 1)
          throw new AppError(
            "Debe permanecer al menos un administrador activo. Activa o crea otro administrador antes de cambiar este acceso.",
            409,
          );
      }
      accessChanged =
        previous.role !== value.role || previous.active !== active;
      const changed = accessChanged || previous.name !== name;
      if (changed) {
        database
          .prepare("UPDATE usuarios SET name=?,role=?,active=? WHERE id=?")
          .run(name, value.role, active, value.id);
        if (accessChanged)
          database
            .prepare("DELETE FROM sesiones WHERE user_id=?")
            .run(value.id);
        audit(
          actor.username!,
          actor.role,
          "usuario.actualizado",
          JSON.stringify({
            username: previous.username,
            before: {
              name: previous.name,
              role: previous.role,
              active: Boolean(previous.active),
            },
            after: { name, role: value.role, active: value.active },
            sessionsRevoked: accessChanged,
          }),
        );
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return NextResponse.json({
      ok: true,
      accessChanged,
      relogin: accessChanged && actor.id === value.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, sessionIdentity } from "./auth";
import { AppError, canEditContent, type Identity } from "./domain";
export async function identity(): Promise<Identity> {
  const user = sessionIdentity((await cookies()).get(COOKIE)?.value);
  if (!user) throw new AppError("La sesión expiró. Ingresa nuevamente.", 401);
  return user;
}
export async function editor() {
  const user = await identity();
  if (!canEditContent(user.role))
    throw new AppError(
      "Solo administradores y editores pueden realizar cambios.",
      403,
    );
  return user;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new AppError("Origen de solicitud no permitido.", 403);
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 2_000_000)
    throw new AppError("Solicitud demasiado grande.", 413);
  const raw = await request.text();
  if (raw.length > 2_000_000)
    throw new AppError("Solicitud demasiado grande.", 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw new AppError("JSON no válido.");
  }
}
export function errorResponse(e: unknown) {
  if (e instanceof AppError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e instanceof Error ? e.message : "Error interno");
  return NextResponse.json(
    { error: "No se pudo completar la operación." },
    { status: 500 },
  );
}
export async function setSession(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 36000,
  });
}
export const actor = (u: Identity) => u.username || "Invitado #" + u.id;

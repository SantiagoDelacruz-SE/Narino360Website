import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE,
  signIn,
  guestSignIn,
  signOut,
  changePassword,
} from "@/lib/auth";
import {
  body,
  errorResponse,
  identity,
  sameOrigin,
  setSession,
} from "@/lib/http";
import { AppError, textField, passwordField } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json({ user: await identity() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const value = await body(request);
    if (value.action === "logout") {
      const token = (await cookies()).get(COOKIE)?.value;
      if (token) signOut(token);
      (await cookies()).delete(COOKIE);
      return NextResponse.json({ ok: true });
    }
    let token: string;
    if (value.action === "login")
      token = signIn(
        textField(value.username, "Usuario", 60),
        passwordField(value.password),
      );
    else if (value.action === "guest") token = guestSignIn(value);
    else if (value.action === "password")
      token = changePassword(
        await identity(),
        passwordField(value.current),
        passwordField(value.next),
      );
    else throw new AppError("Acción no válida.");
    await setSession(token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

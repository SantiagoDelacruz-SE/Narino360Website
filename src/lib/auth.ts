import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db, audit } from "./db";
import { AppError, textField, type Identity, type Role } from "./domain";
export const COOKIE = "narino360_session";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new AppError("Usa una contraseña de 12 a 128 caracteres.");
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  if (password.length > 128) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64),
    expected = Buffer.from(key, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
export function createUser(
  username: string,
  name: string,
  password: string,
  role: Exclude<Role, "Invitado">,
) {
  username = textField(username, "Usuario", 60).toLowerCase();
  if (
    !/^[a-z0-9._-]{3,60}$/.test(username) ||
    !["Administrador", "Editor"].includes(role)
  )
    throw new AppError("Usuario o rol no válido.");
  const result = db()
    .prepare(
      "INSERT INTO usuarios(username,name,password_hash,role) VALUES(?,?,?,?)",
    )
    .run(
      username,
      textField(name, "Nombre", 120),
      hashPassword(password),
      role,
    );
  audit("Sistema", "Configuración", "usuario.creado", username);
  return Number(result.lastInsertRowid);
}
export function makeSession(userId: number | null, guestId: number | null) {
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + 10 * 60 * 60 * 1000;
  db().prepare("DELETE FROM sesiones WHERE expires_at < ?").run(Date.now());
  db()
    .prepare("INSERT INTO sesiones VALUES(?,?,?,?)")
    .run(digest(token), userId, guestId, expires);
  return token;
}
export function sessionIdentity(token?: string): Identity | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db()
    .prepare(
      `SELECT s.user_id,s.guest_id,u.name,u.username,u.role,u.active,g.nombre,g.apellido FROM sesiones s LEFT JOIN usuarios u ON s.user_id=u.id LEFT JOIN registro_invitados g ON s.guest_id=g.id WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .get(digest(token), Date.now()) as
    | Record<string, string | number>
    | undefined;
  if (!row) return null;
  if (row.user_id && row.active)
    return {
      id: Number(row.user_id),
      name: String(row.name),
      username: String(row.username),
      role: row.role as Role,
    };
  if (row.guest_id)
    return {
      id: Number(row.guest_id),
      name: row.nombre + " " + row.apellido,
      role: "Invitado",
    };
  return null;
}
export function signIn(username: string, password: string) {
  username = textField(username, "Usuario", 60).toLowerCase();
  const now = Date.now(),
    d = db();
  const attempts = d
    .prepare("SELECT attempts,reset_at FROM intentos_login WHERE username=?")
    .get(username) as { attempts: number; reset_at: number } | undefined;
  if (attempts && attempts.reset_at > now && attempts.attempts >= 8)
    throw new AppError(
      "Demasiados intentos. Intenta de nuevo en 15 minutos.",
      429,
    );
  const u = d
    .prepare("SELECT * FROM usuarios WHERE username=? AND active=1")
    .get(username) as
    | { id: number; password_hash: string; role: Role }
    | undefined;
  const valid = verifyPassword(
    password,
    u?.password_hash ?? "00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!u || !valid) {
    d.prepare(
      "INSERT INTO intentos_login VALUES(?,1,?) ON CONFLICT(username) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
    ).run(username, now + 900000, now, now);
    audit(username, "Sin autenticar", "acceso.denegado");
    throw new AppError("Usuario o contraseña incorrectos.", 401);
  }
  d.prepare("DELETE FROM intentos_login WHERE username=?").run(username);
  audit(username, u.role, "sesion.iniciada");
  return makeSession(u.id, null);
}
export function guestSignIn(value: Record<string, unknown>) {
  const first = textField(value.firstName, "Nombre", 80),
    last = textField(value.lastName, "Apellido", 80),
    entity = textField(value.entity, "Entidad", 160),
    position = textField(value.position, "Cargo", 120);
  const id = Number(
    db()
      .prepare(
        "INSERT INTO registro_invitados(nombre,apellido,entidad,cargo) VALUES(?,?,?,?)",
      )
      .run(first, last, entity, position).lastInsertRowid,
  );
  audit("Invitado #" + id, "Invitado", "sesion.iniciada");
  return makeSession(null, id);
}
export function signOut(token: string) {
  const identity = sessionIdentity(token);
  if (identity)
    audit(
      identity.username || "Invitado #" + identity.id,
      identity.role,
      "sesion.cerrada",
    );
  db().prepare("DELETE FROM sesiones WHERE token_hash=?").run(digest(token));
}
export function changePassword(
  identity: Identity,
  current: string,
  next: string,
) {
  if (identity.role === "Invitado")
    throw new AppError("Acción reservada a funcionarios.", 403);
  const row = db()
    .prepare("SELECT password_hash FROM usuarios WHERE id=?")
    .get(identity.id) as { password_hash: string };
  if (!verifyPassword(current, row.password_hash))
    throw new AppError("La contraseña actual no es correcta.", 400);
  const hash = hashPassword(next);
  db()
    .prepare("UPDATE usuarios SET password_hash=? WHERE id=?")
    .run(hash, identity.id);
  db().prepare("DELETE FROM sesiones WHERE user_id=?").run(identity.id);
  audit(identity.username!, identity.role, "contraseña.actualizada");
  return makeSession(identity.id, null);
}

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import sharp from "sharp";
import { impactFixture } from "./impact-fixture";
import type { ImpactReport, Delivery } from "../src/lib/impact-domain";
import {
  MUNICIPALITIES,
  validateActivity,
  parseBulletin,
  recordTypeOf,
  assetComponent,
  COMPONENTS,
  type Asset,
} from "../src/lib/domain";
const temp = mkdtempSync(join(tmpdir(), "narino360-api-"));
const origin = "http://127.0.0.1:3138",
  password = randomBytes(20).toString("hex");
let server: ChildProcess,
  admin = "",
  editor = "",
  guest = "",
  activityId = 0,
  assetId = "";
let db: typeof import("../src/lib/db");
const activity = {
  title: "Jornada de prueba",
  date: "2026-10-15",
  municipality: "Pasto",
  program: "PISCC",
  latitude: 1.2136,
  longitude: -77.2811,
  people: 125,
  families: 30,
  weaponsSeized: 2,
  weaponsVoluntary: 3,
  objective: "Prevención y convivencia comunitaria",
  summary: "Jornada de diálogo, desarme y seguridad con jóvenes.",
  pisccGoal: "Meta de prueba",
  budgetApproved: 5000000,
  budgetExecuted: 2000000,
};
const request = (
  url: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  customOrigin = origin,
) =>
  fetch(origin + url, {
    method,
    headers: {
      origin: customOrigin,
      ...(cookie ? { cookie } : {}),
      ...(data instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
    },
    ...(data !== undefined
      ? { body: data instanceof FormData ? data : JSON.stringify(data) }
      : {}),
  });
async function login(username: string, pass = password) {
  const r = await request("/api/auth", "POST", {
    action: "login",
    username,
    password: pass,
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.headers.get("set-cookie")!.split(";")[0];
}
before(
  async () => {
    process.env.DATA_DIR = temp;
    const auth = await import("../src/lib/auth");
    db = await import("../src/lib/db");
    auth.createUser(
      "admin",
      "Administrador de prueba",
      password,
      "Administrador",
    );
    auth.createUser("editor", "Editor de prueba", password, "Editor");
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3138",
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATA_DIR: temp,
          APP_ORIGIN: origin,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let log = "";
    server.stdout?.on("data", (c) => {
      log += c;
    });
    server.stderr?.on("data", (c) => {
      log += c;
    });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(origin + "/acceso");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, log);
    admin = await login("admin");
    editor = await login("editor");
    const r = await request("/api/auth", "POST", {
      action: "guest",
      firstName: "Ana",
      lastName: "Prueba",
      entity: "Entidad de prueba",
      position: "Analista",
    });
    assert.equal(r.status, 200);
    guest = r.headers.get("set-cookie")!.split(";")[0];
  },
  { timeout: 30000 },
);
after(async () => {
  if (server) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", () => resolve());
    });
  }
  db?.db().close();
  rmSync(temp, { recursive: true, force: true });
});

test("Los componentes y tipos se guardan sin reclasificar registros anteriores; noticias sin coordenadas", async () => {
  assert.deepEqual(
    [...COMPONENTS],
    [
      "Observatorio",
      "PISCC",
      "Banco de Alimentos",
      "Cultivos para la Paz",
      "Acción Unificada",
    ],
  );
  assert.equal(recordTypeOf({}), "Actividad");
  const old = validateActivity(activity);
  assert.equal(old.recordType, "Actividad");
  assert.equal(
    assetComponent({ kind: "publicacion", program: "" } as Asset),
    "Observatorio",
  );
  assert.equal(
    assetComponent({ kind: "documento", program: "" } as Asset),
    null,
  );
  assert.equal(
    assetComponent({ kind: "documento", program: "", activityId: 4 } as Asset, [
      { id: 4, program: "PISCC" },
    ]),
    "PISCC",
  );
  for (const recordType of ["Actividad", "Operativo", "Feria", "Noticia"]) {
    const municipalReference = validateActivity({
      ...activity,
      recordType,
      latitude: null,
      longitude: null,
    });
    assert.equal(municipalReference.latitude, null);
    assert.equal(municipalReference.longitude, null);
    assert.equal(municipalReference.municipality, "Pasto");
  }
  for (const recordType of [null, "Otra cosa", 5])
    assert.throws(() => validateActivity({ ...activity, recordType }));
  assert.throws(() =>
    validateActivity({ ...activity, program: "Inexistente" }),
  );
  assert.throws(() =>
    validateActivity({
      ...activity,
      recordType: "Noticia",
      latitude: null,
      longitude: -77,
    }),
  );
  const ids: number[] = [];
  for (const [index, recordType] of [
    "Actividad",
    "Operativo",
    "Feria",
    "Noticia",
  ].entries()) {
    const value = {
      ...activity,
      title: "Tipo " + recordType,
      program: COMPONENTS[index],
      recordType,
      ...(recordType === "Noticia" ? { latitude: null, longitude: null } : {}),
    };
    const response = await request("/api/jornadas", "POST", value, admin);
    assert.equal(response.status, 201, await response.clone().text());
    const rows = (
      await (await request("/api/jornadas", "GET", undefined, admin)).json()
    ).activities;
    const saved = rows.find((a: { title: string }) => a.title === value.title);
    assert.equal(saved.recordType, recordType);
    assert.equal(saved.program, COMPONENTS[index]);
    if (recordType === "Noticia") assert.equal(saved.latitude, null);
    ids.push(saved.id);
  }
  for (const id of ids)
    assert.equal(
      (await request("/api/jornadas", "DELETE", { id }, admin)).status,
      200,
    );
});
test("Catálogo de 64 municipios únicos y extracción de reportes sin inventar datos", () => {
  assert.equal(MUNICIPALITIES.length, 64);
  assert.equal(new Set(MUNICIPALITIES).size, 64);
  const p = parseBulletin(
    "PISCC en Pasto. 15/10/2026. 125 personas y 30 familias. Coordenadas: 1.2136, -77.2811. 2 armas incautadas.",
  );
  assert.equal(p.municipality, "Pasto");
  assert.equal(p.date, "2026-10-15");
  assert.equal(p.people, 125);
  assert.equal(p.latitude, 1.2136);
  assert.equal(p.weaponsSeized, 2);
  assert.equal(parseBulletin("Reunión comunitaria").latitude, undefined);
  assert.equal(
    parseBulletin("Gobernación de Nariño. Jornada en Pasto.").municipality,
    undefined,
  );
  assert.equal(
    parseBulletin("Gobernación de Nariño. Municipio: Pasto.").municipality,
    "Pasto",
  );
  assert.throws(() => validateActivity({ ...activity, date: "2026-02-31" }));
  assert.throws(() =>
    validateActivity({ ...activity, budgetExecuted: 9000000 }),
  );
  assert.throws(() => validateActivity({ ...activity, latitude: null }));
});
test("Autenticación y autorización en servidor, incluido CSRF", async () => {
  assert.equal((await request("/api/jornadas")).status, 401);
  assert.equal(
    (await request("/api/jornadas", "POST", activity, guest)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "POST",
        activity,
        editor,
        "https://otro.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/auditoria", "GET", undefined, guest)).status,
    403,
  );
  assert.equal(
    (await request("/api/auditoria", "GET", undefined, editor)).status,
    403,
  );
  assert.equal(
    (await request("/api/usuarios", "POST", { username: "ataque" }, editor))
      .status,
    403,
  );
  assert.equal(
    (
      await request("/api/auth", "POST", {
        action: "login",
        username: "admin",
        password: "incorrecta",
      })
    ).status,
    401,
  );
});
test("Registro, edición, persistencia y consulta de jornadas", async () => {
  const r = await request("/api/jornadas", "POST", activity, editor);
  assert.equal(r.status, 201, await r.clone().text());
  const data = await (
    await request("/api/jornadas", "GET", undefined, guest)
  ).json();
  assert.equal(data.activities.length, 1);
  activityId = data.activities[0].id;
  assert.equal(data.activities[0].people, 125);
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "PUT",
        { ...activity, id: activityId, people: 150 },
        editor,
      )
    ).status,
    200,
  );
  assert.equal(db.listActivities()[0].people, 150);
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id: activityId }, editor))
      .status,
    403,
  );
});
test("Importación valida todo antes de insertar y rechaza números o JSON inválidos", async () => {
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "POST",
        [activity, { ...activity, people: -1 }],
        editor,
      )
    ).status,
    400,
  );
  assert.equal(db.listActivities().length, 1);
  assert.equal(
    (await request("/api/jornadas", "POST", null, editor)).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "POST",
        { ...activity, municipality: "Municipio inexistente" },
        editor,
      )
    ).status,
    400,
  );
});
test("Evidencias privadas, decodificación segura y presentación ordenable", async () => {
  const buffer = await sharp({
    create: { width: 160, height: 90, channels: 3, background: "#235947" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "image/png" }),
    "test.png",
  );
  form.set("kind", "diapositiva");
  form.set("title", "Diapositiva de prueba");
  const r = await request("/api/media", "POST", form, editor);
  assert.equal(r.status, 201, await r.clone().text());
  assetId = (await r.json()).asset.id;
  assert.equal((await request("/api/media/" + assetId)).status, 401);
  const image = await request("/api/media/" + assetId, "GET", undefined, guest);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.equal(
    (await request("/api/media", "PUT", { order: [assetId] }, editor)).status,
    200,
  );
  assert.equal(
    (await request("/api/media", "PUT", { order: ["bad"] }, editor)).status,
    400,
  );
  const invalid = new FormData();
  invalid.set("file", new Blob(["not an image"]), "bad.png");
  invalid.set("kind", "evidencia");
  invalid.set("title", "Inválida");
  assert.equal(
    (await request("/api/media", "POST", invalid, editor)).status,
    400,
  );
  const denied = new FormData();
  denied.set("file", new Blob([new Uint8Array(buffer)]), "test.png");
  denied.set("kind", "evidencia");
  denied.set("title", "No autorizado");
  assert.equal(
    (await request("/api/media", "POST", denied, guest)).status,
    403,
  );
});
test("Cambio autónomo de contraseña revoca otras sesiones y el hash no guarda texto plano", async () => {
  const oldSession = await login("editor");
  const next = randomBytes(24).toString("hex");
  const r = await request(
    "/api/auth",
    "POST",
    { action: "password", current: password, next },
    editor,
  );
  assert.equal(r.status, 200);
  editor = r.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await request("/api/auth", "GET", undefined, oldSession)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth", "POST", {
        action: "login",
        username: "editor",
        password,
      })
    ).status,
    401,
  );
  assert.ok(await login("editor", next));
  const row = db
    .db()
    .prepare("SELECT password_hash FROM usuarios WHERE username='editor'")
    .get() as { password_hash: string };
  assert.ok(!row.password_hash.includes(next));
  assert.match(row.password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
});
test("Auditoría registra acceso de invitados, inicio, edición y cambio de contraseña", async () => {
  const data = await (
    await request("/api/auditoria", "GET", undefined, admin)
  ).json();
  assert.equal(data.guests[0].entidad, "Entidad de prueba");
  for (const event of [
    "sesion.iniciada",
    "jornadas.creadas",
    "jornada.editada",
    "contraseña.actualizada",
  ])
    assert.ok(
      data.events.some((e: { event: string }) => e.event === event),
      event,
    );
});
test("Cierre de sesión y eliminación administrativa", async () => {
  assert.equal(
    (await request("/api/media", "DELETE", { id: assetId }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/api/media/" + assetId, "GET", undefined, guest)).status,
    404,
  );
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id: activityId }, admin))
      .status,
    200,
  );
  assert.equal(db.listActivities().length, 0);
  assert.equal(
    (await request("/api/auth", "POST", { action: "logout" }, guest)).status,
    200,
  );
  assert.equal(
    (await request("/api/auth", "GET", undefined, guest)).status,
    401,
  );
});

test("El administrador crea funcionarios y las contraseñas preservan sus espacios", async () => {
  const spacedPassword = "  Clave-Con-Espacios-2026  ";
  const user = {
    username: "nuevo-editor",
    name: "Nueva funcionaria",
    password: spacedPassword,
    role: "Editor",
  };
  assert.equal(
    (await request("/api/usuarios", "POST", user, admin)).status,
    201,
  );
  assert.equal(
    (await request("/api/usuarios", "POST", user, admin)).status,
    409,
  );
  const cookie = await login(user.username, spacedPassword);
  const identity = await (
    await request("/api/auth", "GET", undefined, cookie)
  ).json();
  assert.equal(identity.user.role, "Editor");
  assert.equal(
    (
      await request("/api/auth", "POST", {
        action: "login",
        username: user.username,
        password: spacedPassword.trim(),
      })
    ).status,
    401,
  );
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await request("/api/auth", "POST", {
          action: "login",
          username: "usuario-inexistente",
          password: "incorrecta",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/api/auth", "POST", {
        action: "login",
        username: "usuario-inexistente",
        password: "incorrecta",
      })
    ).status,
    429,
  );
});

test("Los soportes PDF se descargan con autenticación y no se ejecutan en el visor", async () => {
  const form = new FormData();
  form.set(
    "file",
    new Blob(["%PDF-1.4\n% Soporte de prueba\n%%EOF"], {
      type: "application/pdf",
    }),
    "soporte.pdf",
  );
  form.set("kind", "documento");
  form.set("title", "Soporte de prueba");
  const upload = await request("/api/media", "POST", form, admin);
  assert.equal(upload.status, 201);
  const id = (await upload.json()).asset.id;
  const response = await request("/api/media/" + id, "GET", undefined, admin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(response.headers.get("content-security-policy"), "sandbox");
  assert.equal((await request("/api/media/" + id)).status, 401);
  assert.equal(
    (await request("/api/media", "DELETE", { id }, admin)).status,
    200,
  );
});

test("El Observatorio guarda las seis categorías y permite descargas privadas de PDF", async () => {
  const { PUBLICATION_TYPES } = await import("../src/lib/domain");
  const login = await request("/api/auth", "POST", {
    action: "guest",
    firstName: "Consulta",
    lastName: "Observatorio",
    entity: "Pruebas",
    position: "Invitado",
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const ids: string[] = [];
  for (const category of PUBLICATION_TYPES) {
    const data = new FormData();
    data.set("kind", "publicacion");
    data.set("title", category + " de prueba");
    data.set("caption", "Producto institucional de prueba");
    data.set("publicationType", category);
    data.set("publicationDate", "2026-11-05");
    data.set(
      "file",
      new Blob(["%PDF-1.4\n% Prueba\n%%EOF"], { type: "application/pdf" }),
      "boletin.pdf",
    );
    assert.equal(
      (await request("/api/media", "POST", data, cookie)).status,
      403,
    );
    const result = await request("/api/media", "POST", data, editor);
    assert.equal(result.status, 201, await result.clone().text());
    const { asset } = await result.json();
    assert.equal(asset.publicationType, category);
    assert.equal(asset.publicationDate, "2026-11-05");
    ids.push(asset.id);
    const download = await request(
      "/api/media/" + asset.id,
      "GET",
      undefined,
      cookie,
    );
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-type"), "application/pdf");
    assert.match(download.headers.get("content-disposition")!, /^attachment;/);
    assert.equal((await request("/api/media/" + asset.id)).status, 401);
  }
  const { assets } = await (
    await request("/api/media", "GET", undefined, cookie)
  ).json();
  assert.equal(
    assets.filter((a: { kind: string }) => a.kind === "publicacion").length,
    6,
  );
  const { readAssets } = await import("../src/lib/media");
  assert.equal(readAssets().filter((a) => a.kind === "publicacion").length, 6);
  for (const id of ids)
    assert.equal(
      (await request("/api/media", "DELETE", { id }, editor)).status,
      200,
    );
});

test("El Observatorio rechaza categorías, fechas y archivos no válidos", async () => {
  const form = (
    category = "Boletín diario",
    date = "2026-11-05",
    pdf = true,
  ) => {
    const data = new FormData();
    data.set("kind", "publicacion");
    data.set("title", "Validación de prueba");
    data.set("publicationType", category);
    data.set("publicationDate", date);
    data.set(
      "file",
      new Blob([pdf ? "%PDF-1.4\n%%EOF" : "not a PDF"]),
      "boletin.pdf",
    );
    return data;
  };
  for (const data of [
    form("Anual"),
    form(""),
    form("Boletín diario", "2026-02-31"),
    form("Boletín diario", ""),
    form("Boletín diario", "2026-11-05", false),
  ])
    assert.equal(
      (await request("/api/media", "POST", data, editor)).status,
      400,
    );
  assert.equal(
    (await request("/api/media", "GET", undefined, admin)).status,
    200,
  );
});

test("Las jornadas nuevas no necesitan campos presupuestales", () => {
  const { budgetApproved, budgetExecuted, ...current } = activity;
  assert.ok(budgetApproved > 0 && budgetExecuted > 0);
  const validated = validateActivity(current);
  assert.equal(validated.budgetApproved, 0);
  assert.equal(validated.budgetExecuted, 0);
});

test("Una diapositiva JPEG se convierte, persiste y devuelve identificador de diagnóstico", async () => {
  const jpeg = await sharp({
    create: { width: 6000, height: 3375, channels: 3, background: "#FFD500" },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  const form = new FormData();
  form.set("kind", "diapositiva");
  form.set("title", "Portada JPEG de prueba");
  form.set(
    "file",
    new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }),
    "01_portada.jpg",
  );
  const response = await request("/api/media", "POST", form, admin);
  assert.equal(response.status, 201, await response.clone().text());
  assert.match(response.headers.get("x-request-id")!, /^[a-f0-9-]{36}$/);
  const { asset } = await response.json();
  const image = await request(
    "/api/media/" + asset.id,
    "GET",
    undefined,
    admin,
  );
  assert.equal(image.status, 200);
  const originalBytes = Buffer.from(await image.arrayBuffer());
  const metadata = await sharp(originalBytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 4096);
  assert.equal(metadata.height, 2304);
  const thumbnail = await request(
    "/api/media/" + asset.id + "?size=thumbnail",
    "GET",
    undefined,
    admin,
  );
  assert.equal(thumbnail.status, 200);
  const previewBytes = Buffer.from(await thumbnail.arrayBuffer());
  const previewMetadata = await sharp(previewBytes).metadata();
  assert.equal(previewMetadata.width, 640);
  assert.equal(previewMetadata.height, 360);
  assert.equal(thumbnail.headers.get("cache-control"), "private, no-cache");
  assert.match(thumbnail.headers.get("vary")!, /cookie/i);
  assert.ok(
    previewBytes.length < originalBytes.length,
    "La miniatura debe transferir menos bytes que la imagen HD.",
  );
  const etag = thumbnail.headers.get("etag")!;
  const cached = await fetch(
    origin + "/api/media/" + asset.id + "?size=thumbnail",
    { headers: { cookie: admin, "if-none-match": etag } },
  );
  assert.equal(cached.status, 304);
  assert.equal(await cached.text(), "");
  const denied = await fetch(
    origin + "/api/media/" + asset.id + "?size=thumbnail",
    { headers: { "if-none-match": etag } },
  );
  assert.equal(denied.status, 401);
  const { thumbnailPath } = await import("../src/lib/images");
  const { existsSync } = await import("node:fs");
  const previewPath = thumbnailPath(asset.filename);
  assert.ok(existsSync(previewPath));
  rmSync(previewPath);
  const legacy = await Promise.all(
    [1, 2, 3].map(() =>
      request(
        "/api/media/" + asset.id + "?size=thumbnail",
        "GET",
        undefined,
        admin,
      ),
    ),
  );
  for (const response of legacy) assert.equal(response.status, 200);
  assert.ok(existsSync(previewPath));
  assert.equal(
    (await request("/api/media", "DELETE", { id: asset.id }, admin)).status,
    200,
  );
  assert.equal(existsSync(previewPath), false);
});

test("Reintentos simultáneos con el mismo identificador guardan una sola diapositiva", async () => {
  const png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#10A13B" },
  })
    .png()
    .toBuffer();
  const uploadId = randomUUID();
  const upload = (
    kind = "diapositiva",
    id: string = uploadId,
    cookie = admin,
  ) => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", "Diapositiva con carga recuperable");
    form.set("uploadId", id);
    form.set(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "reintento.png",
    );
    return request("/api/media", "POST", form, cookie);
  };
  const responses = await Promise.all([upload(), upload(), upload()]);
  const ids = [];
  for (const response of responses) {
    assert.ok(
      response.status === 200 || response.status === 201,
      await response.clone().text(),
    );
    ids.push((await response.json()).asset.id);
  }
  assert.equal(new Set(ids).size, 1);
  const saved = (
    await (await request("/api/media", "GET", undefined, admin)).json()
  ).assets;
  assert.equal(
    saved.filter((a: { uploadId: string }) => a.uploadId === uploadId).length,
    1,
  );
  assert.equal((await upload()).status, 200);
  assert.equal((await upload("evidencia")).status, 409);
  assert.equal((await upload("diapositiva", "no-valido")).status, 400);
  const visitor = await request("/api/auth", "POST", {
    action: "guest",
    firstName: "Ana",
    lastName: "Prueba",
    entity: "Entidad",
    position: "Analista",
  });
  assert.equal(visitor.status, 200);
  const visitorCookie = visitor.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await upload("diapositiva", uploadId, visitorCookie)).status,
    403,
  );
  assert.equal(
    (await request("/api/media", "DELETE", { id: ids[0] }, admin)).status,
    200,
  );
});

test("Consulta usa credenciales, lee contenidos y cambia su contraseña, sin permisos de gestión", async () => {
  const account = {
    username: "gobernador-prueba",
    name: "Gobernador de prueba",
    role: "Consulta",
    password,
  };
  assert.equal(
    (await request("/api/usuarios", "POST", account, admin)).status,
    201,
  );
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "POST",
        { ...account, username: "rol-invalido", role: "Superusuario" },
        admin,
      )
    ).status,
    400,
  );
  const cookie = await login(account.username);
  const otherSession = await login(account.username);
  assert.equal(
    (await (await request("/api/auth", "GET", undefined, cookie)).json()).user
      .role,
    "Consulta",
  );
  assert.equal(
    (await request("/api/jornadas", "POST", activity, admin)).status,
    201,
  );
  const activities = (
    await (await request("/api/jornadas", "GET", undefined, cookie)).json()
  ).activities;
  const id = activities[0].id;
  const png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#10A13B" },
  })
    .png()
    .toBuffer();
  const mediaForm = (kind: string) => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", "Contenido para consulta");
    if (kind === "publicacion") {
      form.set("publicationType", "Boletín diario");
      form.set("publicationDate", "2026-11-06");
    }
    form.set(
      "file",
      kind === "publicacion" || kind === "documento"
        ? new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" })
        : new Blob([new Uint8Array(png)], { type: "image/png" }),
      "archivo",
    );
    return form;
  };
  const assets = [];
  for (const kind of ["diapositiva", "publicacion"]) {
    const saved = await request("/api/media", "POST", mediaForm(kind), admin);
    assert.equal(saved.status, 201);
    assets.push((await saved.json()).asset);
  }
  assert.equal(
    (await request("/api/media", "GET", undefined, cookie)).status,
    200,
  );
  for (const asset of assets) {
    const download = await request(
      "/api/media/" + asset.id,
      "GET",
      undefined,
      cookie,
    );
    assert.equal(download.status, 200);
    assert.ok((await download.arrayBuffer()).byteLength > 0);
  }
  assert.equal(
    (
      await request(
        "/api/media/" + assets[0].id + "?size=thumbnail",
        "GET",
        undefined,
        cookie,
      )
    ).status,
    200,
  );
  for (const [path, method, data] of [
    ["/api/jornadas", "POST", activity],
    ["/api/jornadas", "POST", [activity]],
    ["/api/jornadas", "PUT", { ...activity, id }],
    ["/api/jornadas", "DELETE", { id }],
    ["/api/media", "PUT", { order: [assets[0].id] }],
    ["/api/media", "DELETE", { id: assets[0].id }],
    ["/api/usuarios", "GET", undefined],
    [
      "/api/usuarios",
      "POST",
      { ...account, username: "auto-administrador", role: "Administrador" },
    ],
    ["/api/auditoria", "GET", undefined],
  ] as const)
    assert.equal(
      (await request(path, method, data, cookie)).status,
      403,
      method + " " + path,
    );
  for (const kind of ["diapositiva", "evidencia", "documento", "publicacion"])
    assert.equal(
      (await request("/api/media", "POST", mediaForm(kind), cookie)).status,
      403,
    );
  const next = randomBytes(20).toString("hex");
  const changed = await request(
    "/api/auth",
    "POST",
    { action: "password", current: password, next },
    cookie,
  );
  assert.equal(changed.status, 200);
  const renewed = changed.headers.get("set-cookie")!.split(";")[0];
  assert.equal(
    (await request("/api/auth", "GET", undefined, cookie)).status,
    401,
  );
  assert.equal(
    (await request("/api/auth", "GET", undefined, otherSession)).status,
    401,
  );
  assert.equal(
    (await request("/api/jornadas", "GET", undefined, renewed)).status,
    200,
  );
  const newLogin = await login(account.username, next);
  assert.equal(
    (await request("/api/media", "DELETE", { id: assets[0].id }, newLogin))
      .status,
    403,
  );
  const audit = (
    await (await request("/api/auditoria", "GET", undefined, admin)).json()
  ).events;
  assert.ok(
    audit.some(
      (e: { actor: string; role: string; event: string }) =>
        e.actor === account.username &&
        e.role === "Consulta" &&
        e.event === "sesion.iniciada",
    ),
  );
  assert.ok(
    audit.some(
      (e: { actor: string; role: string; event: string }) =>
        e.actor === account.username &&
        e.role === "Consulta" &&
        e.event === "contraseña.actualizada",
    ),
  );
  assert.equal(
    (await request("/api/jornadas", "GET", undefined, newLogin)).status,
    200,
  );
  for (const asset of assets)
    assert.equal(
      (await request("/api/media", "DELETE", { id: asset.id }, admin)).status,
      200,
    );
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id }, admin)).status,
    200,
  );
});

test("Solo el administrador edita cuentas; los cambios de acceso revocan sesiones y conservan la contraseña", async () => {
  const user = {
    username: "gestion-prueba",
    name: "Funcionaria inicial",
    password,
    role: "Editor",
  };
  assert.equal(
    (await request("/api/usuarios", "POST", user, admin)).status,
    201,
  );
  const users = (
    await (await request("/api/usuarios", "GET", undefined, admin)).json()
  ).users;
  const target = users.find(
    (u: { username: string }) => u.username === user.username,
  );
  const initial = {
    id: target.id,
    name: target.name,
    role: target.role,
    active: true,
  };
  const session = await login(user.username),
    otherSession = await login(user.username);
  const database = db.db();
  const hash = database
    .prepare("SELECT password_hash FROM usuarios WHERE id=?")
    .get(target.id)!.password_hash;
  const activities = db.listActivities();
  const files = (
    await (await request("/api/media", "GET", undefined, admin)).json()
  ).assets;
  assert.equal((await request("/api/usuarios", "PUT", initial)).status, 401);
  assert.equal(
    (await request("/api/usuarios", "PUT", initial, session)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "PUT",
        initial,
        admin,
        "https://otro.example",
      )
    ).status,
    403,
  );
  for (const invalid of [
    { ...initial, id: "1" },
    { ...initial, id: 0 },
    { ...initial, role: "Invitado" },
    { ...initial, role: "Superusuario" },
    { ...initial, active: 1 },
    { ...initial, active: "false" },
    { ...initial, name: "" },
  ])
    assert.equal(
      (await request("/api/usuarios", "PUT", invalid, admin)).status,
      400,
    );
  assert.equal(
    (await request("/api/usuarios", "PUT", { ...initial, id: 999999 }, admin))
      .status,
    404,
  );
  const same = await request("/api/usuarios", "PUT", initial, admin);
  assert.equal(same.status, 200);
  assert.equal((await same.json()).accessChanged, false);
  const renamed = await request(
    "/api/usuarios",
    "PUT",
    { ...initial, name: "Secretaria de prueba" },
    admin,
  );
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).accessChanged, false);
  assert.equal(
    (await (await request("/api/auth", "GET", undefined, session)).json()).user
      .name,
    "Secretaria de prueba",
  );
  const changed = await request(
    "/api/usuarios",
    "PUT",
    { ...initial, name: "Secretaria de prueba", role: "Consulta" },
    admin,
  );
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), {
    ok: true,
    accessChanged: true,
    relogin: false,
  });
  for (const cookie of [session, otherSession])
    assert.equal(
      (await request("/api/auth", "GET", undefined, cookie)).status,
      401,
    );
  const readOnly = await login(user.username);
  assert.equal(
    (await (await request("/api/auth", "GET", undefined, readOnly)).json()).user
      .role,
    "Consulta",
  );
  assert.equal(
    (await request("/api/usuarios", "PUT", initial, readOnly)).status,
    403,
  );
  assert.equal(
    (await request("/api/jornadas", "POST", activity, readOnly)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "PUT",
        { ...initial, role: "Consulta", active: false },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/auth", "GET", undefined, readOnly)).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth", "POST", {
        action: "login",
        username: user.username,
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "PUT",
        { ...initial, role: "Consulta" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/auth", "GET", undefined, readOnly)).status,
    401,
    "Reactivar no debe restaurar sesiones revocadas.",
  );
  const activated = await login(user.username);
  assert.equal(
    (await request("/api/media", "GET", undefined, activated)).status,
    200,
  );
  assert.equal(
    database
      .prepare("SELECT password_hash FROM usuarios WHERE id=?")
      .get(target.id)!.password_hash,
    hash,
  );
  assert.deepEqual(db.listActivities(), activities);
  assert.deepEqual(
    (await (await request("/api/media", "GET", undefined, admin)).json())
      .assets,
    files,
  );
  const events = (
    await (await request("/api/auditoria", "GET", undefined, admin)).json()
  ).events;
  const event = events.find(
    (e: { event: string; detail: string }) =>
      e.event === "usuario.actualizado" &&
      JSON.parse(e.detail).username === user.username &&
      JSON.parse(e.detail).after.active === false,
  );
  assert.equal(event.actor, "admin");
  assert.equal(JSON.parse(event.detail).sessionsRevoked, true);
  assert.ok(!event.detail.includes(password));
});

test("Se conserva un administrador activo ante cambios propios y solicitudes concurrentes", async () => {
  const database = db.db();
  const row = database
    .prepare("SELECT id,name FROM usuarios WHERE username='admin'")
    .get()!;
  const original = {
    id: Number(row.id),
    name: String(row.name),
    role: "Administrador",
    active: true,
  };
  const backup = {
    username: "admin-respaldo",
    name: "Administrador de respaldo",
    password,
    role: "Administrador",
  };
  assert.equal(
    (await request("/api/usuarios", "POST", backup, admin)).status,
    201,
  );
  const backupId = Number(
    database
      .prepare("SELECT id FROM usuarios WHERE username=?")
      .get(backup.username)!.id,
  );
  const backupValue = {
    id: backupId,
    name: backup.name,
    role: "Administrador",
    active: false,
  };
  assert.equal(
    (await request("/api/usuarios", "PUT", backupValue, admin)).status,
    200,
  );
  for (const change of [
    { ...original, role: "Consulta" },
    { ...original, active: false },
  ]) {
    const rejected = await request("/api/usuarios", "PUT", change, admin);
    assert.equal(rejected.status, 409);
    assert.match((await rejected.json()).error, /administrador activo/);
  }
  assert.equal(
    (await request("/api/usuarios", "GET", undefined, admin)).status,
    200,
    "Un cambio rechazado conserva la sesión del administrador.",
  );
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "PUT",
        { ...backupValue, active: true },
        admin,
      )
    ).status,
    200,
  );
  const backupSession = await login(backup.username);
  const responses = await Promise.all([
    request("/api/usuarios", "PUT", { ...original, role: "Consulta" }, admin),
    request(
      "/api/usuarios",
      "PUT",
      { ...backupValue, role: "Consulta", active: true },
      backupSession,
    ),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  for (const response of responses)
    if (response.status === 200)
      assert.equal((await response.json()).relogin, true);
  const remaining = database
    .prepare(
      "SELECT username FROM usuarios WHERE role='Administrador' AND active=1",
    )
    .all();
  assert.equal(remaining.length, 1);
  const remainingSession =
    remaining[0].username === "admin" ? admin : backupSession;
  assert.equal(
    (await request("/api/usuarios", "PUT", original, remainingSession)).status,
    200,
  );
  admin = await login("admin");
  assert.equal(
    (
      await request(
        "/api/usuarios",
        "PUT",
        { ...backupValue, role: "Consulta" },
        admin,
      )
    ).status,
    200,
  );
});

test("Impactos y entregas: acceso, importación atómica sin duplicar jornadas, edición y vínculos persistentes", async () => {
  const auth = await import("../src/lib/auth");
  auth.createUser("impact-editor", "Editor de impacto", password, "Editor");
  auth.createUser(
    "impact-consulta",
    "Consulta de impacto",
    password,
    "Consulta",
  );
  const impactEditor = await login("impact-editor"),
    consulta = await login("impact-consulta");
  const guestLogin = await request("/api/auth", "POST", {
    action: "guest",
    firstName: "Invitado",
    lastName: "Impactos",
    entity: "Entidad de prueba",
    position: "Consulta",
  });
  assert.equal(guestLogin.status, 200);
  const impactGuest = guestLogin.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await request("/api/impactos")).status, 401);
  assert.equal((await request("/api/entregas?reportId=1")).status, 401);
  const bundle = impactFixture("prueba-importacion-" + randomUUID());
  for (const cookie of [impactGuest, consulta]) {
    assert.equal(
      (await request("/api/impactos", "POST", bundle, cookie)).status,
      403,
    );
    assert.equal(
      (await request("/api/impactos", "GET", undefined, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/entregas?reportId=1", "GET", undefined, cookie))
        .status,
      200,
    );
    assert.equal(
      (await request("/api/entregas", "POST", {}, cookie)).status,
      403,
    );
  }
  assert.equal(
    (
      await request(
        "/api/impactos",
        "POST",
        bundle,
        admin,
        "https://otro.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/entregas", "PUT", {}, admin, "https://otro.example"))
      .status,
    403,
  );
  const before = db.listActivities();
  const imported = await request("/api/impactos", "POST", bundle, impactEditor);
  assert.equal(imported.status, 201, await imported.clone().text());
  const reportId = (await imported.json()).id;
  assert.deepEqual(db.listActivities(), before);
  let report: ImpactReport = (
    await (await request("/api/impactos", "GET", undefined, consulta)).json()
  ).reports.find((r: ImpactReport) => r.id === reportId);
  assert.equal(report.deliveryCount, 49);
  assert.equal(report.periodStatus, "Pendiente");
  assert.equal(
    report.lines.reduce((n, l) => n + l.people, 0),
    1000,
  );
  let deliveries: Delivery[] = (
    await (
      await request(
        "/api/entregas?reportId=" + reportId,
        "GET",
        undefined,
        consulta,
      )
    ).json()
  ).deliveries;
  assert.equal(deliveries.length, 49);
  for (let i = 0; i < 2; i++) {
    const result = await request(
      "/api/entregas",
      "POST",
      {
        ...bundle.deliveries[0],
        reportId,
        actNumber: "",
        title: "Entrega sin acta " + i,
      },
      impactEditor,
    );
    assert.equal(result.status, 201);
  }
  const withoutActs = (
    await (
      await request(
        "/api/entregas?reportId=" + reportId,
        "GET",
        undefined,
        admin,
      )
    ).json()
  ).deliveries as Delivery[];
  assert.equal(withoutActs.filter((d) => d.actNumber === "").length, 2);
  assert.equal(deliveries[0].sourceDateText, "13 de agosto de 20206");
  assert.equal(
    (await request("/api/impactos", "POST", bundle, admin)).status,
    409,
  );
  const bad = impactFixture("bad-" + randomUUID());
  bad.deliveries[48].lineId = "inexistente";
  const reportsBefore = (
    await (await request("/api/impactos", "GET", undefined, admin)).json()
  ).reports.length;
  assert.equal(
    (await request("/api/impactos", "POST", bad, admin)).status,
    400,
  );
  assert.equal(
    (await (await request("/api/impactos", "GET", undefined, admin)).json())
      .reports.length,
    reportsBefore,
  );
  const missing = {
    ...activity,
    title: "Jornada sin cifra individual",
    people: null,
  };
  assert.equal(
    (await request("/api/jornadas", "POST", missing, admin)).status,
    201,
  );
  const journey = db.listActivities().find((a) => a.title === missing.title)!;
  assert.equal(journey.people, null);
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "POST",
        {
          ...missing,
          title: "Otra jornada respaldada por la misma acta",
          program: "Cultivos para la Paz",
        },
        admin,
      )
    ).status,
    201,
  );
  const secondJourney = db
    .listActivities()
    .find((a) => a.title === "Otra jornada respaldada por la misma acta")!;
  const updated = {
    ...deliveries[0],
    activityIds: [journey.id, secondJourney.id],
    dates: ["2026-05-20"],
    municipalities: ["Pasto", "Tumaco"],
    items: [{ product: "Arroz", quantity: 2, unit: "bultos" }],
    reviewStatus: "Revisada",
  };
  assert.equal(
    (await request("/api/entregas", "PUT", updated, impactEditor)).status,
    200,
  );
  assert.equal(
    db.listActivities().find((a) => a.id === journey.id)!.people,
    null,
  );
  assert.equal(db.listActivities().length, before.length + 2);
  const linked = (
    await (
      await request(
        "/api/entregas?reportId=" + reportId,
        "GET",
        undefined,
        admin,
      )
    ).json()
  ).deliveries as Delivery[];
  assert.deepEqual(
    linked.find((d) => d.id === updated.id)!.activityIds,
    [journey.id, secondJourney.id].sort((a, b) => a - b),
  );
  assert.equal(
    (
      await request(
        "/api/entregas",
        "PUT",
        { ...deliveries[1], activityIds: [journey.id, secondJourney.id] },
        impactEditor,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/api/entregas",
        "POST",
        { ...updated, actNumber: "1" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/api/entregas",
        "PUT",
        { ...updated, lineId: "otra" },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/entregas",
        "PUT",
        { ...updated, activityIds: [99999999] },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/impactos",
        "PUT",
        { ...report, lines: report.lines.slice(1) },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/api/impactos",
        "PUT",
        {
          ...report,
          periodStatus: "Confirmado",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
        },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/api/impactos",
        "PUT",
        {
          ...report,
          periodStatus: "Confirmado",
          periodStart: "2026-01-01",
          periodEnd: "2026-12-31",
        },
        impactEditor,
      )
    ).status,
    200,
  );
  report = {
    ...report,
    periodStatus: "Confirmado",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
  };
  assert.equal(
    (
      await request(
        "/api/entregas",
        "PUT",
        { ...updated, dates: ["2027-01-01"] },
        admin,
      )
    ).status,
    400,
  );
  for (const cookie of [impactEditor, consulta, impactGuest]) {
    assert.equal(
      (await request("/api/impactos", "DELETE", { id: reportId }, cookie))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/entregas", "DELETE", { id: updated.id }, cookie))
        .status,
      403,
    );
  }
  const upload = new FormData();
  upload.set("kind", "documento");
  upload.set("title", "Soporte de informe");
  upload.set("program", "Banco de Alimentos");
  upload.set(
    "file",
    new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
    "soporte.pdf",
  );
  const pdf = await request("/api/media", "POST", upload, admin);
  assert.equal(pdf.status, 201);
  const pdfId = (await pdf.json()).asset.id;
  assert.equal(
    (
      await request(
        "/api/impactos",
        "PUT",
        { ...report, sourceAssetId: pdfId },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/media", "DELETE", { id: pdfId }, admin)).status,
    409,
  );
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id: journey.id }, admin))
      .status,
    200,
  );
  deliveries = (
    await (
      await request(
        "/api/entregas?reportId=" + reportId,
        "GET",
        undefined,
        admin,
      )
    ).json()
  ).deliveries;
  assert.deepEqual(deliveries.find((d) => d.id === updated.id)!.activityIds, [
    secondJourney.id,
  ]);
  assert.equal(
    (await request("/api/entregas", "DELETE", { id: updated.id }, admin))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/impactos", "DELETE", { id: reportId }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/api/media", "DELETE", { id: pdfId }, admin)).status,
    200,
  );
  assert.equal(
    (
      await (
        await request(
          "/api/entregas?reportId=" + reportId,
          "GET",
          undefined,
          admin,
        )
      ).json()
    ).deliveries.length,
    0,
  );
  assert(db.listActivities().some((a) => a.id === secondJourney.id));
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id: secondJourney.id }, admin))
      .status,
    200,
  );
  assert.deepEqual(db.listActivities(), before);
  assert(
    (db
      .db()
      .prepare(
        "SELECT COUNT(*) AS n FROM registro_accesos_usuarios WHERE event='impacto.importado'",
      )
      .get()!.n as number) > 0,
  );
});

test("Un fallo dentro de la importación revierte informe y entregas, sin dejar un lote parcial", async () => {
  const database = db.db();
  const before = database
    .prepare("SELECT COUNT(*) AS n FROM impactos_informes")
    .get()!.n;
  database.exec(
    "CREATE TRIGGER rechazar_acta_prueba BEFORE INSERT ON donacion_entregas WHEN NEW.act_number='002' BEGIN SELECT RAISE(ABORT,'Fallo de prueba'); END",
  );
  try {
    const response = await request(
      "/api/impactos",
      "POST",
      impactFixture("rollback-" + randomUUID(), 3),
      admin,
    );
    assert.equal(response.status, 500);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS n FROM impactos_informes").get()!.n,
      before,
    );
    assert.equal(
      database.prepare("SELECT COUNT(*) AS n FROM donacion_entregas").get()!.n,
      0,
    );
  } finally {
    database.exec("DROP TRIGGER rechazar_acta_prueba");
  }
});

test("Una actividad con varios municipios se persiste una sola vez; la edición conserva el ID y los clientes antiguos no pierden destinos", async () => {
  const before = db.listActivities();
  const destinations = [
    "Linares",
    "Guaitarilla",
    "El Peñol",
    "La Florida",
    "Taminango",
    "Policarpa",
    "Buesaco",
    "Belén",
    "Arboleda",
  ];
  const input = {
    ...activity,
    title: "Actividad sintética con nueve municipios",
    program: "Banco de Alimentos",
    municipality: "Pasto",
    municipalities: [...destinations, "Linares"],
    people: 90,
    families: 9,
  };
  const saved = await request("/api/jornadas", "POST", input, admin);
  assert.equal(saved.status, 201, await saved.clone().text());
  assert.equal((await saved.json()).count, 1);
  const record = db.listActivities().find((a) => a.title === input.title)!;
  assert.equal(db.listActivities().length, before.length + 1);
  assert.deepEqual(record.municipalities, destinations);
  assert.equal(record.municipality, "Linares");
  assert.equal(record.people, 90);
  assert.equal(record.latitude, activity.latitude);
  const read = (
    await (await request("/api/jornadas", "GET", undefined, admin)).json()
  ).activities.find((a: { id: number }) => a.id === record.id);
  assert.deepEqual(read.municipalities, destinations);
  const { municipalities: _members, ...legacy } = record;
  void _members;
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "PUT",
        { ...legacy, title: input.title + " editada" },
        admin,
      )
    ).status,
    200,
  );
  assert.deepEqual(
    db.listActivities().find((a) => a.id === record.id)!.municipalities,
    destinations,
  );
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "PUT",
        { ...legacy, municipality: "Tumaco" },
        admin,
      )
    ).status,
    409,
  );
  const value = { ...record, municipalities: ["Belén", "Arboleda"] };
  assert.equal(
    (await request("/api/jornadas", "PUT", value, admin)).status,
    200,
  );
  const updated = db.listActivities().find((a) => a.id === record.id)!;
  assert.deepEqual(updated.municipalities, ["Belén", "Arboleda"]);
  assert.equal(updated.municipality, "Belén");
  assert.equal(updated.people, 90);
  assert.equal(db.listActivities().length, before.length + 1);
  for (const invalid of [[], ["Bogotá"], null]) {
    assert.equal(
      (
        await request(
          "/api/jornadas",
          "PUT",
          { ...updated, municipalities: invalid },
          admin,
        )
      ).status,
      400,
    );
    assert.deepEqual(
      db.listActivities().find((a) => a.id === record.id),
      updated,
    );
  }
  assert.equal(
    (
      await request(
        "/api/jornadas",
        "PUT",
        { ...updated, municipalities: ["Belén"] },
        admin,
      )
    ).status,
    200,
  );
  assert.deepEqual(
    db.listActivities().find((a) => a.id === record.id)!.municipalities,
    ["Belén"],
  );
  assert.equal(
    (await request("/api/jornadas", "DELETE", { id: record.id }, admin)).status,
    200,
  );
  assert.deepEqual(db.listActivities(), before);
});

test("FONSET conserva costos exactos, estados libres, permisos y persistencia sin duplicar envíos", async () => {
  const auth = await import("../src/lib/auth");
  auth.createUser("fonset-editor", "Editor FONSET", password, "Editor");
  auth.createUser("fonset-consulta", "Consulta FONSET", password, "Consulta");
  const fonsetEditor = await login("fonset-editor"),
    consulta = await login("fonset-consulta");
  const invited = await request("/api/auth", "POST", {
    action: "guest",
    firstName: "Invitado",
    lastName: "FONSET",
    entity: "Entidad de prueba",
    position: "Consulta",
  });
  assert.equal(invited.status, 200);
  const fonsetGuest = invited.headers.get("set-cookie")!.split(";")[0];
  const before = db.listActivities();
  const input = {
    name: "Proyecto sintético FONSET",
    objective: "Mejorar la convivencia mediante un proyecto de prueba",
    cost: "125000000.50",
    status: "En revisión del comité",
    submissionId: randomUUID(),
  };
  assert.equal((await request("/api/fonset")).status, 401);
  for (const cookie of [consulta, fonsetGuest]) {
    assert.equal(
      (await request("/api/fonset", "GET", undefined, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/fonset", "POST", input, cookie)).status,
      403,
    );
    assert.equal(
      (await request("/api/fonset", "PUT", { ...input, id: 1 }, cookie)).status,
      403,
    );
    assert.equal(
      (await request("/api/fonset", "DELETE", { id: 1 }, cookie)).status,
      403,
    );
  }
  assert.equal(
    (await request("/api/fonset", "POST", input, admin, "https://otro.example"))
      .status,
    403,
  );
  const created = await request("/api/fonset", "POST", input, fonsetEditor);
  assert.equal(created.status, 201, await created.clone().text());
  const initial = (await created.json()).project;
  assert.equal(initial.costCents, 12500000050);
  assert.equal(initial.status, input.status);
  assert.equal(initial.author, "fonset-editor");
  const repeated = await request("/api/fonset", "POST", input, fonsetEditor);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).project.id, initial.id);
  assert.equal(
    (await request("/api/fonset", "POST", { ...input, cost: "100" }, admin))
      .status,
    409,
  );
  const list = await request("/api/fonset", "GET", undefined, consulta);
  assert.match(list.headers.get("cache-control")!, /private/);
  assert.equal((await list.json()).projects.length, 1);
  for (const change of [
    { cost: "1.001" },
    { cost: -1 },
    { cost: "1.000.000" },
    { status: "" },
    { objective: "" },
    { submissionId: "invalido" },
  ])
    assert.equal(
      (await request("/api/fonset", "POST", { ...input, ...change }, admin))
        .status,
      400,
    );
  assert.equal(
    (
      await request(
        "/api/fonset",
        "PUT",
        { ...input, id: initial.id, cost: "1.001" },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    db
      .db()
      .prepare("SELECT cost_cents FROM fonset_proyectos WHERE id=?")
      .get(initial.id)!.cost_cents,
    12500000050,
  );
  const updated = {
    ...input,
    id: initial.id,
    name: "Proyecto actualizado FONSET",
    objective: "Objetivo actualizado sin alterar jornadas",
    cost: "130000000.75",
    status: "Finalizado por comité",
  };
  assert.equal(
    (await request("/api/fonset", "PUT", updated, fonsetEditor)).status,
    200,
  );
  const persisted = db
    .db()
    .prepare("SELECT * FROM fonset_proyectos WHERE id=?")
    .get(initial.id)!;
  assert.equal(persisted.cost_cents, 13000000075);
  assert.equal(persisted.status, updated.status);
  assert.equal(
    (await request("/api/fonset", "PUT", { ...updated, id: 99999999 }, admin))
      .status,
    404,
  );
  assert.equal(
    (await request("/api/fonset", "DELETE", { id: initial.id }, fonsetEditor))
      .status,
    403,
  );
  const event = db
    .db()
    .prepare(
      "SELECT detail FROM registro_accesos_usuarios WHERE event='fonset.proyecto_actualizado' ORDER BY id DESC LIMIT 1",
    )
    .get()!;
  const detail = JSON.parse(String(event.detail));
  assert.equal(detail.before.costCents, 12500000050);
  assert.equal(detail.after.costCents, 13000000075);
  assert.equal(detail.objectiveChanged, true);
  assert.equal(
    (await request("/api/fonset", "DELETE", { id: initial.id }, admin)).status,
    200,
  );
  assert.equal(
    (await request("/api/fonset", "DELETE", { id: initial.id }, admin)).status,
    404,
  );
  const zero = await request(
    "/api/fonset",
    "POST",
    { ...input, submissionId: randomUUID(), cost: 0 },
    admin,
  );
  assert.equal(zero.status, 201);
  const zeroId = (await zero.json()).project.id;
  assert.equal(
    (await request("/api/fonset", "DELETE", { id: zeroId }, admin)).status,
    200,
  );
  assert.deepEqual(db.listActivities(), before);
  assert.equal(
    (await (await request("/api/fonset", "GET", undefined, admin)).json())
      .projects.length,
    0,
  );
});

test("Un fallo de auditoría revierte la creación del proyecto FONSET", async () => {
  const database = db.db();
  const before = database
    .prepare("SELECT COUNT(*) AS n FROM fonset_proyectos")
    .get()!.n;
  database.exec(
    "CREATE TRIGGER fonset_fallo_auditoria BEFORE INSERT ON registro_accesos_usuarios WHEN NEW.event='fonset.proyecto_creado' BEGIN SELECT RAISE(ABORT,'Fallo de prueba'); END",
  );
  try {
    const result = await request(
      "/api/fonset",
      "POST",
      {
        name: "Proyecto de prueba",
        objective: "Probar operación atómica",
        cost: "1.25",
        status: "Estado de prueba",
      },
      admin,
    );
    assert.equal(result.status, 500);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS n FROM fonset_proyectos").get()!.n,
      before,
    );
  } finally {
    database.exec("DROP TRIGGER fonset_fallo_auditoria");
  }
});

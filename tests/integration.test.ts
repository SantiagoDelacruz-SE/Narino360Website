import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import sharp from "sharp";
import {
  MUNICIPALITIES,
  validateActivity,
  parseBulletin,
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

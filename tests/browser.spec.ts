import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { pdfFixture } from "./pdf-fixture";
test("Funcionario registra jornada, carga evidencias y usa el carrusel", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page).toHaveURL(/acceso/);
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-empty.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Nueva jornada", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Título del registro")
    .fill("Encuentro comunitario de prueba");
  await dialog.getByLabel("Fecha", { exact: true }).fill("2026-10-15");
  await dialog
    .getByRole("combobox", { name: "Municipio", exact: true })
    .selectOption("Pasto");
  await dialog
    .getByRole("combobox", { name: "Componente", exact: true })
    .selectOption("PISCC");
  await dialog.getByLabel("Latitud").fill("1.2136");
  await dialog.getByLabel("Longitud").fill("-77.2811");
  await dialog.getByLabel("Personas beneficiadas").fill("125");
  await dialog.getByLabel("Familias beneficiadas").fill("30");
  await dialog.getByLabel("Armas incautadas").fill("2");
  await dialog.getByLabel("Armas entregadas voluntariamente").fill("3");
  await dialog
    .getByLabel("Objetivo", { exact: true })
    .fill("Fortalecer la convivencia y el diálogo comunitario");
  await dialog
    .getByLabel("Resumen operativo y resultados")
    .fill("Jornada de desarme, convivencia y participación de jóvenes.");
  await expect(dialog.getByLabel("Presupuesto aprobado")).toHaveCount(0);
  await expect(dialog.getByLabel("Presupuesto ejecutado")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Registrar jornada", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Encuentro comunitario de prueba",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mapa de calor", exact: true })
    .click();
  await expect(page.locator(".leaflet-heatmap-layer")).toBeVisible();
  await page.getByRole("button", { name: "Marcadores", exact: true }).click();
  await expect(page.locator(".territory-marker")).toBeVisible();
  await page
    .getByRole("button", { name: "Mural de evidencias", exact: true })
    .click();
  await page.getByRole("button", { name: "Cargar fotografías" }).click();
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Evidencia de prueba");
  const png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#367d59" },
  })
    .png()
    .toBuffer();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "evidencia.png",
    mimeType: "image/png",
    buffer: png,
  });
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evidencia de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver en alta definición" }).click();
  await expect(dialog.locator("img")).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Presentación estratégica", exact: true })
    .click();
  await expect(
    page.getByText("Estas son plantillas de orientación", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cargar diapositivas" }).click();
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Presentación de prueba");
  await dialog.locator('input[type="file"]').setInputFiles([
    { name: "uno.png", mimeType: "image/png", buffer: png },
    { name: "dos.png", mimeType: "image/png", buffer: png },
  ]);
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".slide-counter")).toHaveText("1 / 2");
  await page.getByRole("button", { name: "Diapositiva siguiente" }).click();
  await expect(page.locator(".slide-counter")).toHaveText("2 / 2");
  await page.getByRole("button", { name: "Mover antes" }).click();
  await expect(page.locator(".slide-counter")).toHaveText("1 / 2");
  await page.locator(".presentation-viewer").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".slide-counter")).toHaveText("2 / 2");
  await expect(
    page.getByRole("button", { name: "Control presupuestal", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analítica textual", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Jornadas y actividades", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar datos" }).click();
  expect((await download).suggestedFilename()).toBe("narino360-jornadas.csv");
  await page
    .getByRole("button", { name: "Auditoría de accesos", exact: true })
    .click();
  await expect(
    page.getByText("jornadas.creadas", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("Invitado consulta desde móvil sin opciones de escritura", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Invitado", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("María");
  await page.getByLabel("Apellido", { exact: true }).fill("Prueba");
  await page.getByLabel("Entidad u organización").fill("Entidad invitada");
  await page.getByLabel("Cargo o vínculo").fill("Analista");
  await page
    .getByRole("button", { name: "Registrar ingreso y continuar" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nueva jornada", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".leaflet-map")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("button", { name: "Mural de evidencias", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "El territorio, en imágenes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cargar fotografías" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/acceso/);
  expect(errors).toEqual([]);
});

test("Observatorio permite publicar, filtrar, descargar y eliminar boletines", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir componente Observatorio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Boletines y productos del observatorio",
    }),
  ).toBeVisible();
  await expect(page.locator(".heading-actions")).toBeHidden();
  for (const item of [
    {
      title: "Boletín semanal de convivencia",
      type: "Boletín semanal",
      date: "2026-11-05",
    },
    {
      title: "Balance mensual de seguridad",
      type: "Boletín mensual",
      date: "2026-11-01",
    },
  ]) {
    await page
      .getByRole("button", { name: "Cargar publicación", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título", { exact: true }).fill(item.title);
    await dialog
      .getByLabel("Descripción o fuente")
      .fill("Publicación de prueba del observatorio");
    await dialog
      .getByRole("combobox", { name: "Tipo de publicación", exact: true })
      .selectOption(item.type);
    await dialog
      .getByLabel("Fecha de publicación", { exact: true })
      .fill(item.date);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "boletin.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% Producto de prueba\n%%EOF"),
    });
    await dialog
      .getByRole("button", { name: "Cargar archivos", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await expect(page.locator(".publication-card")).toHaveCount(2);
  await page
    .locator(".publication-category")
    .filter({ hasText: "Boletín semanal" })
    .click();
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Boletín semanal de convivencia" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar publicación", exact: true })
    .fill("sin coincidencia");
  await expect(page.locator(".publication-card")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Buscar publicación", exact: true })
    .fill("");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole("button", { name: "Restablecer", exact: true }).click();
  await page
    .getByLabel("Publicaciones hasta", { exact: true })
    .fill("2026-11-04");
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Balance mensual de seguridad" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restablecer", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("observatorio-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Eliminar publicación Boletín semanal de convivencia",
      exact: true,
    })
    .click();
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Balance mensual de seguridad" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.locator(".sidebar").evaluate((e) => e.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("observatorio-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/acceso/);
  await page.getByRole("button", { name: "Invitado", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Consulta");
  await page.getByLabel("Apellido", { exact: true }).fill("Prueba");
  await page.getByLabel("Entidad u organización").fill("Pruebas");
  await page.getByLabel("Cargo o vínculo").fill("Analista");
  await page
    .getByRole("button", { name: "Registrar ingreso y continuar" })
    .click();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir componente Observatorio", exact: true })
    .click();
  await expect(page.locator(".publication-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Cargar publicación", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".publication-delete")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("El mapa identifica su origen, carga teselas válidas y maneja 403 sin dibujar imágenes de bloqueo", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const tile = await sharp({
    create: { width: 256, height: 256, channels: 3, background: "#80BEFF" },
  })
    .png()
    .toBuffer();
  let mode: "ok" | "blocked" | "offline" = "ok";
  const requests: {
    referer: string | undefined;
    cookie: string | undefined;
  }[] = [];
  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    const headers = route.request().headers();
    requests.push({ referer: headers.referer, cookie: headers.cookie });
    if (mode === "offline") {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      status: mode === "blocked" ? 403 : 200,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
      body: tile,
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto("/acceso");
  expect(response!.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await page.evaluate(async () => {
    const result = await fetch("/api/jornadas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Jornada de prueba cartográfica",
        date: "2026-11-05",
        municipality: "Pasto",
        program: "PISCC",
        latitude: 1.2136,
        longitude: -77.2811,
        people: 10,
        families: 2,
        weaponsSeized: 0,
        weaponsVoluntary: 0,
        objective: "Prueba del mapa",
        summary: "Registro temporal para probar cartografía",
        pisccGoal: "",
      }),
    });
    return result.status;
  });
  expect(saved).toBe(201);
  await page.reload();
  const images = page.locator(".leaflet-tile-pane img.leaflet-tile-loaded");
  await expect.poll(() => images.count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      images.first().evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(256);
  expect(requests.length).toBeGreaterThan(0);
  expect(
    requests.every((r) => r.referer === "http://127.0.0.1:3139/" && !r.cookie),
  ).toBe(true);
  await expect(page.locator(".map-feedback")).toHaveCount(0);
  const count = requests.length;
  await page.locator(".leaflet-control-zoom-in").click();
  await expect.poll(() => requests.length).toBeGreaterThan(count);
  mode = "blocked";
  await page.reload();
  await expect(
    page.getByText("Mapa base no disponible", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-feedback")).toContainText("HTTP 403");
  await expect(page.locator(".leaflet-tile-pane img")).toHaveCount(0);
  await page.getByRole("button", { name: "Marcadores", exact: true }).click();
  await expect
    .poll(() => page.locator(".territory-marker").count())
    .toBeGreaterThan(0);
  await page.locator(".map-panel").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("mapa-error-controlado.png"),
    fullPage: true,
    animations: "disabled",
  });
  mode = "ok";
  await page
    .getByRole("button", { name: "Reintentar mapa", exact: true })
    .click();
  await expect.poll(() => images.count()).toBeGreaterThan(0);
  await expect(page.locator(".map-feedback")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mapa de calor", exact: true })
    .click();
  await expect(page.locator(".leaflet-heatmap-layer")).toBeVisible();
  await expect.poll(() => images.count()).toBeGreaterThan(0);
  mode = "offline";
  await page.reload();
  await expect(page.locator(".map-feedback")).toContainText(
    "No se pudo conectar",
  );
  await expect(page.locator(".leaflet-tile-pane img")).toHaveCount(0);
  mode = "ok";
  await page
    .getByRole("button", { name: "Reintentar mapa", exact: true })
    .click();
  await expect.poll(() => images.count()).toBeGreaterThan(0);
  await expect(page.locator(".map-feedback")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("La administración valida usuarios con puntos y guiones sin errores de expresión regular", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  let reads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/usuarios") && request.method() === "GET")
      reads++;
  });
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mi cuenta y acceso", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(reads).toBe(0);
  await dialog
    .getByText("Gestionar cuentas institucionales", { exact: true })
    .click();
  await expect(dialog.locator(".user-list strong").first()).toBeVisible();
  expect(reads).toBe(1);
  const username = dialog.getByLabel("Usuario", { exact: true });
  await username.fill("nombre invalido");
  expect(
    await username.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await username.fill("editor.local-prueba_26");
  expect(
    await username.evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true);
  await dialog
    .getByLabel("Nombre completo", { exact: true })
    .fill("Funcionario de prueba de formulario");
  await dialog
    .getByLabel("Contraseña inicial", { exact: true })
    .fill("Solo-Pruebas-Form-2026");
  await dialog
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(
    dialog.getByText("Cuenta creada.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".user-list")).toContainText(
    "editor.local-prueba_26",
  );
  expect(
    errors.filter((message) =>
      /Pattern attribute|Invalid regular expression/.test(message),
    ),
  ).toEqual([]);
});

test("Los errores y tiempos de espera de usuarios no recargan la página y las solicitudes se cancelan", async ({
  page,
}) => {
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  let documentRequests = 0,
    failedRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentRequests++;
  });
  page.on("requestfailed", (request) => {
    if (request.url().endsWith("/api/usuarios")) failedRequests++;
  });
  let mode: "unavailable" | "hung" | "expired" = "unavailable";
  await page.route("**/api/usuarios", async (route) => {
    if (mode === "hung") return;
    if (mode === "expired") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "La sesión expiró. Ingresa nuevamente.",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "<html>Service unavailable</html>",
    });
  });
  async function openAccounts() {
    await page
      .getByRole("button", { name: "Mi cuenta y acceso", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const request = page.waitForRequest((r) =>
      r.url().endsWith("/api/usuarios"),
    );
    await dialog
      .getByText("Gestionar cuentas institucionales", { exact: true })
      .click();
    await request;
    return dialog;
  }
  let dialog = await openAccounts();
  await expect(dialog.getByRole("alert")).toContainText(
    "El servidor no está disponible",
  );
  expect(documentRequests).toBe(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  mode = "hung";
  await page.clock.install();
  dialog = await openAccounts();
  await page.clock.fastForward(30001);
  await expect(dialog.getByRole("alert")).toContainText(
    "El servidor no respondió a tiempo",
  );
  await expect(
    dialog.getByRole("button", { name: "Crear cuenta", exact: true }),
  ).toBeEnabled();
  expect(documentRequests).toBe(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  const beforeCancel = failedRequests;
  dialog = await openAccounts();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect.poll(() => failedRequests).toBeGreaterThan(beforeCancel);
  mode = "expired";
  await page.context().clearCookies();
  dialog = await openAccounts();
  await expect(dialog.getByRole("alert")).toContainText("La sesión expiró");
  expect(documentRequests).toBe(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Volver a ingresar", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Volver a ingresar", exact: true })
    .click();
  await expect(page).toHaveURL(/acceso/);
});

test("Las diapositivas grandes se rechazan antes de subir y un JPEG válido se guarda", async ({
  page,
}) => {
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page
    .getByRole("button", { name: "Presentación estratégica", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cargar diapositivas", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Portada JPEG de prueba");
  let uploads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/media") && request.method() === "POST")
      uploads++;
  });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "portada-muy-grande.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(15 * 1024 * 1024 + 1),
  });
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("supera los 15 MB");
  expect(uploads).toBe(0);
  await expect(
    dialog.getByRole("button", { name: "Cargar archivos", exact: true }),
  ).toBeEnabled();
  const jpeg = await sharp({
    create: { width: 1920, height: 1080, channels: 3, background: "#FFD500" },
  })
    .jpeg()
    .toBuffer();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "01_portada.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(uploads).toBe(1);
  await expect(page.locator(".slide-thumbnails")).toContainText(
    "Portada JPEG de prueba",
  );
});

test("Una respuesta perdida se confirma sin repetir la subida; un corte previo conserva el formulario", async ({
  page,
}) => {
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page
    .getByRole("button", { name: "Presentación estratégica", exact: true })
    .click();
  let mode: "lost-response" | "not-sent" = "lost-response",
    posts = 0;
  await page.route("**/api/media", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posts++;
    if (mode === "lost-response") {
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
    }
    await route.abort("connectionreset");
  });
  const png = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: "#10A13B" },
  })
    .png()
    .toBuffer();
  async function upload(title: string) {
    await page
      .getByRole("button", { name: "Cargar diapositivas", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título", { exact: true }).fill(title);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "conexion.png",
      mimeType: "image/png",
      buffer: png,
    });
    await dialog
      .getByRole("button", { name: "Cargar archivos", exact: true })
      .click();
    return dialog;
  }
  let dialog = await upload("Respuesta perdida de prueba");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".slide-thumbnails")).toContainText(
    "Respuesta perdida de prueba",
  );
  expect(posts).toBe(1);
  const confirmed = await page.evaluate(async () => {
    const response = await fetch("/api/media");
    return (await response.json()).assets.filter(
      (a: { title: string }) => a.title === "Respuesta perdida de prueba",
    );
  });
  expect(confirmed).toHaveLength(1);
  expect(confirmed[0].uploadId).toMatch(/^[a-f0-9-]{36}$/);
  const previews = page.locator(".slide-thumbnails img");
  await expect(previews.first()).toHaveAttribute("src", /\?size=thumbnail$/);
  await expect(previews.first()).toHaveAttribute("loading", "lazy");
  mode = "not-sent";
  dialog = await upload("Solicitud no recibida de prueba");
  await expect(dialog.getByRole("alert")).toContainText("No se pudo confirmar");
  await expect(
    dialog.getByRole("button", { name: "Reanudar pendientes", exact: true }),
  ).toBeEnabled();
  expect(posts).toBe(2);
  const missing = await page.evaluate(async () => {
    const response = await fetch("/api/media");
    return (await response.json()).assets.filter(
      (a: { title: string }) => a.title === "Solicitud no recibida de prueba",
    ).length;
  });
  expect(missing).toBe(0);
});

test("54 diapositivas se ordenan, se preparan y se reanudan tras perder una confirmación sin duplicados", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page
    .getByRole("button", { name: "Presentación estratégica", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cargar diapositivas", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Serie de 54 de prueba");
  const jpeg = await sharp({
    create: { width: 6000, height: 3375, channels: 3, background: "#FFD500" },
  })
    .jpeg()
    .toBuffer();
  const png = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#10A13B" },
  })
    .png()
    .toBuffer();
  await dialog.locator('input[type="file"]').setInputFiles(
    Array.from({ length: 54 }, (_, i) => {
      const number = 54 - i;
      return {
        name: number + (number === 1 ? ".jpg" : ".png"),
        mimeType: number === 1 ? "image/jpeg" : "image/png",
        buffer: number === 1 ? jpeg : png,
      };
    }),
  );
  let posts = 0,
    loseConfirmation = false;
  const names: string[] = [];
  await page.route("**/api/media", async (route) => {
    if (route.request().method() !== "POST") {
      if (loseConfirmation) {
        loseConfirmation = false;
        await route.abort("connectionreset");
      } else await route.continue();
      return;
    }
    posts++;
    const form = await new Response(
      new Uint8Array(route.request().postDataBuffer()!),
      {
        headers: { "content-type": route.request().headers()["content-type"] },
      },
    ).formData();
    const file = form.get("file") as File;
    names.push(file.name);
    if (posts === 1) {
      const metadata = await sharp(
        Buffer.from(await file.arrayBuffer()),
      ).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(4096);
      expect(metadata.height).toBe(2304);
      expect(file.size).toBeLessThan(jpeg.length);
    }
    if (posts === 6) {
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
      loseConfirmation = true;
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "5 de 54 archivos confirmados",
    { timeout: 30000 },
  );
  expect(posts).toBe(6);
  await expect(dialog.getByLabel("Título", { exact: true })).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Reanudar pendientes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible({ timeout: 60000 });
  expect(posts).toBe(54);
  expect(names).toEqual(
    Array.from({ length: 54 }, (_, i) => i + 1 + (i === 0 ? ".jpg" : ".png")),
  );
  const saved = await page.evaluate(async () => {
    const { assets } = await (await fetch("/api/media")).json();
    return assets.filter((a: { title: string }) =>
      a.title.startsWith("Serie de 54 de prueba · "),
    );
  });
  expect(saved).toHaveLength(54);
  expect(new Set(saved.map((a: { uploadId: string }) => a.uploadId)).size).toBe(
    54,
  );
  expect(saved.map((a: { title: string }) => a.title)).toEqual(
    Array.from({ length: 54 }, (_, i) => "Serie de 54 de prueba · " + (i + 1)),
  );
});

test("El administrador crea una cuenta Consulta y el funcionario navega sin controles de edición", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page
    .getByRole("button", { name: "Mi cuenta y acceso", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByText("Gestionar cuentas institucionales", { exact: true })
    .click();
  await expect(dialog.locator(".user-list strong").first()).toBeVisible();
  await dialog
    .getByLabel("Nombre completo", { exact: true })
    .fill("Secretaria de prueba");
  await dialog
    .getByLabel("Usuario", { exact: true })
    .fill("secretaria-consulta");
  await dialog.getByLabel("Rol", { exact: true }).selectOption("Consulta");
  await dialog
    .getByLabel("Contraseña inicial", { exact: true })
    .fill("Clave-Consulta-Prueba-2026");
  await dialog
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(
    dialog.getByText("Cuenta creada.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".user-list")).toContainText(
    "secretaria-consulta · Consulta",
  );
  const slide = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#10A13B" },
  })
    .png()
    .toBuffer();
  const saved = await page.request.post("/api/media", {
    headers: { origin: new URL(page.url()).origin },
    multipart: {
      kind: "diapositiva",
      title: "Presentación para la cuenta Consulta",
      file: { name: "consulta.png", mimeType: "image/png", buffer: slide },
    },
  });
  expect(saved.status()).toBe(201);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByLabel("Usuario", { exact: true }).fill("secretaria-consulta");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Consulta-Prueba-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Auditoría de accesos", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Nueva jornada", exact: true }),
  ).toHaveCount(0);
  for (const tab of [
    "FONSET",
    "Jornadas y actividades",
    "Mural de evidencias",
    "Presentación estratégica",
    "Componentes",
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: /^(Cargar|Editar|Eliminar|Mover antes|Mover después|Nueva jornada)/,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Importar jornadas", { exact: true }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("button", { name: "Presentación estratégica", exact: true })
    .click();
  await expect(page.locator(".slide-thumbnails")).toBeVisible();
  await page.locator(".slide-thumbnails button").last().click();
  await expect(page.locator(".slide-thumbnails button").last()).toHaveClass(
    /active/,
  );
  await page
    .getByRole("button", { name: "Mi cuenta y acceso", exact: true })
    .click();
  await expect(
    dialog.getByText("Tu cuenta es de solo lectura.", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Gestionar cuentas institucionales", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Contraseña actual", { exact: true })
    .fill("Clave-Consulta-Prueba-2026");
  await dialog
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Clave-Consulta-Nueva-2026");
  await dialog
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Clave-Consulta-Nueva-2026");
  await dialog
    .getByRole("button", { name: "Actualizar contraseña", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Contraseña actualizada",
  );
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByLabel("Usuario", { exact: true }).fill("secretaria-consulta");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Consulta-Nueva-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Observatorio de Paz, Seguridad y Convivencia",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("El administrador edita rol y estado desde la web, revoca sesiones y conserva su propio acceso", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await page
    .getByRole("button", { name: "Mi cuenta y acceso", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByText("Gestionar cuentas institucionales", { exact: true })
    .click();
  await expect(dialog.locator(".user-list strong").first()).toBeVisible();
  await dialog
    .getByLabel("Nombre completo", { exact: true })
    .fill("Funcionaria editable");
  await dialog.getByLabel("Usuario", { exact: true }).fill("acceso-editable");
  await dialog.getByLabel("Rol", { exact: true }).selectOption("Editor");
  await dialog
    .getByLabel("Contraseña inicial", { exact: true })
    .fill("Clave-Gestion-Prueba-2026");
  await dialog
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Cuenta creada");
  const origin = new URL(page.url()).origin;
  const visitor = await browser.newPage();
  try {
    async function loginVisitor() {
      await visitor.goto(origin + "/acceso");
      await visitor
        .getByLabel("Usuario", { exact: true })
        .fill("acceso-editable");
      await visitor
        .getByLabel("Contraseña", { exact: true })
        .fill("Clave-Gestion-Prueba-2026");
      await visitor
        .getByRole("button", { name: "Ingresar al observatorio" })
        .click();
    }
    await loginVisitor();
    await expect(
      visitor.getByRole("button", { name: "Nueva jornada", exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", {
        name: "Editar acceso de acceso-editable",
        exact: true,
      })
      .click();
    let edit = dialog.getByRole("form", {
      name: "Editar acceso de acceso-editable",
      exact: true,
    });
    await edit
      .getByLabel("Nombre completo", { exact: true })
      .fill("Secretaria de consulta");
    await edit
      .getByLabel("Rol de acceso", { exact: true })
      .selectOption("Consulta");
    await edit
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText(
      "Sus sesiones se cerraron",
    );
    expect((await visitor.request.get(origin + "/api/auth")).status()).toBe(
      401,
    );
    await loginVisitor();
    await expect(
      visitor.getByRole("heading", {
        name: "Observatorio de Paz, Seguridad y Convivencia",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      visitor.getByRole("button", { name: "Nueva jornada", exact: true }),
    ).toHaveCount(0);
    await dialog
      .getByRole("button", {
        name: "Editar acceso de acceso-editable",
        exact: true,
      })
      .click();
    edit = dialog.getByRole("form", {
      name: "Editar acceso de acceso-editable",
      exact: true,
    });
    await edit.getByLabel("Cuenta activa", { exact: true }).uncheck();
    await page.screenshot({
      path: testInfo.outputPath("edicion-accesos.png"),
      fullPage: true,
      animations: "disabled",
    });
    await edit
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText(
      "Cuenta actualizada",
    );
    await expect(
      dialog.locator(".user-list > div").filter({ hasText: "acceso-editable" }),
    ).toContainText("Inactiva");
    expect((await visitor.request.get(origin + "/api/auth")).status()).toBe(
      401,
    );
    await loginVisitor();
    await expect(visitor.getByRole("alert")).toBeVisible();
    await dialog
      .getByRole("button", {
        name: "Editar acceso de acceso-editable",
        exact: true,
      })
      .click();
    edit = dialog.getByRole("form", {
      name: "Editar acceso de acceso-editable",
      exact: true,
    });
    await edit.getByLabel("Cuenta activa", { exact: true }).check();
    await edit
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toContainText(
      "Cuenta actualizada",
    );
    await loginVisitor();
    await expect(
      visitor.getByRole("heading", {
        name: "Observatorio de Paz, Seguridad y Convivencia",
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByRole("button", {
        name: "Editar acceso de admin-prueba",
        exact: true,
      })
      .click();
    const own = dialog.getByRole("form", {
      name: "Editar acceso de admin-prueba",
      exact: true,
    });
    await own
      .getByLabel("Rol de acceso", { exact: true })
      .selectOption("Consulta");
    await own
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "administrador activo",
    );
    await own
      .getByRole("button", { name: "Cancelar edición", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", {
        name: "Editar acceso de admin-prueba",
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    await visitor.close();
  }
});

test("FONSET y componentes distinguen operativos y ferias; los PDF se leen con páginas y zoom sin ejecutar scripts", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    errors.push("PDF ejecutó un diálogo: " + dialog.message());
    await dialog.dismiss();
  });
  await page.goto("/acceso");
  await page.getByLabel("Usuario", { exact: true }).fill("admin-prueba");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Clave-Solo-Pruebas-2026");
  await page.getByRole("button", { name: "Ingresar al observatorio" }).click();
  await expect(page.locator(".map-container")).toHaveClass(/heat-view/);
  await expect(page.locator(".leaflet-heatmap-layer")).toBeVisible();
  await expect(page.locator(".heat-scale")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mapa territorial", exact: true }),
  ).toHaveCount(0);
  const kpi = (label: string) =>
    page.locator(".kpi-card").filter({ hasText: label }).locator(".kpi-value");
  const before = Number(
    (await kpi("Actividades ejecutadas").innerText()).replace(/\./g, ""),
  );
  await page.getByRole("button", { name: "FONSET", exact: true }).click();
  await expect(
    page.getByText("En construcción", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Presupuesto y proyectos FONSET",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-map")).toHaveCount(0);
  await expect(page.locator(".heading-actions")).toBeHidden();
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await expect(page.locator(".component-card")).toHaveCount(5);
  await page.screenshot({
    path: testInfo.outputPath("componentes-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Abrir componente PISCC", exact: true })
    .click();
  for (const item of [
    {
      tab: "Operativos",
      type: "Operativo",
      title: "Operativo territorial PISCC",
      municipality: "Pasto",
      lat: "1.2136",
      lng: "-77.2811",
    },
    {
      tab: "Ferias",
      type: "Feria",
      title: "Feria de servicios PISCC",
      municipality: "Ipiales",
      lat: "0.83",
      lng: "-77.64",
    },
    {
      tab: "Noticias",
      type: "Noticia",
      title: "Noticia relevante PISCC",
      municipality: "Tumaco",
      lat: "",
      lng: "",
    },
  ]) {
    await page.getByRole("tab", { name: item.tab, exact: true }).click();
    await page
      .getByRole("button", {
        name:
          item.type === "Noticia"
            ? "Publicar noticia"
            : "Registrar " + item.type.toLowerCase(),
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Tipo de registro", { exact: true }),
    ).toHaveValue(item.type);
    await expect(dialog.getByLabel("Componente", { exact: true })).toHaveValue(
      "PISCC",
    );
    await dialog
      .getByLabel("Título del registro", { exact: true })
      .fill(item.title);
    await dialog.getByLabel("Fecha", { exact: true }).fill("2026-11-09");
    await dialog
      .getByLabel("Municipio", { exact: true })
      .selectOption(item.municipality);
    if (item.type !== "Noticia") {
      await dialog.getByLabel("Latitud", { exact: true }).fill(item.lat);
      await dialog.getByLabel("Longitud", { exact: true }).fill(item.lng);
    }
    await dialog
      .getByLabel("Objetivo", { exact: true })
      .fill("Comunicar y registrar la gestión institucional");
    await dialog
      .getByLabel("Resumen operativo y resultados", { exact: true })
      .fill("Contenido verificable para " + item.title);
    await dialog
      .getByRole("button", {
        name:
          item.type === "Noticia"
            ? "Publicar noticia"
            : "Registrar " + item.type.toLowerCase(),
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: item.title, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Vista general", exact: true })
    .click();
  await expect(kpi("Operativos ejecutados")).toHaveText("1");
  await expect(kpi("Actividades ejecutadas")).toHaveText(String(before + 1));
  await page.locator(".map-panel").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("mapa-calor-contraste.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Abrir componente Banco de Alimentos",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Operativos", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Operativo territorial PISCC",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Todos los componentes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Abrir componente PISCC", exact: true })
    .click();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await page
    .getByRole("button", { name: "Cargar publicación", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Componente del archivo", { exact: true }),
  ).toHaveValue("PISCC");
  await dialog
    .getByLabel("Título", { exact: true })
    .fill("Documento PISCC de dos páginas");
  await dialog
    .getByLabel("Tipo de publicación", { exact: true })
    .selectOption("Otros productos");
  await dialog
    .getByLabel("Fecha de publicación", { exact: true })
    .fill("2026-11-09");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "producto.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await dialog
    .getByRole("button", { name: "Cargar archivos", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Previsualizar PDF Documento PISCC de dos páginas",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("status")).toHaveText("Página 1 de 2");
  const canvas = dialog.locator("canvas");
  await expect
    .poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width))
    .toBeGreaterThan(300);
  await expect
    .poll(() =>
      canvas.evaluate((c: HTMLCanvasElement) => {
        const pixels = c
          .getContext("2d")!
          .getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] < 180 && pixels[i + 3] > 200) return true;
        return false;
      }),
    )
    .toBe(true);
  await dialog
    .getByRole("button", { name: "Página siguiente", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("Página 2 de 2");
  await expect(
    dialog.getByRole("button", { name: "Página siguiente", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Zoom del PDF", { exact: true }).selectOption("1.5");
  await page.screenshot({
    path: testInfo.outputPath("pdf-previsualizacion.png"),
    fullPage: true,
    animations: "disabled",
  });
  const download = page.waitForEvent("download");
  await dialog
    .getByRole("link", { name: "Descargar PDF", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  const assets = (await (await page.request.get("/api/media")).json()).assets;
  const pdf = assets.find(
    (a: { title: string }) => a.title === "Documento PISCC de dos páginas",
  );
  const origin = new URL(page.url()).origin;
  const anonymous = await browser.newContext();
  try {
    expect(
      (await anonymous.request.get(origin + "/api/media/" + pdf.id)).status(),
    ).toBe(401);
  } finally {
    await anonymous.close();
  }
  // A PDF with no component is an existing Observatorio product.
  const legacy = await page.request.post("/api/media", {
    headers: { origin },
    multipart: {
      kind: "publicacion",
      title: "Boletín previo a componentes",
      publicationType: "Boletín diario",
      publicationDate: "2026-11-09",
      file: {
        name: "legado.pdf",
        mimeType: "application/pdf",
        buffer: pdfFixture(),
      },
    },
  });
  expect(legacy.status()).toBe(201);
  const visitor = await page.request.post("/api/auth", {
    headers: { origin },
    data: {
      action: "guest",
      firstName: "Lectura",
      lastName: "PDF",
      entity: "Prueba",
      position: "Consulta",
    },
  });
  expect(visitor.status()).toBe(200);
  await page.goto("/#observatorio");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Boletín previo a componentes",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cargar publicación", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Previsualizar PDF Boletín previo a componentes",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Página 1 de 2",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Abrir navegación", exact: true })
    .click();
  await page.getByRole("button", { name: "Componentes", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("componentes-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

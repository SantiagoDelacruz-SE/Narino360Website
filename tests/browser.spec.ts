import { test, expect } from "@playwright/test";
import sharp from "sharp";
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
    .getByLabel("Título de la jornada")
    .fill("Encuentro comunitario de prueba");
  await dialog.getByLabel("Fecha", { exact: true }).fill("2026-10-15");
  await dialog
    .getByRole("combobox", { name: "Municipio", exact: true })
    .selectOption("Pasto");
  await dialog
    .getByRole("combobox", { name: "Programa", exact: true })
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
  await page.getByRole("button", { name: "Observatorio", exact: true }).click();
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
  await page.getByRole("button", { name: "Observatorio", exact: true }).click();
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

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
  await dialog.getByLabel("Presupuesto aprobado").fill("5000000");
  await dialog.getByLabel("Presupuesto ejecutado").fill("2000000");
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
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({
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
  await page
    .getByRole("button", { name: "Control presupuestal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seguimiento presupuestal por jornada" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar datos" }).click();
  expect((await download).suggestedFilename()).toBe("narino360-jornadas.csv");
  await page
    .getByRole("button", { name: "Analítica textual", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Temáticas de convivencia y seguridad" }),
  ).toBeVisible();
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

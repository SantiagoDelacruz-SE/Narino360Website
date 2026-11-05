import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
async function main() {
  const temp = mkdtempSync(join(tmpdir(), "narino360-browser-"));
  process.env.DATA_DIR = temp;
  const { createUser } = await import("../src/lib/auth");
  createUser(
    "admin-prueba",
    "Administración de prueba",
    "Clave-Solo-Pruebas-2026",
    "Administrador",
  );
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3139",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_ORIGIN: "http://127.0.0.1:3139",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "inherit",
    },
  );
  const stop = () => {
    server.kill("SIGTERM");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  server.on("exit", (code) => {
    rmSync(temp, { recursive: true, force: true });
    process.exit(code || 0);
  });
}
void main();

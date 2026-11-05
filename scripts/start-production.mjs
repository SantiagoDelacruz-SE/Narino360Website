import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const originValue = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (!originValue) {
  console.error(
    "Configura APP_ORIGIN con la URL pública HTTPS. En Render se utiliza RENDER_EXTERNAL_URL automáticamente.",
  );
  process.exit(1);
}

let origin;
try {
  const url = new URL(originValue);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error();
  }
  origin = url.origin;
} catch {
  console.error("APP_ORIGIN debe ser una URL HTTPS sin ruta, parámetros ni credenciales.");
  process.exit(1);
}

const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT debe ser un puerto válido.");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const server = spawn(
  process.execPath,
  [next, "start", "--hostname", "0.0.0.0", "--port", String(port)],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", APP_ORIGIN: origin },
  },
);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", () => {
  console.error("No se pudo iniciar Next.js.");
  process.exit(1);
});
server.on("exit", (code) => process.exit(code ?? 0));

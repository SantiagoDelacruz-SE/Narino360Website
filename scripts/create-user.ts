import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createUser } from "../src/lib/auth";
import { isAccountRole } from "../src/lib/domain";
const [username, name, role = "Administrador"] = process.argv.slice(2);
if (!username || !name || !isAccountRole(role)) {
  console.error(
    'Uso: npm run user:create -- usuario "Nombre completo" [Administrador|Editor|Consulta]',
  );
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error(
    "Ejecuta este comando en una terminal interactiva para ingresar la contraseña de forma segura.",
  );
  process.exit(1);
}
let mute = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!mute) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
const ask = (prompt: string) =>
  new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    mute = true;
    rl.question("", (answer) => {
      mute = false;
      process.stdout.write("\n");
      resolve(answer);
    });
  });
async function main() {
  try {
    const password = await ask(
      "Contraseña (12 a 128 caracteres, no se muestra): ",
    );
    const confirmation = await ask("Confirmar contraseña: ");
    if (password !== confirmation)
      throw new Error("Las contraseñas no coinciden.");
    if (!isAccountRole(role)) throw new Error("Rol no válido.");
    createUser(username, name, password, role);
    console.log("Cuenta creada. Ya puedes iniciar sesión en /acceso.");
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}
void main();

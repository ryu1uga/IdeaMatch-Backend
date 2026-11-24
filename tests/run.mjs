// =============================================================================
//  Runner de pruebas de integración:  npm test  |  npm test -- sprint5
//
//  Por cada archivo tests/*.test.mts:
//   1. levanta un PostgreSQL en memoria (PGlite) en un puerto libre,
//   2. aplica todas las migraciones de prisma/migrations,
//   3. ejecuta el archivo con tsx contra esa BD (NODE_ENV=test).
//  No necesita Docker ni una BD real, y funciona igual en Windows, Linux y CI.
// =============================================================================
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "prisma", "migrations");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

const filtro = process.argv[2];
const archivos = readdirSync(path.join(root, "tests"))
  .filter((f) => f.endsWith(".test.mts") && (!filtro || f.includes(filtro)))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!archivos.length) {
  console.error(`No hay pruebas que coincidan con "${filtro}"`);
  process.exit(1);
}

const puertoLibre = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function baseDeDatos() {
  const db = await PGlite.create();
  const migraciones = readdirSync(migrationsDir)
    .filter((d) => statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();
  for (const m of migraciones) await db.exec(readFileSync(path.join(migrationsDir, m, "migration.sql"), "utf8"));
  const port = await puertoLibre();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  return { port, close: async () => (await server.stop(), await db.close()) };
}

function ejecutar(archivo, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsxCli, path.join("tests", archivo)], { cwd: root, env, stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const fallidos = [];
const inicio = Date.now();
for (const archivo of archivos) {
  console.log(`\n# ${archivo}`);
  const db = await baseDeDatos();
  const uploads = mkdtempSync(path.join(tmpdir(), "ideamatch-uploads-"));
  const code = await ejecutar(archivo, {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${db.port}/postgres?sslmode=disable`,
    JWT_SECRET: "jwt-secret-solo-para-pruebas-0123456789abcdef",
    UPLOAD_DIR: uploads,
    CLOUDINARY_URL: "",
    PUBLIC_URL: "",
    ADMIN_EMAIL: "",
    ADMIN_PASSWORD: "",
    // Sin SMTP los correos quedan en memoria (bandejaDePrueba). Las pruebas de los sprints
    // usan el registro directo; tests/verificacion.test.mts activa la verificación por su cuenta.
    SMTP_USER: "",
    SMTP_PASS: "",
    MAIL_FROM: "",
    REQUIRE_EMAIL_VERIFICATION: "false",
  });
  await db.close();
  rmSync(uploads, { recursive: true, force: true });
  if (code !== 0) fallidos.push(archivo);
}

const seg = ((Date.now() - inicio) / 1000).toFixed(1);
if (fallidos.length) {
  console.error(`\n${fallidos.length} de ${archivos.length} archivos fallaron (${seg} s): ${fallidos.join(", ")}`);
  process.exit(1);
}
console.log(`\nTodas las pruebas pasaron: ${archivos.length} archivos (${seg} s)`);

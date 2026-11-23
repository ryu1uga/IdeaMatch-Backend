// Infraestructura: configuración SSL de la BD (Supabase) y health check (Render / UptimeRobot)
import assert from "node:assert/strict";
const { pgConfig } = await import("../src/lib/db-config.ts");
const { app } = await import("../src/app.ts");
const { prisma } = await import("../src/lib/prisma.ts");
let n = 0; const ok = (name: string) => console.log(`  ok ${++n} ${name}`);

// ---- pgConfig
const base = "postgresql://postgres.ref:p%40ss@aws-0-us-east-1.pooler.supabase.com:5432/postgres";
const ssl = (url: string, ca?: string) => pgConfig(url, ca).ssl as any;
assert.equal(ssl("postgresql://u:p@localhost:5432/db?schema=public"), false);
assert.equal(ssl(`${base}?sslmode=disable`), false);
assert.deepEqual(ssl(`${base}?sslmode=require`), { rejectUnauthorized: false });
assert.deepEqual(ssl(`${base}?sslmode=prefer`), { rejectUnauthorized: false });
assert.equal(ssl(`${base}?sslmode=verify-full`).rejectUnauthorized, true);
assert.equal(ssl(`${base}?sslmode=verify-full`).checkServerIdentity, undefined);
assert.equal(typeof ssl(`${base}?sslmode=verify-ca`).checkServerIdentity, "function");
ok("sslmode: sin/disable → sin SSL; require/prefer → cifrado sin validar; verify-ca/full → valida");

const pem = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----";
const conCa = ssl(`${base}?sslmode=require`, pem);
assert.equal(conCa.ca, "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----");
assert.equal(conCa.rejectUnauthorized, true); assert.equal(typeof conCa.checkServerIdentity, "function");
assert.equal(ssl(`${base}?sslmode=verify-full`, pem).checkServerIdentity, undefined);
assert.equal(ssl(base, pem).rejectUnauthorized, true);
assert.equal(ssl(`${base}?sslmode=disable`, pem), false);
ok("DATABASE_CA_CERT: '\\n' literales a saltos de línea; require+CA = verify-ca; verify-full valida el host");

const cs = pgConfig(`${base}?sslmode=require&schema=public&sslrootcert=x.crt`).connectionString!;
assert.ok(!/ssl/.test(cs)); assert.match(cs, /schema=public/); assert.match(cs, /p%40ss@/);
ok("los parámetros ssl* se quitan de la URL que recibe pg (el resto se conserva)");

// ---- /health
const server = app.listen(0);
const H = `http://127.0.0.1:${(server.address() as { port: number }).port}/health`;
let r = await fetch(H);
assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store");
const body = await r.json(); assert.equal(body.status, "ok"); assert.equal(body.db, "ok"); assert.ok(body.timestamp);
r = await fetch(H, { method: "HEAD" }); assert.equal(r.status, 200);
ok("GET y HEAD /health → 200 { status: ok, db: ok }");

const original = prisma.$queryRaw;
(prisma as any).$queryRaw = () => Promise.reject(new Error("BD caída (simulada)"));
const errorOriginal = console.error; console.error = () => {};
r = await fetch(H);
console.error = errorOriginal; (prisma as any).$queryRaw = original;
assert.equal(r.status, 503); assert.deepEqual({ ...(await r.json()), timestamp: 0 }, { status: "error", db: "error", timestamp: 0 });
assert.equal((await fetch(H)).status, 200);
ok("BD caída → 503 { status: error, db: error }");

console.log(`Infraestructura: ${n} pruebas OK`);
server.close(); process.exit(0);

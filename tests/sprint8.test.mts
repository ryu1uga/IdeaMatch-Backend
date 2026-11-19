import assert from "node:assert/strict";
import { execSync } from "node:child_process";
const { prisma } = await import("../src/lib/prisma.ts");
let n = 0; const ok = (name: string) => console.log(`  ok ${++n} ${name}`);
// usuario previo que luego se promueve
execSync("npx tsx src/db/seed.ts", { stdio: "ignore", env: { ...process.env, ADMIN_EMAIL: "Admin@IdeaMatch.com", ADMIN_PASSWORD: "Admin12345" } });
execSync("npx tsx src/db/seed.ts", { stdio: "ignore", env: { ...process.env, ADMIN_EMAIL: "admin@ideamatch.com", ADMIN_PASSWORD: "otra" } });
assert.equal(await prisma.usuario.count({ where: { esAdmin: true } }), 1);
ok("seed crea el admin desde ADMIN_EMAIL/ADMIN_PASSWORD (idempotente)");

const { app } = await import("../src/app.ts");
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const B = `http://127.0.0.1:${port}/api`;
async function req(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const reg = async (f: string, l: string) => (await req("POST", "/auth/register", { firstName: f, lastName: l, email: `${f}@c.com`, password: "Secreta123" })).body;
let r = await req("POST", "/auth/login", { email: "admin@ideamatch.com", password: "Admin12345" });
assert.equal(r.status, 200); assert.equal(r.body.user.isAdmin, true);
const AD = r.body.token;
const A = await reg("Ana", "Pérez"), Bo = await reg("Bruno", "Díaz"), C = await reg("Carla", "Ruiz"), D = await reg("Dario", "Soto");
const T = A.token;
ok("login del admin: user.isAdmin = true");

for (const [m, p] of [["GET", "/admin/metrics"], ["GET", "/admin/reports"], ["GET", "/admin/categories"], ["POST", "/admin/categories"]] as const) {
  r = await req(m, p, m === "POST" ? { name: "X" } : undefined, T); assert.equal(r.status, 403, p); assert.equal(r.body.code, "ADMIN_ONLY");
}
r = await req("GET", "/admin/metrics"); assert.equal(r.status, 401);
ok("rutas /admin: 401 sin token, 403 ADMIN_ONLY para usuarios normales");

execSync(`npx tsx src/db/promote-admin.ts carla@c.com`, { stdio: "ignore", env: process.env });
r = await req("GET", "/admin/categories", undefined, C.token); assert.equal(r.status, 200);
execSync(`npx tsx src/db/promote-admin.ts carla@c.com --remove`, { stdio: "ignore", env: process.env });
r = await req("GET", "/admin/categories", undefined, C.token); assert.equal(r.status, 403);
let fail = false; try { execSync(`npx tsx src/db/promote-admin.ts nadie@c.com`, { stdio: "ignore", env: process.env }); } catch { fail = true; }
assert.ok(fail);
ok("admin:promote da y quita el rol con efecto inmediato (mismo token)");

// ---- datos
const cats = (await req("GET", "/categories")).body;
const crear = async (name: string, cat: string) => {
  const p = (await req("POST", "/projects", { name, summary: "S", categoryId: cat, modality: "remoto" }, T)).body.project;
  const role = (await req("POST", `/projects/${p.id}/roles`, { name: "Dev", vacancies: 2, dedication: "5-10" }, T)).body.role;
  await req("POST", `/projects/${p.id}/publish`, undefined, T);
  return { ...p, role };
};
const P1 = await crear("Huertos", cats[0].id), P2 = await crear("Spam total", cats[1].id);
const a1 = (await req("POST", `/projects/${P1.id}/roles/${P1.role.id}/applications`, {}, Bo.token)).body.application;
await req("POST", `/applications/${a1.id}/accept`, undefined, T);
const a2 = (await req("POST", `/projects/${P1.id}/roles/${P1.role.id}/applications`, {}, C.token)).body.application;
await req("POST", `/applications/${a2.id}/reject`, undefined, T);
const aD = (await req("POST", `/projects/${P2.id}/roles/${P2.role.id}/applications`, {}, D.token)).body.application;

// ---- métricas
r = await req("GET", "/admin/metrics", undefined, AD);
assert.equal(r.status, 200);
assert.deepEqual(r.body.users, { value: 5, changeThisMonth: 5 });
assert.deepEqual(r.body.activeProjects, { value: 2, changeThisMonth: 2 });
assert.equal(r.body.acceptanceRate.value, 50); assert.equal(r.body.acceptanceRate.changeThisMonth, null);
assert.deepEqual(r.body.openReports, { value: 0, changeThisMonth: 0 });
assert.equal(r.body.stale, false); assert.ok(r.body.updatedAt);
ok("GET /admin/metrics: { value, changeThisMonth } por indicador");

// ---- reportes
const rp1 = (await req("POST", `/projects/${P2.id}/reports`, { reason: "spam", description: "Publicidad" }, Bo.token)).body.report;
const rp2 = (await req("POST", `/projects/${P2.id}/reports`, { reason: "contenido_enganoso", description: "Engaña" }, C.token)).body.report;
const rp3 = (await req("POST", `/projects/${P1.id}/reports`, { reason: "propiedad_intelectual", description: "Copia" }, C.token)).body.report;
r = await req("GET", "/admin/reports", undefined, AD);
assert.equal(r.body.total, 3); assert.equal(r.body.items[0].id, rp3.id);
const it = r.body.items[0];
assert.deepEqual({ p: it.project.name, s: it.severity, st: it.status, rep: it.reporter.name }, { p: "Huertos", s: "alta", st: "abierto", rep: "Carla Ruiz" });
assert.ok(!JSON.stringify(r.body).includes("@c.com"));
r = await req("GET", "/admin/reports?severity=alta", undefined, AD); assert.equal(r.body.total, 1);
r = await req("GET", "/admin/reports?status=resuelto", undefined, AD); assert.equal(r.body.total, 0);
r = await req("GET", "/admin/reports?limit=1&page=3", undefined, AD); assert.equal(r.body.items.length, 1);
assert.equal((await req("GET", "/admin/metrics", undefined, AD)).body.openReports.value, 3);
ok("GET /admin/reports con filtros status/severity y paginación");

r = await req("POST", `/admin/reports/${rp3.id}/resolve`, { action: "dismiss", note: "No es copia" }, AD);
assert.equal(r.status, 200); assert.equal(r.body.report.status, "resuelto"); assert.equal(r.body.report.resolution, "dismiss"); assert.equal(r.body.report.resolvedBy.name, "Admin IdeaMatch");
r = await req("GET", "/notifications", undefined, C.token); assert.equal(r.body.items[0].type, "report_resolved"); assert.equal(r.body.items[0].payload.action, "dismiss");
r = await req("POST", `/admin/reports/${rp3.id}/resolve`, { action: "dismiss" }, AD); assert.equal(r.status, 409); assert.equal(r.body.code, "ALREADY_RESOLVED");
r = await req("POST", `/admin/reports/99999/resolve`, { action: "dismiss" }, AD); assert.equal(r.body.code, "REPORT_NOT_FOUND");
r = await req("POST", `/admin/reports/${rp1.id}/resolve`, { action: "borrar" }, AD); assert.equal(r.body.code, "VALIDATION");
ok("dismiss: desestima y avisa al reportante; ALREADY_RESOLVED; REPORT_NOT_FOUND");

r = await req("POST", `/admin/reports/${rp1.id}/resolve`, { action: "suspend_project", note: "Spam" }, AD);
assert.equal(r.status, 200); assert.equal(r.body.report.resolution, "suspend_project"); assert.equal(r.body.report.project.status, "suspendido");
assert.equal((await prisma.reporte.findUniqueOrThrow({ where: { id: BigInt(rp2.id) } })).estado, "Resuelto");
assert.equal((await prisma.postulacion.findUniqueOrThrow({ where: { id: BigInt(aD.id) } })).estado, "Rechazada");
r = await req("GET", "/notifications", undefined, T); assert.equal(r.body.items[0].type, "project_suspended"); assert.match(r.body.items[0].message, /Spam total fue suspendido por moderación: Spam/);
for (const u of [Bo, C]) { r = await req("GET", "/notifications", undefined, u.token); assert.ok(r.body.items.some((x: any) => x.type === "report_resolved" && x.payload.action === "suspend_project")); }
r = await req("GET", "/notifications", undefined, D.token); assert.equal(r.body.items[0].payload.reason, "project_suspended");
ok("suspend_project: suspende, cierra los otros reportes y pendientes, notifica a todos");
r = await req("GET", "/projects", undefined, Bo.token); assert.ok(!r.body.items.some((x: any) => x.id === P2.id));
r = await req("GET", `/projects/${P2.id}`, undefined, Bo.token); assert.equal(r.status, 404);
r = await req("GET", `/projects/${P2.id}`, undefined, T); assert.equal(r.body.status, "suspendido");
r = await req("PATCH", `/projects/${P2.id}`, { name: "Otro" }, T); assert.equal(r.body.code, "PROJECT_CLOSED");
r = await req("PATCH", `/projects/${P2.id}/status`, { status: "abierto" }, T); assert.equal(r.body.code, "INVALID_TRANSITION");
r = await req("POST", `/projects/${P2.id}/roles/${P2.role.id}/applications`, {}, Bo.token); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
r = await req("GET", "/me/projects?status=suspendido", undefined, T); assert.equal(r.body.length, 1);
const conv = (await req("GET", "/conversations", undefined, T)).body.find((c: any) => c.project.id === P2.id);
r = await req("POST", `/conversations/${conv.id}/messages`, { text: "hola" }, T); assert.equal(r.body.code, "PROJECT_CLOSED");
ok("proyecto suspendido: oculto, sin edición/transiciones/postulaciones, chat de solo lectura; el creador lo ve");

// ---- categorías
r = await req("GET", "/admin/categories", undefined, AD);
assert.equal(r.body.length, cats.length);
assert.deepEqual(Object.keys(r.body[0]).sort(), ["active", "createdAt", "id", "name", "projectCount"]);
assert.equal(r.body.find((c: any) => c.id === cats[1].id).projectCount, 1);
r = await req("POST", "/admin/categories", { name: "Agrotech" }, AD); assert.equal(r.status, 201); const nueva = r.body.category;
assert.deepEqual({ n: nueva.name, a: nueva.active, c: nueva.projectCount }, { n: "Agrotech", a: true, c: 0 });
r = await req("POST", "/admin/categories", { name: "agroTECH" }, AD); assert.equal(r.status, 409); assert.equal(r.body.code, "CATEGORY_EXISTS");
r = await req("PATCH", `/admin/categories/${nueva.id}`, { name: cats[0].name.toUpperCase() }, AD); assert.equal(r.body.code, "CATEGORY_EXISTS");
r = await req("PATCH", `/admin/categories/${nueva.id}`, { name: "Agro tech" }, AD); assert.equal(r.body.category.name, "Agro tech");
r = await req("PATCH", `/admin/categories/${nueva.id}`, {}, AD); assert.equal(r.body.code, "VALIDATION");
r = await req("PATCH", `/admin/categories/99999`, { active: false }, AD); assert.equal(r.body.code, "CATEGORY_NOT_FOUND");
ok("POST/PATCH /admin/categories; CATEGORY_EXISTS sin distinguir mayúsculas");
r = await req("PATCH", `/admin/categories/${cats[0].id}`, { active: false }, AD); assert.equal(r.body.category.active, false);
assert.ok(!(await req("GET", "/categories")).body.some((c: any) => c.id === cats[0].id));
r = await req("POST", "/projects", { name: "X", categoryId: cats[0].id }, T); assert.equal(r.body.code, "INVALID_CATEGORY");
assert.equal((await req("GET", `/projects/${P1.id}`, undefined, Bo.token)).body.category.id, cats[0].id);
assert.ok((await req("GET", "/admin/categories", undefined, AD)).body.some((c: any) => c.id === cats[0].id && !c.active));
ok("desactivar: sale de /categories y de proyectos nuevos; los existentes la conservan");

r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
const paths = Object.keys(r.paths);
for (const legacy of ["/api/entregas", "/api/insignias", "/api/usuario-insignias"]) assert.ok(!paths.includes(legacy));
assert.ok(r.paths["/api/admin/metrics"].get.responses[403]);
assert.ok(paths.every((p) => !/[áéíóú]|usuarios|proyectos|perfiles/.test(p)), paths.join(","));
ok("Swagger: solo endpoints del contrato (sin CRUD genérico)");
console.log(`Sprint 8: ${n} pruebas OK`);
server.close(); process.exit(0);

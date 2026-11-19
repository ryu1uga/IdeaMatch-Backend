import assert from "node:assert/strict";
import { execSync } from "node:child_process";
execSync("npx tsx src/db/seed.ts", { stdio: "ignore" });
const { app } = await import("../src/app.ts");
const { prisma } = await import("../src/lib/prisma.ts");
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const B = `http://127.0.0.1:${port}/api`;
async function req(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
let n = 0; const ok = (name: string) => console.log(`  ok ${++n} ${name}`);
const reg = async (e: string) => (await req("POST", "/auth/register", { firstName: "U", lastName: e, email: `${e}@c.com`, password: "Secreta123" })).body;
const A = await reg("ana"); const L = await reg("luis");
const T = A.token, T2 = L.token;
const cats = (await req("GET", "/categories")).body;
const skills = (await req("GET", "/skills", undefined, T)).body;

// ---- crear
let r = await req("POST", "/projects", { name: "Huertos" }, T);
assert.equal(r.status, 201, JSON.stringify(r.body));
const P = r.body.project;
assert.equal(P.status, "borrador"); assert.equal(P.summary, null); assert.deepEqual(P.roles, []); assert.equal(P.publishedAt, null);
ok("POST /projects borrador solo con name");
r = await req("POST", "/projects", { name: "x".repeat(61) }, T); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", "/projects", { name: "X", summary: "y".repeat(141) }, T); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", "/projects", { name: "X", modality: "online" }, T); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", "/projects", { name: "X", categoryId: "9999" }, T); assert.equal(r.body.code, "INVALID_CATEGORY");
ok("validaciones: name ≤ 60, summary ≤ 140, modality, categoría");

// ---- publicar incompleto
r = await req("POST", `/projects/${P.id}/publish`, undefined, T);
assert.equal(r.status, 409); assert.equal(r.body.code, "INCOMPLETE_PROJECT"); assert.deepEqual(r.body.details.missing, ["summary", "categoryId", "modality"]);
ok("publish 409 INCOMPLETE_PROJECT");
r = await req("PATCH", `/projects/${P.id}`, { summary: "Vecinos que cultivan", categoryId: cats[0].id, modality: "hibrido", description: "Larga" }, T);
assert.equal(r.status, 200); assert.equal(r.body.project.modality, "hibrido"); assert.equal(r.body.project.category.id, cats[0].id);
r = await req("PATCH", `/projects/${P.id}`, { name: "Robado" }, T2); assert.equal(r.status, 403); assert.equal(r.body.code, "NOT_OWNER");
r = await req("PATCH", `/projects/99999`, { name: "X" }, T); assert.equal(r.status, 404); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
ok("PATCH /projects/:id (dueño 200, otro 403, inexistente 404)");
r = await req("POST", `/projects/${P.id}/publish`, undefined, T);
assert.equal(r.body.code, "NO_ROLES");
ok("publish 409 NO_ROLES");

// ---- roles
r = await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 0, dedication: "5-10" }, T); assert.equal(r.body.code, "INVALID_VACANCIES");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 1.5, dedication: "5-10" }, T); assert.equal(r.body.code, "INVALID_VACANCIES");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 2, dedication: "40" }, T); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 2, dedication: "5-10", skillIds: ["99999"] }, T); assert.equal(r.body.code, "INVALID_SKILL");
ok("roles: INVALID_VACANCIES / dedicación / INVALID_SKILL");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 2, dedication: "10-20", skillIds: [skills[0].id, skills[1].id, skills[1].id], description: "React" }, T);
assert.equal(r.status, 201); const R1 = r.body.role;
assert.equal(R1.vacancies, 2); assert.equal(R1.vacanciesAvailable, 2); assert.equal(R1.skills.length, 2); assert.equal(R1.dedication, "10-20");
r = await req("POST", `/projects/${P.id}/roles`, { name: "frontend", vacancies: 1, dedication: "5-10" }, T); assert.equal(r.body.code, "ROLE_NAME_TAKEN");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Diseño", vacancies: 1, dedication: "20+" }, T2); assert.equal(r.body.code, "NOT_OWNER");
ok("POST /projects/:id/roles 201; nombre repetido 409; no dueño 403");
r = await req("PATCH", `/projects/${P.id}/roles/${R1.id}`, { vacancies: 3, skillIds: [skills[2].id] }, T);
assert.equal(r.status, 200); assert.equal(r.body.role.vacancies, 3); assert.equal(r.body.role.vacanciesAvailable, 3); assert.equal(r.body.role.skills[0].id, skills[2].id);
r = await req("PATCH", `/projects/${P.id}/roles/99999`, { name: "X" }, T); assert.equal(r.body.code, "ROLE_NOT_FOUND");
ok("PATCH rol (vacantes y skills); ROLE_NOT_FOUND");

// ---- publicar
r = await req("POST", `/projects/${P.id}/publish`, undefined, T);
assert.equal(r.status, 200); assert.equal(r.body.project.status, "abierto"); assert.ok(r.body.project.publishedAt); assert.equal(r.body.project.roles.length, 1);
r = await req("POST", `/projects/${P.id}/publish`, undefined, T); assert.equal(r.body.code, "INVALID_TRANSITION");
r = await req("PATCH", `/projects/${P.id}`, { summary: null }, T); assert.equal(r.body.code, "VALIDATION");
ok("publish 200 abierto; segunda vez INVALID_TRANSITION; publicado no pierde obligatorios");
assert.equal((await req("GET", "/categories")).body.find((c: any) => c.id === cats[0].id).projectCount, 1);
ok("projectCount de /categories cuenta el proyecto abierto");
r = await req("DELETE", `/projects/${P.id}/roles/${R1.id}`, undefined, T); assert.equal(r.body.code, "NO_ROLES");
ok("no se puede borrar el único rol de un proyecto publicado");

// miembro aceptado simulado: 1 vacante ocupada
await prisma.rolProyecto.update({ where: { id: BigInt(R1.id) }, data: { vacantesDisponibles: 2 } });
r = await req("PATCH", `/projects/${P.id}/roles/${R1.id}`, { vacancies: 0 }, T); assert.equal(r.body.code, "INVALID_VACANCIES");
r = await req("POST", `/projects/${P.id}/roles`, { name: "Backend", vacancies: 1, dedication: "5-10" }, T); const R2 = r.body.role;
r = await req("DELETE", `/projects/${P.id}/roles/${R1.id}`, undefined, T); assert.equal(r.body.code, "ROLE_HAS_MEMBERS");
r = await req("PATCH", `/projects/${P.id}/roles/${R1.id}`, { vacancies: 1 }, T); assert.equal(r.status, 200); assert.equal(r.body.role.vacanciesAvailable, 0);
ok("vacantes ocupadas: ROLE_HAS_MEMBERS; bajar a 1 deja 0 disponibles");

// ---- /me/projects
await prisma.postulacion.create({ data: { usuarioId: BigInt(L.user.id), rolProyectoId: BigInt(R2.id), proyectoId: BigInt(P.id) } });
await req("POST", "/projects", { name: "Otro borrador" }, T);
r = await req("GET", "/me/projects", undefined, T);
assert.equal(r.status, 200); assert.equal(r.body.length, 2);
const mine = r.body.find((x: any) => x.id === P.id);
assert.equal(mine.rolesCovered, 1); assert.equal(mine.rolesPending, 1); assert.equal(mine.pendingApplications, 1); assert.equal(mine.vacancies, 2); assert.equal(mine.vacanciesAvailable, 1);
r = await req("GET", "/me/projects?status=borrador", undefined, T); assert.equal(r.body.length, 1); assert.equal(r.body[0].status, "borrador");
r = await req("GET", "/me/projects?status=xx", undefined, T); assert.equal(r.body.code, "VALIDATION");
assert.equal((await req("GET", "/me/projects", undefined, T2)).body.length, 0);
ok("GET /me/projects con contadores y filtro status");

// ---- estados
r = await req("PATCH", `/projects/${P.id}/status`, { status: "abierto" }, T); assert.equal(r.body.code, "INVALID_TRANSITION"); assert.deepEqual(r.body.details.allowed, ["en_curso", "pausado", "cerrado"]);
for (const s of ["en_curso", "pausado", "abierto", "pausado", "en_curso"]) {
  r = await req("PATCH", `/projects/${P.id}/status`, { status: s }, T); assert.equal(r.status, 200, s); assert.equal(r.body.project.status, s);
}
r = await req("PATCH", `/projects/${P.id}/status`, { status: "cancelado" }, T); assert.equal(r.body.code, "VALIDATION");
r = await req("PATCH", `/projects/${P.id}/status`, { status: "cerrado" }, T2); assert.equal(r.body.code, "NOT_OWNER");
const borrador = (await req("GET", "/me/projects?status=borrador", undefined, T)).body[0];
r = await req("PATCH", `/projects/${borrador.id}/status`, { status: "abierto" }, T); assert.equal(r.body.code, "INVALID_TRANSITION");
ok("transiciones válidas e inválidas");
r = await req("PATCH", `/projects/${P.id}/status`, { status: "cerrado" }, T);
assert.equal(r.status, 200); assert.equal(r.body.project.status, "cerrado");
assert.equal((await prisma.postulacion.findFirstOrThrow({ where: { proyectoId: BigInt(P.id) } })).estado, "Rechazada");
r = await req("PATCH", `/projects/${P.id}`, { name: "Nuevo" }, T); assert.equal(r.body.code, "PROJECT_CLOSED");
r = await req("POST", `/projects/${P.id}/roles`, { name: "QA", vacancies: 1, dedication: "5-10" }, T); assert.equal(r.body.code, "PROJECT_CLOSED");
r = await req("POST", `/projects/${P.id}/cancel`, undefined, T); assert.equal(r.body.code, "INVALID_TRANSITION");
ok("cerrar rechaza pendientes y bloquea edición");
r = await req("POST", `/projects/${borrador.id}/cancel`, undefined, T);
assert.equal(r.status, 200); assert.equal(r.body.project.status, "cancelado");
ok("POST /projects/:id/cancel");

r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
assert.ok(r.paths["/api/projects/{id}/roles/{roleId}"].patch);
assert.equal(r.paths["/api/proyectos"], undefined);
ok("Swagger actualizado (sin CRUD viejo de proyectos)");
console.log(`Sprint 3: ${n} pruebas OK`);
server.close(); process.exit(0);

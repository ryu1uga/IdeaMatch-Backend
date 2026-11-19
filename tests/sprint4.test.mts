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
const reg = async (f: string, l: string) => (await req("POST", "/auth/register", { firstName: f, lastName: l, email: `${f}@c.com`, password: "Secreta123" })).body;
const A = await reg("Ana", "Pérez"), Bo = await reg("Bruno", "Díaz"), C = await reg("Carla", "Ruiz"), D = await reg("Dario", "Soto"), E = await reg("Elena", "Vega");
const T = A.token;
const cats = (await req("GET", "/categories")).body;
const skills = (await req("GET", "/skills", undefined, T)).body;
const sk = (name: string) => skills.find((s: any) => s.name === name).id;

async function crearProyecto(name: string, cat: string, roles: { name: string; ded: string; skills: string[]; vac?: number }[], publish = true, extra = {}) {
  const p = (await req("POST", "/projects", { name, summary: `Resumen ${name}`, categoryId: cat, modality: "remoto", ...extra }, T)).body.project;
  const rs = [];
  for (const r of roles) rs.push((await req("POST", `/projects/${p.id}/roles`, { name: r.name, vacancies: r.vac ?? 2, dedication: r.ded, skillIds: r.skills.map(sk) }, T)).body.role);
  if (publish) await req("POST", `/projects/${p.id}/publish`, undefined, T);
  return { ...p, roles: rs };
}
const P1 = await crearProyecto("Huertos urbanos", cats[0].id, [{ name: "Frontend", ded: "5-10", skills: ["React", "TypeScript"] }, { name: "Diseño", ded: "10-20", skills: ["Figma"] }], true, { description: "Plataforma con mapas" });
const P2 = await crearProyecto("Tutor IA", cats[1].id, [{ name: "ML", ded: "20+", skills: ["Python"] }]);
const P3 = await crearProyecto("Marketplace", cats[1].id, [{ name: "Backend", ded: "10-20", skills: ["Node.js"] }]);
const BORR = await crearProyecto("Secreto", cats[0].id, [{ name: "X", ded: "5-10", skills: [] }], false);
await req("PATCH", `/projects/${P3.id}/status`, { status: "en_curso" }, T);

// equipo de P1: Bruno, Carla, Dario, Elena (4 miembros + creador = 5)
const addMember = async (u: any, roleId: string) => {
  await prisma.miembroEquipo.create({ data: { usuarioId: BigInt(u.user.id), rolProyectoId: BigInt(roleId) } });
  await prisma.rolProyecto.update({ where: { id: BigInt(roleId) }, data: { vacantesDisponibles: { decrement: 1 } } });
};
await addMember(Bo, P1.roles[0].id); await addMember(C, P1.roles[0].id); await addMember(D, P1.roles[1].id); await addMember(E, P1.roles[1].id);
// postulaciones: P2 tiene 2 (más popular), P1 ninguna
await prisma.postulacion.create({ data: { usuarioId: BigInt(Bo.user.id), rolProyectoId: BigInt(P2.roles[0].id), proyectoId: BigInt(P2.id) } });
await prisma.postulacion.create({ data: { usuarioId: BigInt(C.user.id), rolProyectoId: BigInt(P2.roles[0].id), proyectoId: BigInt(P2.id), estado: "Rechazada" } });

// ---- listado
let r = await req("GET", "/projects", undefined, Bo.token);
assert.equal(r.status, 200); assert.equal(r.body.total, 2); assert.equal(r.body.page, 1); assert.equal(r.body.limit, 10);
assert.deepEqual(r.body.items.map((x: any) => x.name), ["Tutor IA", "Huertos urbanos"]);
ok("GET /projects: solo abiertos, recientes primero, sin borradores");
const card = r.body.items.find((x: any) => x.id === P1.id);
for (const k of ["id","name","summary","category","coverColor","coverGradient","skills","memberInitials","extraMembers"]) assert.ok(k in card, k);
assert.deepEqual(card.skills.map((s: any) => s.name), ["Figma", "React", "TypeScript"]);
assert.deepEqual(card.memberInitials, ["AP", "BD", "CR"]); assert.equal(card.extraMembers, 2); assert.equal(card.membersCount, 5);
assert.equal(card.vacanciesAvailable, 0); assert.match(card.coverColor, /^#[0-9a-f]{6}$/); assert.equal(card.coverGradient.length, 2);
const otherSameCat = (await req("GET", "/projects?status=abierto,en_curso", undefined, T)).body.items;
assert.deepEqual(otherSameCat.find((x: any) => x.id === P2.id).coverGradient, otherSameCat.find((x: any) => x.id === P3.id).coverGradient);
ok("projectCard: skills sin repetir, iniciales (creador primero), extraMembers, portada por categoría");
r = await req("GET", "/projects"); assert.equal(r.status, 401);
ok("requiere token");

r = await req("GET", "/projects?limit=1&page=2", undefined, T); assert.equal(r.body.items.length, 1); assert.equal(r.body.items[0].name, "Huertos urbanos"); assert.equal(r.body.total, 2);
r = await req("GET", "/projects?limit=3", undefined, T); assert.equal(r.body.items.length, 2);
r = await req("GET", "/projects?limit=51", undefined, T); assert.equal(r.body.code, "VALIDATION");
ok("paginación page/limit (Inicio usa limit=3)");
r = await req("GET", "/projects?q=MAPAS", undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Huertos urbanos"]);
r = await req("GET", "/projects?q=tutor", undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Tutor IA"]);
ok("q busca en nombre y descripción (sin distinguir mayúsculas)");
r = await req("GET", `/projects?categoryIds=${cats[1].id}`, undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Tutor IA"]);
r = await req("GET", `/projects?categoryIds=${cats[0].id},${cats[1].id}`, undefined, T); assert.equal(r.body.total, 2);
r = await req("GET", `/projects?categoryIds=${cats[0].id}&categoryIds=${cats[1].id}`, undefined, T); assert.equal(r.body.total, 2);
r = await req("GET", `/projects?categoryIds=abc`, undefined, T); assert.equal(r.body.code, "VALIDATION");
ok("categoryIds (coma o repetido)");
r = await req("GET", `/projects?skillIds=${sk("Python")}`, undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Tutor IA"]);
r = await req("GET", `/projects?skillIds=${sk("Figma")},${sk("Python")}`, undefined, T); assert.equal(r.body.total, 2);
ok("skillIds");
r = await req("GET", `/projects?availability=20%2B`, undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Tutor IA"]);
r = await req("GET", `/projects?availability=5-10`, undefined, T); assert.equal(r.body.total, 0);
r = await req("GET", `/projects?availability=40`, undefined, T); assert.equal(r.body.code, "VALIDATION");
ok("availability: dedicación de roles con vacantes libres (P1 ya no tiene)");
r = await req("GET", `/projects?status=en_curso`, undefined, T); assert.deepEqual(r.body.items.map((x: any) => x.name), ["Marketplace"]);
r = await req("GET", `/projects?status=borrador`, undefined, T); assert.equal(r.body.code, "VALIDATION");
ok("status (solo estados públicos)");
r = await req("GET", `/projects?sort=popular&status=abierto,en_curso`, undefined, T); assert.equal(r.body.items[0].name, "Tutor IA");
ok("sort=popular");

// ---- detalle
r = await req("GET", `/projects/${P1.id}`, undefined, Bo.token);
assert.equal(r.status, 200);
const d = r.body;
assert.equal(d.description, "Plataforma con mapas"); assert.equal(d.modality, "remoto"); assert.equal(d.status, "abierto");
assert.equal(d.creator.name, "Ana Pérez"); assert.equal(d.creator.initials, "AP");
assert.equal(d.roles.length, 2); assert.equal(d.roles[0].vacanciesAvailable, 0); assert.ok(d.roles[0].skills.length);
assert.equal(d.members.length, 4); assert.deepEqual(Object.keys(d.members[0]).sort(), ["initials","joinedAt","name","photoUrl","role","roleId","userId"]);
assert.equal(d.isMember, true); assert.equal(d.isOwner, false); assert.equal(d.myApplication, null);
assert.ok(!JSON.stringify(d).includes("@c.com"));
ok("GET /projects/:id: creador, roles, miembros, sin correos");
r = await req("GET", `/projects/${P2.id}`, undefined, Bo.token);
assert.deepEqual({ ...r.body.myApplication, id: undefined, createdAt: undefined }, { id: undefined, createdAt: undefined, roleId: P2.roles[0].id, status: "pendiente" });
r = await req("GET", `/projects/${P2.id}`, undefined, C.token); assert.equal(r.body.myApplication.status, "rechazada");
ok("myApplication del usuario autenticado");
r = await req("GET", `/projects/${BORR.id}`, undefined, Bo.token); assert.equal(r.status, 404); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
r = await req("GET", `/projects/${BORR.id}`, undefined, T); assert.equal(r.status, 200); assert.equal(r.body.status, "borrador"); assert.equal(r.body.isOwner, true);
await req("POST", `/projects/${BORR.id}/cancel`, undefined, T);
r = await req("GET", `/projects/${BORR.id}`, undefined, Bo.token); assert.equal(r.status, 404);
r = await req("GET", `/projects/99999`, undefined, T); assert.equal(r.status, 404);
r = await req("GET", `/projects/abc`, undefined, T); assert.equal(r.status, 400);
ok("borrador/cancelado solo para el creador; 404 PROJECT_NOT_FOUND");

// rendimiento básico (RNF34 < 1 s)
const t0 = performance.now(); await req("GET", `/projects?q=a&status=abierto,en_curso&sort=popular`, undefined, T);
assert.ok(performance.now() - t0 < 1000);
ok("respuesta < 1 s");
console.log(`Sprint 4: ${n} pruebas OK`);
server.close(); process.exit(0);

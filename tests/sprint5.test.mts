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

const P = (await req("POST", "/projects", { name: "Huertos", summary: "S", categoryId: cats[0].id, modality: "remoto" }, T)).body.project;
const R1 = (await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 1, dedication: "5-10", skillIds: [sk("React"), sk("TypeScript")] }, T)).body.role;
const R2 = (await req("POST", `/projects/${P.id}/roles`, { name: "Diseño", vacancies: 2, dedication: "10-20", skillIds: [sk("Figma")] }, T)).body.role;
const ap = (u: any, roleId = R1.id, note?: string) => req("POST", `/projects/${P.id}/roles/${roleId}/applications`, note ? { note } : {}, u.token);

// Bruno: React+TS (100%), Carla: React (50%), Dario: nada (0%)
await req("PUT", "/me/skills", { skillIds: [sk("React"), sk("TypeScript")] }, Bo.token);
await req("PUT", "/me/skills", { skillIds: [sk("React"), sk("Docker")] }, C.token);
await req("PATCH", "/me/profile", { headline: "Diseñadora UX", hoursPerWeek: 12, links: { github: "https://github.com/carla" } }, C.token);

let r = await ap(Bo); assert.equal(r.status, 404); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
ok("borrador: invisible para postular (404 PROJECT_NOT_FOUND)");
await req("POST", `/projects/${P.id}/publish`, undefined, T);

r = await ap(Bo, R1.id, "Me encanta React");
assert.equal(r.status, 201); assert.equal(r.body.application.status, "pendiente"); assert.equal(r.body.application.note, "Me encanta React");
const appBo = r.body.application;
ok("POST applications 201 pendiente");
r = await ap(Bo, R2.id); assert.equal(r.body.code, "ALREADY_APPLIED");
r = await ap(A); assert.equal(r.body.code, "OWNER_CANNOT_APPLY");
r = await req("POST", `/projects/${P.id}/roles/99999/applications`, {}, C.token); assert.equal(r.body.code, "ROLE_NOT_FOUND");
r = await req("POST", `/projects/99999/roles/${R1.id}/applications`, {}, C.token); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
r = await req("POST", `/projects/${P.id}/roles/${R1.id}/applications`, { note: "x".repeat(501) }, C.token); assert.equal(r.body.code, "VALIDATION");
ok("ALREADY_APPLIED / OWNER_CANNOT_APPLY / ROLE_NOT_FOUND / PROJECT_NOT_FOUND / nota > 500");
const appC = (await ap(C)).body.application;
const appD = (await ap(D)).body.application;
const appE = (await ap(E, R2.id)).body.application;

// ---- listado del creador
r = await req("GET", `/projects/${P.id}/applications`, undefined, T);
assert.equal(r.status, 200); assert.equal(r.body.total, 4); assert.equal(r.body.vacancies, 3);
assert.deepEqual(r.body.roleCounts.map((x: any) => [x.name, x.count]), [["Frontend", 3], ["Diseño", 1]]);
assert.deepEqual(r.body.items.map((x: any) => x.applicant.name.split(" ")[0]), ["Bruno", "Carla", "Elena", "Dario"]);
const byName = Object.fromEntries(r.body.items.map((x: any) => [x.applicant.name.split(" ")[0], x]));
assert.equal(byName.Bruno.matchPercent, 100); assert.equal(byName.Carla.matchPercent, 50); assert.equal(byName.Dario.matchPercent, 0); assert.equal(byName.Elena.matchPercent, 0);
assert.equal(byName.Bruno.isNew, true); assert.equal(byName.Bruno.note, "Me encanta React");
assert.equal(byName.Carla.applicant.headline, "Diseñadora UX"); assert.equal(byName.Carla.applicant.hoursPerWeek, 12); assert.equal(byName.Carla.applicant.links.github, "https://github.com/carla");
assert.equal(byName.Carla.applicant.skills[0].name, "React"); assert.equal(byName.Carla.applicant.skills[0].matches, true);
assert.equal(byName.Carla.applicant.initials, "CR");
assert.ok(!JSON.stringify(r.body).includes("@c.com"));
ok("GET /projects/:id/applications: roleCounts, vacancies, matchPercent, applicantCard sin correo");
r = await req("GET", `/projects/${P.id}/applications?sort=match`, undefined, T); assert.equal(r.body.items[0].matchPercent, 100); assert.equal(r.body.items[1].matchPercent, 50);
r = await req("GET", `/projects/${P.id}/applications?sort=recent`, undefined, T); assert.equal(r.body.items[0].id, appE.id);
r = await req("GET", `/projects/${P.id}/applications?roleId=${R2.id}`, undefined, T); assert.equal(r.body.total, 1); assert.equal(r.body.vacancies, 2); assert.equal(r.body.roleCounts[0].count, 3);
r = await req("GET", `/projects/${P.id}/applications?q=diseñadora`, undefined, T); assert.equal(r.body.total, 1); assert.equal(r.body.items[0].applicant.name, "Carla Ruiz");
r = await req("GET", `/projects/${P.id}/applications?q=dario`, undefined, T); assert.equal(r.body.total, 1);
r = await req("GET", `/projects/${P.id}/applications?limit=2&page=2`, undefined, T); assert.equal(r.body.items.length, 2); assert.equal(r.body.total, 4);
r = await req("GET", `/projects/${P.id}/applications`, undefined, Bo.token); assert.equal(r.status, 403); assert.equal(r.body.code, "NOT_OWNER");
ok("sort match/recent, roleId, q (nombre/headline), paginación, 403 NOT_OWNER");

// ---- cancelar
r = await req("POST", `/applications/${appD.id}/cancel`, undefined, C.token); assert.equal(r.status, 403); assert.equal(r.body.code, "NOT_APPLICANT");
r = await req("POST", `/applications/${appD.id}/cancel`, undefined, D.token); assert.equal(r.status, 200); assert.equal(r.body.application.status, "cancelada");
r = await req("POST", `/applications/${appD.id}/cancel`, undefined, D.token); assert.equal(r.body.code, "ALREADY_PROCESSED");
r = await req("POST", `/applications/99999/cancel`, undefined, D.token); assert.equal(r.body.code, "APPLICATION_NOT_FOUND");
ok("POST /applications/:id/cancel; ALREADY_PROCESSED; NOT_APPLICANT");
r = await ap(D, R2.id); assert.equal(r.status, 201); assert.equal(r.body.application.id, appD.id); assert.equal(r.body.application.roleId, R2.id);
ok("tras cancelar puede volver a postular (misma fila, otro rol)");

// ---- aceptar / rechazar (carrera por la última vacante de Frontend)
r = await req("POST", `/applications/${appBo.id}/accept`, undefined, Bo.token); assert.equal(r.body.code, "NOT_OWNER");
const [x1, x2] = await Promise.all([req("POST", `/applications/${appBo.id}/accept`, undefined, T), req("POST", `/applications/${appC.id}/accept`, undefined, T)]);
const codes = [x1, x2].map((x) => x.status).sort();
assert.deepEqual(codes, [200, 409]);
assert.equal([x1, x2].find((x) => x.status === 409)!.body.code, "NO_VACANCIES");
const ganador = x1.status === 200 ? appBo : appC; const perdedor = x1.status === 200 ? appC : appBo;
const rol1 = await prisma.rolProyecto.findUniqueOrThrow({ where: { id: BigInt(R1.id) } });
assert.equal(rol1.vacantesDisponibles, 0);
assert.equal(await prisma.miembroEquipo.count({ where: { rolProyectoId: BigInt(R1.id), estado: "Activo" } }), 1);
assert.equal((await prisma.postulacion.findUniqueOrThrow({ where: { id: BigInt(perdedor.id) } })).estado, "Pendiente");
ok("aceptaciones simultáneas: una gana, la otra 409 NO_VACANCIES, vacante nunca negativa");
r = await req("POST", `/applications/${ganador.id}/accept`, undefined, T); assert.equal(r.body.code, "NOT_PENDING");
r = await req("POST", `/applications/${perdedor.id}/reject`, undefined, T); assert.equal(r.status, 200); assert.equal(r.body.application.status, "rechazada");
r = await req("POST", `/applications/${perdedor.id}/reject`, undefined, T); assert.equal(r.body.code, "NOT_PENDING");
ok("reject 200; NOT_PENDING en resueltas");
r = await ap(E, R1.id); assert.equal(r.body.code, "ALREADY_APPLIED");
const F = await reg("Fabio", "Luna"); r = await ap(F, R1.id); assert.equal(r.body.code, "ROLE_FULL");
ok("ROLE_FULL cuando el rol no tiene vacantes");

// detalle refleja el equipo y myApplication
const winnerUser = ganador.id === appBo.id ? Bo : C;
r = await req("GET", `/projects/${P.id}`, undefined, winnerUser.token);
assert.equal(r.body.isMember, true); assert.equal(r.body.myApplication.status, "aceptada"); assert.equal(r.body.members.length, 1);
ok("el aceptado aparece en members y su myApplication es aceptada");

// ---- mis postulaciones
r = await req("GET", "/me/applications", undefined, winnerUser.token);
assert.equal(r.status, 200); assert.deepEqual(r.body.summary, { sent: 1, inReview: 0, accepted: 1, finished: 0 });
assert.equal(r.body.items[0].project.name, "Huertos"); assert.equal(r.body.items[0].role.name, "Frontend"); assert.match(r.body.items[0].project.coverColor, /^#/);
const P2 = (await req("POST", "/projects", { name: "Otro", summary: "S", categoryId: cats[1].id, modality: "presencial" }, T)).body.project;
const R3 = (await req("POST", `/projects/${P2.id}/roles`, { name: "QA", vacancies: 1, dedication: "5-10" }, T)).body.role;
await req("POST", `/projects/${P2.id}/publish`, undefined, T);
await req("POST", `/projects/${P2.id}/roles/${R3.id}/applications`, {}, perdedor.id === appBo.id ? Bo.token : C.token);
const loser = perdedor.id === appBo.id ? Bo : C;
r = await req("GET", "/me/applications", undefined, loser.token);
assert.deepEqual(r.body.summary, { sent: 2, inReview: 1, accepted: 0, finished: 1 });
r = await req("GET", "/me/applications?status=rechazada", undefined, loser.token); assert.equal(r.body.total, 1); assert.equal(r.body.items[0].status, "rechazada"); assert.equal(r.body.summary.sent, 2);
ok("GET /me/applications: summary y filtro status");

// ---- estado del proyecto
await req("PATCH", `/projects/${P.id}/status`, { status: "pausado" }, T);
r = await ap(F, R2.id); assert.equal(r.body.code, "PROJECT_NOT_OPEN");
r = await req("POST", `/applications/${appE.id}/accept`, undefined, T); assert.equal(r.body.code, "PROJECT_NOT_OPEN");
await req("PATCH", `/projects/${P.id}/status`, { status: "en_curso" }, T);
r = await req("POST", `/applications/${appE.id}/accept`, undefined, T); assert.equal(r.status, 200);
ok("pausado: no recibe ni acepta; en_curso: puede aceptar pendientes pero no recibe nuevas");
r = await req("DELETE", `/projects/${P.id}/roles/${R2.id}`, undefined, T); assert.equal(r.body.code, "ROLE_HAS_MEMBERS");
ok("rol con miembro aceptado no se puede borrar");
r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
assert.equal(r.paths["/api/postulaciones"], undefined); assert.ok(r.paths["/api/applications/{id}/accept"]);
ok("Swagger sin CRUD viejo de postulaciones");
console.log(`Sprint 5: ${n} pruebas OK`);
server.close(); process.exit(0);

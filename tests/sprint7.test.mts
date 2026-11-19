import assert from "node:assert/strict";
import { execSync } from "node:child_process";
execSync("npx tsx src/db/seed.ts", { stdio: "ignore" });
const { app } = await import("../src/app.ts");
const { attachRealtime } = await import("../src/lib/realtime.ts");
const { prisma } = await import("../src/lib/prisma.ts");
const { WebSocket } = await import("ws");
const server = app.listen(0); attachRealtime(server);
const port = (server.address() as { port: number }).port;
const B = `http://127.0.0.1:${port}/api`;
async function req(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
let n = 0; const ok = (name: string) => console.log(`  ok ${++n} ${name}`);
const reg = async (f: string, l: string) => (await req("POST", "/auth/register", { firstName: f, lastName: l, email: `${f}@c.com`, password: "Secreta123" })).body;
const A = await reg("Ana", "Pérez"), Bo = await reg("Bruno", "Díaz"), C = await reg("Carla", "Ruiz"), D = await reg("Dario", "Soto");
const T = A.token;
const cats = (await req("GET", "/categories")).body;
const P = (await req("POST", "/projects", { name: "Huertos", summary: "S", categoryId: cats[0].id, modality: "remoto" }, T)).body.project;
const R1 = (await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 3, dedication: "5-10" }, T)).body.role;
await req("POST", `/projects/${P.id}/publish`, undefined, T);
const conectar = (tok: string) => new Promise<{ ws: any; events: any[] }>((res) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${tok}`); const events: any[] = [];
  ws.on("message", (d: any) => { const e = JSON.parse(String(d)); if (e.type === "ready") res({ ws, events }); else events.push(e); });
});
const wsA = await conectar(T), wsB = await conectar(Bo.token);

// ---- postulación -> creador
const appB = (await req("POST", `/projects/${P.id}/roles/${R1.id}/applications`, { note: "hola" }, Bo.token)).body.application;
await wait();
let r = await req("GET", "/notifications", undefined, T);
assert.equal(r.status, 200); assert.equal(r.body.unreadCount, 1); assert.equal(r.body.total, 1);
const n1 = r.body.items[0];
assert.equal(n1.type, "new_application"); assert.equal(n1.read, false); assert.match(n1.message, /Bruno Díaz postuló al rol Frontend en Huertos/);
assert.deepEqual({ p: n1.payload.projectId, a: n1.payload.applicationId, r: n1.payload.roleName }, { p: P.id, a: appB.id, r: "Frontend" });
const wsN = wsA.events.find((e) => e.type === "notification:new");
assert.equal(wsN.data.notification.id, n1.id);
ok("postular notifica al creador (BD + WS notification:new) con payload navegable");

// ---- aceptar / rechazar -> postulante
await req("POST", `/applications/${appB.id}/accept`, undefined, T);
const appC = (await req("POST", `/projects/${P.id}/roles/${R1.id}/applications`, {}, C.token)).body.application;
await req("POST", `/applications/${appC.id}/reject`, undefined, T);
await wait();
r = await req("GET", "/notifications", undefined, Bo.token); assert.equal(r.body.items[0].type, "application_accepted"); assert.match(r.body.items[0].message, /Te aceptaron como Frontend/);
assert.ok(wsB.events.some((e) => e.type === "notification:new" && e.data.notification.type === "application_accepted"));
r = await req("GET", "/notifications", undefined, C.token); assert.equal(r.body.items[0].type, "application_rejected"); assert.equal(r.body.items[0].payload.reason, "rejected");
ok("aceptar y rechazar notifican al postulante");

// ---- leer
r = await req("GET", "/notifications", undefined, T); assert.equal(r.body.unreadCount, 2);
const firstId = r.body.items[r.body.items.length - 1].id;
r = await req("POST", `/notifications/${firstId}/read`, undefined, Bo.token); assert.equal(r.status, 404); assert.equal(r.body.code, "NOTIFICATION_NOT_FOUND");
r = await req("POST", `/notifications/${firstId}/read`, undefined, T); assert.equal(r.status, 204);
r = await req("GET", "/notifications?unreadOnly=true", undefined, T); assert.equal(r.body.unreadCount, 1); assert.equal(r.body.total, 1); assert.ok(r.body.items.every((x: any) => !x.read));
r = await req("POST", "/notifications/read-all", undefined, T); assert.equal(r.status, 204);
r = await req("GET", "/notifications", undefined, T); assert.equal(r.body.unreadCount, 0); assert.equal(r.body.total, 2);
r = await req("GET", "/notifications?limit=1&page=2", undefined, T); assert.equal(r.body.items.length, 1);
ok("read / read-all / unreadOnly / paginación; no se puede leer la de otro");

// ---- counters
await req("POST", `/conversations/${(await req("GET", "/conversations", undefined, T)).body[0].id}/messages`, { text: "Bienvenido" }, T);
await req("POST", `/conversations/${(await req("GET", "/conversations", undefined, T)).body[0].id}/messages`, { text: "¿Todo bien?" }, T);
r = await req("GET", "/me/counters", undefined, Bo.token);
assert.deepEqual(r.body, { unreadNotifications: 1, unreadMessages: 2 });
r = await req("GET", "/me/counters", undefined, T); assert.deepEqual(r.body, { unreadNotifications: 0, unreadMessages: 0 });
r = await req("GET", "/me/counters", undefined, C.token); assert.equal(r.body.unreadMessages, 0);
await req("POST", `/conversations/${(await req("GET", "/conversations", undefined, Bo.token)).body[0].id}/read`, undefined, Bo.token);
assert.equal((await req("GET", "/me/counters", undefined, Bo.token)).body.unreadMessages, 0);
ok("GET /me/counters: notificaciones y mensajes no leídos (no cuenta chats ajenos)");

// ---- estado del proyecto / salir / remover
const appD = (await req("POST", `/projects/${P.id}/roles/${R1.id}/applications`, {}, D.token)).body.application;
await req("PATCH", `/projects/${P.id}/status`, { status: "en_curso" }, T);
r = await req("GET", "/notifications", undefined, Bo.token); assert.equal(r.body.items[0].type, "project_status_changed"); assert.equal(r.body.items[0].payload.status, "en_curso"); assert.equal(r.body.items[0].payload.from, "abierto");
assert.equal((await req("GET", "/notifications", undefined, D.token)).body.total, 0);
ok("cambio de estado notifica a los miembros");
await req("PATCH", `/projects/${P.id}/status`, { status: "cerrado" }, T);
r = await req("GET", "/notifications", undefined, D.token); assert.equal(r.body.items[0].type, "application_rejected"); assert.equal(r.body.items[0].payload.reason, "project_closed"); assert.equal(r.body.items[0].payload.applicationId, appD.id);
ok("cerrar avisa a postulantes pendientes (reason project_closed)");

const P2 = (await req("POST", "/projects", { name: "Tutor IA", summary: "S", categoryId: cats[1].id, modality: "remoto" }, T)).body.project;
const R2 = (await req("POST", `/projects/${P2.id}/roles`, { name: "ML", vacancies: 3, dedication: "20+" }, T)).body.role;
await req("POST", `/projects/${P2.id}/publish`, undefined, T);
for (const u of [Bo, C]) { const a = (await req("POST", `/projects/${P2.id}/roles/${R2.id}/applications`, {}, u.token)).body.application; await req("POST", `/applications/${a.id}/accept`, undefined, T); }
await req("POST", `/projects/${P2.id}/leave`, undefined, Bo.token);
r = await req("GET", "/notifications", undefined, T); assert.equal(r.body.items[0].type, "member_left"); assert.match(r.body.items[0].message, /Bruno Díaz salió del equipo de Tutor IA/);
await req("DELETE", `/projects/${P2.id}/members/${C.user.id}`, { reason: "Inactividad" }, T);
r = await req("GET", "/notifications", undefined, C.token); assert.equal(r.body.items[0].type, "member_removed"); assert.equal(r.body.items[0].payload.reason, "Inactividad");
const appD2 = (await req("POST", `/projects/${P2.id}/roles/${R2.id}/applications`, {}, D.token)).body.application;
await req("POST", `/projects/${P2.id}/cancel`, undefined, T);
r = await req("GET", "/notifications", undefined, D.token); assert.equal(r.body.items[0].payload.reason, "project_cancelled"); assert.equal(r.body.items[0].payload.applicationId, appD2.id);
ok("salir, remover y cancelar generan sus notificaciones");

// ---- reportes
const P3 = (await req("POST", "/projects", { name: "Marketplace", summary: "S", categoryId: cats[1].id, modality: "remoto" }, T)).body.project;
const R3 = (await req("POST", `/projects/${P3.id}/roles`, { name: "Dev", vacancies: 1, dedication: "5-10" }, T)).body.role;
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "spam", description: "x" }, Bo.token); assert.equal(r.body.code, "PROJECT_NOT_FOUND");
await req("POST", `/projects/${P3.id}/publish`, undefined, T);
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "propiedad_intelectual", description: "Copia de otra app" }, Bo.token);
assert.equal(r.status, 201); assert.deepEqual({ ...r.body.report, id: undefined, createdAt: undefined }, { id: undefined, createdAt: undefined, projectId: P3.id, reason: "propiedad_intelectual", description: "Copia de otra app", status: "abierto" });
assert.equal((await prisma.reporte.findFirstOrThrow()).severidad, "alta");
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "spam", description: "otra vez" }, Bo.token); assert.equal(r.status, 409); assert.equal(r.body.code, "ALREADY_REPORTED");
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "spam", description: "x" }, T); assert.equal(r.body.code, "CANNOT_REPORT_OWN");
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "spam", description: "" }, C.token); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "odio", description: "x" }, C.token); assert.equal(r.body.code, "VALIDATION");
r = await req("POST", `/projects/${P3.id}/reports`, { reason: "spam", description: "Publicidad" }, C.token); assert.equal(r.status, 201);
ok("POST /projects/:id/reports: severidad, ALREADY_REPORTED, CANNOT_REPORT_OWN, validación");

r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
for (const p of ["/api/notificaciones", "/api/notificaciones-email", "/api/reportes"]) assert.equal(r.paths[p], undefined);
assert.ok(r.paths["/api/me/counters"]);
ok("Swagger sin CRUD viejo de notificaciones/reportes");
wsA.ws.close(); wsB.ws.close();
console.log(`Sprint 7: ${n} pruebas OK`);
server.close(); process.exit(0);

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
  const isForm = body instanceof FormData;
  const r = await fetch(B + path, { method, headers: { ...(isForm ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
let n = 0; const ok = (name: string) => console.log(`  ok ${++n} ${name}`);
const reg = async (f: string, l: string) => (await req("POST", "/auth/register", { firstName: f, lastName: l, email: `${f}@c.com`, password: "Secreta123" })).body;
const A = await reg("Ana", "Pérez"), Bo = await reg("Bruno", "Díaz"), C = await reg("Carla", "Ruiz"), X = await reg("Xavi", "Mora");
const T = A.token;
const cats = (await req("GET", "/categories")).body;
const P = (await req("POST", "/projects", { name: "Huertos urbanos", summary: "S", categoryId: cats[0].id, modality: "remoto" }, T)).body.project;
const R1 = (await req("POST", `/projects/${P.id}/roles`, { name: "Frontend", vacancies: 2, dedication: "5-10" }, T)).body.role;
let r = await req("GET", "/conversations", undefined, T); assert.equal(r.body.length, 0);
await req("POST", `/projects/${P.id}/publish`, undefined, T);
const join = async (u: any) => { const a = (await req("POST", `/projects/${P.id}/roles/${R1.id}/applications`, {}, u.token)).body.application; await req("POST", `/applications/${a.id}/accept`, undefined, T); };
await join(Bo); await join(C);

// ---- equipo
r = await req("GET", `/projects/${P.id}/team`, undefined, X.token);
assert.equal(r.status, 200); assert.equal(r.body.length, 3);
assert.deepEqual(r.body[0], { ...r.body[0], name: "Ana Pérez", role: "Líder del proyecto", isLeader: true, roleId: null });
assert.equal(r.body[1].role, "Frontend"); assert.equal(r.body[1].isLeader, false); assert.equal(r.body[1].initials, "BD");
ok("GET /projects/:id/team: creador primero como líder");

// ---- conversaciones
r = await req("GET", "/conversations", undefined, Bo.token);
assert.equal(r.body.length, 1); const conv = r.body[0];
assert.deepEqual(conv.project, { ...conv.project, id: P.id, name: "Huertos urbanos", initials: "HU", status: "abierto" });
assert.equal(conv.lastMessage, null); assert.equal(conv.unreadCount, 0);
assert.equal((await req("GET", "/conversations", undefined, X.token)).body.length, 0);
ok("publicar crea la conversación; solo la ven creador y miembros");
r = await req("GET", `/conversations/${conv.id}`, undefined, C.token);
assert.equal(r.body.membersCount, 3); assert.equal(r.body.projectStatus, "abierto"); assert.equal(r.body.members[0].isLeader, true);
r = await req("GET", `/conversations/${conv.id}`, undefined, X.token); assert.equal(r.status, 403); assert.equal(r.body.code, "NOT_MEMBER");
r = await req("GET", `/conversations/99999`, undefined, T); assert.equal(r.body.code, "CONVERSATION_NOT_FOUND");
r = await req("GET", `/conversations/${conv.id}/messages`, undefined, X.token); assert.equal(r.body.code, "NOT_MEMBER");
r = await req("POST", `/conversations/${conv.id}/messages`, { text: "hola" }, X.token); assert.equal(r.body.code, "NOT_MEMBER");
ok("GET /conversations/:id; 403 NOT_MEMBER; 404");

// ---- WebSocket
const wsUrl = `ws://127.0.0.1:${port}/ws?token=`;
const bad = await new Promise((res) => { const w = new WebSocket(wsUrl + "basura"); w.on("error", () => res("rechazado")); w.on("open", () => res("abierto")); });
assert.equal(bad, "rechazado");
const conectar = (tok: string) => new Promise<{ ws: any; events: any[] }>((res) => {
  const ws = new WebSocket(wsUrl + tok); const events: any[] = [];
  ws.on("message", (d: any) => { const e = JSON.parse(String(d)); if (e.type === "ready") res({ ws, events }); else events.push(e); });
});
const wsC = await conectar(C.token), wsX = await conectar(X.token), wsA = await conectar(T);
ok("WS: token inválido rechazado; válido recibe ready");

r = await req("POST", `/conversations/${conv.id}/messages`, { text: "  Hola equipo  " }, Bo.token);
assert.equal(r.status, 201); const m1 = r.body.message;
assert.equal(m1.text, "Hola equipo"); assert.equal(m1.author.name, "Bruno Díaz"); assert.equal(m1.readByOthers, false); assert.deepEqual(m1.attachments, []);
await new Promise((res) => setTimeout(res, 150));
assert.equal(wsC.events.length, 1); assert.equal(wsC.events[0].type, "message:new"); assert.equal(wsC.events[0].data.message.id, m1.id); assert.equal(wsC.events[0].data.conversationId, conv.id);
assert.equal(wsX.events.length, 0);
ok("POST mensaje 201; WS message:new a participantes y no a externos");
r = await req("POST", `/conversations/${conv.id}/messages`, { text: "   " }, Bo.token); assert.equal(r.body.code, "EMPTY_MESSAGE");
r = await req("POST", `/conversations/${conv.id}/messages`, { text: "x".repeat(2001) }, Bo.token); assert.equal(r.body.code, "VALIDATION");
ok("EMPTY_MESSAGE / texto > 2000");

// adjuntos
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200)]);
let fd = new FormData(); fd.append("file", new Blob([pdf], { type: "application/pdf" }), "propuesta.pdf"); fd.append("text", "Mira esto");
r = await req("POST", `/conversations/${conv.id}/messages`, fd, C.token);
assert.equal(r.status, 201, JSON.stringify(r.body)); const m2 = r.body.message;
assert.equal(m2.text, "Mira esto"); assert.equal(m2.attachments[0].name, "propuesta.pdf"); assert.equal(m2.attachments[0].mimeType, "application/pdf"); assert.equal(m2.attachments[0].size, pdf.length);
assert.equal((await fetch(m2.attachments[0].url)).status, 200);
fd = new FormData(); fd.append("file", new Blob([Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(50)])]), "captura.png");
r = await req("POST", `/conversations/${conv.id}/messages`, fd, T); assert.equal(r.status, 201); assert.equal(r.body.message.text, null);
const m3 = r.body.message;
fd = new FormData(); fd.append("file", new Blob([Buffer.from([0xff,0xd8,0xff,0xe0,0,0])]), "foto.jpg");
r = await req("POST", `/conversations/${conv.id}/messages`, fd, T); assert.equal(r.body.code, "INVALID_FILE");
fd = new FormData(); fd.append("file", new Blob([Buffer.concat([pdf, Buffer.alloc(10*1024*1024)])]), "big.pdf");
r = await req("POST", `/conversations/${conv.id}/messages`, fd, T); assert.equal(r.body.code, "INVALID_FILE");
ok("adjuntos: PDF con texto, PNG solo; JPG y > 10 MB → INVALID_FILE");

// ---- listado, no leídos, lectura
r = await req("GET", "/conversations", undefined, Bo.token);
assert.equal(r.body[0].unreadCount, 2); assert.equal(r.body[0].lastMessage.text, "Archivo adjunto"); assert.equal(r.body[0].lastMessage.authorName, "Ana Pérez");
r = await req("GET", "/conversations", undefined, T); assert.equal(r.body[0].unreadCount, 0); // enviar marca como leído lo anterior
ok("unreadCount (los propios no cuentan) y lastMessage");
r = await req("GET", `/conversations/${conv.id}/messages`, undefined, Bo.token);
assert.deepEqual(r.body.map((m: any) => m.id), [m1.id, m2.id, m3.id]);
assert.equal(r.body[0].readByOthers, true); // Carla y Ana enviaron después → ya lo vieron
r = await req("GET", `/conversations/${conv.id}/messages?limit=2`, undefined, Bo.token); assert.deepEqual(r.body.map((m: any) => m.id), [m2.id, m3.id]);
r = await req("GET", `/conversations/${conv.id}/messages?before=${m2.id}`, undefined, Bo.token); assert.deepEqual(r.body.map((m: any) => m.id), [m1.id]);
r = await req("GET", `/conversations/${conv.id}/messages?after=${m1.id}`, undefined, Bo.token); assert.deepEqual(r.body.map((m: any) => m.id), [m2.id, m3.id]);
r = await req("GET", `/conversations/${conv.id}/messages?after=${m3.id}`, undefined, Bo.token); assert.deepEqual(r.body, []);
ok("mensajes cronológicos; limit, before (historial) y after (polling)");
const before = wsA.events.length;
r = await req("POST", `/conversations/${conv.id}/read`, undefined, Bo.token); assert.equal(r.status, 204);
assert.equal((await req("GET", "/conversations", undefined, Bo.token)).body[0].unreadCount, 0);
await new Promise((res) => setTimeout(res, 150));
const readEv = wsA.events.slice(before).find((e) => e.type === "message:read");
assert.equal(readEv.data.userId, Bo.user.id);
r = await req("GET", `/conversations/${conv.id}/messages`, undefined, T); assert.equal(r.body[2].readByOthers, true);
ok("POST read 204: unreadCount 0, WS message:read, readByOthers");

// ---- salir / remover
r = await req("POST", `/projects/${P.id}/leave`, undefined, T); assert.equal(r.body.code, "OWNER_CANNOT_LEAVE");
r = await req("POST", `/projects/${P.id}/leave`, undefined, X.token); assert.equal(r.body.code, "NOT_MEMBER");
r = await req("POST", `/projects/${P.id}/leave`, undefined, Bo.token); assert.equal(r.status, 204);
assert.equal((await prisma.rolProyecto.findUniqueOrThrow({ where: { id: BigInt(R1.id) } })).vacantesDisponibles, 1);
r = await req("GET", `/conversations/${conv.id}/messages`, undefined, Bo.token); assert.equal(r.body.code, "NOT_MEMBER");
assert.equal((await req("GET", `/projects/${P.id}/team`, undefined, T)).body.length, 2);
assert.equal((await prisma.miembroEquipo.findFirstOrThrow({ where: { usuarioId: BigInt(Bo.user.id) } })).estado, "Retirado");
ok("leave 204: libera vacante y quita acceso al chat");
r = await req("DELETE", `/projects/${P.id}/members/${C.user.id}`, { reason: "x" }, C.token); assert.equal(r.body.code, "NOT_OWNER");
r = await req("DELETE", `/projects/${P.id}/members/${C.user.id}`, {}, T); assert.equal(r.body.code, "VALIDATION");
r = await req("DELETE", `/projects/${P.id}/members/${X.user.id}`, { reason: "x" }, T); assert.equal(r.body.code, "MEMBER_NOT_FOUND");
r = await req("DELETE", `/projects/${P.id}/members/${C.user.id}`, { reason: "Inactividad" }, T); assert.equal(r.status, 204);
const mc = await prisma.miembroEquipo.findFirstOrThrow({ where: { usuarioId: BigInt(C.user.id) } });
assert.equal(mc.estado, "Removido"); assert.equal(mc.motivoBaja, "Inactividad");
assert.equal((await prisma.rolProyecto.findUniqueOrThrow({ where: { id: BigInt(R1.id) } })).vacantesDisponibles, 2);
assert.equal((await req("GET", "/conversations", undefined, C.token)).body.length, 0);
ok("DELETE member: motivo obligatorio, reabre vacante, quita acceso");

// ---- chat de solo lectura al cerrar
await req("PATCH", `/projects/${P.id}/status`, { status: "cerrado" }, T);
r = await req("POST", `/conversations/${conv.id}/messages`, { text: "hola" }, T); assert.equal(r.body.code, "PROJECT_CLOSED");
r = await req("GET", `/conversations/${conv.id}/messages`, undefined, T); assert.equal(r.status, 200);
ok("proyecto cerrado: chat de solo lectura");

r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
const content = r.paths["/api/conversations/{id}/messages"].post.requestBody.content;
assert.ok(content["application/json"] && content["multipart/form-data"].schema.properties.text);
assert.equal(r.paths["/api/mensajes"], undefined);
ok("Swagger: JSON o multipart en enviar mensaje; sin CRUD viejo");
for (const w of [wsC, wsX, wsA]) w.ws.close();
console.log(`Sprint 6: ${n} pruebas OK`);
server.close(); process.exit(0);

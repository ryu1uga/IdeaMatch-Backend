import assert from "node:assert/strict";
const { app } = await import("../src/app.ts");
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const B = `http://127.0.0.1:${port}/api`;

async function req(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
let n = 0;
const ok = (name: string) => console.log(`  ok ${++n} ${name}`);

let r = await req("POST", "/auth/register", { firstName: "Ana", lastName: "Pérez", email: "Ana@Correo.com", password: "Secreta123" });
assert.equal(r.status, 201, JSON.stringify(r.body));
assert.ok(r.body.token);
assert.deepEqual(Object.keys(r.body.user).sort(), ["createdAt", "email", "firstName", "id", "isAdmin", "lastName"]);
assert.equal(r.body.user.email, "ana@correo.com");
assert.equal(r.body.user.isAdmin, false);
ok("register 201 { token, user }");

r = await req("POST", "/auth/register", { firstName: "A", lastName: "B", email: "ana@correo.com", password: "Secreta123" });
assert.equal(r.status, 409); assert.equal(r.body.code, "EMAIL_TAKEN_OR_INVALID");
ok("register email repetido 409");
r = await req("POST", "/auth/register", { firstName: "A", lastName: "B", email: "no-es-correo", password: "Secreta123" });
assert.equal(r.status, 409); assert.equal(r.body.code, "EMAIL_TAKEN_OR_INVALID");
ok("register email inválido 409");
for (const p of ["corta1A", "sinmayuscula1", "SinNumeroXX"]) {
  r = await req("POST", "/auth/register", { firstName: "A", lastName: "B", email: `x${p}@c.com`, password: p });
  assert.equal(r.status, 400); assert.equal(r.body.code, "WEAK_PASSWORD");
}
ok("register password débil 400 WEAK_PASSWORD");
r = await req("POST", "/auth/register", { email: "z@c.com", password: "Secreta123" });
assert.equal(r.status, 400); assert.equal(r.body.code, "VALIDATION");
ok("register sin nombres 400 VALIDATION");

r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "mala" });
assert.equal(r.status, 401); assert.equal(r.body.code, "INVALID_CREDENTIALS");
const msg = r.body.message;
r = await req("POST", "/auth/login", { email: "nadie@correo.com", password: "Secreta123" });
assert.equal(r.status, 401); assert.equal(r.body.message, msg);
ok("login inválido 401 mismo mensaje");

r = await req("POST", "/auth/login", { email: "ANA@correo.com", password: "Secreta123" });
assert.equal(r.status, 200); const token = r.body.token; assert.equal(r.body.user.firstName, "Ana");
ok("login 200");

r = await req("GET", "/auth/me", undefined, token);
assert.equal(r.status, 200); assert.equal(r.body.user.lastName, "Pérez");
ok("me 200 { user }");
r = await req("GET", "/auth/me");
assert.equal(r.status, 401); assert.equal(r.body.code, "UNAUTHORIZED");
r = await req("GET", "/auth/me", undefined, "basura");
assert.equal(r.status, 401); assert.equal(r.body.code, "INVALID_TOKEN");
ok("me sin token / token inválido 401");

r = await req("POST", "/auth/logout", undefined, token);
assert.equal(r.status, 204);
r = await req("GET", "/auth/me", undefined, token);
assert.equal(r.status, 401);
ok("logout 204 invalida el token");
r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "Secreta123" });
r = await req("GET", "/auth/me", undefined, r.body.token);
assert.equal(r.status, 200);
ok("nuevo login sigue funcionando");

r = await req("GET", "/nada");
assert.equal(r.status, 404); assert.equal(r.body.code, "ROUTE_NOT_FOUND");
ok("formato de error { code, message }");

console.log(`Sprint 1: ${n} pruebas OK`);
server.close();
process.exit(0);

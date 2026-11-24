// Verificación de correo y recuperación de contraseña con código de 6 dígitos
process.env.REQUIRE_EMAIL_VERIFICATION = "true";

import assert from "node:assert/strict";
const { app } = await import("../src/app.ts");
const { bandejaDePrueba } = await import("../src/lib/mailer.ts");
const { prisma } = await import("../src/lib/prisma.ts");
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
const ultimoCodigo = (to: string) => {
  const m = [...bandejaDePrueba].reverse().find((c) => c.to === to);
  assert.ok(m, `no hay correo para ${to}`);
  const codigo = m.text.match(/\b(\d{6})\b/)?.[1];
  assert.ok(codigo);
  return { codigo, correo: m };
};
// Simula que pasó la espera entre reenvíos
const envejecerCodigos = () =>
  prisma.token.updateMany({ data: { fechaCreacion: new Date(Date.now() - 2 * 60 * 1000) } });

// ---------- Registro: sin token, con código por correo
let r = await req("POST", "/auth/register", { firstName: "Ana", lastName: "Pérez", email: "Ana@Correo.com", password: "Secreta123" });
assert.equal(r.status, 201, JSON.stringify(r.body));
assert.equal(r.body.token, undefined);
assert.equal(r.body.verificationRequired, true);
assert.equal(r.body.emailSent, true);
assert.equal(r.body.user.email, "ana@correo.com");
let { codigo, correo } = ultimoCodigo("ana@correo.com");
assert.match(correo.subject, new RegExp(codigo));
assert.ok(correo.html.includes(codigo) && correo.html.includes("Ana"));
ok("register 201 sin token y envía código de 6 dígitos");

const fila = await prisma.token.findFirstOrThrow({ where: { tipo: "Verificacion_Email" } });
assert.notEqual(fila.valor, codigo);
ok("el código se guarda como hash");

r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "Secreta123" });
assert.equal(r.status, 403); assert.equal(r.body.code, "EMAIL_NOT_VERIFIED");
r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "Mala1234" });
assert.equal(r.status, 401); assert.equal(r.body.code, "INVALID_CREDENTIALS");
ok("login sin verificar 403 EMAIL_NOT_VERIFIED (solo con la contraseña correcta)");

r = await req("POST", "/auth/verify-email", { email: "ana@correo.com", code: "12345" });
assert.equal(r.status, 400); assert.equal(r.body.code, "VALIDATION");
const malo = codigo === "000000" ? "111111" : "000000";
r = await req("POST", "/auth/verify-email", { email: "ana@correo.com", code: malo });
assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_CODE"); assert.equal(r.body.details.attemptsLeft, 4);
ok("código con formato inválido / incorrecto 400");

// ---------- Reenvío: respeta la espera y anula el código anterior
const enviados = bandejaDePrueba.length;
r = await req("POST", "/auth/resend-verification", { email: "ana@correo.com" });
assert.equal(r.status, 204); assert.equal(bandejaDePrueba.length, enviados);
ok("resend dentro de los 60 s no reenvía");
await envejecerCodigos();
r = await req("POST", "/auth/resend-verification", { email: "ana@correo.com" });
assert.equal(r.status, 204); assert.equal(bandejaDePrueba.length, enviados + 1);
const anterior = codigo;
({ codigo } = ultimoCodigo("ana@correo.com"));
if (anterior !== codigo) {
  r = await req("POST", "/auth/verify-email", { email: "ana@correo.com", code: anterior });
  assert.equal(r.body.code, "INVALID_CODE");
}
r = await req("POST", "/auth/resend-verification", { email: "nadie@correo.com" });
assert.equal(r.status, 204);
ok("resend envía uno nuevo, anula el anterior y no revela cuentas");

r = await req("POST", "/auth/verify-email", { email: "ANA@correo.com", code: codigo });
assert.equal(r.status, 200, JSON.stringify(r.body)); assert.ok(r.body.token);
r = await req("GET", "/auth/me", undefined, r.body.token);
assert.equal(r.status, 200);
r = await req("POST", "/auth/verify-email", { email: "ana@correo.com", code: codigo });
assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_CODE");
r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "Secreta123" });
assert.equal(r.status, 200);
ok("verify-email 200 { token, user }, código de un solo uso y login habilitado");

// ---------- Máximo de intentos
await req("POST", "/auth/register", { firstName: "Luis", lastName: "G", email: "luis@c.com", password: "Secreta123" });
({ codigo } = ultimoCodigo("luis@c.com"));
const otro = codigo === "999999" ? "888888" : "999999";
for (let i = 0; i < 5; i++) await req("POST", "/auth/verify-email", { email: "luis@c.com", code: otro });
r = await req("POST", "/auth/verify-email", { email: "luis@c.com", code: codigo });
assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_CODE");
ok("tras 5 intentos fallidos el código se invalida");

// ---------- Código vencido
await envejecerCodigos();
await req("POST", "/auth/resend-verification", { email: "luis@c.com" });
({ codigo } = ultimoCodigo("luis@c.com"));
await prisma.token.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
r = await req("POST", "/auth/verify-email", { email: "luis@c.com", code: codigo });
assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_CODE");
ok("código vencido 400 INVALID_CODE");

// ---------- Recuperación de contraseña
r = await req("POST", "/auth/forgot-password", { email: "nadie@correo.com" });
assert.equal(r.status, 204);
r = await req("POST", "/auth/forgot-password", { email: "ana@correo.com" });
assert.equal(r.status, 204);
({ codigo, correo } = ultimoCodigo("ana@correo.com"));
assert.match(correo.subject, /restablecer/);
r = await req("POST", "/auth/reset-password", { email: "ana@correo.com", code: codigo, newPassword: "debil" });
assert.equal(r.status, 400); assert.equal(r.body.code, "WEAK_PASSWORD");
r = await req("POST", "/auth/reset-password", { email: "ana@correo.com", code: codigo, newPassword: "NuevaClave123" });
assert.equal(r.status, 204, JSON.stringify(r.body));
r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "Secreta123" });
assert.equal(r.status, 401);
r = await req("POST", "/auth/login", { email: "ana@correo.com", password: "NuevaClave123" });
assert.equal(r.status, 200);
r = await req("POST", "/auth/reset-password", { email: "ana@correo.com", code: codigo, newPassword: "OtraClave123" });
assert.equal(r.body.code, "INVALID_CODE");
ok("forgot/reset: cambia la contraseña y el código es de un solo uso");

// Restablecer también verifica una cuenta pendiente
await envejecerCodigos();
await req("POST", "/auth/forgot-password", { email: "luis@c.com" });
({ codigo } = ultimoCodigo("luis@c.com"));
r = await req("POST", "/auth/reset-password", { email: "luis@c.com", code: codigo, newPassword: "Secreta456" });
assert.equal(r.status, 204);
r = await req("POST", "/auth/login", { email: "luis@c.com", password: "Secreta456" });
assert.equal(r.status, 200);
ok("reset-password también verifica una cuenta pendiente");

console.log(`Verificación por correo: ${n} pruebas OK`);
server.close();
process.exit(0);

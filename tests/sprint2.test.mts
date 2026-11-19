import assert from "node:assert/strict";
import { execSync } from "node:child_process";
execSync("npx tsx src/db/seed.ts", { stdio: "inherit" });
const { app } = await import("../src/app.ts");
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const B = `http://127.0.0.1:${port}/api`;

async function req(method: string, path: string, body?: unknown, token?: string) {
  const isForm = body instanceof FormData;
  const r = await fetch(B + path, {
    method,
    headers: { ...(isForm ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
let n = 0;
const ok = (name: string) => console.log(`  ok ${++n} ${name}`);

const reg = await req("POST", "/auth/register", { firstName: "Ana", lastName: "Pérez", email: "ana@c.com", password: "Secreta123" });
const T = reg.body.token; const myId = reg.body.user.id;

let r = await req("GET", "/me/profile", undefined, T);
assert.equal(r.status, 200);
assert.deepEqual(Object.keys(r.body.profile).sort(), ["bio","firstName","headline","hoursPerWeek","id","interests","lastName","links","location","photoUrl","skills"]);
assert.equal(r.body.profile.firstName, "Ana"); assert.deepEqual(r.body.profile.skills, []);
ok("GET /me/profile");

r = await req("PATCH", "/me/profile", { headline: "Diseñadora UX", location: "Lima", bio: "Hola", hoursPerWeek: 15, links: { github: "https://github.com/ana" }, lastName: "Pérez Soto" }, T);
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal(r.body.profile.headline, "Diseñadora UX"); assert.equal(r.body.profile.hoursPerWeek, 15);
assert.equal(r.body.profile.links.github, "https://github.com/ana"); assert.equal(r.body.profile.links.portfolio, null);
assert.equal(r.body.profile.lastName, "Pérez Soto");
r = await req("GET", "/auth/me", undefined, T); assert.equal(r.body.user.lastName, "Pérez Soto");
ok("PATCH /me/profile actualiza perfil y nombre");
r = await req("PATCH", "/me/profile", { links: { linkedin: "https://linkedin.com/in/ana" } }, T);
assert.equal(r.body.profile.links.github, "https://github.com/ana");
r = await req("PATCH", "/me/profile", { links: { github: "" }, bio: null }, T);
assert.equal(r.body.profile.links.github, null); assert.equal(r.body.profile.bio, null); assert.equal(r.body.profile.links.linkedin, "https://linkedin.com/in/ana");
ok("PATCH links parcial y borrado con ''/null");
r = await req("PATCH", "/me/profile", { links: { portfolio: "ftp://x.com" } }, T);
assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_URL");
r = await req("PATCH", "/me/profile", { links: { portfolio: "midominio.com" } }, T);
assert.equal(r.body.code, "INVALID_URL");
ok("400 INVALID_URL");
for (const h of [0, 81, 2.5]) { r = await req("PATCH", "/me/profile", { hoursPerWeek: h }, T); assert.equal(r.body.code, "INVALID_HOURS"); }
ok("400 INVALID_HOURS");
r = await req("PATCH", "/me/profile", {}, T); assert.equal(r.body.code, "VALIDATION");
r = await req("PATCH", "/me/profile", { bio: "x".repeat(301) }, T); assert.equal(r.body.code, "VALIDATION");
ok("400 VALIDATION (vacío / bio > 300)");

r = await req("GET", "/skills?q=re", undefined, T);
assert.equal(r.status, 200); assert.ok(r.body.some((s: any) => s.name === "React")); assert.ok(r.body.every((s: any) => /re/i.test(s.name)));
const all = (await req("GET", "/skills", undefined, T)).body;
assert.equal(all.length, 21);
r = await req("GET", "/skills"); assert.equal(r.status, 401);
ok("GET /skills?q= (solo técnicas, requiere token)");

r = await req("GET", "/categories");
assert.equal(r.status, 200); assert.ok(r.body.length >= 7); assert.deepEqual(Object.keys(r.body[0]).sort(), ["id","name","projectCount"]);
const cats = r.body;
ok("GET /categories pública con projectCount");

r = await req("PUT", "/me/skills", { skillIds: [] }, T); assert.equal(r.body.code, "SKILLS_OUT_OF_RANGE");
r = await req("PUT", "/me/skills", { skillIds: all.slice(0, 16).map((s: any) => s.id) }, T); assert.equal(r.body.code, "SKILLS_OUT_OF_RANGE");
r = await req("PUT", "/me/skills", { skillIds: ["999999"] }, T); assert.equal(r.body.code, "INVALID_SKILL");
r = await req("PUT", "/me/skills", { skillIds: [all[0].id, all[1].id, all[1].id] }, T);
assert.equal(r.status, 200); assert.equal(r.body.skills.length, 2);
ok("PUT /me/skills (1–15, dedupe, inválidas)");
r = await req("PUT", "/me/interests", { categoryIds: [cats[0].id, cats[1].id] }, T);
assert.equal(r.status, 200); assert.equal(r.body.interests.length, 2);
r = await req("PUT", "/me/interests", { categoryIds: ["99999"] }, T); assert.equal(r.body.code, "INVALID_CATEGORY");
r = await req("GET", "/me/profile", undefined, T); assert.equal(r.body.profile.skills.length, 2); assert.equal(r.body.profile.interests.length, 2);
ok("PUT /me/interests");

// ---- foto
const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), Buffer.alloc(100)]);
let fd = new FormData(); fd.append("file", new Blob([png], { type: "image/png" }), "a.png");
r = await req("PUT", "/me/profile/photo", fd, T);
assert.equal(r.status, 200, JSON.stringify(r.body)); assert.match(r.body.photoUrl, /\/uploads\/avatars\/.+\.png$/);
const img = await fetch(r.body.photoUrl); assert.equal(img.status, 200); assert.equal(img.headers.get("cross-origin-resource-policy"), "cross-origin");
const firstUrl = r.body.photoUrl;
ok("PUT /me/profile/photo PNG → URL servida");
fd = new FormData(); fd.append("file", new Blob([Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3])], { type: "image/jpeg" }), "b.jpg");
r = await req("PUT", "/me/profile/photo", fd, T); assert.equal(r.status, 200); assert.match(r.body.photoUrl, /\.jpg$/);
assert.equal((await fetch(firstUrl)).status, 404);
ok("cambiar foto borra la anterior");
fd = new FormData(); fd.append("file", new Blob([Buffer.from("GIF89a....")], { type: "image/png" }), "x.png");
r = await req("PUT", "/me/profile/photo", fd, T); assert.equal(r.body.code, "INVALID_FILE");
fd = new FormData(); fd.append("file", new Blob([Buffer.concat([png, Buffer.alloc(2*1024*1024)])], { type: "image/png" }), "big.png");
r = await req("PUT", "/me/profile/photo", fd, T); assert.equal(r.status, 400); assert.equal(r.body.code, "INVALID_FILE");
r = await req("PUT", "/me/profile/photo", new FormData(), T); assert.equal(r.body.code, "INVALID_FILE");
fd = new FormData(); fd.append("file", new Blob([png]), "a.png");
r = await req("PUT", "/me/profile/photo", fd); assert.equal(r.status, 401);
ok("foto: tipo falso / > 2 MB / sin archivo → 400 INVALID_FILE; sin token 401");

// ---- perfil público
const otro = await req("POST", "/auth/register", { firstName: "Luis", lastName: "Gómez", email: "luis@c.com", password: "Secreta123" });
r = await req("GET", `/users/${myId}`, undefined, otro.body.token);
assert.equal(r.status, 200);
const pp = r.body.publicProfile;
assert.equal(pp.fullName, "Ana Pérez Soto"); assert.equal(pp.email, undefined); assert.equal(pp.skills.length, 2);
assert.ok(Array.isArray(pp.experience) && Array.isArray(pp.badges)); assert.equal(pp.projectsCount, 0);
assert.ok(!JSON.stringify(r.body).includes("ana@c.com"));
r = await req("GET", "/users/99999", undefined, T); assert.equal(r.status, 404); assert.equal(r.body.code, "USER_NOT_FOUND");
ok("GET /users/:id sin correo; 404 USER_NOT_FOUND");

r = await fetch(`http://127.0.0.1:${port}/docs.json`).then((x) => x.json());
assert.ok(r.paths["/api/me/profile/photo"].put.requestBody.content["multipart/form-data"]);
ok("Swagger documenta multipart");

console.log(`Sprint 2: ${n} pruebas OK`);
server.close(); process.exit(0);

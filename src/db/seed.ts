import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { pgConfig } from "../lib/db-config.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg(pgConfig(process.env.DATABASE_URL!, process.env.DATABASE_CA_CERT)),
});

const categorias = ["IA", "Fintech", "Educación", "Salud", "Videojuegos", "Sostenibilidad", "E-commerce"];

// Habilidades técnicas: mismo catálogo que usa el front (INITIAL_SKILLS_CATALOG)
const habilidadesTecnicas = [
  "Product Design", "Figma", "UX Research", "Design Systems", "Prototyping", "UI Design",
  "React", "TypeScript", "Next.js", "Node.js", "Python", "FastAPI", "Tailwind CSS",
  "PostgreSQL", "MongoDB", "Docker", "Git", "Scrum / Ágil", "Testing / QA",
  "Product Management", "Data Analysis",
];
const habilidades: { nombre: string; tipo: "Tecnica" | "Interes" }[] = [
  ...habilidadesTecnicas.map((nombre) => ({ nombre, tipo: "Tecnica" as const })),
  { nombre: "Emprendimiento", tipo: "Interes" },
  { nombre: "Impacto social", tipo: "Interes" },
];

const insignias = [
  { nombre: "Primer proyecto", descripcion: "Publicó su primer proyecto", criterio: "Crear 1 proyecto" },
  { nombre: "Colaborador activo", descripcion: "Fue aceptado en un equipo", criterio: "1 postulación aceptada" },
  { nombre: "Proyecto completado", descripcion: "Participó en un proyecto cerrado", criterio: "Proyecto en estado Cerrado" },
];

/**
 * Administrador inicial (Sprint 8): si existen ADMIN_EMAIL y ADMIN_PASSWORD en el entorno,
 * crea esa cuenta como admin, o marca como admin a la cuenta existente (sin tocar su contraseña).
 */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existe = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (existe) {
    await prisma.usuario.update({ where: { email }, data: { esAdmin: true } });
  } else {
    await prisma.usuario.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        nombres: "Admin",
        apellidos: "IdeaMatch",
        esAdmin: true,
        estado: "Activo",
        perfil: { create: { nombreVisible: "Admin IdeaMatch" } },
      },
    });
  }
  console.log(`Administrador listo: ${email}`);
}

async function main() {
  for (const nombre of categorias) {
    await prisma.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const h of habilidades) {
    await prisma.habilidad.upsert({ where: { nombre: h.nombre }, update: {}, create: h });
  }
  for (const i of insignias) {
    await prisma.insignia.upsert({ where: { nombre: i.nombre }, update: {}, create: i });
  }
  await seedAdmin();
  console.log("Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const categorias = ["IA", "Fintech", "Educación", "Salud", "Videojuegos", "Sostenibilidad", "E-commerce"];

const habilidades: { nombre: string; tipo: "Tecnica" | "Interes" }[] = [
  { nombre: "React", tipo: "Tecnica" },
  { nombre: "Node.js", tipo: "Tecnica" },
  { nombre: "TypeScript", tipo: "Tecnica" },
  { nombre: "PostgreSQL", tipo: "Tecnica" },
  { nombre: "Figma", tipo: "Tecnica" },
  { nombre: "Python", tipo: "Tecnica" },
  { nombre: "Emprendimiento", tipo: "Interes" },
  { nombre: "Impacto social", tipo: "Interes" },
];

const insignias = [
  { nombre: "Primer proyecto", descripcion: "Publicó su primer proyecto", criterio: "Crear 1 proyecto" },
  { nombre: "Colaborador activo", descripcion: "Fue aceptado en un equipo", criterio: "1 postulación aceptada" },
  { nombre: "Proyecto completado", descripcion: "Participó en un proyecto cerrado", criterio: "Proyecto en estado Cerrado" },
];

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
  console.log("Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

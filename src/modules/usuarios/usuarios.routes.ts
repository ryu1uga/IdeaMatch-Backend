import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { prisma } from "../../lib/prisma.js";
import { idParam } from "../../lib/schemas.js";
import { ESTADOS_USUARIO_BLOQUEADOS } from "../../domain/enums.js";
import { HttpError } from "../../utils/http-error.js";
import { profileSelect, toProfileDto } from "../perfil/profile.dto.js";

const router = Router();
const tag = "Usuarios";
registerTag(tag, "Sprint 2 — Perfil público de otros usuarios (sin correo ni datos privados).");

defineRoute(
  router,
  "/api",
  {
    method: "get",
    path: "/users/:id",
    tag,
    summary: "Perfil público",
    description:
      "`200 { publicProfile }`: datos del perfil, habilidades, enlaces, disponibilidad, experiencia " +
      "(proyectos en los que participó) e insignias. `404 USER_NOT_FOUND`.",
    params: z.object({ id: idParam }),
  },
  async ({ params }) => {
    const u = await prisma.usuario.findUnique({
      where: { id: params.id },
      select: {
        ...profileSelect,
        estado: true,
        _count: { select: { proyectosCreados: true } },
        membresias: {
          where: { estado: { in: ["Activo", "Retirado"] } },
          orderBy: { fechaIngreso: "desc" },
          select: {
            id: true,
            fechaIngreso: true,
            rolProyecto: {
              select: {
                nombre: true,
                proyecto: { select: { id: true, titulo: true, creador: { select: { nombres: true, apellidos: true } } } },
              },
            },
          },
        },
        insignias: {
          orderBy: { fechaObtencion: "desc" },
          select: { fechaObtencion: true, insignia: { select: { id: true, nombre: true, descripcion: true } } },
        },
      },
    });
    if (!u || ESTADOS_USUARIO_BLOQUEADOS.includes(u.estado)) {
      throw HttpError.notFound("El usuario no existe", "USER_NOT_FOUND");
    }

    const { links, ...base } = toProfileDto(u);
    return {
      publicProfile: {
        ...base,
        fullName: `${u.nombres} ${u.apellidos}`,
        links,
        projectsCount: u._count.proyectosCreados + new Set(u.membresias.map((m) => m.rolProyecto.proyecto.id)).size,
        experience: u.membresias.map((m) => ({
          id: m.id,
          projectId: m.rolProyecto.proyecto.id,
          projectName: m.rolProyecto.proyecto.titulo,
          role: m.rolProyecto.nombre,
          verifiedBy: `${m.rolProyecto.proyecto.creador.nombres} ${m.rolProyecto.proyecto.creador.apellidos}`,
          year: m.fechaIngreso.getFullYear(),
        })),
        badges: u.insignias.map((i) => ({
          id: i.insignia.id,
          name: i.insignia.nombre,
          description: i.insignia.descripcion,
          earnedAt: i.fechaObtencion,
        })),
      },
    };
  },
);

export const usuariosModule = { base: "/", router };

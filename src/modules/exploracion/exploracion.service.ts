import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import {
  applicationStatusFromDb,
  modalityFromDb,
  portada,
  statusFromDb,
  statusToDb,
  type ProjectStatus,
} from "../../domain/proyecto.js";
import { toRoleDto, roleSelect } from "../proyectos/proyectos.dto.js";

const MAX_AVATARES = 3;

const iniciales = (u: { nombres: string; apellidos: string }) =>
  `${u.nombres.trim().charAt(0)}${u.apellidos.trim().charAt(0)}`.toUpperCase();
const nombre = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`.trim();

const personaSelect = { id: true, nombres: true, apellidos: true, perfil: { select: { fotoUrl: true } } } as const;

/** Lo necesario para armar la tarjeta (projectCard) */
const cardSelect = {
  id: true,
  titulo: true,
  resumen: true,
  modalidad: true,
  estado: true,
  fechaPublicacion: true,
  categoriaId: true,
  categoria: { select: { id: true, nombre: true } },
  creador: { select: personaSelect },
  roles: {
    select: {
      vacantesDisponibles: true,
      habilidades: { select: { habilidad: { select: { id: true, nombre: true } } } },
      miembros: {
        where: { estado: "Activo" },
        orderBy: { fechaIngreso: "asc" },
        select: { usuario: { select: personaSelect } },
      },
    },
  },
} as const satisfies Prisma.ProyectoSelect;

type CardRow = Prisma.ProyectoGetPayload<{ select: typeof cardSelect }>;

function toCard(p: CardRow) {
  // skills: unión de las habilidades de todos los roles (sin repetir)
  const skills = new Map<string, { id: bigint; name: string }>();
  for (const r of p.roles) for (const h of r.habilidades) skills.set(String(h.habilidad.id), { id: h.habilidad.id, name: h.habilidad.nombre });

  // equipo: el creador primero y luego los miembros activos (sin repetir)
  const equipo = new Map<string, CardRow["creador"]>([[String(p.creador.id), p.creador]]);
  for (const r of p.roles) for (const m of r.miembros) equipo.set(String(m.usuario.id), m.usuario);
  const personas = [...equipo.values()];

  return {
    id: p.id,
    name: p.titulo,
    summary: p.resumen,
    category: p.categoria ? { id: p.categoria.id, name: p.categoria.nombre } : null,
    ...portada(p.id, p.categoriaId),
    modality: modalityFromDb(p.modalidad),
    status: statusFromDb(p.estado),
    publishedAt: p.fechaPublicacion,
    skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
    vacanciesAvailable: p.roles.reduce((a, r) => a + r.vacantesDisponibles, 0),
    membersCount: personas.length,
    memberInitials: personas.slice(0, MAX_AVATARES).map(iniciales),
    extraMembers: Math.max(0, personas.length - MAX_AVATARES),
  };
}

export interface ListFilters {
  q?: string;
  categoryIds?: bigint[];
  skillIds?: bigint[];
  availability?: string[];
  status?: ProjectStatus[];
  sort: "recent" | "popular";
  page: number;
  limit: number;
}

export const exploracionService = {
  async list(f: ListFilters) {
    const where: Prisma.ProyectoWhereInput = {
      estado: { in: (f.status?.length ? f.status : ["abierto"]).map((s) => statusToDb(s as ProjectStatus)) },
      ...(f.q && {
        OR: [
          { titulo: { contains: f.q, mode: "insensitive" } },
          { resumen: { contains: f.q, mode: "insensitive" } },
          { descripcion: { contains: f.q, mode: "insensitive" } },
        ],
      }),
      ...(f.categoryIds?.length && { categoriaId: { in: f.categoryIds } }),
      AND: [
        ...(f.skillIds?.length ? [{ roles: { some: { habilidades: { some: { habilidadId: { in: f.skillIds } } } } } }] : []),
        // availability: algún rol con vacantes libres y esa dedicación
        ...(f.availability?.length
          ? [{ roles: { some: { dedicacion: { in: f.availability }, vacantesDisponibles: { gt: 0 } } } }]
          : []),
      ],
    };

    const orderBy: Prisma.ProyectoOrderByWithRelationInput[] =
      f.sort === "popular"
        ? [{ postulaciones: { _count: "desc" } }, { fechaPublicacion: "desc" }, { id: "desc" }]
        : [{ fechaPublicacion: { sort: "desc", nulls: "last" } }, { id: "desc" }];

    const [total, rows] = await Promise.all([
      prisma.proyecto.count({ where }),
      prisma.proyecto.findMany({ where, orderBy, select: cardSelect, skip: (f.page - 1) * f.limit, take: f.limit }),
    ]);
    return { items: rows.map(toCard), total, page: f.page, limit: f.limit };
  },

  async detail(id: bigint, userId: bigint) {
    const p = await prisma.proyecto.findUnique({
      where: { id },
      select: {
        ...cardSelect,
        creadorId: true,
        descripcion: true,
        fechaCreacion: true,
        roles: {
          orderBy: { fechaCreacion: "asc" },
          select: {
            ...roleSelect,
            ...cardSelect.roles.select,
            miembros: {
              where: { estado: "Activo" },
              orderBy: { fechaIngreso: "asc" },
              select: { fechaIngreso: true, usuario: { select: personaSelect } },
            },
          },
        },
        postulaciones: {
          where: { usuarioId: userId },
          select: { id: true, rolProyectoId: true, estado: true, fechaPostulacion: true },
          take: 1,
        },
      },
    });
    const esCreador = p?.creadorId === userId;
    // Borradores y cancelados solo los ve su creador
    if (!p || (!esCreador && (p.estado === "Borrador" || p.estado === "Cancelado"))) {
      throw HttpError.notFound("El proyecto no existe o fue eliminado", "PROJECT_NOT_FOUND");
    }

    const members = p.roles.flatMap((r) =>
      r.miembros.map((m) => ({
        userId: m.usuario.id,
        name: nombre(m.usuario),
        initials: iniciales(m.usuario),
        photoUrl: m.usuario.perfil?.fotoUrl ?? null,
        role: r.nombre,
        roleId: r.id,
        joinedAt: m.fechaIngreso,
      })),
    );
    const app = p.postulaciones[0];

    return {
      ...toCard(p),
      description: p.descripcion,
      createdAt: p.fechaCreacion,
      creator: {
        id: p.creador.id,
        name: nombre(p.creador),
        initials: iniciales(p.creador),
        photoUrl: p.creador.perfil?.fotoUrl ?? null,
      },
      roles: p.roles.map(toRoleDto),
      members,
      isOwner: esCreador,
      isMember: members.some((m) => m.userId === userId),
      myApplication: app
        ? { id: app.id, roleId: app.rolProyectoId, status: applicationStatusFromDb(app.estado), createdAt: app.fechaPostulacion }
        : null,
    };
  },
};

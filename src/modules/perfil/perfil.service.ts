import { prisma } from "../../lib/prisma.js";
import { storage } from "../../lib/storage.js";
import { HttpError } from "../../utils/http-error.js";
import type { UpdateProfileInput } from "./perfil.schemas.js";
import { profileSelect, toNamed, toProfileDto } from "./profile.dto.js";

export const MIN_SKILLS = 1;
export const MAX_SKILLS = 15;

const LINK_LABEL = { portfolio: "Portafolio", linkedin: "LinkedIn", github: "GitHub" } as const;

function esUrlValida(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const uniq = (ids: bigint[]) => [...new Set(ids.map(String))].map((x) => BigInt(x));

async function getProfile(userId: bigint) {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: userId }, select: profileSelect });
  return toProfileDto(u);
}

export const perfilService = {
  async get(userId: bigint) {
    return { profile: await getProfile(userId) };
  },

  async update(userId: bigint, input: UpdateProfileInput) {
    // ---- Reglas de negocio con código propio
    const links: Partial<Record<keyof typeof LINK_LABEL, string | null>> = {};
    for (const key of Object.keys(LINK_LABEL) as (keyof typeof LINK_LABEL)[]) {
      const v = input.links?.[key];
      if (v === undefined) continue;
      if (v === null || v === "") links[key] = null;
      else if (!esUrlValida(v)) {
        throw HttpError.badRequest(`El enlace de ${LINK_LABEL[key]} debe comenzar con http:// o https://`, "INVALID_URL");
      } else links[key] = v;
    }
    if (input.hoursPerWeek != null) {
      const h = input.hoursPerWeek;
      if (!Number.isInteger(h) || h < 1 || h > 80) {
        throw HttpError.badRequest("La disponibilidad debe estar entre 1 y 80 horas semanales", "INVALID_HOURS");
      }
    }

    await prisma.$transaction(async (tx) => {
      let nombreVisible: string | undefined;
      if (input.firstName !== undefined || input.lastName !== undefined) {
        const u = await tx.usuario.update({
          where: { id: userId },
          data: { nombres: input.firstName, apellidos: input.lastName },
          select: { nombres: true, apellidos: true },
        });
        nombreVisible = `${u.nombres} ${u.apellidos}`.slice(0, 100);
      }
      const data = {
        nombreVisible,
        titular: input.headline,
        ubicacion: input.location,
        biografia: input.bio,
        disponibilidadHorasSem: input.hoursPerWeek,
        linkPortafolio: links.portfolio,
        linkLinkedin: links.linkedin,
        linkGithub: links.github,
      };
      await tx.perfil.upsert({
        where: { usuarioId: userId },
        update: data,
        create: { ...data, usuarioId: userId, nombreVisible: nombreVisible ?? "Usuario" },
      });
    });

    return { profile: await getProfile(userId) };
  },

  async setPhoto(userId: bigint, file: { buffer: Buffer; mime: string }, baseUrl: string) {
    const anterior = await prisma.perfil.findUnique({ where: { usuarioId: userId }, select: { fotoKey: true } });
    const stored = await storage.save({ buffer: file.buffer, mime: file.mime, folder: "avatars", kind: "image", maxSide: 512, baseUrl });
    await prisma.perfil.update({ where: { usuarioId: userId }, data: { fotoUrl: stored.url, fotoKey: stored.key } });
    if (anterior?.fotoKey) await storage.remove(anterior.fotoKey);
    return { photoUrl: stored.url };
  },

  async setSkills(userId: bigint, skillIds: bigint[]) {
    const ids = uniq(skillIds);
    if (ids.length < MIN_SKILLS || ids.length > MAX_SKILLS) {
      throw HttpError.badRequest(`Selecciona entre ${MIN_SKILLS} y ${MAX_SKILLS} habilidades`, "SKILLS_OUT_OF_RANGE");
    }
    const validas = await prisma.habilidad.count({ where: { id: { in: ids }, activa: true, tipo: "Tecnica" } });
    if (validas !== ids.length) throw HttpError.badRequest("Alguna habilidad no existe o no está activa", "INVALID_SKILL");

    await prisma.$transaction([
      prisma.usuarioHabilidad.deleteMany({ where: { usuarioId: userId } }),
      prisma.usuarioHabilidad.createMany({ data: ids.map((habilidadId) => ({ usuarioId: userId, habilidadId })) }),
    ]);
    const rows = await prisma.usuarioHabilidad.findMany({
      where: { usuarioId: userId },
      select: { habilidad: { select: { id: true, nombre: true } } },
      orderBy: { habilidad: { nombre: "asc" } },
    });
    return { skills: rows.map((r) => toNamed(r.habilidad)) };
  },

  async setInterests(userId: bigint, categoryIds: bigint[]) {
    const ids = uniq(categoryIds);
    const validas = await prisma.categoria.count({ where: { id: { in: ids }, activa: true } });
    if (validas !== ids.length) throw HttpError.badRequest("Alguna categoría no existe o no está activa", "INVALID_CATEGORY");

    await prisma.$transaction([
      prisma.usuarioInteres.deleteMany({ where: { usuarioId: userId } }),
      prisma.usuarioInteres.createMany({ data: ids.map((categoriaId) => ({ usuarioId: userId, categoriaId })) }),
    ]);
    const rows = await prisma.usuarioInteres.findMany({
      where: { usuarioId: userId },
      select: { categoria: { select: { id: true, nombre: true } } },
      orderBy: { categoria: { nombre: "asc" } },
    });
    return { interests: rows.map((r) => toNamed(r.categoria)) };
  },
};

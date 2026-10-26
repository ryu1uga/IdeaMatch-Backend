import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idParam, idRef, searchQuery } from "../../lib/schemas.js";

const campos = {
  nombreVisible: z.string().trim().min(1).max(100),
  biografia: z.string().max(5000).nullable(),
  fotoUrl: z.url().max(500).nullable(),
  disponibilidadHorasSem: z.number().int().min(1).max(80).nullable(),
};

export const perfilesModule = crud({
  model: "perfil",
  base: "/perfiles",
  tag: "Perfiles",
  tagDescription: "Perfil público del usuario (relación 1:1, se identifica por usuarioId).",
  singular: "perfil",
  publicRead: true,
  idParams: z.object({ usuarioId: idParam }),
  whereUnique: ({ usuarioId }) => ({ usuarioId }),
  list: {
    filters: z.object({ q: searchQuery.meta({ description: "Busca en nombreVisible" }) }),
    where: ({ q }) => (q ? { nombreVisible: { contains: q as string, mode: "insensitive" } } : {}),
    orderBy: { nombreVisible: "asc" },
  },
  create: {
    body: z.object({
      usuarioId: idRef,
      nombreVisible: campos.nombreVisible,
      biografia: campos.biografia.optional(),
      fotoUrl: campos.fotoUrl.optional(),
      disponibilidadHorasSem: campos.disponibilidadHorasSem.optional(),
    }),
  },
  update: {
    body: atLeastOne(
      z.object({
        nombreVisible: campos.nombreVisible.optional(),
        biografia: campos.biografia.optional(),
        fotoUrl: campos.fotoUrl.optional(),
        disponibilidadHorasSem: campos.disponibilidadHorasSem.optional(),
      }),
    ),
  },
});

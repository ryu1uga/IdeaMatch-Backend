import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { PLATAFORMA_ENTREGA } from "../../domain/enums.js";

export const entregasModule = crud({
  model: "entregaProyecto",
  base: "/entregas",
  tag: "Entregas",
  tagDescription: "Enlaces de entrega de un proyecto en plataformas externas (GitHub, Figma, Trello...).",
  singular: "entrega",
  publicRead: true,
  list: {
    filters: z.object({ proyectoId: idQuery, plataforma: z.enum(PLATAFORMA_ENTREGA).optional() }),
    orderBy: { fechaVinculacion: "desc" },
  },
  create: {
    description: "El colaborador es el usuario autenticado.",
    body: z.object({ proyectoId: idRef, plataforma: z.enum(PLATAFORMA_ENTREGA), url: z.url().max(500) }),
    data: (b, ctx) => ({ ...b, colaboradorId: ctx.userId }),
  },
  update: {
    body: atLeastOne(z.object({ plataforma: z.enum(PLATAFORMA_ENTREGA).optional(), url: z.url().max(500).optional() })),
  },
});

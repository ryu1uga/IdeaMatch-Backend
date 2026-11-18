import { z } from "zod";
import { idParam, idQuery, searchQuery } from "../../lib/schemas.js";
import { APPLICATION_STATUS } from "../../domain/proyecto.js";

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(10);

export const applyParams = z.object({ id: idParam, roleId: idParam });
export const applyBody = z.object({
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .meta({ description: "Nota de presentación (opcional, máx. 500)", example: "Tengo experiencia en React" }),
});

export const applicationIdParams = z.object({ id: idParam });

export const myApplicationsQuery = z.object({ status: z.enum(APPLICATION_STATUS).optional(), page, limit });

export const projectApplicationsQuery = z.object({
  roleId: idQuery,
  status: z.enum(APPLICATION_STATUS).default("pendiente").meta({ description: "Por defecto `pendiente`" }),
  q: searchQuery.meta({ description: "Busca por nombre o headline del postulante" }),
  sort: z.enum(["match", "recent"]).default("match"),
  page,
  limit,
});

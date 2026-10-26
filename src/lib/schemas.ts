import { z } from "zod";

// ---------------------------------------------------------------------------
// Piezas de validación reutilizables (zod) para params, query y body.
// Los IDs son BIGINT: llegan como string (o número en el body) y se convierten a bigint.
// ---------------------------------------------------------------------------

const digits = /^\d+$/;

/** ID en la ruta: "/recurso/:id" */
export const idParam = z
  .string()
  .regex(digits, "Debe ser un entero positivo")
  .transform((v) => BigInt(v))
  .meta({ example: "1" });

/** ID dentro del body (acepta "1" o 1) */
export const idRef = z
  .union([z.string().regex(digits, "Debe ser un entero positivo"), z.number().int().positive()])
  .transform((v) => BigInt(v))
  .meta({ example: "1" });

/** ID opcional como filtro en query string */
export const idQuery = z
  .string()
  .regex(digits, "Debe ser un entero positivo")
  .transform((v) => BigInt(v))
  .optional();

/** Booleano en query string ("true" | "false") */
export const boolQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

/** Texto de búsqueda en query string */
export const searchQuery = z.string().trim().min(1).optional().meta({ description: "Búsqueda por texto" });

/** Fecha ISO-8601 en el body */
export const dateTime = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v))
  .meta({ example: "2026-12-31T23:59:59Z" });

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

/** Exige al menos un campo en los PATCH */
export const atLeastOne = <T extends z.ZodObject>(schema: T) =>
  schema.refine((d) => Object.values(d).some((v) => v !== undefined), "Envía al menos un campo");

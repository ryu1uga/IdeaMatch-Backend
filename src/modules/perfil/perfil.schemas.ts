import { z } from "zod";
import { atLeastOne, idRef } from "../../lib/schemas.js";

/** Texto opcional: "" o null lo borran */
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

// Las URL y las horas se validan en el servicio para responder INVALID_URL / INVALID_HOURS
const link = z.string().trim().max(500).nullable().optional();

export const updateProfileSchema = atLeastOne(
  z.object({
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
    headline: texto(100).meta({ example: "Diseñadora UX" }),
    location: texto(100).meta({ example: "Lima, Perú" }),
    bio: texto(300),
    links: z
      .object({ portfolio: link, linkedin: link, github: link })
      .optional()
      .meta({ example: { github: "https://github.com/ana" } }),
    hoursPerWeek: z.number().nullable().optional().meta({ description: "Entero entre 1 y 80", example: 15 }),
  }),
);

export const skillsSchema = z.object({
  skillIds: z.array(idRef).meta({ description: "Entre 1 y 15 habilidades", example: ["1", "2"] }),
});

export const interestsSchema = z.object({
  categoryIds: z.array(idRef).max(50).meta({ example: ["1"] }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

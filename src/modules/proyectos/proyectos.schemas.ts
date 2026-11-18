import { z } from "zod";
import { atLeastOne, idParam, idRef } from "../../lib/schemas.js";
import { DEDICATION, MODALITY, PROJECT_STATUS, PROJECT_STATUS_TARGET } from "../../domain/proyecto.js";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

const proyectoCampos = {
  name: z.string().trim().min(1, "Obligatorio").max(60).meta({ example: "App para huertos urbanos" }),
  summary: textoOpcional(140).meta({ example: "Conecta vecinos para cultivar en espacios compartidos" }),
  description: textoOpcional(5000),
  categoryId: idRef.nullable().optional(),
  modality: z.enum(MODALITY).nullable().optional(),
};

/** Crear borrador: solo `name` es obligatorio; el resto se exige al publicar */
export const createProjectSchema = z.object(proyectoCampos);

export const updateProjectSchema = atLeastOne(z.object({ ...proyectoCampos, name: proyectoCampos.name.optional() }));

export const projectIdParams = z.object({ id: idParam });
export const roleIdParams = z.object({ id: idParam, roleId: idParam });

// vacancies se valida en el servicio para responder INVALID_VACANCIES
const rolCampos = {
  name: z.string().trim().min(1, "Obligatorio").max(100).meta({ example: "Frontend developer" }),
  vacancies: z.number().meta({ description: "Entero ≥ 1", example: 2 }),
  dedication: z.enum(DEDICATION).meta({ description: "Horas por semana" }),
  skillIds: z.array(idRef).max(15).default([]).meta({ example: ["1", "2"] }),
  description: textoOpcional(2000),
};

export const createRoleSchema = z.object(rolCampos);

export const updateRoleSchema = atLeastOne(
  z.object({
    name: rolCampos.name.optional(),
    vacancies: rolCampos.vacancies.optional(),
    dedication: rolCampos.dedication.optional(),
    skillIds: z.array(idRef).max(15).optional(),
    description: rolCampos.description,
  }),
);

export const changeStatusSchema = z.object({ status: z.enum(PROJECT_STATUS_TARGET) });

export const myProjectsQuery = z.object({ status: z.enum(PROJECT_STATUS).optional() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

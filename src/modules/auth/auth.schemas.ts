import { z } from "zod";

const nombre = z.string().trim().min(1, "Obligatorio").max(60);

export const registerSchema = z.object({
  firstName: nombre.meta({ example: "Ana" }),
  lastName: nombre.meta({ example: "Pérez" }),
  email: z
    .string()
    .trim()
    .max(255)
    .meta({ example: "ana@correo.com" }),
  // La fortaleza (≥ 8, una mayúscula y un número) se valida en el servicio
  // para responder con el código WEAK_PASSWORD.
  password: z.string().max(72).meta({ example: "Secreta123" }),
});

export const loginSchema = z.object({
  email: z.string().trim().max(255).meta({ example: "ana@correo.com" }),
  password: z.string().max(72).meta({ example: "Secreta123" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

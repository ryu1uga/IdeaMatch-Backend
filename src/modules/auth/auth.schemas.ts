import { z } from "zod";
import { ROL_GLOBAL } from "../../domain/enums.js";

export const registerSchema = z.object({
  email: z.email().max(255).transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  rolGlobal: z.enum(ROL_GLOBAL),
  nombreVisible: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

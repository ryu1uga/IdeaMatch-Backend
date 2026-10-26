import { randomBytes } from "node:crypto";
import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, boolQuery, dateTime, idQuery, idRef } from "../../lib/schemas.js";
import { TIPO_TOKEN } from "../../domain/enums.js";

const HORA = 60 * 60 * 1000;
const VIGENCIA = { Verificacion_Email: 24 * HORA, Reset_Password: HORA } as const;

export const tokensModule = crud({
  model: "token",
  base: "/tokens",
  tag: "Tokens",
  tagDescription: "Tokens de verificación de email y de reseteo de contraseña.",
  singular: "token",
  list: {
    filters: z.object({ usuarioId: idQuery, tipo: z.enum(TIPO_TOKEN).optional(), usado: boolQuery }),
    orderBy: { fechaCreacion: "desc" },
  },
  create: {
    description: "El valor se genera automáticamente. Si no se envía expiraEn: 24 h (verificación) o 1 h (reset).",
    body: z.object({ usuarioId: idRef, tipo: z.enum(TIPO_TOKEN), expiraEn: dateTime.optional() }),
    data: (b) => ({
      ...b,
      valor: randomBytes(32).toString("hex"),
      expiraEn: b.expiraEn ?? new Date(Date.now() + VIGENCIA[b.tipo as keyof typeof VIGENCIA]),
    }),
  },
  update: { body: atLeastOne(z.object({ usado: z.boolean().optional(), expiraEn: dateTime.optional() })) },
});

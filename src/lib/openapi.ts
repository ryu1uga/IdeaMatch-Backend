import { z, type ZodType } from "zod";

// ---------------------------------------------------------------------------
// Registro de operaciones -> documento OpenAPI 3.1 (lo consume Swagger UI).
// Cada ruta definida con defineRoute() se registra aquí automáticamente,
// así la documentación siempre coincide con la validación real.
// ---------------------------------------------------------------------------

export interface OperationDoc {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string; // estilo Express: /api/proyectos/:id
  tag: string;
  summary: string;
  description?: string;
  auth: boolean;
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
  successStatus: number;
}

const operations: OperationDoc[] = [];
const tagDescriptions = new Map<string, string>();

export function registerOperation(op: OperationDoc) {
  operations.push(op);
}

export function registerTag(name: string, description: string) {
  tagDescriptions.set(name, description);
}

type JsonSchema = { properties?: Record<string, unknown>; required?: string[]; [k: string]: unknown };

function toSchema(schema: ZodType): JsonSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema;
  return rest;
}

function toParameters(schema: ZodType | undefined, location: "path" | "query") {
  if (!schema) return [];
  const js = toSchema(schema);
  return Object.entries(js.properties ?? {}).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === "path" ? true : (js.required ?? []).includes(name),
    schema: propSchema,
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const op of operations) {
    const oasPath = op.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    paths[oasPath] ??= {};

    const responses: Record<string, unknown> = {
      [op.successStatus]: { description: op.successStatus === 204 ? "Sin contenido" : "OK" },
      400: errorResponse("Datos inválidos o regla de negocio violada"),
    };
    if (op.auth) responses[401] = errorResponse("No autenticado");
    if (op.params) responses[404] = errorResponse("No encontrado");
    if (op.method !== "get") responses[409] = errorResponse("Conflicto (duplicado o referencia inválida)");

    paths[oasPath][op.method] = {
      tags: [op.tag],
      summary: op.summary,
      ...(op.description && { description: op.description }),
      ...(op.auth && { security: [{ bearerAuth: [] }] }),
      parameters: [...toParameters(op.params, "path"), ...toParameters(op.query, "query")],
      ...(op.body && {
        requestBody: { required: true, content: { "application/json": { schema: toSchema(op.body) } } },
      }),
      responses,
    };
  }

  const usedTags = [...new Set(operations.map((o) => o.tag))];

  return {
    openapi: "3.1.0",
    info: {
      title: "IdeaMatch API",
      version: "1.0.0",
      description:
        "Backend de IdeaMatch.\n\n" +
        "1. Registra un usuario en **POST /api/auth/register** o inicia sesión en **POST /api/auth/login**.\n" +
        "2. Copia el `token` de la respuesta y pégalo en el botón **Authorize**.\n\n" +
        "Los IDs son BIGINT y se devuelven como string (`\"id\": \"1\"`).",
    },
    servers: [{ url: "/" }],
    tags: usedTags.map((name) => ({ name, description: tagDescriptions.get(name) })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" }, details: {} },
          required: ["error"],
        },
      },
    },
  };
}

import type { Request, Response, Router } from "express";
import type { z, ZodType } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { registerOperation, type OperationDoc } from "./openapi.js";

type Out<T> = T extends ZodType ? z.output<T> : undefined;

export interface RouteContext<P, Q, B> {
  params: Out<P>;
  query: Out<Q>;
  body: Out<B>;
  /** id del usuario autenticado (solo en rutas con auth) */
  userId: bigint;
  req: Request;
  res: Response;
}

export interface RouteDef<P, Q, B> {
  method: OperationDoc["method"];
  /** ruta relativa al router, estilo Express: "/:id" */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** true = exige "Authorization: Bearer <token>" (por defecto true) */
  auth?: boolean;
  params?: P;
  query?: Q;
  body?: B;
  /** por defecto: 201 en POST, 204 si el handler no devuelve nada, 200 en el resto */
  status?: number;
}

/**
 * Define una ruta: valida params/query/body con zod, aplica auth y la registra
 * en la documentación OpenAPI. El handler devuelve el objeto a responder.
 */
export function defineRoute<
  P extends ZodType | undefined = undefined,
  Q extends ZodType | undefined = undefined,
  B extends ZodType | undefined = undefined,
>(
  router: Router,
  basePath: string,
  def: RouteDef<P, Q, B>,
  handler: (ctx: RouteContext<P, Q, B>) => Promise<unknown> | unknown,
) {
  const auth = def.auth ?? true;
  const defaultStatus = def.status ?? (def.method === "post" ? 201 : def.method === "delete" ? 204 : 200);

  registerOperation({
    method: def.method,
    path: `${basePath}${def.path === "/" ? "" : def.path}`,
    tag: def.tag,
    summary: def.summary,
    description: def.description,
    auth,
    params: def.params,
    query: def.query,
    body: def.body,
    successStatus: defaultStatus,
  });

  const middlewares = auth ? [requireAuth] : [];

  router[def.method](def.path, ...middlewares, async (req: Request, res: Response) => {
    const ctx = {
      params: def.params ? def.params.parse(req.params) : undefined,
      query: def.query ? def.query.parse(req.query) : undefined,
      body: def.body ? def.body.parse(req.body ?? {}) : undefined,
      userId: req.user ? BigInt(req.user.sub) : (undefined as unknown as bigint),
      req,
      res,
    } as RouteContext<P, Q, B>;

    const result = await handler(ctx);

    if (result === undefined) return res.status(204).end();
    res.status(defaultStatus === 204 ? 200 : defaultStatus).json(result);
  });
}

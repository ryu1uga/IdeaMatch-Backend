import { Router } from "express";
import { z, type ZodObject, type ZodType } from "zod";
import { prisma } from "./prisma.js";
import type { Request, Response } from "express";
import { defineRoute } from "./route.js";
import { registerTag } from "./openapi.js";
import { idParam, paginationShape } from "./schemas.js";
import { HttpError } from "../utils/http-error.js";

// ---------------------------------------------------------------------------
// Fábrica de CRUD: genera GET (lista paginada), GET /:id, POST, PATCH /:id y
// DELETE /:id para un modelo de Prisma, con validación y documentación Swagger.
// ---------------------------------------------------------------------------

/** Contexto disponible en los hooks data(): usuario autenticado y request */
export interface Ctx {
  userId: bigint;
  req: Request;
  res: Response;
}
type Obj = Record<string, unknown>;

export interface CrudOptions {
  /** nombre del modelo en el cliente de Prisma: prisma.<model> */
  model: keyof typeof prisma & string;
  /** ruta base, p. ej. "/categorias" */
  base: string;
  /** nombre para la sección de Swagger */
  tag: string;
  tagDescription?: string;
  /** nombre singular para los textos ("categoría") */
  singular: string;

  /** params que identifican un registro (por defecto { id }) */
  idParams?: ZodObject;
  /** cómo construir el where único a partir de los params */
  whereUnique?: (params: Obj) => Obj;

  /** GET de lectura públicos (sin token). Por defecto false. */
  publicRead?: boolean;

  list?: {
    filters?: ZodObject;
    where?: (filters: Obj, ctx: Ctx) => Obj;
    orderBy?: Obj | Obj[];
    include?: Obj;
  };
  /** include/select para GET /:id */
  include?: Obj;

  create?: {
    body: ZodType;
    data?: (body: Obj, ctx: Ctx) => Obj | Promise<Obj>;
    include?: Obj;
    description?: string;
  };
  /** false = sin endpoint PATCH */
  update?:
    | {
        body: ZodType;
        data?: (body: Obj, ctx: Ctx & { id: Obj }) => Obj | Promise<Obj>;
        description?: string;
      }
    | false;
  /** "hard" = DELETE real; objeto = borrado lógico (update con esos datos) */
  remove?: "hard" | { soft: Obj; description?: string } | false;
}

/** Quita las claves undefined para no mandarlas a Prisma */
const clean = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function crud(opts: CrudOptions) {
  const router = Router();
  const base = `/api${opts.base}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[opts.model];
  const idParams = opts.idParams ?? z.object({ id: idParam });
  const idPath = Object.keys(idParams.shape)
    .map((k) => `/:${k}`)
    .join("");
  const whereUnique = opts.whereUnique ?? ((p: Obj) => ({ id: p.id }));
  const readAuth = !opts.publicRead;

  if (opts.tagDescription) registerTag(opts.tag, opts.tagDescription);

  // ---------- LISTAR
  const listQuery = (opts.list?.filters ?? z.object({})).extend(paginationShape);
  defineRoute(
    router,
    base,
    { method: "get", path: "/", tag: opts.tag, summary: `Listar (paginado)`, auth: readAuth, query: listQuery },
    async (ctx) => {
      const { page, pageSize, ...filters } = ctx.query as Obj & { page: number; pageSize: number };
      const where = opts.list?.where ? opts.list.where(filters, ctx) : clean(filters);
      const [total, items] = await Promise.all([
        delegate.count({ where }),
        delegate.findMany({
          where,
          orderBy: opts.list?.orderBy ?? { id: "desc" },
          include: opts.list?.include,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  // ---------- OBTENER
  defineRoute(
    router,
    base,
    { method: "get", path: idPath, tag: opts.tag, summary: `Obtener ${opts.singular}`, auth: readAuth, params: idParams },
    async (ctx) => {
      const item = await delegate.findUnique({ where: whereUnique(ctx.params as Obj), include: opts.include });
      if (!item) throw HttpError.notFound(`No existe ${opts.singular} con ese identificador`);
      return item;
    },
  );

  // ---------- CREAR
  if (opts.create) {
    const c = opts.create;
    defineRoute(
      router,
      base,
      { method: "post", path: "/", tag: opts.tag, summary: `Crear ${opts.singular}`, description: c.description, body: c.body },
      async (ctx) => {
        const body = ctx.body as Obj;
        const data = c.data ? await c.data(body, ctx) : body;
        return delegate.create({ data: clean(data), include: c.include ?? opts.include });
      },
    );
  }

  // ---------- ACTUALIZAR
  if (opts.update) {
    const u = opts.update;
    defineRoute(
      router,
      base,
      {
        method: "patch",
        path: idPath,
        tag: opts.tag,
        summary: `Actualizar ${opts.singular}`,
        description: u.description ?? "Solo se modifican los campos enviados.",
        params: idParams,
        body: u.body,
      },
      async (ctx) => {
        const id = whereUnique(ctx.params as Obj);
        const body = ctx.body as Obj;
        const data = u.data ? await u.data(body, { ...ctx, id }) : body;
        return delegate.update({ where: id, data: clean(data), include: opts.include });
      },
    );
  }

  // ---------- ELIMINAR
  const remove = opts.remove ?? "hard";
  if (remove) {
    const soft = remove !== "hard";
    defineRoute(
      router,
      base,
      {
        method: "delete",
        path: idPath,
        tag: opts.tag,
        summary: soft ? `Desactivar ${opts.singular} (borrado lógico)` : `Eliminar ${opts.singular}`,
        description: soft
          ? remove.description ?? `No borra el registro: actualiza ${JSON.stringify(remove.soft)}.`
          : undefined,
        params: idParams,
      },
      async (ctx) => {
        const where = whereUnique(ctx.params as Obj);
        if (soft) await delegate.update({ where, data: remove.soft });
        else await delegate.delete({ where });
        return undefined;
      },
    );
  }

  return { base: opts.base, router };
}

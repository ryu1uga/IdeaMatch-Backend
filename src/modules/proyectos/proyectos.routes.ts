import { Router } from "express";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import {
  changeStatusSchema,
  createProjectSchema,
  createRoleSchema,
  myProjectsQuery,
  projectIdParams,
  roleIdParams,
  updateProjectSchema,
  updateRoleSchema,
} from "./proyectos.schemas.js";
import { proyectosService as svc } from "./proyectos.service.js";

const router = Router();
const base = "/api";
const tag = "Proyectos";
registerTag(
  tag,
  "Sprint 3 — Creación y gestión de proyectos por su creador.\n\n" +
    "Estados: `borrador` → (publish) → `abierto` ⇄ `en_curso` ⇄ `pausado` → `cerrado`. " +
    "`cancelado` desde cualquier estado no final. Errores comunes: `404 PROJECT_NOT_FOUND` · `403 NOT_OWNER` · " +
    "`409 PROJECT_CLOSED` (cerrado o cancelado).",
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects",
    tag,
    summary: "Crear proyecto (borrador)",
    description:
      "Solo `name` es obligatorio para guardar el borrador; `summary`, `categoryId` y `modality` se exigen al publicar.\n\n" +
      "`201 { project }` · `400 VALIDATION` · `400 INVALID_CATEGORY`.",
    body: createProjectSchema,
  },
  ({ userId, body }) => svc.create(userId, body),
);

defineRoute(
  router,
  base,
  {
    method: "patch",
    path: "/projects/:id",
    tag,
    summary: "Editar proyecto",
    description: "Mismos campos que al crear, todos opcionales. `200 { project }` · `403 NOT_OWNER` · `409 PROJECT_CLOSED`.",
    params: projectIdParams,
    body: updateProjectSchema,
  },
  ({ userId, params, body }) => svc.update(params.id, userId, body),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/me/projects",
    tag,
    summary: "Mis proyectos (como creador)",
    description:
      "`200 [{ id, name, summary, category, status, rolesCovered, rolesPending, vacancies, vacanciesAvailable, pendingApplications, createdAt, updatedAt }]`.\n\n" +
      "`rolesCovered`: roles sin vacantes libres · `rolesPending`: roles con vacantes por cubrir.",
    query: myProjectsQuery,
  },
  ({ userId, query }) => svc.listMine(userId, query.status),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects/:id/roles",
    tag,
    summary: "Agregar rol",
    description: "`201 { role }` · `400 INVALID_VACANCIES` (entero 1–50) · `400 INVALID_SKILL` · `409 ROLE_NAME_TAKEN` · `403 NOT_OWNER`.",
    params: projectIdParams,
    body: createRoleSchema,
  },
  ({ userId, params, body }) => svc.createRole(params.id, userId, body),
);

defineRoute(
  router,
  base,
  {
    method: "patch",
    path: "/projects/:id/roles/:roleId",
    tag,
    summary: "Editar rol",
    description:
      "Campos opcionales; `skillIds` reemplaza la lista. `200 { role }` · `404 ROLE_NOT_FOUND` · " +
      "`409 VACANCIES_BELOW_MEMBERS` (no se puede bajar de los miembros ya aceptados).",
    params: roleIdParams,
    body: updateRoleSchema,
  },
  ({ userId, params, body }) => svc.updateRole(params.id, params.roleId, userId, body),
);

defineRoute(
  router,
  base,
  {
    method: "delete",
    path: "/projects/:id/roles/:roleId",
    tag,
    summary: "Eliminar rol",
    description: "`204` · `409 ROLE_HAS_MEMBERS` · `409 NO_ROLES` (un proyecto publicado no puede quedar sin roles).",
    params: roleIdParams,
  },
  ({ userId, params }) => svc.deleteRole(params.id, params.roleId, userId),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects/:id/publish",
    tag,
    summary: "Publicar proyecto",
    description:
      "Pasa de `borrador` a `abierto`. `200 { project }` · `409 NO_ROLES` · " +
      "`409 INCOMPLETE_PROJECT` (`details.missing`) · `409 INVALID_TRANSITION` si no está en borrador.",
    params: projectIdParams,
    status: 200,
  },
  ({ userId, params }) => svc.publish(params.id, userId),
);

defineRoute(
  router,
  base,
  {
    method: "patch",
    path: "/projects/:id/status",
    tag,
    summary: "Cambiar estado",
    description:
      "`status`: `abierto` | `en_curso` | `pausado` | `cerrado`. Al cerrar, las postulaciones pendientes quedan rechazadas.\n\n" +
      "`200 { project }` · `409 INVALID_TRANSITION` (`details.allowed`).",
    params: projectIdParams,
    body: changeStatusSchema,
  },
  ({ userId, params, body }) => svc.changeStatus(params.id, userId, body.status),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects/:id/cancel",
    tag,
    summary: "Cancelar proyecto",
    description: "Estado `cancelado`; las postulaciones pendientes se cierran. `200 { project }` · `409 INVALID_TRANSITION`.",
    params: projectIdParams,
    status: 200,
  },
  ({ userId, params }) => svc.cancel(params.id, userId),
);

export const proyectosModule = { base: "/", router };

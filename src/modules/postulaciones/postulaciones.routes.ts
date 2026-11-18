import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { idParam } from "../../lib/schemas.js";
import {
  applicationIdParams,
  applyBody,
  applyParams,
  myApplicationsQuery,
  projectApplicationsQuery,
} from "./postulaciones.schemas.js";
import { postulacionesService as svc } from "./postulaciones.service.js";

const router = Router();
const base = "/api";
const tag = "Postulaciones";
registerTag(
  tag,
  "Sprint 5 — Postulaciones a roles. Estados: `pendiente`, `aceptada`, `rechazada`, `cancelada`. " +
    "Un colaborador solo puede postular una vez por proyecto (puede volver a hacerlo si canceló la suya).",
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects/:id/roles/:roleId/applications",
    tag,
    summary: "Postular a un rol",
    description:
      "`201 { application }` en estado `pendiente`.\n\n" +
      "Errores: `409 PROJECT_NOT_OPEN` · `409 ROLE_FULL` · `409 ALREADY_APPLIED` · `409 ALREADY_MEMBER` · " +
      "`409 OWNER_CANNOT_APPLY` · `404 PROJECT_NOT_FOUND` · `404 ROLE_NOT_FOUND`.",
    params: applyParams,
    body: applyBody,
  },
  ({ params, userId, body }) => svc.apply(params.id, params.roleId, userId, body.note),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/me/applications",
    tag,
    summary: "Mis postulaciones",
    description:
      "`200 { summary: { sent, inReview, accepted, finished }, total, page, limit, items: [{ id, project { id, name, status, category, coverColor }, role, createdAt, status, note, resolvedAt }] }`.\n\n" +
      "`finished` = rechazadas + canceladas. El resumen no depende del filtro `status`.",
    query: myApplicationsQuery,
  },
  ({ userId, query }) => svc.listMine(userId, query),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/applications/:id/cancel",
    tag,
    summary: "Cancelar mi postulación",
    description: "`200 { application }` en estado `cancelada` · `409 ALREADY_PROCESSED` · `403 NOT_APPLICANT`.",
    params: applicationIdParams,
    status: 200,
  },
  ({ params, userId }) => svc.cancel(params.id, userId),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/projects/:id/applications",
    tag,
    summary: "Postulaciones de mi proyecto (creador)",
    description:
      "`200 { roleCounts: [{ roleId, name, count }], total, vacancies, page, limit, items: [applicantCard] }` · `403 NOT_OWNER`.\n\n" +
      "`applicantCard`: `{ id, roleId, role, status, isNew, matchPercent, note, createdAt, applicant: { id, name, initials, photoUrl, headline, location, projectsCount, hoursPerWeek, skills[], links } }`.\n\n" +
      "`matchPercent` = % de las habilidades del rol que tiene el postulante · `isNew` = pendiente de las últimas 72 h · " +
      "`roleCounts` respeta `status` y `q` pero no `roleId` · `vacancies` = vacantes libres (del rol filtrado o de todo el proyecto).",
    params: z.object({ id: idParam }),
    query: projectApplicationsQuery,
  },
  ({ params, userId, query }) => svc.listForProject(params.id, userId, query),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/applications/:id/accept",
    tag,
    summary: "Aceptar postulación (creador)",
    description:
      "Estado `aceptada`: resta 1 vacante al rol y suma al usuario al equipo. `200 { application }`.\n\n" +
      "Errores: `409 NO_VACANCIES` · `409 NOT_PENDING` · `409 PROJECT_NOT_OPEN` · `403 NOT_OWNER`.",
    params: applicationIdParams,
    status: 200,
  },
  ({ params, userId }) => svc.accept(params.id, userId),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/applications/:id/reject",
    tag,
    summary: "Rechazar postulación (creador)",
    description: "`200 { application }` en estado `rechazada` · `409 NOT_PENDING` · `403 NOT_OWNER`.",
    params: applicationIdParams,
    status: 200,
  },
  ({ params, userId }) => svc.reject(params.id, userId),
);

export const postulacionesModule = { base: "/", router };

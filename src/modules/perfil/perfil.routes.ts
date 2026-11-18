import { Router } from "express";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { MB, requireFile } from "../../lib/upload.js";
import { interestsSchema, skillsSchema, updateProfileSchema } from "./perfil.schemas.js";
import { perfilService } from "./perfil.service.js";

const router = Router();
const base = "/api/me";
const tag = "Mi perfil";
registerTag(tag, "Sprint 2 — Perfil del usuario autenticado.");

defineRoute(router, base, { method: "get", path: "/profile", tag, summary: "Ver mi perfil", description: "`200 { profile }`" }, ({ userId }) =>
  perfilService.get(userId),
);

defineRoute(
  router,
  base,
  {
    method: "patch",
    path: "/profile",
    tag,
    summary: "Editar mi perfil",
    description:
      "Todos los campos son opcionales; `null` o `\"\"` borra un campo de texto o enlace.\n\n" +
      "Errores: `400 INVALID_URL` (debe iniciar con http:// o https://) · `400 INVALID_HOURS` (1–80).",
    body: updateProfileSchema,
  },
  ({ userId, body }) => perfilService.update(userId, body),
);

defineRoute(
  router,
  base,
  {
    method: "put",
    path: "/profile/photo",
    tag,
    summary: "Subir foto de perfil",
    description: "multipart/form-data, campo `file`: JPG o PNG de hasta 2 MB. `200 { photoUrl }` · `400 INVALID_FILE`.",
    upload: { field: "file", maxBytes: 2 * MB, description: "JPG o PNG ≤ 2 MB" },
  },
  ({ userId, req }) => {
    const file = requireFile(req.file, ["image/jpeg", "image/png"], "La foto debe ser JPG o PNG de hasta 2 MB");
    return perfilService.setPhoto(userId, file, `${req.protocol}://${req.get("host")}`);
  },
);

defineRoute(
  router,
  base,
  {
    method: "put",
    path: "/skills",
    tag,
    summary: "Reemplazar mis habilidades",
    description: "`200 { skills }` · `400 SKILLS_OUT_OF_RANGE` (1–15) · `400 INVALID_SKILL`.",
    body: skillsSchema,
  },
  ({ userId, body }) => perfilService.setSkills(userId, body.skillIds),
);

defineRoute(
  router,
  base,
  {
    method: "put",
    path: "/interests",
    tag,
    summary: "Reemplazar mis categorías de interés",
    description: "`200 { interests }` · `400 INVALID_CATEGORY`. Un arreglo vacío borra los intereses.",
    body: interestsSchema,
  },
  ({ userId, body }) => perfilService.setInterests(userId, body.categoryIds),
);

export const perfilModule = { base: "/me", router };

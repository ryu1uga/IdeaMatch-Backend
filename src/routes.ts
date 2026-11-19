import { Router } from "express";
import { authModule } from "./modules/auth/auth.routes.js";
import { perfilModule } from "./modules/perfil/perfil.routes.js";
import { catalogosModule } from "./modules/catalogos/catalogos.routes.js";
import { usuariosModule } from "./modules/usuarios/usuarios.routes.js";
import { proyectosModule } from "./modules/proyectos/proyectos.routes.js";
import { exploracionModule } from "./modules/exploracion/exploracion.routes.js";
import { postulacionesModule } from "./modules/postulaciones/postulaciones.routes.js";
import { equipoModule } from "./modules/equipo/equipo.routes.js";
import { conversacionesModule } from "./modules/conversaciones/conversaciones.routes.js";
import { notificacionesModule } from "./modules/notificaciones/notificaciones.routes.js";
import { reportesModule } from "./modules/reportes/reportes.routes.js";
import { entregasModule } from "./modules/entregas/entregas.routes.js";
import { insigniasModule } from "./modules/insignias/insignias.routes.js";
import { usuarioInsigniasModule } from "./modules/usuario-insignias/usuario-insignias.routes.js";

// El orden define el orden de las secciones en Swagger.
// Los módulos CRUD genéricos (en español) se van reemplazando sprint a sprint por
// los endpoints del contrato del front (docs/API_ENDPOINTS.md del repo IdeaMatch).
const modules = [
  authModule,
  perfilModule,
  catalogosModule,
  usuariosModule,
  proyectosModule,
  exploracionModule,
  postulacionesModule,
  equipoModule,
  conversacionesModule,
  notificacionesModule,
  reportesModule,
  entregasModule,
  insigniasModule,
  usuarioInsigniasModule,
];

export const router = Router();
for (const m of modules) router.use(m.base, m.router);

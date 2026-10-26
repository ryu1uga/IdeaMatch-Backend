import { Router } from "express";
import { authModule } from "./modules/auth/auth.routes.js";
import { usuariosModule } from "./modules/usuarios/usuarios.routes.js";
import { perfilesModule } from "./modules/perfiles/perfiles.routes.js";
import { habilidadesModule } from "./modules/habilidades/habilidades.routes.js";
import { categoriasModule } from "./modules/categorias/categorias.routes.js";
import { proyectosModule } from "./modules/proyectos/proyectos.routes.js";
import { rolesProyectoModule } from "./modules/roles-proyecto/roles-proyecto.routes.js";
import { postulacionesModule } from "./modules/postulaciones/postulaciones.routes.js";
import { miembrosEquipoModule } from "./modules/miembros-equipo/miembros-equipo.routes.js";
import { conversacionesModule } from "./modules/conversaciones/conversaciones.routes.js";
import { mensajesModule } from "./modules/mensajes/mensajes.routes.js";
import { adjuntosModule } from "./modules/adjuntos/adjuntos.routes.js";
import { notificacionesModule } from "./modules/notificaciones/notificaciones.routes.js";
import { notificacionesEmailModule } from "./modules/notificaciones-email/notificaciones-email.routes.js";
import { reportesModule } from "./modules/reportes/reportes.routes.js";
import { entregasModule } from "./modules/entregas/entregas.routes.js";
import { insigniasModule } from "./modules/insignias/insignias.routes.js";
import { usuarioInsigniasModule } from "./modules/usuario-insignias/usuario-insignias.routes.js";
import { tokensModule } from "./modules/tokens/tokens.routes.js";

// El orden define el orden de las secciones en Swagger
const modules = [
  authModule,
  usuariosModule,
  perfilesModule,
  habilidadesModule,
  categoriasModule,
  proyectosModule,
  rolesProyectoModule,
  postulacionesModule,
  miembrosEquipoModule,
  conversacionesModule,
  mensajesModule,
  adjuntosModule,
  notificacionesModule,
  notificacionesEmailModule,
  reportesModule,
  entregasModule,
  insigniasModule,
  usuarioInsigniasModule,
  tokensModule,
];

export const router = Router();
for (const m of modules) router.use(m.base, m.router);

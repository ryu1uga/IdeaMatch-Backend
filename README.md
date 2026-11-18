# IdeaMatch Backend

API REST de IdeaMatch: Express 5 + TypeScript + Prisma 7 + PostgreSQL.
El contrato que consume el frontend está en `docs/API_ENDPOINTS.md` del repo **IdeaMatch** (front).

- Documentación interactiva (Swagger): `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`
- Todas las rutas van bajo el prefijo `/api` (por ejemplo `POST /api/auth/login`).

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 20.19 o superior (recomendado 22) |
| Docker Desktop | cualquiera reciente (para PostgreSQL) |
| Git | — |

---

## Iniciar el proyecto en local (primera vez)

Hay dos formas. Para desarrollar se recomienda la **opción A** (recarga automática al guardar).

### Opción A — BD en Docker + API con `npm run dev` (recomendada)

```bash
# 1. Clonar e instalar dependencias (el postinstall ejecuta `prisma generate`)
git clone <url-del-repo> IdeaMatch-Backend
cd IdeaMatch-Backend
npm install

# 2. Crear el archivo de entorno
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
#    Edita .env y pon un JWT_SECRET propio (mínimo 32 caracteres):
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Levantar solo PostgreSQL
npm run db:up

# 4. Crear las tablas y cargar los catálogos (categorías, habilidades, insignias)
npm run prisma:deploy
npm run db:seed

# 5. Iniciar la API en modo desarrollo
npm run dev
```

Abre `http://localhost:3000/docs`, registra un usuario en `POST /api/auth/register`, copia el `token` y pégalo en **Authorize**.

### Opción B — Todo en Docker (BD + API)

```bash
cp .env.example .env          # y define JWT_SECRET
npm run docker:up             # construye la imagen, migra, carga el seed e inicia la API
npm run docker:logs           # ver logs de la API
npm run docker:down           # detener
```

Al arrancar, el contenedor de la API aplica las migraciones pendientes y ejecuta el seed automáticamente.

---

## Actualizar tu copia local (después de un `git pull` o al cambiar de branch)

```bash
git pull
npm install                   # instala dependencias nuevas y regenera el cliente de Prisma
npm run prisma:deploy         # aplica las migraciones nuevas a tu BD
npm run db:seed               # opcional: agrega catálogos nuevos (no duplica los existentes)
npm run dev
```

Si usas la opción B: `npm run docker:up` (reconstruye la imagen y migra solo).

Si algo quedó inconsistente y no te importa perder los datos locales:

```bash
npm run db:reset              # borra la BD, aplica todas las migraciones y ejecuta el seed
# o, con Docker, borrando también el volumen:
npm run docker:reset && npm run docker:up
```

---

## Variables de entorno

Se definen en `.env` (ver `.env.example`). Nunca subas `.env` al repositorio.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar los JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | No | Duración del token (por defecto `1d`) |
| `PORT` | No | Puerto de la API (por defecto `3000`) |
| `CORS_ORIGIN` | No | Orígenes permitidos separados por coma, o `*` (por defecto) |
| `TRUST_PROXY` | No | Proxies delante de la API: `0` en local, `1` en Render |
| `AUTH_RATE_LIMIT` | No | Intentos por IP cada 15 min en login/registro (por defecto `20`) |
| `CLOUDINARY_URL` | En producción | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. Si no está, los archivos se guardan en disco |
| `UPLOAD_DIR` | No | Carpeta para archivos locales (por defecto `uploads`) |
| `PUBLIC_URL` | No | URL pública de la API para armar las URLs de archivos locales |
| `API_PORT` / `DB_PORT` | No | Puertos publicados por `docker compose` (por defecto 3000 / 5432) |

### Archivos subidos (foto de perfil, adjuntos)

- **Sin `CLOUDINARY_URL`** (desarrollo): se guardan en `uploads/` y se sirven en `http://localhost:3000/uploads/...`.
- **Con `CLOUDINARY_URL`** (producción): se suben a Cloudinary en la carpeta `ideamatch/`.
  En Render es obligatorio usar Cloudinary porque su disco se borra en cada reinicio.

---

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | API en modo desarrollo con recarga automática (tsx watch) |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta la versión compilada |
| `npm run typecheck` | Revisa tipos sin compilar |
| `npm run db:up` | Levanta solo PostgreSQL en Docker |
| `npm run prisma:deploy` | Aplica las migraciones pendientes (no crea migraciones nuevas) |
| `npm run prisma:migrate` | `prisma migrate dev`: crea una migración nueva a partir de cambios en `schema.prisma` |
| `npm run prisma:generate` | Regenera el cliente de Prisma en `src/generated/` |
| `npm run prisma:studio` | Abre Prisma Studio para ver/editar la BD |
| `npm run db:seed` | Carga catálogos (idempotente) |
| `npm run db:reset` | Borra la BD local, migra y ejecuta el seed |
| `npm run docker:up` / `docker:down` / `docker:logs` / `docker:reset` | Manejo del entorno completo en Docker |

---

## Cambiar el modelo de datos (nueva migración)

1. Edita `prisma/schema.prisma` (modelos en PascalCase/camelCase, tablas y columnas en snake_case con `@@map` / `@map`).
2. Ejecuta `npm run prisma:migrate -- --name descripcion_corta`. Esto crea `prisma/migrations/<fecha>_descripcion_corta/` y la aplica.
3. Si necesitas algo que Prisma no soporta (CHECK, índices parciales, triggers), agrégalo a mano al final del `migration.sql` generado **antes** de subirlo. `prisma/sql/constraints.sql` sirve de referencia.
4. Sube la carpeta de la migración junto con el cambio del schema.

Nunca edites una migración que ya está en `main` o que otro compañero ya aplicó: crea una nueva.

---

## Estructura

```
prisma/
  schema.prisma          Modelo de datos
  migrations/            Migraciones SQL (una carpeta por cambio)
  sql/constraints.sql    Referencia de CHECK/índices/triggers propios
src/
  app.ts                 Configuración de Express (Swagger, helmet, CORS, rutas)
  server.ts              Arranque y apagado del servidor
  routes.ts              Registro de módulos
  config/env.ts          Validación de variables de entorno (zod)
  domain/enums.ts        Valores permitidos por los CHECK de la BD
  lib/
    route.ts             defineRoute(): valida con zod, aplica auth y documenta en Swagger
    openapi.ts           Genera el documento OpenAPI
    storage.ts           Almacenamiento de archivos (local / Cloudinary)
    upload.ts            Subida multipart y validación del tipo real del archivo
    prisma.ts            Cliente de Prisma
  middlewares/           auth (JWT), rate limit, manejo de errores
  modules/<modulo>/      Rutas, esquemas y servicios de cada funcionalidad
  db/seed.ts             Catálogos iniciales
```

### Convenciones de la API

- **Autenticación:** `Authorization: Bearer <token>`. El token se obtiene en `/api/auth/register` o `/api/auth/login` y se invalida con `/api/auth/logout`.
- **Errores:** siempre `{ "code": "INVALID_CREDENTIALS", "message": "...", "details"?: ... }`. El front decide qué mostrar según `code`.
- **Estados HTTP:** `400` datos inválidos · `401` sin sesión · `403` sin permiso · `404` no existe · `409` conflicto de reglas de negocio · `429` demasiados intentos.
- **IDs:** son BIGINT y se devuelven como string (`"id": "1"`).

### Agregar un endpoint

1. Crea (o usa) la carpeta `src/modules/<modulo>/` con `*.schemas.ts` (zod), `*.service.ts` (lógica con Prisma) y `*.routes.ts`.
2. En el `*.routes.ts` usa `defineRoute(...)`: la validación y la documentación de Swagger salen del mismo esquema.
3. Lanza errores de negocio con `HttpError` y un `code` del contrato, por ejemplo `HttpError.conflict("...", "ROLE_FULL")`.
4. Registra el módulo en `src/routes.ts`.

---

## Avance por sprint

| Sprint | Alcance | Estado |
|---|---|---|
| 1 — Acceso | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` | Hecho |
| 2 — Perfil | `/me/profile`, `/me/profile/photo`, `/me/skills`, `/me/interests`, `/skills`, `/categories`, `/users/:id` | Hecho |
| 3 — Proyectos | `/projects` (borrador), roles, `publish`, `status`, `cancel`, `/me/projects` | Hecho |
| 4 — Exploración | `GET /projects` (q, categoryIds, skillIds, availability, status, sort, page, limit) y `GET /projects/:id` | Hecho |
| 5 — Postulaciones | Postular, cancelar, aceptar, rechazar | Pendiente |
| 6 — Equipo y mensajería | Equipo, salir/remover, chat con adjuntos y WebSocket | Pendiente |
| 7 — Notificaciones y reportes | Notificaciones in-app, contadores, reportes | Pendiente |
| 8 — Administración | Métricas, moderación de reportes, categorías | Pendiente |

Estados de un proyecto: `borrador` → (`publish`) → `abierto` ⇄ `en_curso` ⇄ `pausado` → `cerrado`; `cancelado` desde cualquier estado no final. Las transiciones están en `src/domain/proyecto.ts`.

Los módulos CRUD genéricos que aún aparecen en Swagger (proyectos, postulaciones, mensajes, etc.) son del andamiaje inicial y se reemplazan en el sprint correspondiente.

---

## Problemas comunes

| Problema | Solución |
|---|---|
| `Variables de entorno inválidas` al arrancar | Falta `.env` o `JWT_SECRET` tiene menos de 32 caracteres |
| `Can't reach database server` | PostgreSQL no está levantado: `npm run db:up` (y revisa `DATABASE_URL`) |
| El puerto 5432 ya está en uso | Tienes otro PostgreSQL. Pon `DB_PORT=5433` en `.env` y cambia el puerto en `DATABASE_URL` |
| `Cannot find module '../generated/prisma/client.js'` | Ejecuta `npm run prisma:generate` (o `npm install`) |
| Error de columna o tabla inexistente | Faltan migraciones: `npm run prisma:deploy` |
| `429 TOO_MANY_REQUESTS` en login mientras pruebas | Espera 15 minutos o sube `AUTH_RATE_LIMIT` en `.env` |
| Las fotos se pierden en Render | Falta `CLOUDINARY_URL` en las variables del servicio |

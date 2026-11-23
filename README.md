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
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL. El SSL se toma de `sslmode` (ver Despliegue) |
| `DATABASE_CA_CERT` | No | Certificado CA de la BD (PEM) para validar el SSL, p. ej. el de Supabase |
| `JWT_SECRET` | Sí | Secreto para firmar los JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | No | Duración del token (por defecto `1d`) |
| `PORT` | No | Puerto de la API (por defecto `3000`) |
| `CORS_ORIGIN` | No | Orígenes permitidos separados por coma, o `*` (por defecto) |
| `TRUST_PROXY` | No | Proxies delante de la API: `0` en local, `1` en Render |
| `AUTH_RATE_LIMIT` | No | Intentos por IP cada 15 min en login/registro (por defecto `20`) |
| `CLOUDINARY_URL` | En producción | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. Si no está, los archivos se guardan en disco |
| `UPLOAD_DIR` | No | Carpeta para archivos locales (por defecto `uploads`) |
| `PUBLIC_URL` | No | URL pública de la API para armar las URLs de archivos locales |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Administrador inicial que crea `npm run db:seed` (si la cuenta existe, solo la marca como admin) |
| `API_PORT` / `DB_PORT` | No | Puertos publicados por `docker compose` (por defecto 3000 / 5432) |

### Archivos subidos (foto de perfil, adjuntos)

- **Sin `CLOUDINARY_URL`** (desarrollo): se guardan en `uploads/` y se sirven en `http://localhost:3000/uploads/...`.
- **Con `CLOUDINARY_URL`** (producción): se suben a Cloudinary en la carpeta `ideamatch/`.
  En Render es obligatorio usar Cloudinary porque su disco se borra en cada reinicio.

### Administradores

Las rutas `/api/admin/*` solo responden a administradores (`403 ADMIN_ONLY`). Para tener uno:

- **Al iniciar:** define `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env` y ejecuta `npm run db:seed` (con Docker, el seed corre solo al arrancar).
- **A una cuenta ya registrada:** `npm run admin:promote -- correo@ejemplo.com` (y `--remove` para quitarlo).
  En el contenedor de producción: `docker compose exec api node dist/db/promote-admin.js correo@ejemplo.com`.

El rol se lee de la BD en cada request: darlo o quitarlo tiene efecto inmediato, sin volver a iniciar sesión.

---

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | API en modo desarrollo con recarga automática (tsx watch) |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta la versión compilada |
| `npm run typecheck` | Revisa tipos sin compilar |
| `npm test` | Pruebas de integración de todos los sprints (`npm test -- sprint5` para uno solo) |
| `npm run db:up` | Levanta solo PostgreSQL en Docker |
| `npm run prisma:deploy` | Aplica las migraciones pendientes (no crea migraciones nuevas) |
| `npm run prisma:migrate` | `prisma migrate dev`: crea una migración nueva a partir de cambios en `schema.prisma` |
| `npm run prisma:generate` | Regenera el cliente de Prisma en `src/generated/` |
| `npm run prisma:studio` | Abre Prisma Studio para ver/editar la BD |
| `npm run db:seed` | Carga catálogos (idempotente) |
| `npm run db:reset` | Borra la BD local, migra y ejecuta el seed |
| `npm run admin:promote -- <correo> [--remove]` | Da o quita el rol de administrador a una cuenta existente |
| `npm run docker:up` / `docker:down` / `docker:logs` / `docker:reset` | Manejo del entorno completo en Docker |

---

## Pruebas

```bash
npm test                 # todas (unos 30 s)
npm test -- sprint5      # solo los archivos que contengan "sprint5"
```

Son pruebas de integración en `tests/sprintN.test.mts`: levantan la API y la recorren con peticiones HTTP reales (y WebSocket en el Sprint 6). El runner `tests/run.mjs` crea para cada archivo un **PostgreSQL en memoria (PGlite)** con todas las migraciones aplicadas, así que no necesitas Docker ni tocar tu BD local, y funciona igual en Windows y en CI.

Cuando agregues un endpoint, suma sus casos al archivo del sprint correspondiente (o crea `tests/<nombre>.test.mts`).

### CI

`.github/workflows/ci.yml` corre en cada push y pull request: `npm ci`, `npm run typecheck`, `npm test`, `npm run build` y además construye la imagen Docker. Si algo falla, el PR queda marcado en rojo.

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
    realtime.ts          WebSocket /ws (eventos en tiempo real)
  middlewares/           auth (JWT), rate limit, manejo de errores
  modules/<modulo>/      Rutas, esquemas y servicios de cada funcionalidad
  db/seed.ts             Catálogos iniciales (y admin inicial)
  db/promote-admin.ts    Dar o quitar el rol de administrador
tests/
  run.mjs                Runner: BD en memoria por archivo + tsx
  sprintN.test.mts       Pruebas de integración por sprint
```

### Convenciones de la API

- **Autenticación:** `Authorization: Bearer <token>`. El token se obtiene en `/api/auth/register` o `/api/auth/login` y se invalida con `/api/auth/logout`.
- **Errores:** siempre `{ "code": "INVALID_CREDENTIALS", "message": "...", "details"?: ... }`. El front decide qué mostrar según `code`.
- **Estados HTTP:** `400` datos inválidos · `401` sin sesión · `403` sin permiso · `404` no existe · `409` conflicto de reglas de negocio · `429` demasiados intentos.
- **IDs:** son BIGINT y se devuelven como string (`"id": "1"`).

### Tiempo real (WebSocket)

El chat usa un WebSocket en `ws://localhost:3000/ws?token=<jwt>` (en producción `wss://`). El servidor envía eventos JSON `{ type, data }`:

| Evento | Datos |
|---|---|
| `ready` | `{ userId }` al conectarse |
| `message:new` | `{ conversationId, message }` |
| `message:read` | `{ conversationId, userId, readAt }` |
| `notification:new` | `{ notification }` (misma forma que en `GET /api/notifications`) |

Si el WebSocket se cae, el front puede hacer polling con `GET /api/conversations/:id/messages?after=<idDelÚltimo>`.

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
| 5 — Postulaciones | Postular, `/me/applications`, cancelar, listado del creador con `matchPercent`, aceptar, rechazar | Hecho |
| 6 — Equipo y mensajería | `/projects/:id/team`, `leave`, remover miembro, `/conversations` con adjuntos, lectura y WebSocket `/ws` | Hecho |
| 7 — Notificaciones y reportes | `/notifications` (+ WS `notification:new`), `read`, `read-all`, `/me/counters`, `/projects/:id/reports` | Hecho |
| 8 — Administración | `/admin/metrics`, `/admin/reports` (+ `resolve`), `/admin/categories` | Hecho |

Estados de un proyecto: `borrador` → (`publish`) → `abierto` ⇄ `en_curso` ⇄ `pausado` → `cerrado`; `cancelado` desde cualquier estado no final; `suspendido` lo pone un administrador al resolver un reporte. Las transiciones están en `src/domain/proyecto.ts`.

---

## Despliegue (Render + Supabase)

### 1. Base de datos en Supabase

1. Crea el proyecto en una región cercana a la del servicio de Render (por ejemplo, ambos en el este de EE. UU.).
2. En **Connect**, copia la cadena del **Session pooler (puerto 5432)** y agrégale `?sslmode=require`:
   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   - No uses la conexión directa (`db.<ref>.supabase.co`): es IPv6 y Render no la alcanza.
   - No uses el Transaction pooler (6543): las migraciones de Prisma necesitan una sesión estable.
   - Si la contraseña tiene caracteres especiales, codifícalos para URL (`@` → `%40`, etc.).
3. Desactiva la **Data API** en la configuración del proyecto. La API usa Prisma con conexión directa a Postgres; dejar la Data API activa expone las tablas de `public` (sin RLS).

**SSL:** `node-postgres` trata `sslmode=require` como `verify-full`, y el certificado de Supabase no está entre los CA de Node. `src/lib/db-config.ts` interpreta `sslmode` como `psql` y la CLI de Prisma (que usan la misma URL para migrar): `require` cifra sin validar, `verify-ca`/`verify-full` validan. Para validar el certificado, descárgalo desde Supabase y ponlo en `DATABASE_CA_CERT`.

### 2. API en Render

**New → Web Service** con el repositorio, runtime **Docker** (usa el `Dockerfile`):

| Opción | Valor |
|---|---|
| Health Check Path | `/health` |
| `DATABASE_URL` | La del paso anterior |
| `JWT_SECRET` | Uno nuevo y largo (no reutilices el local) |
| `CORS_ORIGIN` | URL del front, p. ej. `https://ideamatch.vercel.app` |
| `TRUST_PROXY` | `1` |
| `CLOUDINARY_URL` | Obligatoria en Render (su disco se borra en cada reinicio) |
| `SEED_ON_START` | `true` (carga catálogos; es idempotente) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Opcional: primer administrador |

Render define `PORT` solo. En cada despliegue el contenedor ejecuta `prisma migrate deploy`, luego el seed y luego la API. El WebSocket queda en `wss://<servicio>.onrender.com/ws?token=<jwt>`.

### 3. Monitoreo (UptimeRobot)

`GET /health` (también responde `HEAD`) consulta la BD:

- `200 { "status": "ok", "db": "ok", "timestamp": ... }` si todo responde.
- `503 { "status": "error", "db": "error", ... }` si la BD no responde.

En UptimeRobot crea un monitor **HTTP(s)** a `https://<servicio>.onrender.com/health` cada 5 minutos (o un monitor **Keyword** que busque `"status":"ok"`). En los planes gratuitos, ese ping también evita que el servicio de Render se duerma por inactividad.

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
| `self-signed certificate in certificate chain` | Usa `sslmode=require` en `DATABASE_URL` (no `verify-full` sin `DATABASE_CA_CERT`) |
| `ENETUNREACH` o timeout al conectar a Supabase | Estás usando la conexión directa (IPv6): cambia al Session pooler |

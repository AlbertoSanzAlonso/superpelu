# Supabase — Superpelu (legado)

> **Producción actual:** PostgreSQL en el servidor con `DATABASE_URL` (ver `.cursor/skills/superpelu/deploy-coolify.md`). No hace falta proyecto Supabase cloud ni cliente JS en el frontend para citas/agenda.

## 1. Crear proyecto

1. [supabase.com](https://supabase.com) → New project.
2. Anota la contraseña de `postgres`.

## 2. Connection string

**Project Settings → Database → Connection string → URI**

- **Desarrollo / migración:** modo *Session* (puerto `5432`).
- **Producción (Coolify):** modo *Transaction* pooler (puerto `6543`).
- Host del pooler en proyectos nuevos: **`aws-1-eu-central-1.pooler.supabase.com`** (no `aws-0`).
- El host `db.[ref].supabase.co:5432` suele ser solo IPv6; si falla en local, usa el pooler.

En `.env` (sustituye `[ref]` y `[PASSWORD]`):

```env
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
```

## 3. Esquema

Al arrancar el servidor (`npm run dev` / `npm start`) se ejecuta `server/pg/schema.sql` y el sync de catálogo.

También puedes pegar el mismo SQL en **SQL Editor** de Supabase.

## 4. Migrar datos desde SQLite (opcional)

Si ya tenías citas en `data/appointments.sqlite` (local o copiado desde Coolify):

1. En Supabase → **Database** → **Connection string** → elige **Session** (puerto `5432`).
2. Pega la URI en `.env` como `DATABASE_URL` (sustituye `[PASSWORD]` por la contraseña real del proyecto).
3. Ejecuta:

```bash
SQLITE_PATH=./data/appointments.sqlite npm run db:migrate-sqlite
```

El script aplica el esquema, vacía las tablas en Postgres y copia todo desde SQLite. Al final imprime un resumen por tabla.

**Error `password authentication failed`:** la contraseña en `.env` no coincide con la de Supabase. Restablécela en *Project Settings → Database* y actualiza `DATABASE_URL`.

**Producción antigua (Coolify con volumen SQLite):** copia `appointments.sqlite` del contenedor/volumen a tu máquina y usa la misma ruta en `SQLITE_PATH`.

## 5. Coolify

- Variable **`DATABASE_URL`** en runtime (sin comillas).
- Ya **no** hace falta volumen `/app/data` para la base de datos.
- Healthcheck: `GET /api/health` en puerto `3001`.

## Variables en Superpelu (Vite + Hono)

| Variable | Dónde | Para qué |
|----------|--------|----------|
| `DATABASE_URL` | Servidor Node / Coolify | API, citas, agenda (`postgres`) |
| `VITE_SUPABASE_URL` | `.env` → build Vite | Cliente `@supabase/supabase-js` en el navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` → build Vite | Misma clave que «publishable» del dashboard |

**No** uses `NEXT_PUBLIC_*` ni `@supabase/ssr` (eso es solo Next.js).

Reservas y agenda siguen en **`/api`** (Hono); el cliente Supabase en `src/lib/supabaseClient.ts` es opcional (auth, storage, realtime).

## Seguridad

- No expongas `DATABASE_URL` ni la contraseña de Postgres en el frontend.
- La publishable key puede ir en el cliente; no sustituye `ADMIN_SECRET` ni login de profesionales.

# Supabase — Superpelu

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

Si ya tenías citas en `data/appointments.sqlite`:

```bash
SQLITE_PATH=./data/appointments.sqlite npm run db:migrate-sqlite
```

(Requiere `DATABASE_URL` en el entorno o en `.env`.)

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

# Coolify — Superpelu

## Checklist tras cambios de configuración

1. Guardar en Coolify
2. **Redeploy** (no solo Restart) si cambian env vars o labels
3. Logs del contenedor: `Superpelu en http://0.0.0.0:3001 (web + API)`
4. Probar `/api/health` en ventana privada (evitar caché del navegador)

## Healthcheck

- Ruta: `GET /api/health` → `{"ok":true,"db":true}` (si `db:false` o 503, revisa `DATABASE_URL`)
- Puerto **3001**
- La imagen Dockerfile incluye **wget** (Coolify lo usa en el healthcheck) y **curl** (HEALTHCHECK del Dockerfile); `node:slim` no los trae por defecto
- **Start period:** 60–90 s (arranque + Postgres + seed)

## Container Labels (Caddy)

**Mantener:**

```
caddy_0.handle_path.0_reverse_proxy={{upstreams 3001}}
traefik.http.services.*.loadbalancer.server.port=3001
```

**Quitar** (rompe la API):

```
caddy_0.try_files={path} /index.html /index.php
```

`try_files` hace que `/api/appointments` devuelva `index.html` con `200` y `content-type: text/html`. El login y las reservas fallan en silencio o con mensajes confusos.

## ADMIN_SECRET

- Valor **sin comillas** en la UI de Coolify
- Marcado como variable de **runtime** (no solo build)
- Tras cambiar → **Redeploy**
- Probar con curl antes que con el navegador:

```bash
# Debe ser 401
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer clave-incorrecta" \
  "$BASE/api/appointments?from=2026-01-01&to=2026-01-01"

# Debe ser 200
curl -s -H "Authorization: Bearer TU_CLAVE" \
  "$BASE/api/appointments?from=2026-01-01&to=2026-01-01"

# Clientes (admin)
curl -s -H "Authorization: Bearer TU_CLAVE" "$BASE/api/customers"
```

Rutas web admin con el mismo secreto: `/agenda`, `/clientes`, `/clientes/:phone` (historial; el teléfono va URL-encoded).

Si la clave correcta da 401 pero `superpelu-dev-admin` da 200, la variable no está aplicada en el contenedor.

## Base de datos (Supabase)

Variable de entorno **`DATABASE_URL`** (runtime): connection string de Supabase. Para este servidor Node persistente, usa el pooler en modo **Session** (puerto **5432**), no Transaction (6543). No hace falta volumen local para citas.

**Error `password authentication failed for user "postgres"`:** la URI en Coolify es incorrecta. En el pooler el usuario **no** es `postgres`, sino `postgres.TU_PROJECT_REF` (lo muestra Supabase al copiar «Transaction»). Contraseña = la de *Project Settings → Database*, sin comillas en Coolify.

Ejemplo correcto:

```text
postgresql://postgres.abcdefghijklmnop:TU_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

**Arranca bien pero `/api/services` falla con `user "postgres"`:** suele ser Transaction (6543) + pool de conexiones. Cambia a Session (5432) en la URI o redeploy con el código actual (`max: 1`, `prepare: false` en pooler).

**Recomendado en Coolify** (evita pegar la URI y romper la contraseña con `+`, `@`, etc.):

1. **Borra** `DATABASE_URL` de Coolify (si existe).
2. Añade solo:
   - `SUPABASE_PROJECT_REF` = id del proyecto (ej. `zskaxmjxskfznetfjcwz`, de `https://XXXX.supabase.co`)
   - `SUPABASE_DB_PASSWORD` = contraseña **en texto plano** (la de *Reset database password*, sin URI)
   - `SUPABASE_DB_PORT` = `5432`
   - `NODE_ENV` = `production`
3. Save → Redeploy.

El servidor monta la URI con `encodeURIComponent` en la contraseña. En logs debe salir `origen SUPABASE_*`.

Si usas `DATABASE_URL`, tiene **menor prioridad** que `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`.

Migrar desde SQLite de producción antigua:

```bash
SQLITE_PATH=./data/appointments.sqlite DATABASE_URL="postgresql://..." npm run db:migrate-sqlite
```

## Docker local (referencia)

```bash
docker compose up -d --build   # Caddy :80 → superpelu:3001
```

En Coolify no hace falta un segundo recurso: web + API van en la misma app Dockerfile.

## WhatsApp (OpenWA)

OpenWA es un **recurso aparte** en Coolify (Docker Compose del repo [rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)). Superpelu se conecta por red interna.

Guía paso a paso: **[docs/deploy-coolify-openwa.md](../../../docs/deploy-coolify-openwa.md)**

Variables en la app **Superpelu** (runtime):

```env
OPENWA_ENABLED=true
OPENWA_API_URL=http://openwa:2785/api
OPENWA_API_KEY=...
OPENWA_SESSION_ID=sess_...
```

Requiere **Connect To Predefined Network** (misma red que el stack OpenWA) y volumen `/app/data` en OpenWA. La API **no** debe tener dominio público.

## Credenciales

- **Admin:** solo `ADMIN_SECRET` en variables de entorno del contenedor (no en el repo).
- **Profesionales:** contraseñas definidas en `src/data/salonStaff.ts`, hasheadas en SQLite al arrancar. Para cambiarlas en producción, editar ese archivo, redeploy, o actualizar `password_hash` en BD.

No documentar claves reales en skills ni en el repositorio.

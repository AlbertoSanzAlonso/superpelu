# Coolify — Superpelu

## Checklist tras cambios de configuración

1. Guardar en Coolify
2. **Redeploy** (no solo Restart) si cambian env vars o labels
3. Logs del contenedor: `Superpelu en http://0.0.0.0:3001 (web + API)`
4. Probar `/api/health` en ventana privada (evitar caché del navegador)

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

Variable de entorno **`DATABASE_URL`** (runtime): connection string de Supabase (pooler «Transaction», puerto 6543). No hace falta volumen local para citas.

Migrar desde SQLite de producción antigua:

```bash
SQLITE_PATH=./data/appointments.sqlite DATABASE_URL="postgresql://..." npm run db:migrate-sqlite
```

## Docker local (referencia)

```bash
docker compose up -d --build   # Caddy :80 → superpelu:3001
```

En Coolify no hace falta un segundo recurso: web + API van en la misma app Dockerfile.

## Credenciales

- **Admin:** solo `ADMIN_SECRET` en variables de entorno del contenedor (no en el repo).
- **Profesionales:** contraseñas definidas en `src/data/salonStaff.ts`, hasheadas en SQLite al arrancar. Para cambiarlas en producción, editar ese archivo, redeploy, o actualizar `password_hash` en BD.

No documentar claves reales en skills ni en el repositorio.

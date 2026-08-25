# OpenWA (WhatsApp)

Repositorio: [github.com/rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)

## Docker en local (Pop!_OS / Ubuntu)

Si `npm run openwa:setup` dice que Docker no está en el PATH:

```bash
sudo bash scripts/install-docker.sh
newgrp docker          # o cierra sesión y vuelve a entrar
docker run --rm hello-world
npm run openwa:setup
```

## Desarrollo local (recomendado)

Quick Start oficial de OpenWA:

```bash
git clone https://github.com/rmyndharis/OpenWA.git openwa
npm run openwa:setup   # solo API en Docker (recomendado)
```

| Servicio | URL |
|----------|-----|
| API | http://localhost:2785/api |
| Swagger (sesiones, QR) | http://localhost:2785/api/docs |
| QR tras `openwa:setup` | `openwa/data/qr.html` (abrir en el navegador) |

El `docker-compose.dev.yml` del repo OpenWA incluye **dashboard**; en Docker suele fallar el build del frontend (`npm ci` / Vite 8). Usa `deploy/openwa-local.compose.yml` (solo API) vía `npm run openwa:setup`.

En el `.env` de **Superpelu** (API con `npm run dev` en el host):

```env
OPENWA_ENABLED=true
OPENWA_API_URL=http://127.0.0.1:2785/api
OPENWA_API_KEY=tu-api-key
OPENWA_SESSION_ID=sess_...
```

Si Superpelu corre **dentro de Docker** y OpenWA en el host con el comando de arriba, usa:

```env
OPENWA_API_URL=http://host.docker.internal:2785/api
```

(y en `docker-compose.yml` del servicio `superpelu`: `extra_hosts: ["host.docker.internal:host-gateway"]` en Linux).

### Atajos npm (desde la raíz de Superpelu)

```bash
npm run openwa:setup   # Docker + espera API + crea sesión + actualiza .env
npm run openwa:up      # solo levanta contenedores
npm run openwa:down
npm run openwa:logs
```

En desarrollo, la API key por defecto suele ser `dev-admin-key` (ver logs de `openwa-api` o `openwa/data/.api-key`).

## Conectar con Superpelu

1. Dashboard → crear sesión → **Start** → escanear QR con el móvil del salón.
2. Copiar **API key** y **session id** al `.env`.
3. Reiniciar la API de Superpelu (`npm run dev` o redeploy).

Comprobar sesión:

```bash
# Dev local
curl -s -H "Authorization: Bearer TU_ADMIN_SECRET" \
  http://localhost:3001/api/admin/whatsapp

# Producción Coolify
curl -s -H "Authorization: Bearer TU_ADMIN_SECRET" \
  https://superpelubenalmadena.es/api/admin/whatsapp
```

## Auto-recuperación (sin mantenimiento)

Si OpenWA o Chromium caen (Restart en Coolify, ProtocolError, sesión no ready), **Superpelu se recompone solo**:

1. **Watchdog cada 60 s** — si la sesión no está `ready`, hace `start`; si sigue caída, `stop → start`.
2. **Antes de cada envío** — espera a `ready`; si falla el envío, reintenta y fuerza recuperación.
3. **Zombie** — status `ready` pero fallos seguidos → `stop → start` (Chromium colgado).

No hace falta cola de mensajes ni scripts en el contenedor. La sesión autenticada vive en el volumen `/app/data` de OpenWA; tras Restart suele volver sin QR.

Forzar a mano (raro):

```bash
curl -s -X POST -H "Authorization: Bearer TU_ADMIN_SECRET" \
  https://superpelubenalmadena.es/api/admin/whatsapp/reconnect
```

## Recordatorio 24h antes de la cita

Además del mensaje de confirmación inmediato, Superpelu envía un **recordatorio** cuando faltan ~24h. Lo gestiona un temporizador dentro del propio servidor (`server/reminderScheduler.ts`):

- Cada `REMINDER_POLL_MINUTES` (def. 10) busca citas `confirmed` sin recordatorio enviado y, si entran en la ventana de `REMINDER_HOURS_BEFORE` (def. 24), las notifica.
- Idempotente: la columna `reminder_sent_at` de `appointments` evita duplicados aunque el contenedor se reinicie.
- Si una cita se reserva con **menos de 24h** de antelación, no se envía recordatorio (solo la confirmación).

Variables (todas opcionales):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `REMINDERS_ENABLED` | `true` | `false` desactiva el recordatorio |
| `REMINDER_HOURS_BEFORE` | `24` | horas antes de la cita |
| `REMINDER_POLL_MINUTES` | `10` | frecuencia de revisión |

Requiere OpenWA configurado (si no, el scheduler queda inactivo). Forzar un envío manual (para pruebas):

```bash
# Dev local
curl -s -X POST -H "Authorization: Bearer TU_ADMIN_SECRET" \
  http://localhost:3001/api/admin/whatsapp/reminders/run

# Producción Coolify
curl -s -X POST -H "Authorization: Bearer TU_ADMIN_SECRET" \
  https://superpelubenalmadena.es/api/admin/whatsapp/reminders/run
```

## Coolify

Guía completa: **[deploy-coolify-openwa.md](./deploy-coolify-openwa.md)** — recurso Docker Compose (repo OpenWA) + variables en Superpelu + red compartida.

## Producción (mismo servidor Docker, sin Coolify)

**Opción A — perfil en el compose de Superpelu** (red interna, sin publicar API):

```bash
# openwa/ ya clonado en el repo
docker compose --profile openwa up -d --build
```

`OPENWA_API_URL=http://openwa:2785/api` (default en `.env.example`).

Dashboard solo en el servidor: `ssh -L 2886:127.0.0.1:2886 usuario@servidor` → http://localhost:2886

**Opción B — OpenWA aparte** con su `docker-compose.yml` de producción y red Docker compartida con Superpelu (ver [deploy-oracle.md](./deploy-oracle.md)).

## Seguridad

- No expongas **2785** ni **2886** a internet.
- La API solo debe ser llamada desde Superpelu (red privada o localhost).

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
curl -s -H "Authorization: Bearer TU_ADMIN_SECRET" \
  http://localhost:3001/api/admin/whatsapp
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

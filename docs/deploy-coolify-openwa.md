# OpenWA en Coolify

Despliega **OpenWA** como recurso aparte y conéctalo con la app **Superpelu** que ya tengas en Coolify. La API de WhatsApp **no** debe tener dominio público.

## Resumen

| Recurso Coolify | Repositorio | Puerto | Dominio público |
|-----------------|-------------|--------|-----------------|
| **OpenWA** (compose) | [github.com/rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA) | API `2785`, dashboard `80` | Solo dashboard (opcional, protegido) |
| **Superpelu** (ya existente) | tu repo Superpelu | `3001` | `superpelubenalmadena.es` |

---

## 1. Crear OpenWA en Coolify

### Dónde está Docker Compose (v4)

Si buscas **«docker»** en *New Resource* solo verás opciones **sin Git** (*Dockerfile*, *Docker Compose Empty*, *Docker Image*). **Eso no es lo que necesitas.**

El compose con GitHub va por **repositorio público**:

1. Entra en tu **proyecto** (p. ej. *production*).
2. **+ New** / **Add Resource** — **borra el buscador** o no filtres por «docker».
3. Elige **Public Repository** (repositorio público).
4. URL: `https://github.com/rmyndharis/OpenWA` → **Check repository**.
5. En **Build Pack**, cambia a **Docker Compose** (a veces viene *Nixpacks* por defecto).
6. **Docker Compose Location:** `docker-compose.dev.yml`
7. **Server:** el mismo donde corre Superpelu → **Continue** / **Deploy**.

Si falla al crear (error de Git/LFS): en la app → **Advanced** → **Git** → desactiva **Submodules** y **LFS** → redeploy.

### Si el deploy falla con `nest: not found` (muy habitual)

Coolify pasó `NODE_ENV=production` **en el build**. Sin devDependencies no existe el CLI de Nest:

```text
sh: 1: nest: not found
ERROR: failed to solve: ... npm run build ... exit code: 127
```

**Arreglo:** en **Environment Variables** de OpenWA, para `NODE_ENV` (y el resto):

- Desmarca **Available at Buildtime** / **Buildtime** → solo **Runtime**.
- Valor en runtime: `NODE_ENV=production`
- **Save → Redeploy**

No hace falta tocar el Dockerfile del repo OpenWA.

### Si el deploy falla en `dashboard` → `npm ci` (muy habitual)

El `docker-compose.dev.yml` construye **API + dashboard**. El frontend suele fallar en servidores con poca RAM o ARM.

**Solución recomendada — solo API con Dockerfile:**

1. Misma app OpenWA en Coolify → **General**.
2. **Build Pack:** cambia de *Docker Compose* a **Dockerfile**.
3. Borra / ignora *Docker Compose Location*.
4. **Ports Exposes:** `2785` (no `3000`) · Health: `/api/health` · Start period **120** s.
5. **Storages:** `/app/data`.
6. Variables de entorno (sección 1 abajo), sobre todo **`PORT=2785` solo en Runtime**.
7. **Redeploy** y confirma en logs: `OpenWA is running on: http://localhost:2785`.

El **dashboard** no hace falta en el servidor: configuras WhatsApp con la **API** (logs + `curl`) o levantas el dashboard en tu PC (`npm run openwa:up`) solo para escanear el QR una vez.

**Alternativa:** mantener Docker Compose pero en la configuración de Coolify **elimina el servicio `dashboard`** del compose (deja solo `openwa`). Plantilla: `deploy/openwa-coolify.compose.yml` en este repo.

### Alternativa más simple (solo API, sin dashboard en Coolify)

Si el compose da problemas:

1. **Public Repository** → `https://github.com/rmyndharis/OpenWA`
2. **Build Pack:** **Dockerfile** (raíz del repo).
3. Puerto **2785**, health `/api/health`, volumen `/app/data`.
4. API key en **Logs** o `cat /app/data/.api-key` en terminal.
5. Sesión/QR: otra vez con `curl` (ver [openwa.md](./openwa.md)) o levanta el dashboard en tu PC con `npm run openwa:up` apuntando a la misma sesión (mismo volumen no compartido — mejor escanear QR en servidor vía túnel SSH al puerto 2886 si publicas solo dashboard).

---

### Variables de entorno (servicio API `openwa`)

En Coolify → recurso OpenWA → **Environment Variables** (servicio `openwa` / API):

```env
NODE_ENV=production
PORT=2785
DATABASE_TYPE=sqlite
DATABASE_NAME=/app/data/openwa.sqlite
DATABASE_SYNCHRONIZE=false
ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=/app/data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=/app/data/media
```

### Volumen persistente (obligatorio)

Sin volumen pierdes sesión de WhatsApp y la API key al redeploy.

| Mount path | Descripción |
|------------|-------------|
| `/app/data` | SQLite, sesiones WA, `.api-key`, media |

En Coolify: **Storages** → añadir volumen → path del contenedor `/app/data`.

### Healthcheck (API)

| Campo | Valor |
|-------|--------|
| Puerto | `2785` |
| Ruta | `/api/health` |
| Método | GET |
| Código esperado | `200` |
| Start period | `90`–`120` s (Chromium tarda) |

### Dominios

| Servicio | Recomendación |
|----------|----------------|
| **openwa** (API) | **Sin dominio** / no público |
| **dashboard** | Opcional: subdominio interno p. ej. `wa-admin.tudominio.es` + acceso restringido (VPN, IP, autenticación en proxy). Si no, configuras WhatsApp por **terminal** en el servidor (paso 3). |

**No** publiques `2785` en internet.

---

## 2. Conectar Superpelu con OpenWA

En la app **Superpelu** en Coolify:

### Red Docker compartida

1. Abre el recurso **OpenWA** y anota el nombre de la red Docker (p. ej. en logs de deploy o en *Networks* del compose).
2. En **Superpelu** → **Advanced** → **Connect To Predefined Network** (o equivalente en tu versión de Coolify).
3. Activa la misma red que usa el stack OpenWA.

Así Superpelu puede resolver el hostname **`openwa`** (nombre del servicio en `docker-compose.dev.yml`).

### Variables en Superpelu

Añade en **Environment Variables** (runtime) de Superpelu:

```env
OPENWA_ENABLED=true
OPENWA_API_URL=http://openwa:2785/api
OPENWA_API_KEY=<ver paso 3>
OPENWA_SESSION_ID=<ver paso 3>
OPENWA_NOTIFY_PUBLIC_ONLY=false
```

| Variable | Origen |
|----------|--------|
| `OPENWA_API_URL` | Fijo si la red compartida funciona: `http://openwa:2785/api`. Si Coolify usa otro hostname interno, sustituye `openwa` por el que muestre la UI (*Service name* / FQDN interno). |
| `OPENWA_API_KEY` | Archivo `/app/data/.api-key` del contenedor OpenWA o dashboard |
| `OPENWA_SESSION_ID` | Dashboard → Sessions → id `sess_…` con estado **CONNECTED** |

**Save → Redeploy** de Superpelu (no solo Restart).

### Comprobar

```bash
curl -s -H "Authorization: Bearer TU_ADMIN_SECRET" \
  https://superpelubenalmadena.es/api/admin/whatsapp
```

Respuesta esperada: `"connected": true` cuando la sesión WhatsApp está activa.

---

## 3. Obtener API key y session id en el servidor

### API key

Tras el primer arranque de OpenWA:

```bash
# En Coolify → OpenWA → Terminal (contenedor openwa-api / openwa)
cat /app/data/.api-key
```

Copia el valor a `OPENWA_API_KEY` en Superpelu.

### Session id y QR

**Opción A — Dashboard**

1. Asigna dominio solo al servicio **dashboard** (o túnel SSH, ver abajo).
2. http(s)://tu-dashboard → **Sessions** → Create → **Start** → escanear QR con el móvil del salón.
3. Copia **Session ID** → `OPENWA_SESSION_ID` en Superpelu → Redeploy.

**Opción B — SSH + túnel** (sin exponer dashboard)

En tu PC:

```bash
ssh -L 2886:127.0.0.1:2886 usuario@IP_DEL_SERVIDOR_COOLIFY
```

Si el compose publica el dashboard en `127.0.0.1:2886` del host, abre http://localhost:2886. Si no, usa la URL interna que Coolify asigne al servicio dashboard.

**Opción C — API** (con la key del paso anterior)

```bash
API_KEY=$(ssh usuario@servidor 'docker exec CONTENEDOR_OPENWA cat /app/data/.api-key')

curl -s -H "X-API-Key: $API_KEY" http://127.0.0.1:2785/api/sessions
# Crear sesión, start, QR según docs de OpenWA
```

---

## 4. Checklist

- [ ] OpenWA en Coolify con volumen `/app/data`
- [ ] API **sin** dominio público
- [ ] Superpelu en la **misma red** Docker que OpenWA
- [ ] `OPENWA_*` en Superpelu + **Redeploy**
- [ ] Sesión WhatsApp **CONNECTED** en dashboard
- [ ] `GET /api/admin/whatsapp` → `connected: true`
- [ ] Prueba: crear cita en `/reservar` → WhatsApp al cliente

---

## Problemas frecuentes

### Deploy «unhealthy»: `ECONNREFUSED` en `127.0.0.1:2785` (pero la app arrancó)

Síntoma en Coolify:

```text
Healthcheck logs: ... ECONNREFUSED 127.0.0.1:2785
Container logs: ... OpenWA is running on: http://localhost:3000
```

**Causa:** la API escucha en el puerto **3000** (p. ej. Coolify inyecta `PORT=3000` o *Ports Exposes* = 3000), pero el **HEALTHCHECK** del Dockerfile y Coolify prueban **2785**.

**Arreglo (recomendado — alinear todo en 2785):**

1. Coolify → OpenWA → **General** → **Ports Exposes:** `2785` (no `3000`).
2. **Environment Variables** → añade o corrige:
   - `PORT=2785` → **solo Runtime** (no Buildtime).
3. **Healthcheck** (UI de Coolify):
   - Puerto: `2785`
   - Ruta: `/api/health`
   - **Start period:** `90`–`120` s
   - Comando (si permite custom): el del Dockerfile usa `node`, no hace falta `wget`.
   - O desactiva el healthcheck de Coolify y deja solo el del Dockerfile (tras fijar `PORT`).
4. **Redeploy** (no solo Restart).

Comprueba en **Logs** del contenedor:

```text
🚀 OpenWA is running on: http://localhost:2785
```

Si sigue en `3000`, busca otra variable `PORT` en Coolify o en *Server* y elimínala para esta app.

**Alternativa:** dejar la app en 3000 y cambiar healthcheck + `OPENWA_API_URL` en Superpelu a `:3000` — peor, porque la documentación y el Dockerfile asumen **2785**.

### Tras un redeploy/restart no genera QR: `The profile appears to be in use` (lock de Chromium)

Síntoma en los logs de OpenWA al arrancar la sesión:

```text
Failed to launch the browser process: Code: 21
The profile appears to be in use by another Chromium process (...) on another computer (...).
Chromium has locked the profile so that it doesn't get corrupted.
```

**Causa:** al parar el contenedor de forma brusca (cada redeploy/restart), Chromium deja archivos de bloqueo (`SingletonLock`, `SingletonSocket`, `SingletonCookie`) en el perfil persistido (`/app/data/sessions/session-<nombre>/`). El nuevo contenedor se niega a arrancar el navegador.

**Arreglo inmediato (manual):** abre una terminal en el contenedor OpenWA (Coolify → OpenWA → Terminal, o `docker exec`) y borra los locks; luego **Restart**:

```bash
find /app/data -name "Singleton*" -print -delete
```

**Arreglo permanente (que no vuelva a pasar):** en Coolify → OpenWA → **General → Custom Start Command** (Build Pack Dockerfile), pon:

```bash
sh -c "find /app/data -name 'Singleton*' -delete 2>/dev/null; node dist/main"
```

Como el `ENTRYPOINT` del Dockerfile es `dumb-init --`, el contenedor ejecutará `dumb-init -- sh -c "borra locks; node dist/main"` en cada arranque, limpiando el lock automáticamente. **Redeploy** para aplicarlo.

> Reconexión: Superpelu reintenta arrancar la sesión al iniciar y cada 5 min (`startOpenWaKeepAlive`). Con la sesión ya autenticada y el lock limpio, reconecta a `ready` sin pedir QR nuevo.

---

| Síntoma | Qué revisar |
|---------|-------------|
| `connected: false` | QR no escaneado o sesión caída; reiniciar sesión en dashboard |
| `fetch failed` / timeout en logs Superpelu | Red: Superpelu no está en la red de OpenWA o `OPENWA_API_URL` incorrecta |
| `OPENWA_ENABLED` pero no envía | Faltan `OPENWA_API_KEY` o `OPENWA_SESSION_ID` en runtime |
| Pierde WhatsApp tras deploy | Volumen `/app/data` no montado en OpenWA |
| Deploy falla: `target dashboard` / `npm ci` exit 1 | Cambiar a **Build Pack → Dockerfile** (solo API), no `docker-compose.dev.yml` |
| Dashboard no carga API | Solo si despliegas dashboard; el servicio API debe llamarse `openwa` |

---

## Alternativa: solo API (sin compose)

Si prefieres **una** app Dockerfile en Coolify (solo API):

- Repo OpenWA, Dockerfile raíz, puerto `2785`, volumen `/app/data`, sin dominio.
- `OPENWA_API_URL` = URL interna que Coolify muestre para ese contenedor (puede **no** ser `http://openwa:2785` — usa el hostname interno exacto).
- Dashboard: segunda app con *Base Directory* `dashboard`, o configuración por API/SSH.

El compose `docker-compose.dev.yml` es más simple porque ya incluye API + dashboard con el proxy nginx correcto.

Ver también [openwa.md](./openwa.md) y [deploy-coolify.md](../.cursor/skills/superpelu/deploy-coolify.md) (Superpelu).

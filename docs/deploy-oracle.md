# Despliegue en Oracle Cloud Always Free

Guía para correr **Superpelu** (web + API + citas) y opcionalmente **OpenWA** (WhatsApp) en una VM Ampere ARM gratuita 24/7.

## Qué va en la máquina

```text
Oracle VM (Ampere ARM, Ubuntu 22.04)
│
├── Caddy (:80 / :443)     → HTTPS + proxy inverso
├── Superpelu (:3001)      → React (dist/) + API Hono + SQLite
└── OpenWA (opcional)      → Docker interno, solo red privada
```

Recomendación de shape Always Free:

| Recurso | Valor sugerido |
|---------|----------------|
| Shape | VM.Standard.A1.Flex |
| OCPUs | 2 |
| RAM | 12 GB |
| Disco boot | 50–100 GB |

Con 2 OCPU + 12 GB sobra para web + API + OpenWA.

---

## 1. Crear la VM en Oracle

1. [cloud.oracle.com](https://cloud.oracle.com) → **Compute** → **Instances** → **Create**.
2. **Image:** Ubuntu 22.04 (aarch64).
3. **Shape:** Ampere → **VM.Standard.A1.Flex** → 2 OCPU, 12 GB RAM.
4. **Networking:** VCN pública, asignar IP pública.
5. **SSH key:** sube tu clave pública.
6. Crear instancia.

### Abrir puertos (obligatorio)

En **Networking → Virtual cloud networks → Security List → Ingress rules**:

| Puerto | Origen | Descripción |
|--------|--------|-------------|
| 22 | Tu IP (o 0.0.0.0/0 con cuidado) | SSH |
| 80 | 0.0.0.0/0 | HTTP (Caddy + Let's Encrypt) |
| 443 | 0.0.0.0/0 | HTTPS |

No abras los puertos de OpenWA (2785, 2886) a internet.

---

## 2. Preparar el servidor

```bash
ssh ubuntu@TU_IP_PUBLICA

# Actualizar
sudo apt update && sudo apt upgrade -y

# Docker
sudo apt install -y docker.io docker-compose-v2 git ufw
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para usar docker sin sudo

# Firewall en la VM
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Desplegar Superpelu

```bash
cd /opt
sudo git clone git@github.com:AlbertoSanzAlonso/superpelu.git
sudo chown -R $USER:$USER superpelu
cd superpelu

cp .env.example .env
nano .env
```

`.env` de producción (ejemplo):

```env
DOMAIN=superpelubenalmadena.es
ADMIN_SECRET=una-clave-larga-y-segura
PORT=3001
DATABASE_PATH=/app/data/appointments.sqlite

# Cuando integres OpenWA (solo red interna Docker):
# OPENWA_API_URL=http://openwa:2785/api
# OPENWA_API_KEY=...
# OPENWA_ENABLED=true
```

```bash
docker compose up -d --build
docker compose logs -f superpelu
```

Comprueba: `curl http://localhost/api/health` → `{"ok":true}`

### Dominio

En tu DNS, registro **A** apuntando a la IP pública de Oracle:

```text
superpelubenalmadena.es  →  123.45.67.89
```

Caddy obtiene el certificado Let's Encrypt solo al tener el dominio apuntando al servidor.

---

## 4. OpenWA (WhatsApp, opcional)

En la **misma VM**, carpeta aparte:

```bash
cd /opt/superpelu
git clone https://github.com/rmyndharis/OpenWA.git openwa
cd openwa
docker compose -f docker-compose.dev.yml up -d
# Dashboard :2886 · API :2785/api (solo localhost en la VM)
```

1. Entra al dashboard (túnel SSH si no lo expones):

   ```bash
   ssh -L 2886:127.0.0.1:2886 ubuntu@TU_IP
   # Navegador: http://localhost:2886
   ```

2. Crea sesión → escanea QR con el móvil del salón.
3. Copia la API key (`data/.api-key`).
4. Conecta la red Docker de OpenWA con Superpelu, o añade OpenWA al `docker-compose.yml` con perfil `openwa`.

La API de OpenWA debe llamarse **solo desde Superpelu** (`http://openwa:2785/api`), nunca pública.

---

## 5. Actualizar la app

```bash
cd /opt/superpelu
git pull
docker compose up -d --build
```

Los datos de citas persisten en el volumen `superpelu-data`.

---

## 6. Comprobar que todo vive

| URL | Qué |
|-----|-----|
| `https://tudominio.es/` | Web |
| `https://tudominio.es/reservar` | Reservas |
| `https://tudominio.es/agenda` | Panel interno |
| `https://tudominio.es/api/health` | API |

---

## Coste

Dentro de límites **Always Free** de Oracle: **0 €/mes** (VM + tráfico razonable).

Si Oracle pausa o no hay capacidad ARM en tu región, prueba otra región europea o pasa a Hetzner CX11 (~4 €/mes) con el mismo `docker compose`.

---

## Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| No carga HTTPS | DNS A record, puertos 80/443 en Security List + UFW |
| `better-sqlite3` falla al build | La imagen Dockerfile ya instala `g++`; usa build en la VM ARM |
| OpenWA pierde sesión | No reinicies el contenedor sin volumen; escanea QR de nuevo |
| VM idle reclaim | Oracle puede reclamar VMs inactivas muy antiguas; uso ligero evita problemas |

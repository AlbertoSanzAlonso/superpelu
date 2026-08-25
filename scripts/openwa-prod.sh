#!/usr/bin/env bash
# Gestión de WhatsApp (OpenWA) en el servidor de producción vía SSH.
# Se ejecuta desde TU PC (no dentro del contenedor Coolify).
# La API (2785) no debe estar expuesta a internet; los curl van en el propio servidor.
#
# No copies este script al volumen /app/data ni a la imagen: se pierde en cada
# redeploy. Recuperación habitual desde fuera:
#   curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" \
#     https://superpelubenalmadena.es/api/admin/whatsapp/reconnect
#
# Uso:
#   ./scripts/openwa-prod.sh help
#   ./scripts/openwa-prod.sh health
#   ./scripts/openwa-prod.sh sessions
#   ./scripts/openwa-prod.sh status
#   ./scripts/openwa-prod.sh logout
#   ./scripts/openwa-prod.sh start
#   ./scripts/openwa-prod.sh recover  # stop→start (Chromium colgado / ProtocolError)
#   ./scripts/openwa-prod.sh qr
#   ./scripts/openwa-prod.sh relink    # logout + start + qr
#   ./scripts/openwa-prod.sh locks     # borra Singleton* de Chromium (tras crash)
#   ./scripts/openwa-prod.sh superpelu # estado vía API Superpelu (necesita ADMIN_SECRET)
#
# Config: scripts/openwa-prod.env (plantilla: openwa-prod.env.example)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${OPENWA_PROD_ENV:-$ROOT/scripts/openwa-prod.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-157.180.36.231}"
SSH_TARGET="${SSH_TARGET:-${SSH_USER}@${SSH_HOST}}"
SSH_OPTS="${SSH_OPTS:-}"

OPENWA_API_KEY="${OPENWA_API_KEY:-}"
OPENWA_PORT="${OPENWA_PORT:-2785}"
OPENWA_SESSION_NAME="${OPENWA_SESSION_NAME:-superpelu}"
OPENWA_SESSION_ID="${OPENWA_SESSION_ID:-}"
# host = curl en la VM; docker = curl dentro del contenedor (Coolify suele no publicar 2785 al host)
OPENWA_EXEC="${OPENWA_EXEC:-auto}"
OPENWA_DOCKER_CONTAINER="${OPENWA_DOCKER_CONTAINER:-}"

SUPERPELU_URL="${SUPERPELU_URL:-https://superpelubenalmadena.es}"
QR_OUT="${QR_OUT:-$ROOT/openwa-prod-qr.html}"

die() {
  echo "Error: $*" >&2
  exit 1
}

need_key() {
  [[ -n "$OPENWA_API_KEY" ]] || die "Falta OPENWA_API_KEY en $ENV_FILE"
}

# Argumentos SSH opcionales (p. ej. SSH_OPTS='-i ~/.ssh/id_ed25519')
ssh_cmd() {
  local -a args=()
  if [[ -n "${SSH_OPTS:-}" ]]; then
    read -r -a args <<< "$SSH_OPTS"
  fi
  ssh "${args[@]}" "$SSH_TARGET" "$@"
}

# Script remoto: curl en host o dentro del contenedor OpenWA (Coolify).
build_openwa_remote() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local key_quoted port_quoted exec_quoted container_quoted method_quoted path_quoted body_quoted
  key_quoted=$(printf '%q' "$OPENWA_API_KEY")
  port_quoted=$(printf '%q' "$OPENWA_PORT")
  exec_quoted=$(printf '%q' "$OPENWA_EXEC")
  container_quoted=$(printf '%q' "$OPENWA_DOCKER_CONTAINER")
  method_quoted=$(printf '%q' "$method")
  path_quoted=$(printf '%q' "$path")
  body_quoted=$(printf '%q' "$body")

  cat <<REMOTE
set -e
KEY=${key_quoted}
PORT=${port_quoted}
EXEC_MODE=${exec_quoted}
CONTAINER=${container_quoted}
METHOD=${method_quoted}
API_PATH=${path_quoted}
BODY=${body_quoted}
URL="http://127.0.0.1:\${PORT}/api\${API_PATH}"
HDR_KEY="X-API-Key: \${KEY}"

pick_container() {
  local name img n ip
  if [[ -n "\$CONTAINER" ]]; then
    echo "\$CONTAINER"
    return 0
  fi
  name=\$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'openwa|open-wa|wa-api|whatsapp' | head -1)
  [[ -n "\$name" ]] && { echo "\$name"; return 0; }
  name=\$(docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -iE 'openwa|open-wa' | cut -f1 | head -1)
  [[ -n "\$name" ]] && { echo "\$name"; return 0; }
  while IFS= read -r n; do
    [[ -z "\$n" ]] && continue
    if docker exec "\$n" test -f /app/data/.api-key 2>/dev/null; then
      echo "\$n"
      return 0
    fi
  done < <(docker ps --format '{{.Names}}' 2>/dev/null)
  while IFS= read -r n; do
    [[ -z "\$n" ]] && continue
    if docker port "\$n" 2>/dev/null | grep -qE "[:.]\${PORT}([^0-9]|\$)"; then
      echo "\$n"
      return 0
    fi
  done < <(docker ps --format '{{.Names}}' 2>/dev/null)
  while IFS= read -r n; do
    [[ -z "\$n" ]] && continue
    ip=\$(container_ip "\$n")
    [[ -z "\$ip" ]] && continue
    if curl -sf -m 3 -H "\$HDR_KEY" "http://\${ip}:\${PORT}/api/health" >/dev/null 2>&1; then
      echo "\$n"
      return 0
    fi
  done < <(docker ps --format '{{.Names}}' 2>/dev/null)
  echo 'No se encontró contenedor OpenWA.' >&2
  echo 'Contenedores en ejecución:' >&2
  docker ps --format '  - {{.Names}}  ({{.Image}})' >&2 2>/dev/null || true
  echo 'Define OPENWA_DOCKER_CONTAINER en scripts/openwa-prod.env o ejecuta: npm run openwa:prod -- discover' >&2
  return 1
}

curl_host() {
  if [[ -n "\$BODY" ]]; then
    curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" -d "\$BODY" "\$URL"
  else
    curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" "\$URL"
  fi
}

container_ip() {
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "\$1" 2>/dev/null | awk '{print \$1}'
}

curl_to() {
  local base="\$1"
  local url="\${base}/api\${API_PATH}"
  if [[ -n "\$BODY" ]]; then
    curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" -d "\$BODY" "\$url"
  else
    curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" "\$url"
  fi
}

curl_via_container() {
  local c="\$1"
  local ip
  ip=\$(container_ip "\$c")
  [[ -n "\$ip" ]] || { echo "Sin IP para contenedor \$c" >&2; return 1; }
  curl_to "http://\${ip}:\${PORT}"
}

curl_docker_exec() {
  local c="\$1"
  if docker exec "\$c" command -v curl >/dev/null 2>&1; then
    if [[ -n "\$BODY" ]]; then
      docker exec "\$c" curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" -d "\$BODY" "\$URL"
    else
      docker exec "\$c" curl -sS -H "\$HDR_KEY" -H 'Accept: application/json' -H 'Content-Type: application/json' -X "\$METHOD" "\$URL"
    fi
    return 0
  fi
  curl_via_container "\$c"
}

run() {
  local c
  case "\$EXEC_MODE" in
    host)
      curl_host
      ;;
    docker)
      c=\$(pick_container) || exit 1
      curl_docker_exec "\$c"
      ;;
    *)
      if curl_host 2>/dev/null; then
        return 0
      fi
      c=\$(pick_container) || exit 1
      curl_docker_exec "\$c"
      ;;
  esac
}
run
REMOTE
}

ssh_openwa() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out
  if ! out="$(ssh_cmd bash -s <<<"$(build_openwa_remote "$method" "$path" "$body")" 2>&1)"; then
    if [[ "$out" == *"No se encontró contenedor"* ]]; then
      echo "$out" >&2
      die "Ejecuta: npm run openwa:prod -- discover"
    fi
    if [[ "$out" == *"Could not connect"* ]] || [[ "$out" == *"Connection refused"* ]] || [[ "$out" == *"ni en Docker"* ]]; then
      die "OpenWA no responde. Coolify → ¿app OpenWA desplegada y Running?  npm run openwa:prod -- discover"
    fi
    echo "$out" >&2
    exit 1
  fi
  echo "$out"
}

pretty_json() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

resolve_session_id() {
  if [[ -n "$OPENWA_SESSION_ID" ]]; then
    echo "$OPENWA_SESSION_ID"
    return
  fi
  local raw
  raw="$(ssh_openwa GET "/sessions")"
  if command -v jq >/dev/null 2>&1; then
    local id
    id="$(echo "$raw" | jq -r --arg n "$OPENWA_SESSION_NAME" '
      (.data // .) |
      if type == "array" then . else [] end |
      map(select(.name == $n)) | .[0].id // empty
    ')"
    [[ -n "$id" ]] || id="$(echo "$raw" | jq -r '(.data // .) | if type == "array" then .[0].id else empty end')"
    [[ -n "$id" ]] || die "No hay sesión «${OPENWA_SESSION_NAME}». Ejecuta: $0 sessions"
    echo "$id"
  else
    echo "$raw" >&2
    die "Instala jq (sudo apt install jq) o define OPENWA_SESSION_ID en $ENV_FILE"
  fi
}

session_status() {
  local id="$1"
  ssh_openwa GET "/sessions/${id}"
}

is_connected() {
  local status="$1"
  local s="${status,,}"
  [[ "$s" == "ready" || "$s" == "connected" ]]
}

cmd_health() {
  need_key
  echo "→ OpenWA en ${SSH_TARGET}:${OPENWA_PORT}"
  ssh_openwa GET /health | pretty_json
}

cmd_sessions() {
  need_key
  echo "→ Sesiones en ${SSH_TARGET}"
  ssh_openwa GET /sessions | pretty_json
}

cmd_status() {
  need_key
  local id
  id="$(resolve_session_id)"
  echo "→ Sesión ${id} (nombre: ${OPENWA_SESSION_NAME})"
  local raw status phone
  raw="$(session_status "$id")"
  echo "$raw" | pretty_json
  if command -v jq >/dev/null 2>&1; then
    status="$(echo "$raw" | jq -r '(.data // .).status // empty')"
    phone="$(echo "$raw" | jq -r '(.data // .).phone // (.data // .).phoneNumber // empty')"
    echo ""
    if is_connected "$status"; then
      echo "✅ Conectada (${status})${phone:+ · ${phone}}"
      echo "   OPENWA_SESSION_ID=${id}"
    else
      echo "⚠️  No conectada (estado: ${status:-desconocido})"
      echo "   Para QR: $0 qr   o   $0 relink"
    fi
  fi
}

cmd_logout() {
  need_key
  local id
  id="$(resolve_session_id)"
  echo "→ Cerrando sesión WhatsApp ${id}…"
  ssh_openwa POST "/sessions/${id}/logout" | pretty_json
  echo ""
  echo "En el móvil del salón también puedes desvincular en WhatsApp → Dispositivos vinculados."
}

cmd_start() {
  need_key
  local id
  id="$(resolve_session_id)"
  echo "→ Arrancando sesión ${id}…"
  ssh_openwa POST "/sessions/${id}/start" | pretty_json || true
  sleep 2
  cmd_status
}

# stop→start sin logout (no pide QR). Para ProtocolError / Chromium colgado.
cmd_recover() {
  need_key
  local id
  id="$(resolve_session_id)"
  echo "→ Recuperando sesión ${id} (stop → start)…"
  ssh_openwa POST "/sessions/${id}/stop" | pretty_json || true
  sleep 2
  ssh_openwa POST "/sessions/${id}/start" | pretty_json || true
  echo "→ Esperando ready…"
  sleep 8
  cmd_status
}

cmd_qr() {
  need_key
  local id
  id="$(resolve_session_id)"
  echo "→ QR para sesión ${id}…"
  local raw qr
  raw="$(ssh_openwa GET "/sessions/${id}/qr")"
  if command -v jq >/dev/null 2>&1; then
    qr="$(echo "$raw" | jq -r '(.data // .).qrCode // (.data // .).image // empty')"
  else
    echo "$raw"
    die "Instala jq para extraer el QR, o abre en el navegador:"
  fi
  [[ -n "$qr" ]] || die "QR no disponible. Prueba: $0 start   y vuelve a ejecutar $0 qr"
  cat >"$QR_OUT" <<EOF
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="15">
  <title>WhatsApp Superpelu — QR</title>
  <style>
    body { font-family: system-ui; text-align: center; padding: 2rem; background: #111; color: #eee; }
    img { max-width: 340px; background: #fff; padding: 12px; border-radius: 8px; }
    code { background: #222; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>WhatsApp — Superpelu</h1>
  <p>Escanea: WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
  <img src="${qr}" alt="QR">
  <p>Sesión: <code>${id}</code></p>
  <p>Pon este id en Coolify → Superpelu → <code>OPENWA_SESSION_ID</code> y Redeploy.</p>
  <p style="opacity:.6">Se recarga cada 15 s</p>
</body>
</html>
EOF
  echo "✅ QR guardado en: file://${QR_OUT}"
  echo "   Session ID: ${id}"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$QR_OUT" 2>/dev/null || true
  fi
}

cmd_relink() {
  cmd_logout
  echo ""
  sleep 2
  cmd_start
  echo ""
  cmd_qr
}

cmd_locks() {
  echo "→ Borrando locks de Chromium en contenedor OpenWA (${SSH_TARGET})…"
  local container_quoted
  container_quoted=$(printf '%q' "$OPENWA_DOCKER_CONTAINER")
  ssh_cmd bash -s <<<"
set -e
CONTAINER=${container_quoted}
if [[ -z \"\$CONTAINER\" ]]; then
  CONTAINER=\$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'openwa|wa-api' | head -1)
fi
if [[ -n \"\$CONTAINER\" ]]; then
  docker exec \"\$CONTAINER\" find /app/data -name 'Singleton*' -print -delete
  echo \"Locks borrados en \$CONTAINER\"
else
  echo 'No se encontró contenedor. Coolify → OpenWA → Terminal:'
  echo \"  find /app/data -name 'Singleton*' -delete\"
fi
"
  echo "Reinicia OpenWA en Coolify y luego: npm run openwa:prod -- start"
}

cmd_discover() {
  echo "→ Diagnóstico OpenWA en ${SSH_TARGET}"
  local port_quoted key_quoted container_quoted
  port_quoted=$(printf '%q' "$OPENWA_PORT")
  key_quoted=$(printf '%q' "$OPENWA_API_KEY")
  container_quoted=$(printf '%q' "$OPENWA_DOCKER_CONTAINER")
  ssh_cmd bash -s <<<"
set -e
PORT=${port_quoted}
KEY=${key_quoted}
CONTAINER=${container_quoted}
HDR_KEY=\"X-API-Key: \${KEY}\"

echo '=== docker ps (todos los en ejecución) ==='
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || docker ps

echo ''
echo '=== Candidatos OpenWA (fichero /app/data/.api-key) ==='
found=0
while IFS= read -r n; do
  [[ -z \"\$n\" ]] && continue
  if docker exec \"\$n\" test -f /app/data/.api-key 2>/dev/null; then
    found=1
    echo \"  ✓ \$n\"
    docker exec \"\$n\" cat /app/data/.api-key 2>/dev/null | head -c 40
    echo '…'
  fi
done < <(docker ps --format '{{.Names}}' 2>/dev/null)
[[ \"\$found\" -eq 1 ]] || echo '  (ninguno — ¿OpenWA desplegado en Coolify como app aparte?)'

echo ''
echo '=== Puerto '\${PORT}' en el host (VM) ==='
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep \":\${PORT}\" || echo '  No escucha en 127.0.0.1:'\"\${PORT}\"' (normal si solo está en Docker)'

echo ''
echo '=== Prueba API /health por IP de cada contenedor ==='
while IFS= read -r n; do
  [[ -z \"\$n\" ]] && continue
  ip=\$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \"\$n\" 2>/dev/null | awk '{print \$1}')
  [[ -z \"\$ip\" ]] && continue
  if curl -sf -m 2 -H \"\$HDR_KEY\" \"http://\${ip}:\${PORT}/api/health\" >/dev/null 2>&1; then
    echo \"  ✓ \$n → http://\${ip}:\${PORT}/api/health OK\"
    echo \"    Pon en openwa-prod.env: OPENWA_DOCKER_CONTAINER=\$n\"
  fi
done < <(docker ps --format '{{.Names}}' 2>/dev/null)

echo ''
echo '=== Superpelu (contenedores con superpelu en el nombre) ==='
docker ps --format '  - {{.Names}}' 2>/dev/null | grep -i superpelu || echo '  (ninguno con ese nombre)'
"
}

cmd_containers() {
  cmd_discover
}

cmd_superpelu() {
  [[ -n "${ADMIN_SECRET:-}" ]] || die "Define ADMIN_SECRET en $ENV_FILE para comprobar Superpelu"
  echo "→ GET ${SUPERPELU_URL}/api/admin/whatsapp"
  curl -sS -H "Authorization: Bearer ${ADMIN_SECRET}" \
    "${SUPERPELU_URL}/api/admin/whatsapp" | pretty_json
  echo ""
  echo "QR en navegador (tras logout):"
  echo "  ${SUPERPELU_URL}/api/admin/whatsapp/qr?secret=TU_ADMIN_SECRET"
}

cmd_qr_page() {
  [[ -n "${ADMIN_SECRET:-}" ]] || die "Define ADMIN_SECRET en $ENV_FILE"
  local url="${SUPERPELU_URL}/api/admin/whatsapp/qr?secret=${ADMIN_SECRET}"
  echo "$url"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null || true
  fi
}

usage() {
  cat <<EOF
OpenWA producción — ${SSH_TARGET} (API :${OPENWA_PORT}, key en ${ENV_FILE})

Invocar siempre con:  npm run openwa:prod -- <comando>

Comandos:
  health      Comprueba /api/health en el servidor
  sessions    Lista sesiones
  status      Estado de la sesión «${OPENWA_SESSION_NAME}»
  logout      Cierra sesión WhatsApp (desvincula)
  start       Arranca la sesión (tras logout genera QR)
  recover     stop→start (Chromium colgado / ProtocolError; sin QR)
  qr          Descarga QR → ${QR_OUT}
  relink      logout + start + qr (flujo completo)
  locks       Borra locks Chromium (si no arranca tras redeploy)
  discover    Diagnóstico: docker ps, candidatos OpenWA, puerto 2785
  containers  Alias de discover
  superpelu   Estado vía API pública (requiere ADMIN_SECRET)
  qr-page     URL de QR en Superpelu (requiere ADMIN_SECRET)

Ejemplo — Chromium colgado (sin reescanear QR):
  npm run openwa:prod -- recover

Ejemplo — volver a escanear QR:
  ./scripts/openwa-prod.sh relink

Variables en ${ENV_FILE}:
  SSH_USER, SSH_HOST, OPENWA_API_KEY, OPENWA_SESSION_NAME, OPENWA_SESSION_ID (opcional)
EOF
}

main() {
  local cmd="${1:-help}"
  case "$cmd" in
    help | -h | --help) usage ;;
    health) cmd_health ;;
    sessions) cmd_sessions ;;
    status) cmd_status ;;
    logout) cmd_logout ;;
    start) cmd_start ;;
    recover | revive) cmd_recover ;;
    qr) cmd_qr ;;
    relink | reconnect) cmd_relink ;;
    locks | fix-locks) cmd_locks ;;
    discover | containers | ps) cmd_discover ;;
    superpelu | check) cmd_superpelu ;;
    qr-page) cmd_qr_page ;;
    *)
      echo "Comando desconocido: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"

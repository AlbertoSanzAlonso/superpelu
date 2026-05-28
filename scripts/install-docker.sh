#!/usr/bin/env bash
# Instala Docker en Pop!_OS / Ubuntu 24.04 y deja el binario en PATH (/usr/bin/docker).
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Ejecuta con sudo:"
  echo "  sudo bash scripts/install-docker.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Actualizando índices apt…"
apt-get update -qq

echo "==> Instalando Docker (docker.io) y Compose v2…"
apt-get install -y docker.io docker-compose-v2

echo "==> Activando servicio docker…"
systemctl enable --now docker

echo "==> Comprobando instalación…"
docker --version
docker compose version

TARGET_USER="${SUDO_USER:-$USER}"
if [[ -n "$TARGET_USER" && "$TARGET_USER" != "root" ]]; then
  echo "==> Añadiendo $TARGET_USER al grupo docker (sin sudo para docker run)…"
  usermod -aG docker "$TARGET_USER"
  echo ""
  echo "IMPORTANTE: cierra sesión y vuelve a entrar (o reinicia)"
  echo "  para que el grupo docker tenga efecto."
  echo "  Alternativa rápida: newgrp docker"
fi

echo ""
echo "Listo. Prueba (tras re-login o newgrp docker):"
echo "  docker run --rm hello-world"
echo "  cd $(dirname "$(dirname "$(realpath "$0")")") && npm run openwa:setup"

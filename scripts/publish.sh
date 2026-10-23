#!/usr/bin/env bash
# =============================================================================
#  publish.sh · Publica la aplicación en Docker Hub y verifica las imágenes.
# =============================================================================
#  Uso (desde la raíz del proyecto):
#      bash scripts/publish.sh
#
#  Qué hace:
#    1. Lee el usuario de Docker Hub del archivo .env
#    2. Construye las 3 imágenes propias (vote, result, worker)
#    3. Inicia sesión en Docker Hub
#    4. Sube (push) cada imagen etiquetada con :latest y :v1.0.0
#    5. Comprueba que las imágenes se pueden descargar desde el registro
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")/.."

# --- 1. Configuración -------------------------------------------------------
if [ -f ".env" ]; then
	set -a
	# shellcheck disable=SC1091
	. ./.env
	set +a
fi

DOCKERHUB_USER="${DOCKERHUB_USER:-santacruz}"
TAG="${TAG:-latest}"

echo "==> Usuario de Docker Hub: ${DOCKERHUB_USER}"
echo "==> Etiqueta: ${TAG}"

if ! command -v docker > /dev/null 2>&1; then
	echo "ERROR: Docker no está instalado o no está en el PATH." >&2
	exit 1
fi

# --- 2. Construir las imágenes ----------------------------------------------
echo ""
echo "==> Construyendo las imágenes..."
docker compose build vote result worker

# --- 3. Iniciar sesión en Docker Hub ---------------------------------------
echo ""
echo "==> Iniciando sesión en Docker Hub..."
docker login --username "${DOCKERHUB_USER}"

# --- 4. Publicar (push) -----------------------------------------------------
# OJO: como cada servicio declara su clave `image:`, `docker compose build`
# deja la imagen YA etiquetada como ${DOCKERHUB_USER}/voting-app-<servicio>.
SERVICES="vote result worker"
for svc in ${SERVICES}; do
	IMAGE="${DOCKERHUB_USER}/voting-app-${svc}"
	echo ""
	echo "==> Etiquetando y publicando ${IMAGE}:${TAG} ..."
	docker tag "${IMAGE}:latest" "${IMAGE}:${TAG}"
	docker push "${IMAGE}:${TAG}"
	if [ "${TAG}" != "latest" ]; then
		docker push "${IMAGE}:latest"
	fi
done

# --- 5. Verificar que se pueden descargar -----------------------------------
echo ""
echo "==> Verificando las imágenes publicadas..."
for svc in ${SERVICES}; do
	IMAGE="${DOCKERHUB_USER}/voting-app-${svc}"
	docker pull "${IMAGE}:${TAG}"
	echo "    OK  ${IMAGE}:${TAG}"
done

echo ""
echo "==========================================================="
echo " Listo. Imágenes publicadas en Docker Hub:"
for svc in ${SERVICES}; do
	echo "   https://hub.docker.com/r/${DOCKERHUB_USER}/voting-app-${svc}"
done
echo ""
echo " Para levantar la app SIN construir, usando solo el registro:"
echo "   docker compose -f docker-compose.images.yml up -d"
echo "==========================================================="

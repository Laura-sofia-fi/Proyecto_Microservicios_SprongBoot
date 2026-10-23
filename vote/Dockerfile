# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Imagen del servicio "vote" (Python + Flask + gunicorn)
# Etapa 'base'  -> dependencias comunes
# Etapa 'dev'   -> modo desarrollo (recarga automática)
# Etapa 'final' -> imagen de producción (la que se publica en Docker Hub)
# ---------------------------------------------------------------------------

FROM python:3.11-slim AS base

# curl se usa para el healthcheck del contenedor
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/app

# Primero las dependencias -> aprovecha la cache de Docker al reconstruir
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt


# --- Modo desarrollo (opcional, se usa con docker-compose.dev.yml) ---
FROM base AS dev
ENV FLASK_ENV=development
ENV PYTHONUNBUFFERED=1
CMD ["python", "app.py"]


# --- Imagen de producción (la que se sube a Docker Hub) ---
FROM base AS final

ENV PYTHONUNBUFFERED=1
ENV LOG_DIR=/var/log/app

COPY . ./

# Carpeta donde se monta el volumen de logs
RUN mkdir -p /var/log/app

EXPOSE 80

CMD ["gunicorn", "app:app", \
     "-b", "0.0.0.0:80", \
     "--log-file", "-", \
     "--access-logfile", "-", \
     "--workers", "4", \
     "--keep-alive", "0"]

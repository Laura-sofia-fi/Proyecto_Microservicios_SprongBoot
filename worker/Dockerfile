# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Imagen del servicio "worker" (Python) -> es el que procesa los resultados.
# Es la imagen que se publica en Docker Hub.
# ---------------------------------------------------------------------------

FROM python:3.11-slim

WORKDIR /app

# Primero las dependencias -> mejor cache de Docker
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY worker.py ./worker.py

# Carpeta donde se monta el volumen de logs
RUN mkdir -p /app/logs

ENV PYTHONUNBUFFERED=1
ENV LOG_DIR=/app/logs

# El worker no abre puertos: es un proceso en segundo plano
CMD ["python", "worker.py"]

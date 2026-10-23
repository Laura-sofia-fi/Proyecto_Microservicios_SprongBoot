# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Imagen del servicio "result" (Node.js + Express + socket.io)
# Es la imagen que se publica en Docker Hub.
# ---------------------------------------------------------------------------

FROM node:20-slim

# curl -> healthcheck ; tini -> manejo de señales (SIGTERM limpio)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/app

# Primero el manifiesto -> la capa de dependencias se cachea
COPY package*.json ./

# npm ci es reproducible; si no hay lockfile usamos npm install
RUN if [ -f package-lock.json ]; then \
        npm ci --omit=dev; \
    else \
        npm install --omit=dev; \
    fi && \
    npm cache clean --force && \
    mv /usr/local/app/node_modules /node_modules

COPY . ./

# Carpeta donde se monta el volumen de logs
RUN mkdir -p /var/log/app

ENV NODE_ENV=production
ENV PORT=80
ENV LOG_DIR=/var/log/app

EXPOSE 80

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]

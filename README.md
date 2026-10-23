# Voting App "Santa Cruz" · Aplicación multicontenedor con Docker Compose

Proyecto de la entrega: una aplicación web distribuida en **5 contenedores**
(orquestados con un único `docker-compose.yml`), basada en el ejemplo oficial
de Docker [`example-voting-app`](https://github.com/dockersamples/example-voting-app).

```
                Navegador
                    │
        ┌───────────┴───────────┐
        │  8080  │             │  8081
   ┌────▼─────┐           ┌─────▼──────┐
   │  vote    │           │  result    │
   │ (Python) │           │ (Node.js)  │
   └────┬─────┘           └─────┬──────┘
        │  rpush "votes"        │  SELECT ... FROM votes
        ▼                       │
   ┌─────────┐                 │
   │  redis  │  ◄── BLPOP ──┐  │
   └─────────┘              │  │
        ▲                   │  │
        │                   │  │
   ┌────┴─────┐         ┌───┴──▼───┐
   │  worker  │────────►│    db    │
   │ (Python) │ INSERT  │PostgreSQL│
   └──────────┘         └──────────┘
        ▲                   ▲
        └──── back-tier ─────┘
   (vote y result además están en front-tier)
```

| Servicio  | Tecnología                | Rol                                              | Puerto |
|-----------|---------------------------|--------------------------------------------------|--------|
| `vote`    | Python 3.11 + Flask       | Web de votación, encola los votos en Redis        | 8080   |
| `result`  | Node.js 20 + Express/socket.io | Muestra los resultados en tiempo real           | 8081   |
| `worker`  | Python 3.11               | **Procesa** los votos: Redis → PostgreSQL         | —      |
| `redis`   | Redis 7 (AOF)             | Cola de votos                                    | —      |
| `db`      | PostgreSQL 16             | Almacén permanente de los votos                   | —      |

---

## Requisitos

- Docker Desktop instalado (incluye Docker Compose v2).
- Una cuenta gratuita en [Docker Hub](https://hub.docker.com) para publicar.
- Una cuenta de GitHub para subir el código.

---

## Arranque rápido

```bash
# 1. Levantar todo (construye las 3 imágenes propias)
docker compose up -d --build

# 2. Ver el estado de los contenedores y los puertos
docker compose ps

# 3. Abrir en el navegador
#    http://localhost:8080   -> votar
#    http://localhost:8081   -> resultados en tiempo real

# 4. Ver los logs (el worker dice cada voto que procesa)
docker compose logs -f worker

# 5. Parar y borrar TODO, incluidos los datos
docker compose down -v
```

### Modo desarrollo (recarga el código sin reconstruir la imagen)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Usar solo las imágenes ya publicadas en Docker Hub

```bash
docker login
docker compose -f docker-compose.images.yml up -d
```

---

## Estructura del proyecto

```
.
├── docker-compose.yml          # ARCHIVO PRINCIPAL de la entrega
├── docker-compose.images.yml   # Variante que solo descarga de Docker Hub
├── docker-compose.dev.yml      # Override para desarrollo
├── .env / .env.example         # Usuario de Docker Hub y textos de la votación
├── db/init.sql                 # Script de inicialización de PostgreSQL
├── healthchecks/               # Scripts de healthcheck (redis.sh, postgres.sh)
├── vote/                       # Servicio web en Python (Flask)
│   ├── app.py
│   ├── Dockerfile
│   └── requirements.txt
├── result/                     # Servicio de resultados en Node.js
│   ├── server.js
│   ├── Dockerfile
│   ├── package.json
│   └── views/                  # HTML + JS del navegador
├── worker/                     # Contenedor que procesa los resultados (Python)
│   ├── worker.py
│   ├── Dockerfile
│   └── requirements.txt
├── scripts/
│   ├── publish.sh              # Construye y publica en Docker Hub
│   └── generate-entrega.js     # Genera ENTREGA.txt
├── ENTREGA.txt                 # Archivo de texto para subir a Moodle
├── GUION_VIDEO.md              # Guion del video MP4
└── README.md
```

---

## Publicación en Docker Hub (criterio 7)

```bash
# 1. Editar .env y poner tu usuario real
#    DOCKERHUB_USER=tuusuario

# 2. Construir, iniciar sesión y subir (script incluido)
bash scripts/publish.sh
```

O a mano:

```bash
docker compose build vote result worker
docker login
# Cada servicio ya declara su clave `image:`, así que compose deja la imagen
# etiquetada con el nombre de Docker Hub: solo hay que subirla.
docker push tuusuario/voting-app-vote:latest
docker push tuusuario/voting-app-result:latest
docker push tuusuario/voting-app-worker:latest
```

Las imágenes quedan en:

```
https://hub.docker.com/r/tuusuario/voting-app-vote
https://hub.docker.com/r/tuusuario/voting-app-result
https://hub.docker.com/r/tuusuario/voting-app-worker
```

## Publicación en GitHub (criterio 7)

```bash
git init
git add .
git commit -m "Voting App Santa Cruz - app multicontenedor con Docker Compose"
git branch -M main
git remote add origin https://github.com/tuusuario/santacruz-voting-app.git
git push -u origin main
```

> Recordá cambiar `DOCKERHUB_USER` en `.env` **antes** de hacer commit, para que
> el `docker-compose.yml` del repositorio apunte a las imágenes correctas.

---

## Comandos útiles

```bash
docker compose ps                      # estado + puertos
docker compose logs -f                 # logs de todo
docker compose logs -f worker          # log del worker (procesa votos)
docker compose exec db psql -U postgres -c "SELECT vote, COUNT(*) FROM votes GROUP BY vote;"
docker compose exec redis redis-cli LLEN votes
docker compose config                  # valida el .yml y muestra todo resuelto
docker compose down -v                 # borrar contenedores, redes y volúmenes
docker compose up -d --build           # reconstruir tras cambiar el código
```

---

## Cómo se comprueba la rúbrica

| # | Criterio | Dónde se cumple |
|---|----------|-----------------|
| 1 | Archivo `.yml` bien definido | `docker-compose.yml`, sintaxis Compose Spec. Se valida con `docker compose config` |
| 2 | Al menos 3 servicios | 5: `vote`, `result`, `worker`, `redis`, `db` |
| 3 | Enlaces entre 3 servicios | `depends_on` + `links` en `vote`, `result` y `worker`; healthchecks con `service_healthy` |
| 4 | Volúmenes en 3 servicios | 5 servicios: `db-data`, `redis-data`, `vote-logs`, `result-logs`, `worker-logs` |
| 5 | Puertos para el navegador | `8080:80` (vote) y `8081:80` (result) |
| 6 | Redes | `front-tier` y `back-tier` |
| 7 | Docker Hub + GitHub | Imagen `image:` de los 3 servicios + `scripts/publish.sh`; repo con los Dockerfiles |
| 8 | Video MP4 | `GUION_VIDEO.md` (guion) |

---

## Problemas frecuentes

**`port is already allocated`** → ya hay un proceso en el 8080 u 8081.
Cambiá el lado izquierdo en `ports:` (por ejemplo `"9090:80"`).

**El healthcheck de redis o postgres falla en Windows** → ya está contemplado:
los scripts se invocan con `sh /healthchecks/...`, porque en los bind mounts de
Windows no se conserva el bit de ejecución.

**`docker compose up` arranca pero `result` muestra 0%** → es normal si todavía
no votaste. Votá en http://localhost:8080 y el worker volcará el voto a
PostgreSQL en menos de un segundo.

**Quiero empezar de cero** → `docker compose down -v` y después `docker compose up -d --build`.
El `-v` es lo que borra la base de datos.

**Cambié el `.env` y no se refleja** → `docker compose up -d --force-recreate`.

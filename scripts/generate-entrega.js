/**
 * generate-entrega.js
 *
 * Genera ENTREGA.txt: el archivo de texto que cada integrante del equipo
 * sube a Moodle. Contiene el docker-compose.yml completo y los enlaces
 * de GitHub y Docker Hub.
 *
 * Uso:  node scripts/generate-entrega.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COMPOSE = path.join(ROOT, "docker-compose.yml");
const OUT = path.join(ROOT, "ENTREGA.txt");

const compose = fs.readFileSync(COMPOSE, "utf8");

const separator = "=".repeat(78);
const thin = "-".repeat(78);

const content = `${separator}
ENTREGA · Voting App "Santa Cruz" — Aplicación multicontenedor
${separator}

EQUIPO (integrantes):
  1. [NOMBRE COMPLETO DEL INTEGRANTE 1]
  2. [NOMBRE COMPLETO DEL INTEGRANTE 2]
  3. [NOMBRE COMPLETO DEL INTEGRANTE 3]
  4. [NOMBRE COMPLETO DEL INTEGRANTE 4]

(asignaturas: [MATERIA] · [DOCENTE] · [INSTITUTO] · [FECHA DE ENTREGA])


${separator}
1. ENLACES
${separator}

GitHub (código fuente completo):
  https://github.com/[TU-USUARIO-GITHUB]/santacruz-voting-app

Docker Hub (imágenes publicadas):
  https://hub.docker.com/u/[TU-USUARIO-DOCKERHUB]
  https://hub.docker.com/r/[TU-USUARIO-DOCKERHUB]/voting-app-vote
  https://hub.docker.com/r/[TU-USUARIO-DOCKERHUB]/voting-app-result
  https://hub.docker.com/r/[TU-USUARIO-DOCKERHUB]/voting-app-worker

Video MP4 (explicación paso a paso del .yml y de la publicación):
  [PEGAR AQUÍ EL ENLACE AL VIDEO, o adjuntarlo junto a este archivo]

NOTA: reemplazá los corchetes [...] por los datos reales antes de subir.
      Cada integrante del grupo sube una copia de ESTE MISMO archivo.


${separator}
2. DOCKER-COMPOSE.YML  (archivo completo)
${separator}

${compose}

${thin}

${separator}
3. RESUMEN DE LA SOLUCIÓN
${separator}

La aplicación es una versión del ejemplo oficial de Docker "example-voting-app",
adaptada por el equipo. Levanta 5 contenedores con un único comando:

  docker compose up -d --build

Servicios:
  vote    → web en PYTHON (Flask + gunicorn) que recibe los votos.
            Puerto 8080 -> http://localhost:8080
  result  → web en NODE.JS (Express + socket.io) que muestra los resultados
            en tiempo real.  Puerto 8081 -> http://localhost:8081
  worker  → contenedor en PYTHON que PROCESA los resultados: saca los votos de
            la cola de Redis y los guarda en PostgreSQL.
  redis   → cola de votos (Redis 7, con persistencia AOF).
  db      → PostgreSQL 16, almacén permanente de los votos.

Flujo de un voto:
  Navegador → vote (Python) → Redis (cola) → worker (Python) → PostgreSQL
            → result (Node.js) → Navegador

${separator}
4. CÓMO CUMPLE LA RÚBRICA
${separator}

Criterio 1 — Archivo .yml bien definido y con extensión .yml
  docker-compose.yml, sintaxis Compose Spec (sin la clave "version" obsoleta).
  Se valida con: docker compose config

Criterio 2 — Al menos 3 servicios
  5 servicios: vote, result, worker, redis, db.

Criterio 3 — Enlaces entre al menos 3 servicios
  depends_on (con healthcheck) y links en vote, result y worker.
  depends_on con "condition: service_healthy" garantiza el orden de arranque:
  redis y db healthy -> arrancan vote, result y worker.

Criterio 4 — Volúmenes para al menos 3 servicios
  5 servicios con volúmenes:
    db-data     -> /var/lib/postgresql/data   (persistencia de los votos)
    redis-data  -> /data                       (cola de votos)
    vote-logs   -> /var/log/app
    result-logs -> /var/log/app
    worker-logs -> /app/logs
  Además bind mounts de ./healthchecks y ./db/init.sql.

Criterio 5 — Puertos para ver la app en el navegador
  "8080:80" en vote  -> http://localhost:8080
  "8081:80" en result -> http://localhost:8081

Criterio 6 — Redes
  front-tier (vote, result) y back-tier (vote, result, worker, redis, db).
  La base de datos y Redis no son accesibles desde el exterior.

Criterio 7 — Publicada en Docker Hub y GitHub
  Docker Hub: \${DOCKERHUB_USER}/voting-app-vote, -result y -worker.
  GitHub: repositorio santacruz-voting-app con el código y los Dockerfiles.
  Se demuestra en el video levantando la app con docker-compose.images.yml,
  que solo descarga imágenes del registro (sin construir nada local).

Criterio 8 — Video MP4
  Grabado por todos los integrantes, explicando el .yml paso a paso y la
  publicación en GitHub y Docker Hub. Guion en GUION_VIDEO.md.

${separator}
FIN DEL DOCUMENTO
${separator}
`;

fs.writeFileSync(OUT, content, "utf8");
console.log(`ENTREGA.txt generado correctamente (${content.split("\n").length} líneas).`);
console.log(` -> ${OUT}`);

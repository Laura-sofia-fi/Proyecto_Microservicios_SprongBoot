"""Voting App - contenedor web en Python (Flask).

Recibe los votos del navegador y los encola en Redis (lista "votes").
El contenedor `worker` es quien los consume y los guarda en PostgreSQL.
"""

import json
import logging
import os
import random
import socket
from logging.handlers import RotatingFileHandler

from flask import Flask, g, make_response, render_template, request
from redis import Redis

OPTION_A = os.getenv("OPTION_A", "Café")
OPTION_B = os.getenv("OPTION_B", "Té")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
LOG_DIR = os.getenv("LOG_DIR", "/var/log/app")
HOSTNAME = socket.gethostname()

app = Flask(__name__)

# --- logging: por consola (lo que se ve en `docker compose logs`) y a fichero (volumen)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [vote] %(message)s",
    handlers=[logging.StreamHandler()],
)
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    file_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, "vote.log"), maxBytes=2_000_000, backupCount=3
    )
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [vote] %(message)s")
    )
    logging.getLogger().addHandler(file_handler)
except OSError:
    # si el volumen no está montado seguimos funcionando solo con consola
    pass

logger = logging.getLogger("vote")


def get_redis() -> Redis:
    """Conexión a Redis cacheada por request (se guarda en el contexto de Flask)."""
    if "redis" not in g:
        g.redis = Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=0,
            socket_timeout=5,
            socket_connect_timeout=5,
        )
    return g.redis


@app.route("/", methods=["POST", "GET"])
def index():
    # Un voto por navegador: el identificador va en una cookie.
    voter_id = request.cookies.get("voter_id")
    if not voter_id:
        voter_id = hex(random.getrandbits(64))[2:-1]

    vote = None
    if request.method == "POST":
        vote = request.form.get("vote")
        logger.info("Voto recibido: %s (voter_id=%s)", vote, voter_id)
        payload = json.dumps({"voter_id": voter_id, "vote": vote})
        # Encolamos el voto en Redis; el worker lo sacará de aquí.
        get_redis().rpush("votes", payload)

    resp = make_response(
        render_template(
            "index.html",
            option_a=OPTION_A,
            option_b=OPTION_B,
            hostname=HOSTNAME,
            vote=vote,
        )
    )
    resp.set_cookie("voter_id", voter_id, max_age=60 * 60 * 24 * 30)
    return resp


@app.route("/healthz")
def healthz():
    """Endpoint de salud: lo usa el healthcheck del contenedor."""
    return {"status": "ok", "service": "vote", "hostname": HOSTNAME}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, debug=True, threaded=True)

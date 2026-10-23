"""Voting App - contenedor "worker" (Python).

Es el contenedor que PROCESA los resultados: consume los votos que dejó el
servicio `vote` en la cola de Redis y los persiste en PostgreSQL.
"""

import json
import logging
import os
import signal
import sys
import time
from logging.handlers import RotatingFileHandler

import psycopg2
import redis

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
DB_HOST = os.getenv("DB_HOST", "db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "postgres")
QUEUE_NAME = os.getenv("QUEUE_NAME", "votes")
LOG_DIR = os.getenv("LOG_DIR", "/app/logs")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [worker] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
try:
    os.makedirs(LOG_DIR, exist_ok=True)
    file_handler = RotatingFileHandler(
        os.path.join(LOG_DIR, "worker.log"), maxBytes=2_000_000, backupCount=3
    )
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [worker] %(message)s")
    )
    logging.getLogger().addHandler(file_handler)
except OSError:
    pass

logger = logging.getLogger("worker")

running = True


def _stop(signum, _frame):
    global running
    logger.info("Señal %s recibida, terminando...", signum)
    running = False


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def connect_redis():
    """Conecta a Redis reintentando hasta que el contenedor esté listo."""
    while running:
        try:
            client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=0,
                socket_timeout=5,
                socket_connect_timeout=5,
                health_check_interval=30,
            )
            client.ping()
            logger.info("Conectado a Redis en %s:%s", REDIS_HOST, REDIS_PORT)
            return client
        except redis.RedisError as err:
            logger.warning("Esperando a Redis: %s", err)
            time.sleep(2)
    return None


def connect_postgres():
    """Conecta a PostgreSQL reintentando hasta que el contenedor esté listo."""
    while running:
        try:
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                dbname=DB_NAME,
                connect_timeout=5,
            )
            conn.autocommit = True
            logger.info("Conectado a PostgreSQL en %s:%s", DB_HOST, DB_PORT)
            return conn
        except psycopg2.Error as err:
            logger.warning("Esperando a PostgreSQL: %s", err)
            time.sleep(2)
    return None


def ensure_table(conn):
    """Crea la tabla de votos si no existe (idempotente)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS votes (
                id         VARCHAR(255) NOT NULL UNIQUE,
                vote       VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
            )
            """
        )
    logger.info("Tabla 'votes' lista")


def store_vote(conn, voter_id, vote):
    """Guarda el voto. Si el votante ya habia votado, se actualiza."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO votes (id, vote) VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()
            """,
            (voter_id, vote),
        )


def main():
    rds = connect_redis()
    if rds is None:
        return

    conn = connect_postgres()
    if conn is None:
        return

    ensure_table(conn)
    logger.info("Esperando votos en la cola '%s'...", QUEUE_NAME)

    while running:
        try:
            item = rds.blpop(QUEUE_NAME, timeout=1)
        except redis.RedisError as err:
            logger.warning("Error de Redis: %s. Reconectando...", err)
            rds = connect_redis()
            if rds is None:
                break
            continue

        if item is None:
            continue

        _key, raw = item
        try:
            data = json.loads(raw)
            voter_id = data.get("voter_id", "")
            vote = data.get("vote", "")
            logger.info("Procesando voto '%s' de %s", vote, voter_id)
            store_vote(conn, voter_id, vote)
        except (ValueError, TypeError) as err:
            logger.error("Voto con formato inválido: %s (%s)", raw, err)
        except psycopg2.Error as err:
            logger.error("Error de PostgreSQL: %s. Reconectando...", err)
            conn = connect_postgres()
            if conn is None:
                break

    logger.info("Worker detenido.")


if __name__ == "__main__":
    main()

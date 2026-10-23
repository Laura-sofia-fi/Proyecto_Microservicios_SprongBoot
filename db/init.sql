-- Se ejecuta UNA SOLA VEZ, la primera vez que se crea el volumen de datos
-- de PostgreSQL (docker-entrypoint-initdb.d).
-- El worker también crea la tabla si no existe, por si acaso.

CREATE TABLE IF NOT EXISTS votes (
    id         VARCHAR(255) NOT NULL UNIQUE,
    vote       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS votes_vote_idx ON votes (vote);

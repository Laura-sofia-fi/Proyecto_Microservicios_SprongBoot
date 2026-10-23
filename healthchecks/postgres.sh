#!/bin/sh
# Healthcheck de PostgreSQL: la consulta SELECT 1 responde -> está listo.
# Escrito en POSIX sh para que funcione en postgres:alpine y en postgres:latest.
set -eu

host="$(hostname -i 2>/dev/null || echo 127.0.0.1)"
user="${POSTGRES_USER:-postgres}"
db="${POSTGRES_DB:-$user}"

export PGPASSWORD="${POSTGRES_PASSWORD:-}"

result="$(psql -h "$host" -U "$user" -d "$db" -tAc 'SELECT 1' 2>/dev/null || echo '')"

if [ "$result" = "1" ]; then
	exit 0
fi

exit 1

#!/bin/sh
# Healthcheck de Redis: responde PONG -> el contenedor está listo.
# Escrito en POSIX sh para que funcione en redis:alpine y en redis:latest.
set -eu

host="$(hostname -i 2>/dev/null || echo 127.0.0.1)"

if [ "$(redis-cli -h "$host" ping 2>/dev/null || echo '')" = "PONG" ]; then
	exit 0
fi

exit 1

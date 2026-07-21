#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${NODE_ENV:-production}" == "test" ]]; then
  CORS_ORIGINS="${CORS_ORIGINS:-http://127.0.0.1:${FRONTEND_PORT:-3001}}"
  export CORS_ORIGINS
fi

for name in DATABASE_URL JWT_SECRET CORS_ORIGINS; do
  if [[ -z "${!name:-}" ]]; then
    echo "Required environment variable $name is missing." >&2
    exit 1
  fi
done
if [[ ${#JWT_SECRET} -lt 32 ]]; then
  echo "JWT_SECRET must be at least 32 characters." >&2
  exit 1
fi
if [[ ! -d backend/node_modules || ! -d frontend/node_modules || ! -f frontend/dist/index.html ]]; then
  echo "Installed dependencies and a production frontend build are required." >&2
  exit 1
fi

APP_HOST=${APP_HOST:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-4002}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1024 || port > 65535 )); then
    echo "Application ports must be integers from 1024 through 65535." >&2
    exit 1
  fi
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already occupied; no process was changed." >&2
    exit 1
  fi
done
if [[ "$BACKEND_PORT" == "$FRONTEND_PORT" ]]; then
  echo "Backend and frontend ports must be different." >&2
  exit 1
fi

node backend/server.js &
BACKEND_PID=$!
BACKEND_PORT="$BACKEND_PORT" npm --prefix frontend run preview -- --host "$APP_HOST" --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in {1..50}; do
  curl -fsS "http://${APP_HOST}:${BACKEND_PORT}/api/health" >/dev/null && break
  sleep 0.2
done
curl -fsS "http://${APP_HOST}:${BACKEND_PORT}/api/health" >/dev/null
curl -fsS "http://${APP_HOST}:${FRONTEND_PORT}/login" >/dev/null
echo "SAP CRM running: frontend http://${APP_HOST}:${FRONTEND_PORT}, API http://${APP_HOST}:${BACKEND_PORT}/api"
wait "$BACKEND_PID" "$FRONTEND_PID"

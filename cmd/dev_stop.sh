#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev-run"

stop_process() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "[$name] not running (pid file not found)"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if [[ -z "${pid}" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "[$name] already stopped"
    rm -f "$pid_file"
    return
  fi

  echo "[$name] stopping (PID: $pid)..."
  kill "$pid" 2>/dev/null || true
  sleep 1

  if kill -0 "$pid" 2>/dev/null; then
    echo "[$name] force stopping (PID: $pid)..."
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
  echo "[$name] stopped"
}

stop_process "frontend" "$RUN_DIR/frontend.pid"
stop_process "backend" "$RUN_DIR/backend.pid"

echo "[infra] stopping PostgreSQL/Redis..."
cd "$ROOT_DIR"
docker-compose stop

echo "Done."

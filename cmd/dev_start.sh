#!/usr/bin/env bash

set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
ROOT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev-run"

BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG_FILE="$ROOT_DIR/backend/logs/local-dev.log"
FRONTEND_LOG_FILE="$ROOT_DIR/frontend/logs/local-dev.log"

mkdir -p "$RUN_DIR" "$ROOT_DIR/backend/logs" "$ROOT_DIR/frontend/logs"

start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  local command="$4"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if [[ -n "${existing_pid}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "[$name] already running (PID: $existing_pid)"
      return
    fi
  fi

  echo "[$name] starting..."
  nohup bash -lc "$command" >> "$log_file" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$pid_file"
  sleep 1

  if kill -0 "$new_pid" 2>/dev/null; then
    echo "[$name] started (PID: $new_pid)"
    echo "[$name] log: $log_file"
  else
    rm -f "$pid_file"
    echo "[$name] failed to start. Check log: $log_file"
    exit 1
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local pid_file="$3"
  local log_file="$4"
  local attempts="${5:-30}"

  echo "[$name] waiting for HTTP response at $url ..."

  for ((i=1; i<=attempts; i++)); do
    local pid=""
    if [[ -f "$pid_file" ]]; then
      pid="$(cat "$pid_file")"
    fi

    if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
      echo "[$name] process exited during startup. Check log: $log_file"
      exit 1
    fi

    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[$name] ready"
      return
    fi

    sleep 1
  done

  echo "[$name] did not become ready in time. Check log: $log_file"
  exit 1
}

echo "[infra] starting PostgreSQL/Redis..."
bash "$ROOT_DIR/setup-local-env.sh"

start_process "backend" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE" "cd '$ROOT_DIR/backend' && ./deploy-local.sh"
wait_for_http "backend" "http://localhost:8000/docs" "$BACKEND_PID_FILE" "$BACKEND_LOG_FILE"
start_process "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" "cd '$ROOT_DIR/frontend' && ./deploy-local.sh"
wait_for_http "frontend" "http://localhost:3000" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE"

echo ""
echo "Done."
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:8000/docs"
echo ""
echo "Stop command: ./cmd/dev_stop.sh"

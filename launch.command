#!/bin/bash
set -euo pipefail

# =========================================================
# DRMVYZ Local Launcher
# - Kills any process already using port 5173
# - Installs dependencies if node_modules is missing
# - Starts the Vite dev server (:5173)
# - Opens the app in your browser
#
# Notes:
# - No backend or environment variables required.
# - Pure frontend — Web Audio API + Canvas only.
# =========================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

APP_URL="http://127.0.0.1:5173"
LOG_DIR="$DIR/logs"
LOG_FILE="$LOG_DIR/frontend.log"

cleanup() {
  echo ""
  echo "🧹 Shutting down DRMVYZ..."
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

echo "🚀 Starting DRMVYZ v2.0 locally..."

if [[ ! -f "$DIR/package.json" ]]; then
  echo "❌ package.json not found. Put launch.command in the DRMVYZ repo root."
  exit 1
fi

require_cmd npm
require_cmd curl
require_cmd lsof

mkdir -p "$LOG_DIR"

if ! grep -q '"name"[[:space:]]*:[[:space:]]*"drmvyz"' "$DIR/package.json"; then
  echo "❌ This doesn't look like the DRMVYZ project (name mismatch in package.json)."
  exit 1
fi

echo "🧹 Clearing port 5173..."
lsof -ti :5173 | xargs kill -9 2>/dev/null || true

if [[ ! -d "$DIR/node_modules" ]]; then
  echo "📦 node_modules not found — installing dependencies..."
  npm install
fi

echo "--- Starting DRMVYZ v2.0 (Vite :5173) ---"
: > "$LOG_FILE"

npm run dev -- --host 127.0.0.1 --port 5173 > "$LOG_FILE" 2>&1 &
FRONTEND_PID=$!

echo "⏳ Waiting for DRMVYZ to be reachable at $APP_URL ..."
for i in {1..60}; do
  if curl -s -I "$APP_URL" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "❌ Vite exited unexpectedly. Last 50 lines of log:"
    tail -n 50 "$LOG_FILE" || true
    exit 1
  fi

  sleep 1
done

if ! curl -s -I "$APP_URL" >/dev/null 2>&1; then
  echo "❌ DRMVYZ did not become reachable on port 5173."
  echo "   Last 50 lines of $LOG_FILE:"
  tail -n 50 "$LOG_FILE" || true
  exit 1
fi

echo ""
echo "✅ DRMVYZ v2.0 is running:"
echo "   $APP_URL"
echo ""
echo "ℹ️  Log: $LOG_FILE"
echo ""

open "$APP_URL" >/dev/null 2>&1 || true

echo "🟢 Running. Leave this window open. Press Ctrl+C to stop."
while true; do sleep 1; done

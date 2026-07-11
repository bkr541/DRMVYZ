#!/bin/bash
set -euo pipefail

# =========================================================
# DRMVYZ Desktop Launcher
# - Installs dependencies when needed
# - Starts Vite and the Electron desktop shell
# - Connects the native Rekordbox USB parser bridge
# =========================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

require_cmd node
require_cmd npm

echo "🚀 Starting DRMVYZ Desktop..."

if [[ ! -f "$DIR/package.json" ]]; then
  echo "❌ package.json not found. Put launch.command in the DRMVYZ repo root."
  exit 1
fi

if [[ ! -d "$DIR/node_modules" ]] || ! node -e "const fs=require('node:fs'); try { const electron=require('electron'); process.exit(typeof electron === 'string' && fs.existsSync(electron) ? 0 : 1) } catch { process.exit(1) }"; then
  echo "📦 Installing desktop dependencies..."
  npm install
fi

echo "🟢 Opening the Electron desktop app. Press Ctrl+C here to stop it."
npm run electron:dev

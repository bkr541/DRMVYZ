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

# Finder-launched command files do not consistently load the user's Node
# version manager. Prefer the supported Homebrew Node 22 installation, then
# load nvm when available so the repository's .nvmrc remains authoritative.
export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
  nvm use --silent >/dev/null 2>&1 || true
fi

# Electron must run as Electron even when launched from a development shell.
unset ELECTRON_RUN_AS_NODE

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

require_cmd node
require_cmd npm

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -ne 22 ]]; then
  echo "❌ DRMVYZ requires Node 22, but $(node --version) is active at $(command -v node)."
  echo "   Install Node 22 with: brew install node@22"
  echo "   Then launch DRMVYZ again."
  exit 1
fi

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

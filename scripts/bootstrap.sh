#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_VERSION="$(node -p "process.versions.node")"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" != "24" ]]; then
  echo "[bootstrap] EdgeIntel currently requires Node 24.x. Found $NODE_VERSION."
  echo "[bootstrap] Use \`nvm use\` to pick up the version from .nvmrc, then re-run bootstrap."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "[bootstrap] Installing dependencies"
  npm ci
fi

echo "[bootstrap] Validating dependency install"
npm run validate:install

if [[ ! -f .dev.vars && -f .dev.vars.example ]]; then
  echo "[bootstrap] Creating .dev.vars from template"
  cp .dev.vars.example .dev.vars
fi

echo "[bootstrap] Generating Wrangler runtime types"
npm run cf:types

echo "[bootstrap] Applying local D1 migrations"
npm run db:local:apply

cat <<'EOF'
[bootstrap] EdgeIntel local foundation is ready.
Next steps:
  1. Fill any needed secrets in .dev.vars
  2. Run npm run dev
  3. Run npm run verify before deploy work
EOF

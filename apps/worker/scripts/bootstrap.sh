#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$WORKSPACE_DIR/../.." && pwd)"
cd "$WORKSPACE_DIR"

NODE_VERSION="$(node -p "process.versions.node")"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" != "24" ]]; then
  echo "[bootstrap] EdgeIntel currently requires Node 24.x. Found $NODE_VERSION."
  echo "[bootstrap] Use \`nvm use\` from the repo root, then re-run bootstrap."
  exit 1
fi

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "[bootstrap] Installing workspace dependencies"
  (cd "$REPO_ROOT" && npm install)
fi

echo "[bootstrap] Validating dependency install"
npm run validate:install

if [[ ! -f .dev.vars && -f "$REPO_ROOT/.dev.vars" ]]; then
  echo "[bootstrap] Copying existing repo-root .dev.vars into apps/worker"
  cp "$REPO_ROOT/.dev.vars" .dev.vars
fi

if [[ ! -f .dev.vars && -f .dev.vars.example ]]; then
  echo "[bootstrap] Creating apps/worker/.dev.vars from template"
  cp .dev.vars.example .dev.vars
fi

echo "[bootstrap] Generating Wrangler runtime types"
npm run cf:types

echo "[bootstrap] Applying local D1 migrations"
npm run db:local:apply

cat <<'EOF'
[bootstrap] EdgeIntel local foundation is ready.
Next steps:
  1. Fill any needed secrets in apps/worker/.dev.vars
  2. Run npm run dev from the repo root
  3. Run npm run verify before deploy work
EOF

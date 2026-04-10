#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$WORKSPACE_DIR/../.." && pwd)"
cd "$WORKSPACE_DIR"

required_files=(
  "$REPO_ROOT/node_modules/vite-node/dist/client.mjs"
  "$REPO_ROOT/node_modules/vite-node/dist/server.mjs"
  "$REPO_ROOT/node_modules/wrangler/wrangler-dist/cli.js"
)

missing_files=()
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    missing_files+=("$file")
  fi
done

if (( ${#missing_files[@]} > 0 )); then
  echo "[install-check] Incomplete workspace dependency install detected."
  printf '  - missing %s\n' "${missing_files[@]}"
  echo "[install-check] Re-run npm install from the repo root before continuing."
  exit 1
fi

echo "[install-check] Dependency install looks complete."

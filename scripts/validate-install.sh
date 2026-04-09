#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "node_modules/vite-node/dist/client.mjs"
  "node_modules/vite-node/dist/server.mjs"
  "node_modules/wrangler/wrangler-dist/cli.js"
)

missing_files=()
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    missing_files+=("$file")
  fi
done

if (( ${#missing_files[@]} > 0 )); then
  echo "[install-check] Incomplete dependency install detected."
  printf '  - missing %s\n' "${missing_files[@]}"
  echo "[install-check] Re-run npm ci before continuing."
  exit 1
fi

echo "[install-check] Dependency install looks complete."

#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_DIR"

DATABASE_BINDING="edgeintel"
LOCAL_PERSIST_DIR=".wrangler/state"

usage() {
  cat <<'EOF'
Usage: bash scripts/d1-local.sh <apply|list|reset|sql>

Commands:
  apply   Apply local D1 migrations
  list    List pending local D1 migrations
  reset   Remove local Wrangler state and re-apply migrations
  sql     Execute SQL passed via EDGEINTEL_SQL
EOF
}

case "${1:-}" in
  apply)
    npx wrangler d1 migrations apply "$DATABASE_BINDING" --local --persist-to "$LOCAL_PERSIST_DIR"
    ;;
  list)
    npx wrangler d1 migrations list "$DATABASE_BINDING"
    ;;
  reset)
    rm -rf "$LOCAL_PERSIST_DIR"
    npx wrangler d1 migrations apply "$DATABASE_BINDING" --local --persist-to "$LOCAL_PERSIST_DIR"
    ;;
  sql)
    : "${EDGEINTEL_SQL:?Set EDGEINTEL_SQL to the SQL command you want to run.}"
    npx wrangler d1 execute "$DATABASE_BINDING" --local --persist-to "$LOCAL_PERSIST_DIR" --command "$EDGEINTEL_SQL"
    ;;
  *)
    usage
    exit 1
    ;;
esac

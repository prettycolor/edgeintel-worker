#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/activate-remote.sh <base-url>

Reads any supported EdgeIntel remote secret from the current shell
environment, writes it to the deployed Worker via Wrangler, then reruns the
remote readiness check.

Supported environment variables:
  PROVIDER_SECRET_ENCRYPTION_KEY
  ACCESS_TEAM_DOMAIN
  ACCESS_AUD
  MCP_ACCESS_CLIENT_ID
  MCP_ACCESS_CLIENT_SECRET
  MCP_ACCESS_TOKEN_URL
  MCP_ACCESS_AUTHORIZATION_URL
  MCP_ACCESS_JWKS_URL
  CLOUDFLARE_API_TOKEN

Example:
  export ACCESS_TEAM_DOMAIN="example.cloudflareaccess.com"
  export ACCESS_AUD="01234567-89ab-cdef-0123-456789abcdef"
  export CLOUDFLARE_API_TOKEN="..."
  bash scripts/activate-remote.sh https://edgeintel-worker.example.workers.dev
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

BASE_URL="${1%/}"

SUPPORTED_SECRETS=(
  PROVIDER_SECRET_ENCRYPTION_KEY
  ACCESS_TEAM_DOMAIN
  ACCESS_AUD
  MCP_ACCESS_CLIENT_ID
  MCP_ACCESS_CLIENT_SECRET
  MCP_ACCESS_TOKEN_URL
  MCP_ACCESS_AUTHORIZATION_URL
  MCP_ACCESS_JWKS_URL
  CLOUDFLARE_API_TOKEN
)

yellow() {
  printf '\033[33m%s\033[0m\n' "$1"
}

green() {
  printf '\033[32m%s\033[0m\n' "$1"
}

write_secret() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    return 1
  fi

  printf '%s' "$value" | npx wrangler secret put "$name" >/dev/null
  green "set $name"
  return 0
}

applied=0

for name in "${SUPPORTED_SECRETS[@]}"; do
  value="${!name:-}"
  if [[ -n "$value" ]]; then
    write_secret "$name" "$value"
    applied=$((applied + 1))
  fi
done

if [[ "$applied" -eq 0 ]]; then
  yellow "No supported remote secret environment variables were set."
  usage
  exit 1
fi

printf '\n'
green "Applied $applied remote secret(s)."
printf '\n'

bash scripts/remote-readiness.sh "$BASE_URL"

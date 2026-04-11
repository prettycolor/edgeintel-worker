#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/remote-readiness.sh <base-url>"
  echo "Example: bash scripts/remote-readiness.sh https://edgeintel.app"
  exit 1
fi

BASE_URL="${1%/}"
BASE_HOST="${BASE_URL#*://}"
BASE_HOST="${BASE_HOST%%/*}"
BASE_HOST="${BASE_HOST%%:*}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CURL_EXTRA_ARGS=()
if [[ "$BASE_HOST" != "localhost" && "$BASE_HOST" != "127.0.0.1" && "$BASE_HOST" != "::1" ]]; then
  CURL_EXTRA_ARGS+=(--doh-url "https://cloudflare-dns.com/dns-query")
fi

green() {
  printf '\033[32m%s\033[0m\n' "$1"
}

yellow() {
  printf '\033[33m%s\033[0m\n' "$1"
}

red() {
  printf '\033[31m%s\033[0m\n' "$1"
}

section() {
  printf '\n%s\n' "$1"
}

request() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local body_file="$TMP_DIR/${name// /_}.body"
  local headers_file="$TMP_DIR/${name// /_}.headers"
  local status

  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$body_file" -D "$headers_file" -w '%{http_code}' -X "$method" \
      "${CURL_EXTRA_ARGS[@]}" \
      -H 'content-type: application/json' \
      --data "$body" \
      "$BASE_URL$path")"
  else
    status="$(curl -sS -o "$body_file" -D "$headers_file" -w '%{http_code}' -X "$method" \
      "${CURL_EXTRA_ARGS[@]}" \
      "$BASE_URL$path")"
  fi

  printf '%s\n' "$status"
}

body_contains() {
  local file="$1"
  local needle="$2"
  if rg -Fq "$needle" "$file"; then
    return 0
  fi
  return 1
}

header_contains() {
  local file="$1"
  local needle="$2"
  if rg -Fqi "$needle" "$file"; then
    return 0
  fi
  return 1
}

section "EdgeIntel Remote Readiness"
echo "Base URL: $BASE_URL"

section "Worker Secrets"

SECRETS_JSON="[]"
if secrets_output="$(npx wrangler secret list --format json 2>/dev/null)"; then
  SECRETS_JSON="$secrets_output"
else
  yellow "Could not enumerate Worker secrets via Wrangler. The Worker may not be deployed yet."
fi

SECRET_SUMMARY="$(node - "$SECRETS_JSON" <<'NODE'
const secrets = JSON.parse(process.argv[2] ?? '[]');
const names = new Set(Array.isArray(secrets) ? secrets.map((entry) => entry.name) : []);
const groups = {
  minimum: ["PROVIDER_SECRET_ENCRYPTION_KEY"],
  access: ["ACCESS_TEAM_DOMAIN", "ACCESS_AUD"],
  mcp: [
    "MCP_ACCESS_CLIENT_ID",
    "MCP_ACCESS_CLIENT_SECRET",
    "MCP_ACCESS_TOKEN_URL",
    "MCP_ACCESS_AUTHORIZATION_URL",
    "MCP_ACCESS_JWKS_URL",
  ],
  tunnel: ["CLOUDFLARE_API_TOKEN"],
};

const result = {};
for (const [group, required] of Object.entries(groups)) {
  result[group] = {
    present: required.filter((name) => names.has(name)),
    missing: required.filter((name) => !names.has(name)),
  };
}
process.stdout.write(JSON.stringify(result));
NODE
)"

node - "$SECRET_SUMMARY" <<'NODE'
const summary = JSON.parse(process.argv[2]);
const groups = [
  ["minimum", "Minimum deploy"],
  ["access", "Access operator app"],
  ["mcp", "MCP OAuth"],
  ["tunnel", "Cloudflare orchestration"],
];
for (const [key, label] of groups) {
  const { present, missing } = summary[key];
  const status = missing.length === 0 ? "ready" : present.length > 0 ? "partial" : "missing";
  console.log(`${label}: ${status}`);
  console.log(`  present: ${present.length ? present.join(", ") : "-"}`);
  console.log(`  missing: ${missing.length ? missing.join(", ") : "-"}`);
}
NODE

section "Public Endpoints"

health_status="$(request "health" GET "/health")"
if [[ "$health_status" == "200" ]]; then
  green "health: 200"
else
  red "health: $health_status"
fi

oauth_meta_status="$(request "oauth_meta" GET "/.well-known/oauth-authorization-server")"
if [[ "$oauth_meta_status" == "200" ]]; then
  green "oauth metadata: 200"
else
  red "oauth metadata: $oauth_meta_status"
fi

protected_meta_status="$(request "protected_meta" GET "/.well-known/oauth-protected-resource/mcp")"
if [[ "$protected_meta_status" == "200" ]]; then
  green "mcp protected-resource metadata: 200"
else
  red "mcp protected-resource metadata: $protected_meta_status"
fi

mcp_status="$(request "mcp" POST "/mcp")"
if [[ "$mcp_status" == "401" ]] && header_contains "$TMP_DIR/mcp.headers" 'www-authenticate: Bearer realm="OAuth"'; then
  green "mcp unauthenticated challenge: 401"
else
  yellow "mcp unauthenticated challenge: $mcp_status"
fi

section "Protected Operator Surface"

app_status="$(request "app" GET "/app")"
if [[ "$app_status" == "500" ]] && body_contains "$TMP_DIR/app.body" "ACCESS_TEAM_DOMAIN and ACCESS_AUD"; then
  yellow "app shell: Access config missing"
elif [[ "$app_status" == "401" ]] && body_contains "$TMP_DIR/app.body" "Missing Cf-Access-Jwt-Assertion header."; then
  green "app shell: Access-configured and awaiting authenticated request"
else
  yellow "app shell: HTTP $app_status"
fi

session_status="$(request "session" GET "/api/session")"
if [[ "$session_status" == "500" ]] && body_contains "$TMP_DIR/session.body" "ACCESS_TEAM_DOMAIN and ACCESS_AUD"; then
  yellow "operator session: Access config missing"
elif [[ "$session_status" == "401" ]] && body_contains "$TMP_DIR/session.body" "Missing Cf-Access-Jwt-Assertion header."; then
  green "operator session: Access-configured and awaiting authenticated request"
else
  yellow "operator session: HTTP $session_status"
fi

scan_status="$(request "scan" POST "/api/scan" '{"domains":["example.com"]}')"
if [[ "$scan_status" == "500" ]] && body_contains "$TMP_DIR/scan.body" "ACCESS_TEAM_DOMAIN and ACCESS_AUD"; then
  yellow "scan API: Access config missing"
elif [[ "$scan_status" == "401" ]] && body_contains "$TMP_DIR/scan.body" "Missing Cf-Access-Jwt-Assertion header."; then
  green "scan API: Access-configured and awaiting authenticated request"
else
  yellow "scan API: HTTP $scan_status"
fi

section "MCP OAuth Surface"

authorize_status="$(request "authorize" GET "/authorize")"
if [[ "$authorize_status" == "500" ]] && body_contains "$TMP_DIR/authorize.body" "Missing MCP Access OAuth configuration"; then
  yellow "authorize: MCP Access for SaaS config missing"
elif [[ "$authorize_status" == "200" ]]; then
  green "authorize: 200"
else
  yellow "authorize: HTTP $authorize_status"
fi

token_status="$(request "token" POST "/token")"
if [[ "$token_status" == "400" ]] && body_contains "$TMP_DIR/token.body" "Content-Type must be application/x-www-form-urlencoded"; then
  green "token endpoint: reachable"
else
  yellow "token endpoint: HTTP $token_status"
fi

section "Next Actions"

node - "$SECRET_SUMMARY" <<'NODE'
const summary = JSON.parse(process.argv[2]);
const actions = [];
if (summary.access.missing.length > 0) {
  actions.push(
    "Enable Cloudflare Access for the deployed host and set ACCESS_TEAM_DOMAIN plus ACCESS_AUD."
  );
}
if (summary.mcp.missing.length > 0) {
  actions.push(
    "Create the Access for SaaS OIDC app for MCP and set the MCP_ACCESS_* secrets."
  );
}
if (summary.tunnel.missing.length > 0) {
  actions.push(
    "Set CLOUDFLARE_API_TOKEN before using in-app tunnel, DNS, and Access orchestration."
  );
}
if (actions.length === 0) {
  actions.push("Remote secrets look complete. Run an authenticated /app and MCP Inspector smoke next.");
}
for (const action of actions) {
  console.log(`- ${action}`);
}
NODE

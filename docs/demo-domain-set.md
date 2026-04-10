# EdgeIntel Demo Domain Set

Use this as the canonical domain mix for live demos.

## Tier 1: Controlled Domains

- `hostinginfo.gg`
  Primary product-context domain for scans, findings, recommendations, and exports.

- A Cloudflare-proxied domain you control
  Use this to show the difference between basic adoption and deeper Cloudflare usage.

- A local-model tunnel hostname you provision through EdgeIntel
  Use this to show providers, tunnels, Access, pairing, and runtime observability.

## Tier 2: Public Reference Categories

- One clearly Cloudflare-fronted domain
- One non-Cloudflare domain with visible auth surface
- One domain with visible cache or redirect complexity

Verify these the same day as the demo. Do not assume any public third-party domain still has the same edge or DNS posture from a previous run.

## What To Avoid

- Unverified third-party domains
- Anything that needs authenticated crawling to tell the story
- Anything that makes EdgeIntel look like an offensive scanner

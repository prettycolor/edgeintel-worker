# Contributing

EdgeIntel is being built as a Cloudflare-native operator product, not a generic
starter repo. Contributions should preserve that focus.

## Core Rules

- Keep scans bounded to public, web-visible posture.
- Do not add private-network probing, exploit behavior, or offensive security
  checks.
- Prefer Cloudflare-native architecture over bolting on unrelated services.
- Keep AI grounded in persisted findings and artifacts. AI is not the
  source-of-truth layer.

## Local Setup

```bash
cd /Users/b.rad/Documents/GitHub/edgeintel-worker
nvm use
npm ci
npm run db:local:apply
npm run verify
```

If you are developing the Worker locally, copy
[`apps/worker/.dev.vars.example`](/Users/b.rad/Documents/GitHub/edgeintel-worker/apps/worker/.dev.vars.example)
to `apps/worker/.dev.vars` and fill in only the values you actually need.

## Change Workflow

Every meaningful slice should close the same review gate before moving on:

1. Implement the change.
2. Review the diff for behavioral regressions and weak assumptions.
3. Run QA and the relevant test commands.
4. Do a polish pass on code, copy, and docs.
5. Update documentation if routes, setup, or operator workflows changed.
6. Run `npm run verify`.
7. Commit only after the gate is clean.

## Commands

- `npm run dev`: start the Worker locally
- `npm run dev:control-plane`: start the React control-plane workspace
- `npm run dev:desktop`: start the Electron connector
- `npm run db:local:apply`: apply local D1 migrations
- `npm run verify`: monorepo verification gate
- `npm run desktop:package`: package the macOS connector locally

## Pull Requests

Use the PR template and include:

- the user-visible impact
- the exact verification you ran
- any known follow-up work that is intentionally deferred

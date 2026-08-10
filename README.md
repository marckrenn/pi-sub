# pi-sub

[![Join dotfield.xyz on Discord](https://img.shields.io/badge/Join%20dotfield.xyz%20on%20Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/4945dXZVW5)

[![Release](https://github.com/eiei114/pi-sub/actions/workflows/release.yml/badge.svg?branch=main&event=push)](https://github.com/eiei114/pi-sub/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/%40eiei114%2Fpi-sub-core.svg)](https://www.npmjs.com/package/@eiei114/pi-sub-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing-blue.svg)](RELEASE_PROCESS.md)

> Unofficial continuation of [`marckrenn/pi-sub`](https://github.com/marckrenn/pi-sub).
> This fork keeps the upstream MIT license and attribution, but publishes packages under the `@eiei114` npm scope.

Monorepo for the `sub-*` extension ecosystem: a shared usage core (`sub-core`), UI clients (like `sub-bar`), and headless consumers that subscribe to usage updates.

## About this fork

This fork exists because the upstream repo has been quiet while a few maintenance issues and PRs were waiting. The goal is to keep `pi-sub` usable for current Pi users, not to present this fork as the upstream project.

Initial changes in this fork:

- Package scope changed from `@marckrenn/*` to `@eiei114/*` for npm publishing.
- Install docs updated for the `@eiei114` packages.
- Cache writes are more robust on Windows by retrying transient rename failures and cleaning up temp files.
- Cache lock ownership is safer so one process does not release another process's lock.
- `turn_end` and `tool_result` refreshes now respect the cache TTL instead of forcing network requests every turn.

## Overview

- **sub-core**: fetches usage + status, manages cache/locks, owns provider selection, and emits updates via `pi.events`.
- **sub-bar**: UI widget that renders the current usage state above the editor.
- **sub-status**: compact status-line client that renders the current usage state via `ctx.ui.setStatus(...)`.
- **sub-shared**: shared types + event contract (published to npm as `@eiei114/pi-sub-shared`).

`sub-core` can power multiple `sub-*` extensions at once, including rich UI clients like `sub-bar` and compact/headless-friendly clients like `sub-status`.

## Packages

| Package | Version | Downloads | Description |
| --- | --- | --- | --- |
| [`@eiei114/pi-sub-core`](https://www.npmjs.com/package/@eiei114/pi-sub-core) | ![npm version](https://img.shields.io/npm/v/%40eiei114%2Fpi-sub-core.svg) | ![npm downloads](https://img.shields.io/npm/dm/%40eiei114%2Fpi-sub-core.svg) | Shared fetch/cache core (pi extension). |
| [`@eiei114/pi-sub-bar`](https://www.npmjs.com/package/@eiei114/pi-sub-bar) | ![npm version](https://img.shields.io/npm/v/%40eiei114%2Fpi-sub-bar.svg) | ![npm downloads](https://img.shields.io/npm/dm/%40eiei114%2Fpi-sub-bar.svg) | Rich widget display client (pi extension). |
| [`@eiei114/pi-sub-status`](https://www.npmjs.com/package/@eiei114/pi-sub-status) | ![npm version](https://img.shields.io/npm/v/%40eiei114%2Fpi-sub-status.svg) | ![npm downloads](https://img.shields.io/npm/dm/%40eiei114%2Fpi-sub-status.svg) | Compact status-line display client (pi extension). |
| [`@eiei114/pi-sub-shared`](https://www.npmjs.com/package/@eiei114/pi-sub-shared) | ![npm version](https://img.shields.io/npm/v/%40eiei114%2Fpi-sub-shared.svg) | ![npm downloads](https://img.shields.io/npm/dm/%40eiei114%2Fpi-sub-shared.svg) | Shared types + event contract (npm package). |

## Ideas / planned sub-* extensions

| Package | Description |
| --- | --- |
| `pi-sub-compare` | Usage comparison chart across multiple providers. |
| `pi-sub-model-switcher` | Auto model/provider switching when reaching a usage threshold. |
| `pi-sub-account-switcher` | Cycle between multiple subscriptions at usage thresholds. |

If you’d like to work on these, PRs or standalone packages are welcome.

## Requirements

- Node.js >= 24 (see `.nvmrc`)
- npm (bundled with Node)

## Pi package manager

You can install the packages via `pi install`:

```bash
pi install npm:@eiei114/pi-sub-core
pi install npm:@eiei114/pi-sub-bar
pi install npm:@eiei114/pi-sub-status
```

`sub-bar` remains the default rich UI path. `sub-status` is an explicit opt-in compact client and can be installed alongside `sub-bar` when you want both the widget and a status-line summary.

## Quick Start (manual install)

```bash
git clone https://github.com/eiei114/pi-sub.git

# Enable the shared core plus one or both display clients
ln -s /path/to/pi-sub/packages/sub-core   ~/.pi/agent/extensions/sub-core
ln -s /path/to/pi-sub/packages/sub-bar    ~/.pi/agent/extensions/sub-bar
ln -s /path/to/pi-sub/packages/sub-status ~/.pi/agent/extensions/sub-status
```

Alternative (no symlink): add the core plus whichever clients you want to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "/path/to/pi-sub/packages/sub-core/index.ts",
    "/path/to/pi-sub/packages/sub-bar/index.ts",
    "/path/to/pi-sub/packages/sub-status/index.ts"
  ]
}
```

> `sub-shared` is an npm dependency and is pulled automatically. `sub-bar` and `sub-status` are both optional clients on top of `sub-core`.

## Communication model (core ↔ clients)

`sub-core` is the source of truth. It emits updates and accepts requests/actions over `pi.events`.

## Rendering good practice (snappy UI)

To keep UI clients responsive (like `sub-bar`), prefer this sequence when a model or session changes:

1. **Render cached state immediately** (even if stale).
2. **Fetch fresh usage in the background**.
3. **Re-render when new data arrives**.

Why: awaiting fetches inside `pi.on("session_start")` / `pi.on("model_select")` blocks other extension handlers, so UI renders can lag behind network calls. In sub-core we use a non-blocking refresh (`void refresh(...)`) and allow stale cache (`allowStaleCache: true`) so cached usage is emitted before the forced fetch finishes. UI clients should listen for `sub-core:update-current` and render whenever state changes.

**Broadcasts**
- `sub-core:ready` → `{ state, settings }` (first load)
- `sub-core:update-current` → `{ state }` (cache hit or fresh fetch)
- `sub-core:update-all` → `{ state }` (cached entries + current provider)
- `sub-core:settings:updated` → `{ settings }`

**Requests (pull)**
- `sub-core:request` → `{ reply, includeSettings? }`
- `sub-core:request` → `{ type: "entries", reply, force? }`

**Actions (mutate core state)**
- `sub-core:settings:patch` → `{ patch }` (persists core settings)
- `sub-core:action` → `{ type: "refresh" | "cycleProvider", force? }`

UI extensions like `sub-bar` and compact clients like `sub-status` listen for updates and render the current provider state in their own format.

## Settings & Cache

Settings live in the agent directory to survive updates (legacy extension `settings.json` files are migrated on first run when present, and removed after successful migration). Cache/lock files live under `~/.pi/agent/cache/sub-core`; legacy cache/lock files next to the sub-core extension entry or in the agent root are migrated and removed on first run.

- **sub-core settings**: `~/.pi/agent/pi-sub-core-settings.json`
- **sub-bar settings**: `~/.pi/agent/pi-sub-bar-settings.json`
- **cache**: `~/.pi/agent/cache/sub-core/cache.json`
- **lock**: `~/.pi/agent/cache/sub-core/cache.lock`

## Adding a Provider (summary)

You must update **both** sub-core (fetch layer) and sub-bar (display/UI).

### sub-core
1. Add provider name to `packages/sub-core/src/types.ts`.
2. Implement fetcher in `packages/sub-core/src/providers/impl/<provider>.ts`.
3. Register provider in `packages/sub-core/src/providers/registry.ts`.
4. Add detection + status config in `packages/sub-core/src/providers/metadata.ts`.
5. Add settings defaults in `packages/sub-core/src/settings-types.ts`.

### sub-bar
1. Add provider name to `packages/sub-bar/src/types.ts`.
2. Add display metadata in `packages/sub-bar/src/providers/metadata.ts`.
3. Add window visibility rules in `packages/sub-bar/src/providers/windows.ts`.
4. Add extras (if needed) in `packages/sub-bar/src/providers/extras.ts`.
5. Add settings UI + defaults in `packages/sub-bar/src/providers/settings.ts` and `packages/sub-bar/src/settings-types.ts`.

## Development

### Developer guide (common workflows)

### Add a new provider (core + UI)

- **sub-core** owns fetching, caching, status lookup, provider detection, and emits update events.
- **sub-bar** owns display rules, formatting, per-provider UI settings, and visibility of windows/extras.
- If you add new shared types or provider metadata used by multiple packages, update **sub-shared** and re-export.

### Add a new feature: core vs sub-*

Use this rule of thumb when deciding where a feature lives:

**Put it in sub-core when:**
- It affects **data fetching**, provider detection/selection, or status polling.
- It changes **event contracts** (`sub-core:*` events) or tools (`sub_get_usage`, `sub_get_all_usage`).
- It introduces **shared settings** that should affect all clients.
- It requires cache/lock behavior or cross-window coordination.

**Put it in sub-* when:**
- It is **presentation-only** (formatting, layout, colors, widget behavior).
- It is **UI-only settings** (visibility toggles, label text, window ordering in display).
- It targets a single client (e.g. sub-bar specific display change).

**If both layers need it:**
- Add data and settings in sub-core (and `sub-shared` types), then consume in sub-bar.
- Update docs and tests for the shared contract.

### Example decisions

- **New API field or rate window data** → sub-core (fetch + cache), then surface in sub-bar.
- **New bar style or status icon pack** → sub-bar only.
- **New provider enablement behavior** → sub-core (and sub-bar UI can forward settings).

### Dev setup

```bash
npm install
```

Common commands:

- `npm run check` — typecheck all workspaces
- `npm run test` — run workspace tests (sub-bar + sub-core + sub-status)
- `npm run lint` / `npm run lint:fix` — lint TypeScript
- `npm run format` — format with Prettier
- `npm run verify` — run check + test + lint

Watch mode:

```bash
npm run check:watch -w @eiei114/pi-sub-core
npm run check:watch -w @eiei114/pi-sub-bar
npm run check:watch -w @eiei114/pi-sub-status
npm run check:watch -w @eiei114/pi-sub-shared
npm run test:watch -w @eiei114/pi-sub-bar
npm run test:watch -w @eiei114/pi-sub-status
```

Workspace-specific commands:

```bash
npm run check -w @eiei114/pi-sub-core
npm run check -w @eiei114/pi-sub-bar
npm run check -w @eiei114/pi-sub-status
npm run check -w @eiei114/pi-sub-shared
npm run test -w @eiei114/pi-sub-core
npm run test -w @eiei114/pi-sub-bar
npm run test -w @eiei114/pi-sub-status
```
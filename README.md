# pi-sub

Monorepo for the `sub-*` extension ecosystem: a shared usage core (`sub-core`), UI clients (like `sub-bar`), and headless consumers that subscribe to usage updates.

## Overview

- **sub-core**: fetches usage + status, manages cache/locks, owns provider selection, and emits updates via `pi.events`.
- **sub-bar**: UI widget that renders the current usage state above the editor.
- **sub-status**: compact status-line client that renders the current usage state via `ctx.ui.setStatus(...)`.
- **sub-shared**: shared types + event contract (published to npm as `@marckrenn/pi-sub-shared`).

`sub-core` can power multiple `sub-*` extensions at once, including rich UI clients like `sub-bar` and compact/headless-friendly clients like `sub-status`.

## Packages

| Package | Description |
| --- | --- |
| [`@marckrenn/pi-sub-core`](./packages/sub-core) | Shared fetch/cache core (pi extension). |
| [`@marckrenn/pi-sub-bar`](./packages/sub-bar) | Rich widget display client (pi extension). |
| [`@marckrenn/pi-sub-status`](./packages/sub-status) | Compact status-line display client (pi extension). |
| [`@marckrenn/pi-sub-shared`](./packages/sub-shared) | Shared types + event contract (npm package). |

## Ideas / planned sub-* extensions

| Package | Description |
| --- | --- |
| `pi-sub-compare` | Usage comparison chart across multiple providers. |
| `pi-sub-model-switcher` | Auto model/provider switching when reaching a usage threshold. |
| `pi-sub-account-switcher` | Cycle between multiple subscriptions at usage thresholds. |

If you’d like to work on these, PRs or standalone packages are welcome.

## Requirements

- Node.js >= 20 (see `.nvmrc`)
- npm (bundled with Node)

## Pi package manager

You can install the packages via `pi install`:

```bash
pi install npm:@marckrenn/pi-sub-core
pi install npm:@marckrenn/pi-sub-bar
pi install npm:@marckrenn/pi-sub-status
```

`sub-bar` remains the default rich UI path. `sub-status` is an explicit opt-in compact client and can be installed alongside `sub-bar` when you want both the widget and a status-line summary.

## Quick Start (manual install)

```bash
git clone https://github.com/marckrenn/pi-sub.git

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
- `npm run verify` — run tsconfig check + check + test + lint

Watch mode:

```bash
npm run check:watch -w @marckrenn/pi-sub-core
npm run check:watch -w @marckrenn/pi-sub-bar
npm run check:watch -w @marckrenn/pi-sub-status
npm run check:watch -w @marckrenn/pi-sub-shared
npm run test:watch -w @marckrenn/pi-sub-bar
npm run test:watch -w @marckrenn/pi-sub-status
```

Workspace-specific commands:

```bash
npm run check -w @marckrenn/pi-sub-core
npm run check -w @marckrenn/pi-sub-bar
npm run check -w @marckrenn/pi-sub-status
npm run check -w @marckrenn/pi-sub-shared
npm run test -w @marckrenn/pi-sub-core
npm run test -w @marckrenn/pi-sub-bar
npm run test -w @marckrenn/pi-sub-status
```



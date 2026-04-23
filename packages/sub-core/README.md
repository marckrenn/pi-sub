# sub-core

Shared usage data core for pi extensions. Sub-core owns fetching, caching, provider selection, and emits usage updates via `pi.events` for the wider `sub-*` ecosystem (UI and non-UI clients).

## Overview

- Fetches usage + status data from providers
- Deduplicates requests via shared cache/lock
- Emits updates for display-focused extensions (e.g. `sub-bar`) and non-UI tooling extensions
- Supports Antigravity usage via auth.json (`google-antigravity`)

## Installation

Install via the pi package manager (recommended):

```bash
pi install npm:@marckrenn/pi-sub-core
```

Use `-l` to install into project settings instead of global:

```bash
pi install -l npm:@marckrenn/pi-sub-core
```

For a UI, also install a display extension like `sub-bar` from the same repo (see the root README for the full setup).

Manual install (local development):

```bash
git clone https://github.com/marckrenn/pi-sub.git
ln -s /path/to/pi-sub/packages/sub-core ~/.pi/agent/extensions/sub-core
```

Alternative (no symlink): add it to `~/.pi/agent/settings.json`:

```json
{
  "extensions": ["/path/to/pi-sub/packages/sub-core/index.ts"]
}
```

## Tool Access

Tool registration is gated by `tools` in `~/.pi/agent/pi-sub-core-settings.json`.
By default, both tools are **off**. To enable them, set:

```json
{
  "tools": {
    "usageTool": true,
    "allUsageTool": true
  }
}
```

Then run `/reload` (tool registration only happens on load). You can also toggle these in `/sub-core:settings` → Tool Settings.

When enabled, `sub-core` registers tools to expose usage snapshots to Pi:

- `sub_get_usage` / `get_current_usage` – refreshes usage (forced by default) and returns `{ provider, usage }`.
- `sub_get_all_usage` / `get_all_usage` – refreshes and returns all enabled provider entries (auto-enabled providers require credentials).

## Settings

Use `sub-core:settings` to configure shared provider settings plus **Usage Refresh Settings** and **Status Refresh Settings**. Provider enablement supports `auto` (default), `on`, and `off` — `auto` enables a provider only when credentials are detected.

Usage refresh controls cache/usage updates, while status refresh controls incident polling (you can keep status on a slower interval). The Minimum Refresh Interval caps how often refresh triggers can fetch new data even if you refresh every turn.

Antigravity usage requires an OAuth token in `~/.pi/agent/auth.json` under the `google-antigravity` key.

Anthropic extra usage formatting is controlled in Provider Settings (currency symbol + decimal separator).

Settings are stored in `~/.pi/agent/pi-sub-core-settings.json` (migrated from the legacy extension `settings.json` when present; the legacy file is removed after a successful migration).

**Settings migrations:** settings are merged with defaults on load, but renames/removals are not migrated automatically. When adding new settings or changing schema, update the defaults/merge logic and provide a migration (or instruct users to reset `pi-sub-core-settings.json`).

## Cache

Sub-core stores a shared cache and lock file:

- `~/.pi/agent/cache/sub-core/cache.json`
- `~/.pi/agent/cache/sub-core/cache.lock`

Legacy cache files next to the extension entry or in the agent root are migrated to the cache directory and removed on first run.

## Security notes

- Keep `~/.pi/agent/auth.json` readable only by your user (e.g. `chmod 600 ~/.pi/agent/auth.json`).
- Avoid logging token-bearing headers or auth config when troubleshooting provider calls.

## Provider comparison

| Provider | Usage Data | Status Page | Notes |
|----------|-----------|-------------|-------|
| Anthropic (Claude) | 5h/Week windows, extra usage | ✅ | Extra usage on/off state |
| GitHub Copilot | Monthly quota, requests | ✅ | Request multiplier support |
| Google Gemini | Pro/Flash quotas | ✅ | Aggregated by model family |
| Antigravity | Model quotas | ✅ | Sandbox Cloud Code Assist quotas (tested) |
| OpenAI Codex | Primary/secondary windows | ✅ | Credits not yet supported (PRs welcome!) |
| AWS Kiro | Credits | - | Credits not yet supported (PRs welcome!) |
| z.ai | Tokens/monthly limits | - | API quota limits |
| Kimi for Coding | Week + 5h rolling windows | - | OAuth; tested with `pi-provider-kimi-code` |

## Development

### Packaging notes (pi install compatibility)

Pi packages use a `pi` field in `package.json` plus the `pi-package` keyword for discoverability. This repo already declares `pi.extensions`, so you can install via:

```bash
pi install npm:@marckrenn/pi-sub-core
```

Manual paths/symlinks still work for local development as documented above.

### Tested providers

Tested so far: Anthropic (Claude), OpenAI Codex, GitHub Copilot, Kimi for Coding. Other providers are implemented but not yet verified in production.

### Adding a Provider

You need to update both **sub-core** (fetch layer) and **sub-bar** (display layer).

### Feature placement (core vs UI)

- **sub-core**: fetching, caching, provider detection/selection, status polling, tools/events, and shared settings.
- **sub-bar**: formatting, widget layout, UI-only toggles, and display-specific behavior.
- **sub-shared**: shared types/constants for anything referenced by both layers.

See the root README “Developer guide” for the decision checklist and examples.

#### sub-core (fetch + status)
1. Add provider name to `src/types.ts` (`PROVIDERS`, `ProviderName`).
2. Implement fetcher in `src/providers/impl/<provider>.ts`.
3. Register provider in `src/providers/registry.ts`.
4. Add detection + status config in `src/providers/metadata.ts`.
5. Add provider settings defaults in `src/settings-types.ts`.

#### sub-bar (display + UI)
1. Add provider name to `src/types.ts`.
2. Add display rules + labels in `src/providers/metadata.ts`.
3. Add window visibility in `src/providers/windows.ts`.
4. Add extras in `src/providers/extras.ts` (if needed).
5. Add settings UI + defaults in `src/providers/settings.ts` and `src/settings-types.ts`.

### Events (public contract)

Sub-core uses `pi.events` as an in-process pub/sub bus. Any `sub-*` extension can subscribe to updates (UI or headless). Sub-core is the source of truth for provider selection and refresh behavior; clients observe state and optionally request changes.

#### Broadcasts
- `sub-core:ready` → `{ state, settings }` (first load)
- `sub-core:update-current` → `{ state }` (cache hit or fresh fetch)
- `sub-core:update-all` → `{ state }` (cached entries + current provider)
- `sub-core:settings:updated` → `{ settings }`

`update-current` state is `{ provider, usage }`.
`update-all` state is `{ provider, entries }`, where entries are cached provider snapshots.

#### Requests (pull current state)
- `sub-core:request` → `{ reply, includeSettings? }`
- `sub-core:request` → `{ type: "entries", reply, force? }` (bulk usage entries)

The `reply` callback receives `{ state }` or `{ entries }` immediately if available.

#### Actions (mutate core state)
- `sub-core:settings:patch` → `{ patch }` (updates refresh interval/provider settings and persists)
- `sub-core:action` → `{ type: "refresh" | "cycleProvider", force? }`

After an action, sub-core emits `sub-core:update-current` with the new state.

## Credits

- Hannes Januschka ([barts](https://github.com/hjanuschka/shitty-extensions?tab=readme-ov-file#usage-barts), [@hjanuschka](https://x.com/hjanuschka))
- Peter Steinberger ([CodexBar](https://github.com/steipete/CodexBar), [@steipete](https://x.com/steipete))

## Status

Active. Used by `sub-bar` for display.

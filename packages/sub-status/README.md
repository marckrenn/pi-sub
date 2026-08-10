# sub-status

Compact status-line client for [pi-coding-agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

`sub-status` is a small passive companion to `sub-core`: it renders current quota usage via `ctx.ui.setStatus(...)`, without widget UI, commands, or settings UI in v1.

On startup it follows the same bootstrap pattern as `sub-bar`, requests the current `sub-core` state, and then listens for `sub-core:ready` / `sub-core:update-current` to keep the compact line up to date. It stays deliberately quiet: no placeholder text when state is unavailable, and the status clears entirely when no usable usage snapshot exists.

## Installation

Install via the pi package manager:

```bash
pi install npm:@eiei114/pi-sub-status
```

Use `-l` to install into project settings instead of global:

```bash
pi install -l npm:@eiei114/pi-sub-status
```

`sub-status` follows the same package metadata/bootstrap pattern as `sub-bar`: it depends on `sub-core`, declares the same extra extension paths in package metadata, and probes/auto-loads `sub-core` at runtime for resilience.

## Relationship to the other packages

- `sub-core` is the shared source of truth for provider detection, fetching, cache/state, and events.
- `sub-bar` is the rich widget UI and remains the default visual package.
- `sub-status` is an optional compact client for status-line-friendly and RPC-friendly hosts.

Installing `sub-status` alongside `sub-bar` is expected to be supported: `sub-bar` owns the rich widget, while `sub-status` owns a compact status line.

## Current v1 scope

- Shows windows only
- Shows the first two windows only
- Prefers reset descriptions when available, otherwise falls back to window labels
- Shows percentages for each window
- Appends compact stale / incident suffix text when relevant
- Updates from `sub-core` startup/current-state events
- Clears the status entirely when no usable current state exists

## Not in v1

- Commands
- Settings UI
- `setWidget`
- `ctx.ui.custom(...)`
- Provider/model labels in the compact line
- Hybrid label + reset output in the compact line

## Development

```bash
npm run check -w @eiei114/pi-sub-status
npm run test -w @eiei114/pi-sub-status
```

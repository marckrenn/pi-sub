# @eiei114/pi-sub-status

## 2.0.2

### Patch Changes

- [#24](https://github.com/eiei114/pi-sub/pull/24) [`c761eff`](https://github.com/eiei114/pi-sub/commit/c761eff51c4b90636ba974b10b08ea9398bb06bc) Thanks [@eiei114](https://github.com/eiei114)! - Batch patch release to verify Discord release webhook delivery.

- Updated dependencies [[`c761eff`](https://github.com/eiei114/pi-sub/commit/c761eff51c4b90636ba974b10b08ea9398bb06bc)]:
  - @eiei114/pi-sub-core@2.0.2
  - @eiei114/pi-sub-shared@2.0.2

## 2.0.1

### Patch Changes

- Publish the missed patch release after reconciling public workspace packages with the managed npm inventory.

- Updated dependencies []:
  - @eiei114/pi-sub-core@2.0.1
  - @eiei114/pi-sub-shared@2.0.1

## 2.0.0

### Major Changes

- [#13](https://github.com/eiei114/pi-sub/pull/13) [`83da803`](https://github.com/eiei114/pi-sub/commit/83da80316b41cb48f3616bc1353e11c3564c1f3e) Thanks [@eiei114](https://github.com/eiei114)! - Migrate the Pi SDK dependency from the frozen `@mariozechner/*` scope to the official `@earendil-works/*` scope (DOT-771).

  This is a **breaking** peerDependency change: consumers must provide `@earendil-works/pi-coding-agent` (latest 0.80.x) instead of the abandoned `@mariozechner/pi-coding-agent` (last published 0.73.1, effectively frozen).

  Notable adaptations required by the 0.51 → 0.80 SDK upgrade:
  - `@sinclair/typebox` → `typebox` (the package was renamed and is now a direct dependency of the new SDK).
  - Event handler renames to match the new event contract: `session_switch` → `session_before_switch`, `session_branch` → `session_before_fork`. Both handlers reset the usage cache and re-fetch, so behavior is preserved.
  - `ctx.getContextUsage()` now returns `tokens`/`percent` as `number | null` (null while unknown, e.g. right after compaction); coerce to `0` to keep the existing non-null render contract.

  `@eiei114/pi-sub-shared` has no source change but is bumped to stay version-locked with the `fixed` release group.

### Patch Changes

- Updated dependencies [[`83da803`](https://github.com/eiei114/pi-sub/commit/83da80316b41cb48f3616bc1353e11c3564c1f3e)]:
  - @eiei114/pi-sub-core@2.0.0
  - @eiei114/pi-sub-shared@2.0.0

## 1.5.0

### Minor Changes

- [#56](https://github.com/marckrenn/pi-sub/pull/56) [`864cc1b`](https://github.com/marckrenn/pi-sub/commit/864cc1bbc91897d934c0545a29f508862231963c) - Prioritize usage windows that match the active model before emitting `sub-core:update-current`, so compact status clients show the correct quota windows (including Codex Spark and Antigravity model-specific windows).

  Also make settings list navigation compatible with both old and new `@mariozechner/pi-tui` keybinding APIs, preventing crashes in submenus on older Pi runtimes where `getEditorKeybindings()` is unavailable.

  Thanks [@dnouri](https://github.com/dnouri) for [#54](https://github.com/marckrenn/pi-sub/pull/54).

### Patch Changes

- Updated dependencies [[`864cc1b`](https://github.com/marckrenn/pi-sub/commit/864cc1bbc91897d934c0545a29f508862231963c)]:
  - @marckrenn/pi-sub-core@1.5.0
  - @marckrenn/pi-sub-shared@1.5.0

## 1.4.0

### Minor Changes

- [#49](https://github.com/marckrenn/pi-sub/pull/49) [`8723b10`](https://github.com/marckrenn/pi-sub/commit/8723b10a240e1bf4e2ee20703c4b81f6968c44ae) Thanks [@marckrenn](https://github.com/marckrenn)! - Add `@marckrenn/pi-sub-status`, a compact status-line client that renders `sub-core` usage updates via `ctx.ui.setStatus(...)`.

  Thanks [@dnouri](https://github.com/dnouri) for PR [#48](https://github.com/marckrenn/pi-sub/pull/48).

### Patch Changes

- Updated dependencies []:
  - @marckrenn/pi-sub-core@1.3.1
  - @marckrenn/pi-sub-shared@1.3.1

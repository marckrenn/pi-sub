# @eiei114/pi-sub-core

## 2.0.2

### Patch Changes

- [#24](https://github.com/eiei114/pi-sub/pull/24) [`c761eff`](https://github.com/eiei114/pi-sub/commit/c761eff51c4b90636ba974b10b08ea9398bb06bc) Thanks [@eiei114](https://github.com/eiei114)! - Batch patch release to verify Discord release webhook delivery.

- Updated dependencies [[`c761eff`](https://github.com/eiei114/pi-sub/commit/c761eff51c4b90636ba974b10b08ea9398bb06bc)]:
  - @eiei114/pi-sub-shared@2.0.2

## 2.0.1

### Patch Changes

- Publish the missed patch release after reconciling public workspace packages with the managed npm inventory.

- Updated dependencies []:
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

- Updated dependencies []:
  - @eiei114/pi-sub-shared@2.0.0

## 1.6.1

### Patch Changes

- [#6](https://github.com/eiei114/pi-sub/pull/6) [`3d7604e`](https://github.com/eiei114/pi-sub/commit/3d7604ef7f092f0e5b24d172f59155dfd836671d) Thanks [@eiei114](https://github.com/eiei114)! - Fix Anthropic and Copilot usage providers for upstream API changes (marckrenn/pi-sub#61, #65). Anthropic now reads Claude Code credentials and model-specific weekly quota windows. Copilot now parses chat/completions quota snapshots in addition to premium interactions. Add regression test for legacy cache migration (marckrenn/pi-sub#45).

- Updated dependencies [[`3d7604e`](https://github.com/eiei114/pi-sub/commit/3d7604ef7f092f0e5b24d172f59155dfd836671d)]:
  - @eiei114/pi-sub-shared@1.6.1

## 1.6.0

### Minor Changes

- [#2](https://github.com/eiei114/pi-sub/pull/2) [`93242b9`](https://github.com/eiei114/pi-sub/commit/93242b9f021e211796f48f4643fdecbe983f217d) Thanks [@eiei114](https://github.com/eiei114)! - Add OpenRouter and Kimi for Coding usage providers.

  Ports upstream PRs marckrenn/pi-sub#66 (OpenRouter credits) and #63 (Kimi for Coding week/5h windows) into the @eiei114 fork. PR #67 (Kiro stderr + ISO reset date) was already landed separately.
  - **OpenRouter**: credits endpoint, env/auth token resolution, sub-bar credit extras and toggles.
  - **Kimi for Coding**: `api.kimi.com/coding/v1/usages`, pi-mono `KIMI_API_KEY` / auth.json support, sub-bar week/5h window toggles.

### Patch Changes

- [#1](https://github.com/eiei114/pi-sub/pull/1) [`c43a83c`](https://github.com/eiei114/pi-sub/commit/c43a83c322d50b96df27d8f178e4bfff1fa64035) Thanks [@eiei114](https://github.com/eiei114)! - Kiro provider: capture stderr from `kiro-cli /usage` and parse `YYYY-MM-DD` reset dates.

  Ports the Kiro parts of upstream PR marckrenn/pi-sub#67 while keeping Windows working:
  - Usage retrieval now reads both stdout and stderr (kiro-cli writes some usage
    data to stderr) via a new shell-free, cross-platform dependency hook
    (`execFileSyncWithStderr`, backed by `spawnSync`). No `/bin/sh` or `cmd.exe`
    is spawned, so Windows cache/TTL behavior is unaffected.
  - The reset-date parser now accepts `resets on 2026-06-01` (`YYYY-MM-DD`) in
    addition to the existing `resets on 01/01` (`MM/DD`) format.

- Updated dependencies []:
  - @eiei114/pi-sub-shared@1.6.0

## 1.5.2

### Patch Changes

- [#3](https://github.com/eiei114/pi-sub/pull/3) [`7507aa1`](https://github.com/eiei114/pi-sub/commit/7507aa12207cb4b545e30e32c9f09a998cd20f16) Thanks [@eiei114](https://github.com/eiei114)! - Add project status badges to the root README (npm version, license, Node.js, release workflow, PRs welcome).

- Updated dependencies [[`7507aa1`](https://github.com/eiei114/pi-sub/commit/7507aa12207cb4b545e30e32c9f09a998cd20f16)]:
  - @eiei114/pi-sub-shared@1.5.2

## 1.5.1

### Patch Changes

- [`ad79e93`](https://github.com/eiei114/pi-sub/commit/ad79e935cd51239b0e74657aabe067885ad59b82) Thanks [@eiei114](https://github.com/eiei114)! - Make shared cache writes more robust on Windows by retrying transient `EPERM`, `EACCES`, `EBUSY`, and `ENOTEMPTY` rename failures, using unique temp file names, and cleaning up leftover temp files.

  Also tighten cache lock ownership so one process does not accidentally release another process's lock, and skip duplicate fetch/status writes when another active process owns the lock.

  Fixes upstream marckrenn/pi-sub#60 and covers the Windows cache rename failure reported in marckrenn/pi-sub#68.

- [`ad79e93`](https://github.com/eiei114/pi-sub/commit/ad79e935cd51239b0e74657aabe067885ad59b82) Thanks [@eiei114](https://github.com/eiei114)! - `turn_end` and `tool_result` no longer pass `force: true` to `refresh` /
  `refreshStatus`. The forced refresh bypassed the cache TTL, so an active
  session would hit the upstream `/usage` endpoint on every turn, regardless
  of how recently the cache had been refreshed.

  When the upstream endpoint started rate-limiting (anthropic OAuth
  `/usage` returns 429s under load, especially with multiple `pi`
  instances sharing a session), `fetchWithCache` saw `usage.error`, set
  `shouldCache = false`, and never updated `fetchedAt`. Subsequent
  `turn_end`s kept retrying the rate-limited endpoint and discarding the
  results, so the cache stayed stuck on the last good entry — eventually
  older than the 60s TTL — and `sub-core:update-all` started filtering
  the current provider out of `entries`. UI clients then saw the current
  provider missing and cleared their displays.

  Removing `force: true` lets the existing `behavior.refreshInterval`
  (default 60s) and `behavior.minRefreshInterval` (default 10s) gates do
  their job: turns that arrive faster than the configured TTL reuse the
  cache instead of re-hammering the API. `model_select` keeps `force: true`
  because switching providers always needs fresh data.

  Fixes #58.

- Updated dependencies []:
  - @eiei114/pi-sub-shared@1.5.1

## 1.5.0

### Minor Changes

- [#56](https://github.com/marckrenn/pi-sub/pull/56) [`864cc1b`](https://github.com/marckrenn/pi-sub/commit/864cc1bbc91897d934c0545a29f508862231963c) - Prioritize usage windows that match the active model before emitting `sub-core:update-current`, so compact status clients show the correct quota windows (including Codex Spark and Antigravity model-specific windows).

  Also make settings list navigation compatible with both old and new `@mariozechner/pi-tui` keybinding APIs, preventing crashes in submenus on older Pi runtimes where `getEditorKeybindings()` is unavailable.

  Thanks [@dnouri](https://github.com/dnouri) for [#54](https://github.com/marckrenn/pi-sub/pull/54).

### Patch Changes

- Updated dependencies [[`864cc1b`](https://github.com/marckrenn/pi-sub/commit/864cc1bbc91897d934c0545a29f508862231963c)]:
  - @marckrenn/pi-sub-shared@1.5.0

## 1.4.0

### Minor Changes

- [#51](https://github.com/marckrenn/pi-sub/pull/51) [`477ee48`](https://github.com/marckrenn/pi-sub/commit/477ee480ae1a3841808f1e46b0541e11adcf0651) Thanks [@marckrenn](https://github.com/marckrenn)! - Align `sub-bar`, `sub-core`, and `sub-shared` to `1.4.0` in lockstep.

  No functional changes in this bump; this release normalizes package versions after the previous publish.

### Patch Changes

- Updated dependencies [[`477ee48`](https://github.com/marckrenn/pi-sub/commit/477ee480ae1a3841808f1e46b0541e11adcf0651)]:
  - @marckrenn/pi-sub-shared@1.4.0

## 1.3.1

### Patch Changes

- Updated dependencies []:
  - @marckrenn/pi-sub-shared@1.3.1

## 1.3.0

### Minor Changes

- [#42](https://github.com/marckrenn/pi-sub/pull/42) [`8bf29f3`](https://github.com/marckrenn/pi-sub/commit/8bf29f34c8f9418284cf30631a3325799c3e0f48) Thanks [@marckrenn](https://github.com/marckrenn)! - - Added an optional `showContextBar` setting (default: off), as introduced in [#10](https://github.com/marckrenn/pi-sub/pull/10) by [@pasky](https://github.com/pasky), to render the current context usage as an optional leftmost `Ctx` bar in sub-bar usage output.
  - Support for Codex Spark usage (auto-selected for `gpt-5.3-codex-spark`), including model-specific window labeling behavior.
  - OpenAI Status provider now surfaces the Codex-specific status endpoint instead of the generic status summary when available.
  - [`80b49b1`](https://github.com/marckrenn/pi-sub/commit/80b49b16c20c942135764bcf6c4cd0516e868ce2) Fixed API key auth format handling for the z.ai provider.

### Patch Changes

- Updated dependencies [[`8bf29f3`](https://github.com/marckrenn/pi-sub/commit/8bf29f34c8f9418284cf30631a3325799c3e0f48)]:
  - @marckrenn/pi-sub-shared@1.3.0

## 1.2.0

### Patch Changes

- Fixed tool registration execute signature order for compatibility with the latest Pi tool API.

### Updated dependencies:

- @marckrenn/pi-sub-shared@1.2.0

## 1.1.0

### Patch Changes

- [`7ce2a92`](https://github.com/marckrenn/pi-sub/commit/7ce2a92b15e766fd85a4b7eb85d6fc5c5aa32dca) Thanks [@marckrenn](https://github.com/marckrenn)! - Support providing credentials via environment variables for the usage providers (Anthropic, Copilot, Gemini, Antigravity, Codex, z.ai).

- Updated dependencies []:
  - @marckrenn/pi-sub-shared@1.1.0

## 1.0.6

### Patch Changes

- Watch `~/.pi/agent/pi-sub-core-settings.json` for changes and hot-reload settings (with `fs.watch` + polling fallback).

- Updated dependencies []:
  - @marckrenn/pi-sub-shared@1.0.6

## 1.0.5

### Patch Changes

- [#35](https://github.com/marckrenn/pi-sub/pull/35) [`59e2b45`](https://github.com/marckrenn/pi-sub/commit/59e2b456e0e5c41479dccedcef93f9175cc4aa55) Thanks [@marckrenn](https://github.com/marckrenn)! - Improve startup responsiveness by deferring refreshes and watchers, skipping headless UI work, and unref-ing long-lived timers so pi CLI commands exit cleanly.

- Updated dependencies [[`59e2b45`](https://github.com/marckrenn/pi-sub/commit/59e2b456e0e5c41479dccedcef93f9175cc4aa55)]:
  - @marckrenn/pi-sub-shared@1.0.5

## 1.0.4

### Patch Changes

- [#30](https://github.com/marckrenn/pi-sub/pull/30) [`af0828a`](https://github.com/marckrenn/pi-sub/commit/af0828a8d2e529497a1acff95e388a0a3eabb90e) Thanks [@marckrenn](https://github.com/marckrenn)! - Store the shared cache and lock files in the agent directory so all sub-core instances share a single cache.

- [#22](https://github.com/marckrenn/pi-sub/pull/22) [`3e5a026`](https://github.com/marckrenn/pi-sub/commit/3e5a026ea3dc113561ff32466a8aa03b91c6d876) Thanks [@marckrenn](https://github.com/marckrenn)! - Store sub-core and sub-bar settings in agent-level JSON files so updates no longer overwrite user configuration. Legacy extension `settings.json` files are migrated into the new files and removed after a successful migration.

  Manual migration (if you want to do it yourself before updating):

  ```
  cp ~/.pi/agent/extensions/sub-core/settings.json ~/.pi/agent/pi-sub-core-settings.json
  cp ~/.pi/agent/extensions/sub-bar/settings.json ~/.pi/agent/pi-sub-bar-settings.json
  ```

  Existing users should move legacy settings from the extension folders to:
  - `~/.pi/agent/pi-sub-core-settings.json`
  - `~/.pi/agent/pi-sub-bar-settings.json`

- [`a6c0d33`](https://github.com/marckrenn/pi-sub/commit/a6c0d33c8d19d2876a4a8a1a0a69302a3c63f5e8) Thanks [@marckrenn](https://github.com/marckrenn)! - Move the shared cache/lock files under `~/.pi/agent/cache/sub-core` so all clients share a single cache directory.

- [`7da1e08`](https://github.com/marckrenn/pi-sub/commit/7da1e082e634f4e4dee2560b4d490527d1543ade) Thanks [@marckrenn](https://github.com/marckrenn)! - Add a minimum refresh interval setting to cap refresh frequency even when refresh is triggered every turn.

- [`1f5e451`](https://github.com/marckrenn/pi-sub/commit/1f5e45173b9868b0d6645ae35a084142a0ac56a5) Thanks [@marckrenn](https://github.com/marckrenn)! - Gate tool registration behind `tools.usageTool` and `tools.allUsageTool` (default off) in sub-core settings.

- [`35eb185`](https://github.com/marckrenn/pi-sub/commit/35eb18590f369db4cda931b8e11099d0f3ddb4ec) Thanks [@marckrenn](https://github.com/marckrenn)! - Add usage tool aliases `get_current_usage` and `get_all_usage`.

- Updated dependencies [[`7da1e08`](https://github.com/marckrenn/pi-sub/commit/7da1e082e634f4e4dee2560b4d490527d1543ade)]:
  - @marckrenn/pi-sub-shared@1.0.4

## 1.0.3

### Patch Changes

- [`6fa2736`](https://github.com/marckrenn/pi-sub/commit/6fa27363573f34c38a372a6d7b8b74e756716724) Thanks [@marckrenn](https://github.com/marckrenn)! - Update extension tool execute signature order for compatibility with latest Pi API.

- Updated dependencies [[`6fa2736`](https://github.com/marckrenn/pi-sub/commit/6fa27363573f34c38a372a6d7b8b74e756716724)]:
  - @marckrenn/pi-sub-shared@1.0.3

## 1.0.2

### Patch Changes

- [#3](https://github.com/marckrenn/pi-sub/pull/3) [`4ceb5ad`](https://github.com/marckrenn/pi-sub/commit/4ceb5ad133166237652d197ba9296ad1589a813c) Thanks [@marckrenn](https://github.com/marckrenn)! - Bundle sub-core with sub-bar, refresh Antigravity quotas + settings, and update UI copy/controls.

- Updated dependencies [[`4ceb5ad`](https://github.com/marckrenn/pi-sub/commit/4ceb5ad133166237652d197ba9296ad1589a813c)]:
  - @marckrenn/pi-sub-shared@1.0.2

## 1.0.1

### Patch Changes

- Align repo version with npm publish.
- Updated dependencies:
  - @marckrenn/pi-sub-shared@1.0.1

## 1.0.0

### Major Changes

- [`9bedd80`](https://github.com/marckrenn/pi-sub/commit/9bedd80b0037b723e70f0376019fff59a617e7cb) Thanks [@marckrenn](https://github.com/marckrenn)! - Initial 1.0.0 release.

### Patch Changes

- Updated dependencies [[`9bedd80`](https://github.com/marckrenn/pi-sub/commit/9bedd80b0037b723e70f0376019fff59a617e7cb)]:
  - @marckrenn/pi-sub-shared@1.0.0

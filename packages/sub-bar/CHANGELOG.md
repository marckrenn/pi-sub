# @eiei114/pi-sub-bar

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

## 1.6.1

### Patch Changes

- [#6](https://github.com/eiei114/pi-sub/pull/6) [`3d7604e`](https://github.com/eiei114/pi-sub/commit/3d7604ef7f092f0e5b24d172f59155dfd836671d) Thanks [@eiei114](https://github.com/eiei114)! - Fix Anthropic and Copilot usage providers for upstream API changes (marckrenn/pi-sub#61, #65). Anthropic now reads Claude Code credentials and model-specific weekly quota windows. Copilot now parses chat/completions quota snapshots in addition to premium interactions. Add regression test for legacy cache migration (marckrenn/pi-sub#45).

- Updated dependencies [[`3d7604e`](https://github.com/eiei114/pi-sub/commit/3d7604ef7f092f0e5b24d172f59155dfd836671d)]:
  - @eiei114/pi-sub-core@1.6.1
  - @eiei114/pi-sub-shared@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [[`c43a83c`](https://github.com/eiei114/pi-sub/commit/c43a83c322d50b96df27d8f178e4bfff1fa64035), [`93242b9`](https://github.com/eiei114/pi-sub/commit/93242b9f021e211796f48f4643fdecbe983f217d)]:
  - @eiei114/pi-sub-core@1.6.0
  - @eiei114/pi-sub-shared@1.6.0

## 1.5.2

### Patch Changes

- [#3](https://github.com/eiei114/pi-sub/pull/3) [`7507aa1`](https://github.com/eiei114/pi-sub/commit/7507aa12207cb4b545e30e32c9f09a998cd20f16) Thanks [@eiei114](https://github.com/eiei114)! - Add project status badges to the root README (npm version, license, Node.js, release workflow, PRs welcome).

- Updated dependencies [[`7507aa1`](https://github.com/eiei114/pi-sub/commit/7507aa12207cb4b545e30e32c9f09a998cd20f16)]:
  - @eiei114/pi-sub-core@1.5.2
  - @eiei114/pi-sub-shared@1.5.2

## 1.5.1

### Patch Changes

- Updated dependencies [[`ad79e93`](https://github.com/eiei114/pi-sub/commit/ad79e935cd51239b0e74657aabe067885ad59b82), [`ad79e93`](https://github.com/eiei114/pi-sub/commit/ad79e935cd51239b0e74657aabe067885ad59b82)]:
  - @eiei114/pi-sub-core@1.5.1
  - @eiei114/pi-sub-shared@1.5.1

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

- [#51](https://github.com/marckrenn/pi-sub/pull/51) [`477ee48`](https://github.com/marckrenn/pi-sub/commit/477ee480ae1a3841808f1e46b0541e11adcf0651) Thanks [@marckrenn](https://github.com/marckrenn)! - Align `sub-bar`, `sub-core`, and `sub-shared` to `1.4.0` in lockstep.

  No functional changes in this bump; this release normalizes package versions after the previous publish.

### Patch Changes

- Updated dependencies [[`477ee48`](https://github.com/marckrenn/pi-sub/commit/477ee480ae1a3841808f1e46b0541e11adcf0651)]:
  - @marckrenn/pi-sub-core@1.4.0
  - @marckrenn/pi-sub-shared@1.4.0

## 1.3.1

### Patch Changes

- [#49](https://github.com/marckrenn/pi-sub/pull/49) [`833c19d`](https://github.com/marckrenn/pi-sub/commit/833c19db675f7c8ec7a9bb7fd04323607eb3aa1a) Thanks [@marckrenn](https://github.com/marckrenn)! - Set bundled default themes to use transparent widget background (`backgroundColor: none`) by default.

  Thanks [@marckrenn](https://github.com/marckrenn) for aligning bundled defaults in this release line.

- [#49](https://github.com/marckrenn/pi-sub/pull/49) [`3296415`](https://github.com/marckrenn/pi-sub/commit/3296415732cc1abb3a1687322b078931d5a142b6) Thanks [@marckrenn](https://github.com/marckrenn)! - Fix the status-line placement defaults and behavior:
  - Keep `widgetPlacement` defaulting to `belowEditor` for merged settings state.
  - In `widgetPlacement: "status"`, force left alignment and truncate-only overflow.
  - Status-line placement: hide status-only alignment/overflow controls and apply compact formatting; disable right padding in footer mode where trailing spaces are not safely preservable. Left padding remains applied.

  Thanks [@marckrenn](https://github.com/marckrenn) for the follow-up integration in this branch and [@pasky](https://github.com/pasky) for the original status-line work in PR [#44](https://github.com/marckrenn/pi-sub/pull/44).

- [#49](https://github.com/marckrenn/pi-sub/pull/49) [`3296415`](https://github.com/marckrenn/pi-sub/commit/3296415732cc1abb3a1687322b078931d5a142b6) Thanks [@marckrenn](https://github.com/marckrenn)! - Add a new built-in **Default Footer** display theme preset, applying a status-line optimized footer layout directly from the theme picker.

  Thanks [@marckrenn](https://github.com/marckrenn) for PR [#49](https://github.com/marckrenn/pi-sub/pull/49).

- [#49](https://github.com/marckrenn/pi-sub/pull/49) [`5e2b792`](https://github.com/marckrenn/pi-sub/commit/5e2b792f469a934ecfdddef8f31079442e496c1f) Thanks [@marckrenn](https://github.com/marckrenn)! - Add support for a transparent widget background so users can disable background coloring when it reduces readability in their terminal theme.

  This introduces an explicit `none` background choice in display settings and preserves that preference through settings updates, so the bar can render without forced background ANSI styling.

  Thanks [@airtonix](https://github.com/airtonix) for implementing this in PR [#47](https://github.com/marckrenn/pi-sub/pull/47).

- Updated dependencies []:
  - @marckrenn/pi-sub-core@1.3.1
  - @marckrenn/pi-sub-shared@1.3.1

## 1.3.0

### Minor Changes

- [#42](https://github.com/marckrenn/pi-sub/pull/42) [`8bf29f3`](https://github.com/marckrenn/pi-sub/commit/8bf29f34c8f9418284cf30631a3325799c3e0f48) Thanks [@marckrenn](https://github.com/marckrenn)! - - Added an optional `showContextBar` setting (default: off), as introduced in [#10](https://github.com/marckrenn/pi-sub/pull/10) by [@pasky](https://github.com/pasky), to render the current context usage as an optional leftmost `Ctx` bar in sub-bar usage output.
  - Support for Codex Spark usage (auto-selected for `gpt-5.3-codex-spark`), including model-specific window labeling behavior.
  - OpenAI Status provider now surfaces the Codex-specific status endpoint instead of the generic status summary when available.
  - [`80b49b1`](https://github.com/marckrenn/pi-sub/commit/80b49b16c20c942135764bcf6c4cd0516e868ce2) Fixed API key auth format handling for the z.ai provider.

### Patch Changes

- Updated dependencies [[`8bf29f3`](https://github.com/marckrenn/pi-sub/commit/8bf29f34c8f9418284cf30631a3325799c3e0f48)]:
  - @marckrenn/pi-sub-core@1.3.0
  - @marckrenn/pi-sub-shared@1.3.0

## 1.2.0

### Minor Changes

- Added optional context-window support via `showContextBar` (default: off). When enabled, a `Ctx` bar can appear as the leftmost usage window.
- Kept model-specific Codex Spark handling behavior.

### Updated dependencies:

- @marckrenn/pi-sub-core@1.2.0
- @marckrenn/pi-sub-shared@1.2.0

## 1.1.0

### Minor Changes

- [`e9c1c39`](https://github.com/marckrenn/pi-sub/commit/e9c1c394286b302e018c2c824d16978b2b4d3d44) Thanks [@plesiv](https://github.com/plesiv)! - Make keybindings configurable

### Patch Changes

- Updated dependencies [[`7ce2a92`](https://github.com/marckrenn/pi-sub/commit/7ce2a92b15e766fd85a4b7eb85d6fc5c5aa32dca)]:
  - @marckrenn/pi-sub-core@1.1.0
  - @marckrenn/pi-sub-shared@1.1.0

## 1.0.6

### Patch Changes

- Remove `bundleDependencies`/`bundledDependencies` from `@marckrenn/pi-sub-bar` to fix `npm install -g @marckrenn/pi-sub-bar` failing with `protobufjs` postinstall (missing `scripts/postinstall.js`) on Node 24+/npm.

  Also include a second extension path (`../pi-sub-core/index.ts`) so `sub-core` is discovered whether npm installs `@marckrenn/pi-sub-core` nested or hoisted, restoring `/sub-core:settings`.

- Updated dependencies []:
  - @marckrenn/pi-sub-core@1.0.6
  - @marckrenn/pi-sub-shared@1.0.6

## 1.0.5

### Patch Changes

- [#35](https://github.com/marckrenn/pi-sub/pull/35) [`59e2b45`](https://github.com/marckrenn/pi-sub/commit/59e2b456e0e5c41479dccedcef93f9175cc4aa55) Thanks [@marckrenn](https://github.com/marckrenn)! - Improve startup responsiveness by deferring refreshes and watchers, skipping headless UI work, and unref-ing long-lived timers so pi CLI commands exit cleanly.

- Updated dependencies [[`59e2b45`](https://github.com/marckrenn/pi-sub/commit/59e2b456e0e5c41479dccedcef93f9175cc4aa55)]:
  - @marckrenn/pi-sub-core@1.0.5
  - @marckrenn/pi-sub-shared@1.0.5

## 1.0.4

### Patch Changes

- [#28](https://github.com/marckrenn/pi-sub/pull/28) [`2e35657`](https://github.com/marckrenn/pi-sub/commit/2e3565776a98ec133537fe0bacbc099cd4afadbe) Thanks [@marckrenn](https://github.com/marckrenn)! - Default Anthropic “Show Extra Window” provider setting to off.

- [#29](https://github.com/marckrenn/pi-sub/pull/29) [`7e6b7a0`](https://github.com/marckrenn/pi-sub/commit/7e6b7a08d69cf1cd456d2add406ec89c5c86f5df) Thanks [@marckrenn](https://github.com/marckrenn)! - Split display padding into left/right settings and migrate legacy paddingX values to both sides.

- [#22](https://github.com/marckrenn/pi-sub/pull/22) [`3e5a026`](https://github.com/marckrenn/pi-sub/commit/3e5a026ea3dc113561ff32466a8aa03b91c6d876) Thanks [@marckrenn](https://github.com/marckrenn)! - Store sub-core and sub-bar settings in agent-level JSON files so updates no longer overwrite user configuration. Legacy extension `settings.json` files are migrated into the new files and removed after a successful migration.

  Manual migration (if you want to do it yourself before updating):

  ```
  cp ~/.pi/agent/extensions/sub-core/settings.json ~/.pi/agent/pi-sub-core-settings.json
  cp ~/.pi/agent/extensions/sub-bar/settings.json ~/.pi/agent/pi-sub-bar-settings.json
  ```

  Existing users should move legacy settings from the extension folders to:
  - `~/.pi/agent/pi-sub-core-settings.json`
  - `~/.pi/agent/pi-sub-bar-settings.json`

- [#23](https://github.com/marckrenn/pi-sub/pull/23) [`9c324fc`](https://github.com/marckrenn/pi-sub/commit/9c324fc7daae2a874816f600ac1ea422f3799dd2) Thanks [@marckrenn](https://github.com/marckrenn)! - Auto-post theme share strings when saving, add a “Share theme” menu entry, allow share strings without a name when importing, and post raw share strings (without the `/sub-bar:import` prefix).

- [#25](https://github.com/marckrenn/pi-sub/pull/25) [`ab97c8f`](https://github.com/marckrenn/pi-sub/commit/ab97c8f13c567c32581bb82fe5b0406b3f2464ca) Thanks [@marckrenn](https://github.com/marckrenn)! - Refine the theme menu ordering/labels and add rename support for saved themes in the Manage & Load flow.

- [#27](https://github.com/marckrenn/pi-sub/pull/27) [`549c6fe`](https://github.com/marckrenn/pi-sub/commit/549c6fe3eb57374a54bfc69ad70c91862250a186) Thanks [@marckrenn](https://github.com/marckrenn)! - Move Themes to the root settings menu, rename Display Settings to Adv. Display Settings, and rename “Manage & Load themes” to “Load & Manage themes”.

- [#26](https://github.com/marckrenn/pi-sub/pull/26) [`af28d98`](https://github.com/marckrenn/pi-sub/commit/af28d9820f80bc1d045783644afbcc4d7cd114f1) Thanks [@marckrenn](https://github.com/marckrenn)! - Prompt to upload theme share strings as secret GitHub gists and post the gist URL when accepted.

- Updated dependencies [[`af0828a`](https://github.com/marckrenn/pi-sub/commit/af0828a8d2e529497a1acff95e388a0a3eabb90e), [`3e5a026`](https://github.com/marckrenn/pi-sub/commit/3e5a026ea3dc113561ff32466a8aa03b91c6d876), [`a6c0d33`](https://github.com/marckrenn/pi-sub/commit/a6c0d33c8d19d2876a4a8a1a0a69302a3c63f5e8), [`7da1e08`](https://github.com/marckrenn/pi-sub/commit/7da1e082e634f4e4dee2560b4d490527d1543ade), [`1f5e451`](https://github.com/marckrenn/pi-sub/commit/1f5e45173b9868b0d6645ae35a084142a0ac56a5), [`35eb185`](https://github.com/marckrenn/pi-sub/commit/35eb18590f369db4cda931b8e11099d0f3ddb4ec)]:
  - @marckrenn/pi-sub-core@1.0.4
  - @marckrenn/pi-sub-shared@1.0.4

## 1.0.3

### Patch Changes

- [`6fa2736`](https://github.com/marckrenn/pi-sub/commit/6fa27363573f34c38a372a6d7b8b74e756716724) Thanks [@marckrenn](https://github.com/marckrenn)! - Update extension tool execute signature order for compatibility with latest Pi API.

- Updated dependencies [[`6fa2736`](https://github.com/marckrenn/pi-sub/commit/6fa27363573f34c38a372a6d7b8b74e756716724)]:
  - @marckrenn/pi-sub-core@1.0.3
  - @marckrenn/pi-sub-shared@1.0.3

## 1.0.2

### Patch Changes

- [#3](https://github.com/marckrenn/pi-sub/pull/3) [`4ceb5ad`](https://github.com/marckrenn/pi-sub/commit/4ceb5ad133166237652d197ba9296ad1589a813c) Thanks [@marckrenn](https://github.com/marckrenn)! - Bundle sub-core with sub-bar, refresh Antigravity quotas + settings, and update UI copy/controls.

- Updated dependencies [[`4ceb5ad`](https://github.com/marckrenn/pi-sub/commit/4ceb5ad133166237652d197ba9296ad1589a813c)]:
  - @marckrenn/pi-sub-core@1.0.2
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

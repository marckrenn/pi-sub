# @eiei114/pi-sub-shared

## 2.0.2

### Patch Changes

- [#24](https://github.com/eiei114/pi-sub/pull/24) [`c761eff`](https://github.com/eiei114/pi-sub/commit/c761eff51c4b90636ba974b10b08ea9398bb06bc) Thanks [@eiei114](https://github.com/eiei114)! - Batch patch release to verify Discord release webhook delivery.

## 2.0.1

### Patch Changes

- Publish the missed patch release after reconciling public workspace packages with the managed npm inventory.

## 2.0.0

## 1.6.1

### Patch Changes

- [#6](https://github.com/eiei114/pi-sub/pull/6) [`3d7604e`](https://github.com/eiei114/pi-sub/commit/3d7604ef7f092f0e5b24d172f59155dfd836671d) Thanks [@eiei114](https://github.com/eiei114)! - Fix Anthropic and Copilot usage providers for upstream API changes (marckrenn/pi-sub#61, #65). Anthropic now reads Claude Code credentials and model-specific weekly quota windows. Copilot now parses chat/completions quota snapshots in addition to premium interactions. Add regression test for legacy cache migration (marckrenn/pi-sub#45).

## 1.6.0

## 1.5.2

### Patch Changes

- [#3](https://github.com/eiei114/pi-sub/pull/3) [`7507aa1`](https://github.com/eiei114/pi-sub/commit/7507aa12207cb4b545e30e32c9f09a998cd20f16) Thanks [@eiei114](https://github.com/eiei114)! - Add project status badges to the root README (npm version, license, Node.js, release workflow, PRs welcome).

## 1.5.1

## 1.5.0

### Minor Changes

- [#56](https://github.com/marckrenn/pi-sub/pull/56) [`864cc1b`](https://github.com/marckrenn/pi-sub/commit/864cc1bbc91897d934c0545a29f508862231963c) - Prioritize usage windows that match the active model before emitting `sub-core:update-current`, so compact status clients show the correct quota windows (including Codex Spark and Antigravity model-specific windows).

  Also make settings list navigation compatible with both old and new `@mariozechner/pi-tui` keybinding APIs, preventing crashes in submenus on older Pi runtimes where `getEditorKeybindings()` is unavailable.

  Thanks [@dnouri](https://github.com/dnouri) for [#54](https://github.com/marckrenn/pi-sub/pull/54).

## 1.4.0

### Minor Changes

- [#51](https://github.com/marckrenn/pi-sub/pull/51) [`477ee48`](https://github.com/marckrenn/pi-sub/commit/477ee480ae1a3841808f1e46b0541e11adcf0651) Thanks [@marckrenn](https://github.com/marckrenn)! - Align `sub-bar`, `sub-core`, and `sub-shared` to `1.4.0` in lockstep.

  No functional changes in this bump; this release normalizes package versions after the previous publish.

## 1.3.1

## 1.3.0

### Minor Changes

- [#42](https://github.com/marckrenn/pi-sub/pull/42) [`8bf29f3`](https://github.com/marckrenn/pi-sub/commit/8bf29f34c8f9418284cf30631a3325799c3e0f48) Thanks [@marckrenn](https://github.com/marckrenn)! - - Added an optional `showContextBar` setting (default: off), as introduced in [#10](https://github.com/marckrenn/pi-sub/pull/10) by [@pasky](https://github.com/pasky), to render the current context usage as an optional leftmost `Ctx` bar in sub-bar usage output.
  - Support for Codex Spark usage (auto-selected for `gpt-5.3-codex-spark`), including model-specific window labeling behavior.
  - OpenAI Status provider now surfaces the Codex-specific status endpoint instead of the generic status summary when available.
  - [`80b49b1`](https://github.com/marckrenn/pi-sub/commit/80b49b16c20c942135764bcf6c4cd0516e868ce2) Fixed API key auth format handling for the z.ai provider.

## 1.2.0

### Patch Changes

- No functional changes in this release; package version bumped to align with @marckrenn/pi-sub-bar and @marckrenn/pi-sub-core releases.

## 1.1.0

## 1.0.6

## 1.0.5

### Patch Changes

- [#35](https://github.com/marckrenn/pi-sub/pull/35) [`59e2b45`](https://github.com/marckrenn/pi-sub/commit/59e2b456e0e5c41479dccedcef93f9175cc4aa55) Thanks [@marckrenn](https://github.com/marckrenn)! - Improve startup responsiveness by deferring refreshes and watchers, skipping headless UI work, and unref-ing long-lived timers so pi CLI commands exit cleanly.

## 1.0.4

### Patch Changes

- [`7da1e08`](https://github.com/marckrenn/pi-sub/commit/7da1e082e634f4e4dee2560b4d490527d1543ade) Thanks [@marckrenn](https://github.com/marckrenn)! - Add a minimum refresh interval setting to cap refresh frequency even when refresh is triggered every turn.

## 1.0.3

### Patch Changes

- [`6fa2736`](https://github.com/marckrenn/pi-sub/commit/6fa27363573f34c38a372a6d7b8b74e756716724) Thanks [@marckrenn](https://github.com/marckrenn)! - Update extension tool execute signature order for compatibility with latest Pi API.

## 1.0.2

### Patch Changes

- [#3](https://github.com/marckrenn/pi-sub/pull/3) [`4ceb5ad`](https://github.com/marckrenn/pi-sub/commit/4ceb5ad133166237652d197ba9296ad1589a813c) Thanks [@marckrenn](https://github.com/marckrenn)! - Bundle sub-core with sub-bar, refresh Antigravity quotas + settings, and update UI copy/controls.

## 1.0.1

### Patch Changes

- Align repo version with npm publish.

## 1.0.0

### Major Changes

- [`9bedd80`](https://github.com/marckrenn/pi-sub/commit/9bedd80b0037b723e70f0376019fff59a617e7cb) Thanks [@marckrenn](https://github.com/marckrenn)! - Initial 1.0.0 release.

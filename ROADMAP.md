# Roadmap

This roadmap tracks the maintenance state of the `@eiei114/pi-sub-*` ecosystem
(the unofficial continuation of [`marckrenn/pi-sub`](https://github.com/marckrenn/pi-sub))
and lists bounded micro-maintenance candidates that the Weekly maintenance seed
planner can promote into backlog issues.

It is a living document. Update it whenever a release ships or a seed is picked
up, so the planner always has an accurate picture of "what's next".

> Scope note: this fork's goal is to keep `pi-sub` usable for current Pi users —
> stable Windows cache/TTL behavior, a working npm release flow, and safe triage
> of upstream PRs. New feature development is opportunistic, not roadmap-driven.

---

## 1. Current release status

| Package | Latest | Published | Release group |
| --- | --- | --- | --- |
| [`@eiei114/pi-sub-core`](https://www.npmjs.com/package/@eiei114/pi-sub-core) | `2.0.2` | 2026-08-03 | **fixed** |
| [`@eiei114/pi-sub-bar`](https://www.npmjs.com/package/@eiei114/pi-sub-bar) | `2.0.2` | 2026-08-03 | **fixed** |
| [`@eiei114/pi-sub-shared`](https://www.npmjs.com/package/@eiei114/pi-sub-shared) | `2.0.2` | 2026-08-03 | **fixed** |
| [`@eiei114/pi-sub-status`](https://www.npmjs.com/package/@eiei114/pi-sub-status) | `2.0.2` | 2026-08-03 | independent |

- `2.0.0` was a **major** bump ([PR #13](https://github.com/eiei114/pi-sub/pull/13),
  DOT-771): the Pi SDK peer dependency moved from the frozen `@mariozechner/*`
  scope to the official `@earendil-works/*` scope (`0.80.x`). This was a breaking
  change for consumers.
- `2.0.1` ([PR #18](https://github.com/eiei114/pi-sub/pull/18)) reconciled the
  published npm inventory with the workspace after the `2.0.0` release — no
  functional source changes.
- `2.0.2` ([PR #25](https://github.com/eiei114/pi-sub/pull/25)) shipped a batch
  patch release to verify Discord release webhook delivery ([PR #24](https://github.com/eiei114/pi-sub/pull/24)).
  Consumers should pin `2.0.2` or later.
- `sub-core`, `sub-bar`, and `sub-shared` form a **fixed release group** (one
  changeset bumps all three together — see `.changeset/config.json`).
  `sub-status` is versioned independently but currently tracks the same number.
- 9 usage providers are supported: `anthropic`, `copilot`, `gemini`,
  `antigravity`, `codex`, `kiro`, `zai`, `kimi-coding`, `openrouter`.

### Release pipeline

- Changesets + GitHub Actions, npm **Trusted Publishing** (no `NPM_TOKEN`).
- `.github/workflows/release.yml` runs on every push to `main` (and supports
  `workflow_dispatch` for manual recovery, [PR #26](https://github.com/eiei114/pi-sub/pull/26)):
  `npm ci` → `npm run verify` (check + test + lint, since
  [PR #17](https://github.com/eiei114/pi-sub/pull/17)), then Changesets opens
  (and auto-merges via squash) a `Version Packages` PR, then publishes on the
  second run.
- `.github/workflows/ci.yml` gates `pull_request` and non-`main` pushes on
  `ubuntu-latest` + `windows-latest` via `npm run verify` (since
  [PR #22](https://github.com/eiei114/pi-sub/pull/22), DOT-1258).
- Documented in [`RELEASE_PROCESS.md`](./RELEASE_PROCESS.md).

---

## 2. Maintenance priorities (next 2–3 releases)

These are the themes the fork should hold steady on. They are deliberately
boring and defensive — the fork's value is reliability, not features.

1. **Keep the SDK upgrade stable.** `2.0.x` is the first line on the
   `@earendil-works/*` SDK. Watch for behavioral regressions in event handling
   (`session_before_switch`, `session_before_fork`) and `getContextUsage()`
   null-coercion, and patch promptly.
2. **Protect Windows reliability.** The cache-rename retry, lock-ownership, and
   TTL-respecting refresh fixes are the fork's headline differentiators. Any
   change touching `packages/sub-core/src/cache.ts`, `storage/lock.ts`, or the
   usage controller must not regress these on Windows.
3. **Keep PR CI green.** `.github/workflows/ci.yml` now gates `pull_request` and
   non-`main` pushes on `ubuntu-latest` + `windows-latest` via `npm run verify`
   ([PR #22](https://github.com/eiei114/pi-sub/pull/22), DOT-1258). Treat CI
   failures on feature branches as release blockers — do not merge broken PRs.
4. **Documentation accuracy.** CHANGELOG H1 titles now match `@eiei114/*`
   ([PR #19](https://github.com/eiei114/pi-sub/pull/19), DOT-1243). Some
   generated docs may still reference the old scope — keep those consistent so
   new contributors aren't misled.
5. **Test coverage for shared contracts.** `sub-shared` now has a smoke suite
   in `packages/sub-shared/test/all.test.ts` that locks in provider/settings
   invariants ([PR #29](https://github.com/eiei114/pi-sub/pull/29), DOT-1434).
   Keep it updated when shared contracts change.
6. **Provider parity triage.** Periodically scan upstream `marckrenn/pi-sub`
   for safe, small provider fixes that can be ported without pulling in
   unrelated churn (see seed S-6).

---

## 3. Known technical debt

| Area | Detail | Source |
| --- | --- | --- |
| Thin `CONTRIBUTING.md` | Doesn't explain the `fixed` release group, Trusted Publishing, or the verify-before-merge gate. | `CONTRIBUTING.md` |
| Aspirational extension list | README "Ideas / planned" lists `pi-sub-compare`, `pi-sub-model-switcher`, `pi-sub-account-switcher` with no tracking or owners. | `README.md` |

---

## 4. Candidate maintenance seeds

Each seed is intentionally scoped to **30–90 minutes** of focused work so it can
be promoted into a single backlog issue and cleared in one session. Promote in
rough top-to-bottom priority order. Every seed carries its own acceptance
criteria so an agent or contributor can self-verify.

> Convention: when promoting a seed, file the backlog issue, then check the row
> off here and link the issue. Seeds are docs/CI/hygiene only — **none of these
> require a changeset or a package publish** unless explicitly noted.

---

### S-1 — Fix stale CHANGELOG package-name titles ✅

**Size:** ~30 min · **Type:** docs · **Changeset:** no · **Status:** done
(DOT-1243, [PR #19](https://github.com/eiei114/pi-sub/pull/19))

All four package CHANGELOG H1 titles now read `@eiei114/pi-sub-*`, matching the
published package names. A regression test in `packages/sub-core/test/changelog-titles.test.ts`
guards against future drift.

**Acceptance criteria**

- [x] `packages/sub-core/CHANGELOG.md` H1 reads `# @eiei114/pi-sub-core`.
- [x] `packages/sub-bar/CHANGELOG.md` H1 reads `# @eiei114/pi-sub-bar`.
- [x] `packages/sub-shared/CHANGELOG.md` H1 reads `# @eiei114/pi-sub-shared`.
- [x] `packages/sub-status/CHANGELOG.md` H1 reads `# @eiei114/pi-sub-status`.
- [x] No other lines in the changelogs are changed (history is preserved).
- [x] `packages/sub-core/test/changelog-titles.test.ts` regression test passes (H1 titles match each `package.json` `name`).
- [x] `npm run verify` passes; `npm run lint` still passes; no changeset added (docs-only).

**Verification:** `grep -Rn "^# @marckrenn" packages/` returns nothing; `npm run verify` includes the changelog-title regression test.

---

### S-2 — Add pull-request CI (with Windows matrix) ✅

**Size:** ~60 min · **Type:** CI · **Changeset:** no · **Status:** done
(DOT-1258, [PR #22](https://github.com/eiei114/pi-sub/pull/22); trigger-shape
regression in [PR #23](https://github.com/eiei114/pi-sub/pull/23), DOT-1266)

`.github/workflows/ci.yml` now gates `pull_request` and non-`main` pushes on
`ubuntu-latest` + `windows-latest` via `npm run verify`. `release.yml` still
runs on `main` to gate publish.

**Acceptance criteria**

- [x] New `.github/workflows/ci.yml` triggers on `pull_request` and on `push` to
      non-`main` branches.
- [x] It runs on `ubuntu-latest` + `windows-latest`.
- [x] Steps: checkout → setup-node (version from `.nvmrc`) → `npm ci` →
      `npm run verify`.
- [x] `release.yml`'s `test` job is left in place (it gates the publish); CI is
      additive, not a replacement.
- [x] Workflow passes on a no-op PR before merge.

**Verification:** open a PR; both CI matrices go green; deliberately introduce a
lint error and confirm the job fails.

---

### S-3 — Add tests for `sub-shared` ✅

**Size:** ~60 min · **Type:** tests · **Changeset:** no · **Status:** done
(DOT-1434, [PR #29](https://github.com/eiei114/pi-sub/pull/29))

`packages/sub-shared/test/all.test.ts` now smoke-tests provider metadata,
default settings, and the shared contract that `sub-core` and `sub-bar`
consume.

**Acceptance criteria**

- [x] `packages/sub-shared/package.json` gains `"test": "tsx test/all.test.ts"`
      and `tsx` as a devDependency (matching sub-core/sub-bar).
- [x] `npm run test -w @eiei114/pi-sub-shared` passes.
- [x] `npm run test` (root) now includes sub-shared results.
- [x] Tests assert: every entry in `PROVIDERS` has metadata + a display name;
      `PROVIDER_DISPLAY_NAMES` keys equal `PROVIDERS`;
      `getDefaultCoreProviderSettings()` returns one entry per provider with
      `enabled === "auto"`; `getDefaultCoreSettings()` returns a full
      `providerOrder` matching `PROVIDERS` and a non-null `behavior`.
- [x] No production source changes; no changeset (test-only).

**Verification:** `npm run test -w @eiei114/pi-sub-shared` exits 0; root
`npm run test` shows the new workspace.

---

### S-4 — Expand `CONTRIBUTING.md` with release/verify rules

**Size:** ~45 min · **Type:** docs · **Changeset:** no

`CONTRIBUTING.md` lists scripts but omits the rules that actually trip up
contributors: the `fixed` release group, when a changeset is required, the
Trusted Publishing flow, and the verify-before-merge gate.

**Why needed:** first-time contributors routinely open PRs without changesets or
run only `npm test` instead of `npm run verify`, slowing review.

**Acceptance criteria**

- [ ] A "Release rules" section explains the `fixed` group
      (`sub-core`/`sub-bar`/`sub-shared` bump together) and that `sub-status` is
      independent.
- [ ] A "When to add a changeset" section: required for user-facing package
      changes; skip for docs/CI/test-only changes.
- [ ] A pointer to `RELEASE_PROCESS.md` for the full publish flow.
- [ ] A "Before you merge" checklist: `npm run verify` (check + test + lint)
      passes locally.
- [ ] No source changes; no changeset.

**Verification:** read-through confirms all four bullets present; `npm run lint`
passes on the doc change.

---

### S-5 — Document the Windows reliability contract

**Size:** ~60 min · **Type:** docs · **Changeset:** no

The Windows cache-rename retry, lock-ownership, and TTL-respecting refresh
behavior are the fork's main differentiators, but they are only described
loosely in the README. Capture the exact contract so future changes don't
silently regress it.

**Why needed:** without a written contract, well-intentioned refactors can
reintroduce the Windows cache races this fork was created to fix.

**Acceptance criteria**

- [ ] New `docs/WINDOWS_CACHE_CONTRACT.md` documents: cache/lock file locations,
      the rename-retry behavior, that a process only releases its own lock, and
      that `turn_end`/`tool_result` refreshes respect the cache TTL.
- [ ] Lists the source files that implement each behavior
      (`src/cache.ts`, `src/storage/lock.ts`, usage controller) as the "do not
      regress" surface.
- [ ] README links to the new doc from the "About this fork" section.
- [ ] No source changes; no changeset.

**Verification:** all four implementation files are named in the doc; README link
resolves.

---

### S-6 — Triage upstream `marckrenn/pi-sub` for portable fixes

**Size:** ~45 min · **Type:** triage · **Changeset:** no

Periodically scan the upstream repo's open issues/PRs for small, safe,
provider-specific fixes that can be ported without dragging in unrelated churn.

**Why needed:** upstream still receives provider API fixes; periodic triage
keeps this fork current without a full merge.

**Acceptance criteria**

- [ ] Output is a short report (issue comment or doc) listing up to 3 candidate
      upstream items, each with: link, one-line summary, estimated port effort,
      and a yes/no "safe to port" recommendation.
- [ ] Exclude anything touching the cache/lock layer or the SDK scope (already
      diverged in this fork).
- [ ] No code changes in this seed — porting is a follow-up issue.

**Verification:** report covers the 3 most relevant upstream items with
recommendations; nothing in the fork is modified.

---

## 5. Out of scope (for now)

These are tracked in the README as ideas but are **not** current maintenance
targets. They are listed here only so the planner doesn't re-evaluate them every
week:

- `pi-sub-compare` — multi-provider usage comparison chart.
- `pi-sub-model-switcher` — auto switch model/provider at a usage threshold.
- `pi-sub-account-switcher` — cycle subscriptions at usage thresholds.

Each would be a net-new package and a multi-session effort, not a 30–90 minute
seed. Revisit only if a contributor volunteers to own one.

---

## 6. Changelog

- **2026-08-10** — Roadmap refresh (DOT-1444). Marked seed S-3 done
  (DOT-1434 / PR #29) and removed stale claims that `sub-shared` still has no
  tests.
- **2026-08-03** — Roadmap refresh (DOT-1335). Bumped release status to `2.0.2`
  (2026-08-03), marked seed S-2 done (DOT-1258 / PR #22), and removed stale
  claims that PR CI and the Windows matrix were still missing.
- **2026-07-28** — Marked seed S-1 done (DOT-1243). CHANGELOG H1 titles were
  aligned in [PR #19](https://github.com/eiei114/pi-sub/pull/19); this refresh
  checks off the seed and removes the stale-title technical-debt row.
- **2026-07-21** — Roadmap refresh (DOT-1013). Bumped release status to `2.0.1`
  (2026-07-20), noted `release.yml` now runs `npm run verify` on `main` (PR #17),
  and reframed S-2 around the remaining PR/Windows CI gap. Seeds S-1 … S-6
  remain open and promotable.
- **2026-07-14** — Initial `ROADMAP.md` created (DOT-869). Captures the post-`2.0.0`
  state and six candidate maintenance seeds (S-1 … S-6).

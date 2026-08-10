# Release Process

This repo uses Changesets + GitHub Actions to ship npm releases automatically after merges to `main`.

## One-time setup

1. **npm Trusted Publishing**
   - In npm, grant this repo permission to publish each `@eiei114/pi-sub-*` package from `.github/workflows/release.yml`.
   - This workflow already requests `id-token: write`, so no `NPM_TOKEN` secret is required when Trusted Publishing is configured.
2. **Enable GitHub auto-merge**
   - Repo Settings → Pull Requests → enable **Allow auto-merge**.
   - The release workflow turns on auto-merge for the bot-created `Version Packages` PR after Changesets opens it.

## Normal release flow

### 1) Add a changeset in the feature PR

From your branch:

```bash
npm run changeset
```

- Pick the packages that changed.
- `@eiei114/pi-sub-core`, `@eiei114/pi-sub-bar`, and `@eiei114/pi-sub-shared` are a **fixed group**, so one changeset bumps them together.
- If only docs/CI changed and you do **not** want a publish, skip the changeset.

Commit the generated `.changeset/*.md` file in the same PR.

### 2) Merge the feature PR to `main`

On every push to `main`, `.github/workflows/release.yml` runs automatically.

- If unreleased changesets exist, Changesets creates or updates a **Version Packages** PR.
- The same workflow immediately enables auto-merge for that PR with `gh pr merge --auto --squash`.

### 3) Let the Version Packages PR merge itself

When checks pass, GitHub auto-merges the `Version Packages` PR.

### 4) Publish happens automatically

The merge of the `Version Packages` PR pushes to `main` again, so `release.yml` runs a second time.

- This time there are no pending changesets, so Changesets publishes the changed packages to npm.
- Changesets also creates package tags / GitHub releases for the published packages.

## Local verification before merge

Recommended before merging a release-affecting PR:

```bash
npm ci
npm run verify
```

## Notes

- Publish scope is package-aware: only packages affected by the merged changesets are released.
- Internal dependency bumps are handled by Changesets.
- If the repo auto-merge setting is off, the workflow cannot arm auto-merge and someone must merge the `Version Packages` PR manually.
- A separate `pull_request_target` workflow is not used because PRs created with `GITHUB_TOKEN` do not reliably trigger follow-up automation.

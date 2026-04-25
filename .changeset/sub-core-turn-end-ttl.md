---
"@marckrenn/pi-sub-core": patch
---

`turn_end` and `tool_result` no longer pass `force: true` to `refresh` /
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

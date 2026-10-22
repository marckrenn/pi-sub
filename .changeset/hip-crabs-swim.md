---
'@marckrenn/pi-sub-core': patch
---

Preserve the original quota fetch timestamp in cache-backed usage updates. Consumers that check freshness no longer lose `lastSuccessAt` after a status or shared-cache update, and status-only updates do not make older usage look newly fetched.

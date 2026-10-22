---
'@marckrenn/pi-sub-core': patch
'@marckrenn/pi-sub-shared': patch
---

Expose optional quota-reading provenance through `UsageSnapshot.accountId` and `credentialSource`. Codex reports its request account when known, and Codex and Anthropic report credential-source categories. Consumers can inspect provenance without reading credential files. Authentication selection and polling remain unchanged.

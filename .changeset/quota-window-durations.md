---
'@marckrenn/pi-sub-core': patch
'@marckrenn/pi-sub-shared': patch
---

Expose optional `RateWindow.windowSeconds` metadata for Codex and Anthropic quota windows. Clients can use the full quota period without parsing display labels or treating the time until reset as the duration. Codex uses reported lengths only; unknown durations remain `undefined`.

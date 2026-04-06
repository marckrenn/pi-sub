---
"@marckrenn/pi-sub-core": minor
"@marckrenn/pi-sub-shared": minor
---

Add MiniMax Token Plan usage provider

Fetches 5-hour rolling window and weekly quota from the MiniMax open platform API (`api.minimax.io`). Credentials are resolved from `MINIMAX_API_KEY` / `MINIMAX_TOKEN` env vars or `~/.pi/agent/auth.json` under the `minimax` key.

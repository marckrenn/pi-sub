---
"@marckrenn/pi-sub-bar": patch
---
Add support for a transparent widget background so users can disable background coloring when it reduces readability in their terminal theme.

This introduces an explicit `none` background choice in display settings and preserves that preference through settings updates, so the bar can render without forced background ANSI styling.
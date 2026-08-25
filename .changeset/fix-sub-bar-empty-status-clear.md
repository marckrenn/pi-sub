---
"@marckrenn/pi-sub-bar": patch
---

fix: clear the `sub-bar` status with `undefined` instead of an empty string

`ctx.ui.setStatus("sub-bar", "")` left an empty entry registered in pi's
extension status map. The built-in footer renders an empty status line when any
status entry exists, and custom footers reading `getExtensionStatuses()` also
had to defensively filter blank text, causing a stray blank line below the
footer. The documented clear idiom is `setStatus(key, undefined)`, which removes
the entry entirely; `sub-status` already uses that pattern and is unaffected.
# @eiei114/pi-sub-shared

Shared types, metadata, and event contracts for the `sub-*` ecosystem.

This package is consumed by `sub-core` and `sub-bar` to keep provider metadata, usage types, and model multipliers consistent. For repo setup and extension installation, see the root [pi-sub README](../../README.md).

## Overview

### Installation

```bash
npm install @eiei114/pi-sub-shared
```

### Usage

```ts
import {
  PROVIDERS,
  ProviderName,
  UsageSnapshot,
  getDefaultCoreSettings,
} from "@eiei114/pi-sub-shared";

const defaults = getDefaultCoreSettings();
const provider: ProviderName = "anthropic";
const snapshot: UsageSnapshot = {
  provider,
  displayName: "Anthropic (Claude)",
  windows: [],
};

console.log(PROVIDERS, defaults, snapshot);
```

### Exports

- `PROVIDERS`, `ProviderName`
- `RateWindow`, `UsageSnapshot`, `ProviderUsageEntry`
- `UsageError`, `UsageErrorCode`
- `ProviderStatus`, `StatusIndicator`
- `CoreSettings`, `CoreProviderSettings`, `CoreProviderSettingsMap`
- `BehaviorSettings`, `DEFAULT_BEHAVIOR_SETTINGS`
- `getDefaultCoreSettings`, `getDefaultCoreProviderSettings`
- `SubCoreState`, `SubCoreAllState`, `SubCoreEvents`
- `ProviderMetadata`, `ProviderDetectionConfig`, `ProviderStatusConfig`
- `PROVIDER_METADATA`, `PROVIDER_DISPLAY_NAMES`
- `MODEL_MULTIPLIERS`

## Development

```bash
npm run check
```

## Related docs

- Root README: [../../README.md](../../README.md)

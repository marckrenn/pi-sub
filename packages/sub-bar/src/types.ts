/**
 * Core types for the sub-bar extension
 */

export type {
	ProviderName,
	StatusIndicator,
	ProviderStatus,
	RateWindow,
	UsageSnapshot,
	UsageError,
	UsageErrorCode,
	ProviderUsageEntry,
	SubCoreState,
	SubCoreAllState,
	SubCoreEvents,
} from "@eiei114/pi-sub-shared";

export { PROVIDERS } from "@eiei114/pi-sub-shared";

export type ModelInfo = {
	provider?: string;
	id?: string;
	scopedModelPatterns?: string[];
};

/**
 * Shared types and metadata for sub-* extensions.
 */

export const PROVIDERS = ["anthropic", "copilot", "gemini", "antigravity", "codex", "kiro", "zai", "kimi-coding"] as const;

export type ProviderName = (typeof PROVIDERS)[number];

export type StatusIndicator = "none" | "minor" | "major" | "critical" | "maintenance" | "unknown";

export interface ProviderStatus {
	indicator: StatusIndicator;
	description?: string;
}

export interface RateWindow {
	label: string;
	usedPercent: number;
	resetDescription?: string;
	resetAt?: string;
}

export interface UsageSnapshot {
	provider: ProviderName;
	displayName: string;
	windows: RateWindow[];
	extraUsageEnabled?: boolean;
	fiveHourUsage?: number;
	lastSuccessAt?: number;
	error?: UsageError;
	status?: ProviderStatus;
	requestsSummary?: string;
	requestsRemaining?: number;
	requestsEntitlement?: number;
}

export type UsageErrorCode =
	| "NO_CREDENTIALS"
	| "NO_CLI"
	| "NOT_LOGGED_IN"
	| "FETCH_FAILED"
	| "HTTP_ERROR"
	| "API_ERROR"
	| "TIMEOUT"
	| "UNKNOWN";

export interface UsageError {
	code: UsageErrorCode;
	message: string;
	httpStatus?: number;
}

export interface ProviderUsageEntry {
	provider: ProviderName;
	usage?: UsageSnapshot;
}

export type ProviderEnabledSetting = "auto" | "on" | "off" | boolean;

export interface CoreProviderSettings {
	enabled: ProviderEnabledSetting;
	displayName?: string;
	fetchStatus: boolean;
	extraUsageCurrencySymbol?: string;
	extraUsageDecimalSeparator?: "." | ",";
}

export interface CoreProviderSettingsMap {
	anthropic: CoreProviderSettings;
	copilot: CoreProviderSettings;
	gemini: CoreProviderSettings;
	antigravity: CoreProviderSettings;
	codex: CoreProviderSettings;
	kiro: CoreProviderSettings;
	zai: CoreProviderSettings;
	"kimi-coding": CoreProviderSettings;
}

export interface BehaviorSettings {
	refreshInterval: number;
	minRefreshInterval: number;
	refreshOnTurnStart: boolean;
	refreshOnToolResult: boolean;
}

export const DEFAULT_BEHAVIOR_SETTINGS: BehaviorSettings = {
	refreshInterval: 60,
	minRefreshInterval: 10,
	refreshOnTurnStart: false,
	refreshOnToolResult: false,
};

export function getDefaultCoreProviderSettings(): CoreProviderSettingsMap {
	const defaults = {} as CoreProviderSettingsMap;
	for (const provider of PROVIDERS) {
		defaults[provider] = {
			enabled: "auto" as ProviderEnabledSetting,
			fetchStatus: Boolean(PROVIDER_METADATA[provider]?.status),
		};
	}
	return defaults;
}

export function getDefaultCoreSettings(): CoreSettings {
	return {
		providers: getDefaultCoreProviderSettings(),
		behavior: { ...DEFAULT_BEHAVIOR_SETTINGS },
		statusRefresh: { ...DEFAULT_BEHAVIOR_SETTINGS },
		providerOrder: [...PROVIDERS],
		defaultProvider: null,
	};
}

export interface CoreSettings {
	providers: CoreProviderSettingsMap;
	behavior: BehaviorSettings;
	statusRefresh: BehaviorSettings;
	providerOrder: ProviderName[];
	defaultProvider: ProviderName | null;
}

export type SubCoreState = {
	provider?: ProviderName;
	usage?: UsageSnapshot;
};

export type SubCoreAllState = {
	provider?: ProviderName;
	entries: ProviderUsageEntry[];
};

export type SubCoreEvents =
	| { type: "sub-core:ready"; state: SubCoreState }
	| { type: "sub-core:update-current"; state: SubCoreState }
	| { type: "sub-core:update-all"; state: SubCoreAllState };

export interface StatusPageComponentMatch {
	id?: string;
	name?: string;
}

export type ProviderStatusConfig =
	| { type: "statuspage"; url: string; component?: StatusPageComponentMatch }
	| { type: "google-workspace" };

export interface ProviderDetectionConfig {
	providerTokens: string[];
	modelTokens: string[];
}

export interface ProviderMetadata {
	displayName: string;
	detection?: ProviderDetectionConfig;
	status?: ProviderStatusConfig;
}

export const PROVIDER_METADATA: Record<ProviderName, ProviderMetadata> = {
	anthropic: {
		displayName: "Anthropic (Claude)",
		status: { type: "statuspage", url: "https://status.anthropic.com/api/v2/status.json" },
		detection: { providerTokens: ["anthropic"], modelTokens: ["claude"] },
	},
	copilot: {
		displayName: "GitHub Copilot",
		status: { type: "statuspage", url: "https://www.githubstatus.com/api/v2/status.json" },
		detection: { providerTokens: ["copilot", "github"], modelTokens: [] },
	},
	gemini: {
		displayName: "Google Gemini",
		status: { type: "google-workspace" },
		detection: { providerTokens: ["google", "gemini"], modelTokens: ["gemini"] },
	},
	antigravity: {
		displayName: "Antigravity",
		status: { type: "google-workspace" },
		detection: { providerTokens: ["antigravity"], modelTokens: ["antigravity"] },
	},
	codex: {
		displayName: "OpenAI Codex",
		status: {
			type: "statuspage",
			url: "https://status.openai.com/api/v2/status.json",
			component: {
				id: "01JVCV8YSWZFRSM1G5CVP253SK",
				name: "Codex",
			},
		},
		detection: { providerTokens: ["openai", "codex"], modelTokens: ["gpt", "o1", "o3"] },
	},
	kiro: {
		displayName: "AWS Kiro",
		detection: { providerTokens: ["kiro", "aws"], modelTokens: [] },
	},
	zai: {
		displayName: "z.ai",
		detection: { providerTokens: ["zai", "z.ai", "xai"], modelTokens: [] },
	},
	"kimi-coding": {
		displayName: "Kimi for Coding",
		detection: { providerTokens: ["kimi"], modelTokens: ["kimi-for-coding"] },
	},
};

export const PROVIDER_DISPLAY_NAMES = Object.fromEntries(
	PROVIDERS.map((provider) => [provider, PROVIDER_METADATA[provider].displayName])
) as Record<ProviderName, string>;

export const MODEL_MULTIPLIERS: Record<string, number> = {
	"Claude Haiku 4.5": 0.33,
	"Claude Opus 4.1": 10,
	"Claude Opus 4.5": 3,
	"Claude Sonnet 4": 1,
	"Claude Sonnet 4.5": 1,
	"Gemini 2.5 Pro": 1,
	"Gemini 3 Flash": 0.33,
	"Gemini 3 Pro": 1,
	"GPT-4.1": 0,
	"GPT-4o": 0,
	"GPT-5": 1,
	"GPT-5 mini": 0,
	"GPT-5-Codex": 1,
	"GPT-5.1": 1,
	"GPT-5.1-Codex": 1,
	"GPT-5.1-Codex-Mini": 0.33,
	"GPT-5.1-Codex-Max": 1,
	"GPT-5.2": 1,
	"Grok Code Fast 1": 0.25,
	"Raptor mini": 0,
};

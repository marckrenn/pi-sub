/**
 * Provider metadata shared across the extension.
 */

import type { RateWindow, UsageSnapshot, ProviderName, ModelInfo } from "../types.js";
import type { Settings } from "../settings-types.js";
import { getModelMultiplier, normalizeTokens } from "../utils.js";
import { PROVIDER_METADATA as BASE_METADATA, type ProviderMetadata as BaseProviderMetadata } from "@marckrenn/pi-sub-shared";

export { PROVIDERS, PROVIDER_DISPLAY_NAMES } from "@marckrenn/pi-sub-shared";
export type { ProviderStatusConfig, ProviderDetectionConfig } from "@marckrenn/pi-sub-shared";

export interface UsageExtra {
	label: string;
}

export interface ProviderMetadata extends BaseProviderMetadata {
	isWindowVisible?: (usage: UsageSnapshot, window: RateWindow, settings?: Settings, model?: ModelInfo) => boolean;
	getExtras?: (usage: UsageSnapshot, settings?: Settings, modelId?: string) => UsageExtra[];
}

const anthropicWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers.anthropic;
	if (window.label === "5h") return ps.windows.show5h;
	if (window.label === "Week") return ps.windows.show7d;
	if (window.label.startsWith("Extra [")) return ps.windows.showExtra;
	return true;
};

const copilotWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers.copilot;
	if (window.label === "Month") return ps.windows.showMonth;
	return true;
};

const geminiWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers.gemini;
	if (window.label === "Pro") return ps.windows.showPro;
	if (window.label === "Flash") return ps.windows.showFlash;
	return true;
};

const antigravityWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, model) => {
	if (!settings) return true;
	const ps = settings.providers.antigravity;
	const label = window.label.trim();
	const normalized = label.toLowerCase().replace(/\s+/g, "_");
	if (normalized === "tab_flash_lite_preview") return false;

	const labelTokens = normalizeTokens(label);

	const modelProvider = model?.provider?.toLowerCase() ?? "";
	const modelId = model?.id;
	const providerMatches = modelProvider.includes("antigravity");
	if (ps.showCurrentModel && providerMatches && modelId) {
		const modelTokens = normalizeTokens(modelId);
		const match = modelTokens.length > 0 && modelTokens.every((token) => labelTokens.includes(token));
		if (match) return true;
	}

	if (ps.showScopedModels) {
		const scopedPatterns = model?.scopedModelPatterns ?? [];
		const matchesScoped = scopedPatterns.some((pattern) => {
			if (!pattern) return false;
			const [rawPattern] = pattern.split(":");
			const trimmed = rawPattern?.trim();
			if (!trimmed) return false;
			const hasProvider = trimmed.includes("/");
			if (!hasProvider) return false;
			const providerPart = trimmed.slice(0, trimmed.indexOf("/")).trim().toLowerCase();
			if (!providerPart.includes("antigravity")) return false;
			const base = trimmed.slice(trimmed.lastIndexOf("/") + 1);
			const tokens = normalizeTokens(base);
			return tokens.length > 0 && tokens.every((token) => labelTokens.includes(token));
		});
		if (matchesScoped) return true;
	}

	const visibility = ps.modelVisibility?.[label];
	return visibility === true;
};

const codexWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, model) => {
	if (!settings) return true;
	const ps = settings.providers.codex;
	const isSparkModel = isCodexSparkModel(model);
	const isSparkWindow = isCodexSparkWindow(window);
	if (isSparkWindow) {
		if (!isSparkModel) return false;
		return shouldShowCodexWindowBySetting(ps, window);
	}
	if (isSparkModel) {
		return false;
	}
	return shouldShowCodexWindowBySetting(ps, window);
};

const isCodexSparkModel = (model?: ModelInfo): boolean => {
	const tokens = normalizeTokens(model?.id ?? "");
	return tokens.includes("codex") && tokens.includes("spark");
};

const isCodexSparkWindow = (window: RateWindow): boolean => {
	const tokens = normalizeTokens(window.label ?? "");
	return tokens.includes("codex") && tokens.includes("spark");
};

const shouldShowCodexWindowBySetting = (
	ps: Settings["providers"]["codex"],
	window: RateWindow
): boolean => {
	if (window.label === "") return true;
	if (/\b\d+h$/.test(window.label.trim())) {
		return ps.windows.showPrimary;
	}
	if (window.label === "Day" || window.label === "Week" || /\b(day|week)\b/.test(window.label.toLowerCase())) {
		return ps.windows.showSecondary;
	}
	return true;
};

const kiroWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers.kiro;
	if (window.label === "Credits") return ps.windows.showCredits;
	return true;
};

const zaiWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers.zai;
	if (window.label === "Tokens") return ps.windows.showTokens;
	if (window.label === "Monthly") return ps.windows.showMonthly;
	return true;
};

const kimiCodingWindowVisible: ProviderMetadata["isWindowVisible"] = (_usage, window, settings, _model) => {
	if (!settings) return true;
	const ps = settings.providers["kimi-coding"];
	if (window.label === "Week") return ps.windows.showWeek;
	if (window.label === "5h") return ps.windows.show5h;
	return true;
};

const anthropicExtras: ProviderMetadata["getExtras"] = (usage, settings) => {
	const extras: UsageExtra[] = [];
	const showExtraWindow = settings?.providers.anthropic.windows.showExtra ?? true;
	if (showExtraWindow && usage.extraUsageEnabled === false) {
		extras.push({ label: "Extra [off]" });
	}
	return extras;
};

const copilotExtras: ProviderMetadata["getExtras"] = (usage, settings, modelId) => {
	const extras: UsageExtra[] = [];
	const showMultiplier = settings?.providers.copilot.showMultiplier ?? true;
	const showRequestsLeft = settings?.providers.copilot.showRequestsLeft ?? true;
	if (!showMultiplier) return extras;

	const multiplier = getModelMultiplier(modelId);
	const remaining = usage.requestsRemaining;
	if (multiplier !== undefined) {
		let multiplierStr = `Model multiplier: ${multiplier}x`;
		if (showRequestsLeft && remaining !== undefined) {
			const leftCount = Math.floor(remaining / Math.max(multiplier, 0.0001));
			multiplierStr += ` (${leftCount} req. left)`;
		}
		extras.push({ label: multiplierStr });
	}
	return extras;
};

export const PROVIDER_METADATA: Record<ProviderName, ProviderMetadata> = {
	anthropic: {
		...BASE_METADATA.anthropic,
		isWindowVisible: anthropicWindowVisible,
		getExtras: anthropicExtras,
	},
	copilot: {
		...BASE_METADATA.copilot,
		isWindowVisible: copilotWindowVisible,
		getExtras: copilotExtras,
	},
	gemini: {
		...BASE_METADATA.gemini,
		isWindowVisible: geminiWindowVisible,
	},
	antigravity: {
		...BASE_METADATA.antigravity,
		isWindowVisible: antigravityWindowVisible,
	},
	codex: {
		...BASE_METADATA.codex,
		isWindowVisible: codexWindowVisible,
	},
	kiro: {
		...BASE_METADATA.kiro,
		isWindowVisible: kiroWindowVisible,
	},
	zai: {
		...BASE_METADATA.zai,
		isWindowVisible: zaiWindowVisible,
	},
	"kimi-coding": {
		...BASE_METADATA["kimi-coding"],
		isWindowVisible: kimiCodingWindowVisible,
	},
};

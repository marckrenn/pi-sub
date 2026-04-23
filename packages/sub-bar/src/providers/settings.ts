/**
 * Provider-specific settings helpers.
 */

import type { SettingItem } from "@mariozechner/pi-tui";
import type { ProviderName } from "../types.js";
import type {
	Settings,
	BaseProviderSettings,
	AnthropicProviderSettings,
	CopilotProviderSettings,
	GeminiProviderSettings,
	AntigravityProviderSettings,
	CodexProviderSettings,
	KiroProviderSettings,
	ZaiProviderSettings,
	KimiCodingProviderSettings,
} from "../settings-types.js";

function buildBaseProviderItems(ps: BaseProviderSettings): SettingItem[] {
	return [
		{
			id: "showStatus",
			label: "Show Status Indicator",
			currentValue: ps.showStatus ? "on" : "off",
			values: ["on", "off"],
			description: "Show status indicator for this provider.",
		},
	];
}

function applyBaseProviderSetting(ps: BaseProviderSettings, id: string, value: string): boolean {
	switch (id) {
		case "showStatus":
			ps.showStatus = value === "on";
			return true;
		default:
			return false;
	}
}

/**
 * Build settings items for a specific provider.
 */
export function buildProviderSettingsItems(settings: Settings, provider: ProviderName): SettingItem[] {
	const ps = settings.providers[provider];
	const items: SettingItem[] = [...buildBaseProviderItems(ps)];

	if (provider === "anthropic") {
		const anthroSettings = ps as AnthropicProviderSettings;
		items.push(
			{
				id: "show5h",
				label: "Show 5h Window",
				currentValue: anthroSettings.windows.show5h ? "on" : "off",
				values: ["on", "off"],
				description: "Show the 5-hour usage window.",
			},
			{
				id: "show7d",
				label: "Show Week Window",
				currentValue: anthroSettings.windows.show7d ? "on" : "off",
				values: ["on", "off"],
				description: "Show the weekly usage window.",
			},
			{
				id: "showExtra",
				label: "Show Extra Window",
				currentValue: anthroSettings.windows.showExtra ? "on" : "off",
				values: ["on", "off"],
				description: "Show the extra usage window.",
			},
		);
	}

	if (provider === "copilot") {
		const copilotSettings = ps as CopilotProviderSettings;
		items.push(
			{
				id: "showMultiplier",
				label: "Show Model Multiplier",
				currentValue: copilotSettings.showMultiplier ? "on" : "off",
				values: ["on", "off"],
				description: "Show request cost multiplier for the current model.",
			},
			{
				id: "showRequestsLeft",
				label: "Show Requests Remaining",
				currentValue: copilotSettings.showRequestsLeft ? "on" : "off",
				values: ["on", "off"],
				description: "Estimate requests remaining based on the multiplier.",
			},
			{
				id: "quotaDisplay",
				label: "Show Quota in",
				currentValue: copilotSettings.quotaDisplay,
				values: ["percentage", "requests"],
				description: "Display Copilot usage as percentage or requests.",
			},
			{
				id: "showMonth",
				label: "Show Month Window",
				currentValue: copilotSettings.windows.showMonth ? "on" : "off",
				values: ["on", "off"],
				description: "Show the monthly usage window.",
			},
		);
	}

	if (provider === "gemini") {
		const geminiSettings = ps as GeminiProviderSettings;
		items.push(
			{
				id: "showPro",
				label: "Show Pro Window",
				currentValue: geminiSettings.windows.showPro ? "on" : "off",
				values: ["on", "off"],
				description: "Show the Pro quota window.",
			},
			{
				id: "showFlash",
				label: "Show Flash Window",
				currentValue: geminiSettings.windows.showFlash ? "on" : "off",
				values: ["on", "off"],
				description: "Show the Flash quota window.",
			},
		);
	}

	if (provider === "antigravity") {
		const antigravitySettings = ps as AntigravityProviderSettings;
		items.push(
			{
				id: "showCurrentModel",
				label: "Always Show Current Model",
				currentValue: antigravitySettings.showCurrentModel ? "on" : "off",
				values: ["on", "off"],
				description: "Show the active Antigravity model even if hidden.",
			},
			{
				id: "showScopedModels",
				label: "Show Scoped Models",
				currentValue: antigravitySettings.showScopedModels ? "on" : "off",
				values: ["on", "off"],
				description: "Show Antigravity models that are in the scoped model rotation.",
			},
		);

		const modelVisibility = antigravitySettings.modelVisibility ?? {};
		const modelOrder = antigravitySettings.modelOrder?.length
			? antigravitySettings.modelOrder
			: Object.keys(modelVisibility).sort((a, b) => a.localeCompare(b));
		const seenModels = new Set<string>();

		for (const model of modelOrder) {
			if (!model || seenModels.has(model)) continue;
			seenModels.add(model);
			const normalized = model.toLowerCase().replace(/\s+/g, "_");
			if (normalized === "tab_flash_lite_preview") continue;
			const visible = modelVisibility[model] !== false;
			items.push({
				id: `model:${model}`,
				label: model,
				currentValue: visible ? "on" : "off",
				values: ["on", "off"],
				description: "Toggle this model window.",
			});
		}
	}

	if (provider === "codex") {
		const codexSettings = ps as CodexProviderSettings;
		items.push(
			{
				id: "invertUsage",
				label: "Invert Usage",
				currentValue: codexSettings.invertUsage ? "on" : "off",
				values: ["on", "off"],
				description: "Show remaining-style usage for Codex.",
			},
			{
				id: "showPrimary",
				label: "Show Primary Window",
				currentValue: codexSettings.windows.showPrimary ? "on" : "off",
				values: ["on", "off"],
				description: "Show the primary usage window.",
			},
			{
				id: "showSecondary",
				label: "Show Secondary Window",
				currentValue: codexSettings.windows.showSecondary ? "on" : "off",
				values: ["on", "off"],
				description: "Show secondary windows (day/week).",
			},
		);
	}

	if (provider === "kiro") {
		const kiroSettings = ps as KiroProviderSettings;
		items.push({
			id: "showCredits",
			label: "Show Credits Window",
			currentValue: kiroSettings.windows.showCredits ? "on" : "off",
			values: ["on", "off"],
			description: "Show the credits usage window.",
		});
	}

	if (provider === "zai") {
		const zaiSettings = ps as ZaiProviderSettings;
		items.push(
			{
				id: "showTokens",
				label: "Show Tokens Window",
				currentValue: zaiSettings.windows.showTokens ? "on" : "off",
				values: ["on", "off"],
				description: "Show the tokens usage window.",
			},
			{
				id: "showMonthly",
				label: "Show Monthly Window",
				currentValue: zaiSettings.windows.showMonthly ? "on" : "off",
				values: ["on", "off"],
				description: "Show the monthly usage window.",
			},
		);
	}

	if (provider === "kimi-coding") {
		const kimiSettings = ps as KimiCodingProviderSettings;
		items.push(
			{
				id: "showWeek",
				label: "Show Week Window",
				currentValue: kimiSettings.windows.showWeek ? "on" : "off",
				values: ["on", "off"],
				description: "Show the weekly usage window.",
			},
			{
				id: "show5h",
				label: "Show 5h Window",
				currentValue: kimiSettings.windows.show5h ? "on" : "off",
				values: ["on", "off"],
				description: "Show the 5-hour usage window.",
			},
		);
	}

	return items;
}

/**
 * Apply a provider settings change in-place.
 */
export function applyProviderSettingsChange(
	settings: Settings,
	provider: ProviderName,
	id: string,
	value: string
): Settings {
	const ps = settings.providers[provider];
	if (applyBaseProviderSetting(ps, id, value)) {
		return settings;
	}

	if (provider === "anthropic") {
		const anthroSettings = ps as AnthropicProviderSettings;
		switch (id) {
			case "show5h":
				anthroSettings.windows.show5h = value === "on";
				break;
			case "show7d":
				anthroSettings.windows.show7d = value === "on";
				break;
			case "showExtra":
				anthroSettings.windows.showExtra = value === "on";
				break;
		}
	}

	if (provider === "copilot") {
		const copilotSettings = ps as CopilotProviderSettings;
		switch (id) {
			case "showMultiplier":
				copilotSettings.showMultiplier = value === "on";
				break;
			case "showRequestsLeft":
				copilotSettings.showRequestsLeft = value === "on";
				break;
			case "quotaDisplay":
				copilotSettings.quotaDisplay = value as "percentage" | "requests";
				break;
			case "showMonth":
				copilotSettings.windows.showMonth = value === "on";
				break;
		}
	}

	if (provider === "gemini") {
		const geminiSettings = ps as GeminiProviderSettings;
		switch (id) {
			case "showPro":
				geminiSettings.windows.showPro = value === "on";
				break;
			case "showFlash":
				geminiSettings.windows.showFlash = value === "on";
				break;
		}
	}

	if (provider === "antigravity") {
		const antigravitySettings = ps as AntigravityProviderSettings;
		switch (id) {
			case "showModels":
				antigravitySettings.windows.showModels = value === "on";
				break;
			case "showCurrentModel":
				antigravitySettings.showCurrentModel = value === "on";
				break;
			case "showScopedModels":
				antigravitySettings.showScopedModels = value === "on";
				break;
			default:
				if (id.startsWith("model:")) {
					const model = id.slice("model:".length);
					if (model) {
						if (!antigravitySettings.modelVisibility) {
							antigravitySettings.modelVisibility = {};
						}
						antigravitySettings.modelVisibility[model] = value === "on";
						if (!antigravitySettings.modelOrder) {
							antigravitySettings.modelOrder = [];
						}
						if (!antigravitySettings.modelOrder.includes(model)) {
							antigravitySettings.modelOrder.push(model);
						}
					}
				}
				break;
		}
	}

	if (provider === "codex") {
		const codexSettings = ps as CodexProviderSettings;
		switch (id) {
			case "invertUsage":
				codexSettings.invertUsage = value === "on";
				break;
			case "showPrimary":
				codexSettings.windows.showPrimary = value === "on";
				break;
			case "showSecondary":
				codexSettings.windows.showSecondary = value === "on";
				break;
		}
	}

	if (provider === "kiro") {
		const kiroSettings = ps as KiroProviderSettings;
		switch (id) {
			case "showCredits":
				kiroSettings.windows.showCredits = value === "on";
				break;
		}
	}

	if (provider === "zai") {
		const zaiSettings = ps as ZaiProviderSettings;
		switch (id) {
			case "showTokens":
				zaiSettings.windows.showTokens = value === "on";
				break;
			case "showMonthly":
				zaiSettings.windows.showMonthly = value === "on";
				break;
		}
	}

	if (provider === "kimi-coding") {
		const kimiSettings = ps as KimiCodingProviderSettings;
		switch (id) {
			case "showWeek":
				kimiSettings.windows.showWeek = value === "on";
				break;
			case "show5h":
				kimiSettings.windows.show5h = value === "on";
				break;
		}
	}

	return settings;
}

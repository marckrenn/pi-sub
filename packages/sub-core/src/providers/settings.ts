/**
 * Provider-specific settings helpers.
 */

import type { SettingItem } from "@earendil-works/pi-tui";
import type { ProviderName } from "../types.js";
import type { Settings, CoreProviderSettings } from "../settings-types.js";
import { CUSTOM_OPTION } from "../ui/settings-list.js";

function buildBaseProviderItems(ps: CoreProviderSettings): SettingItem[] {
	const enabledValue = ps.enabled === "auto" ? "auto" : ps.enabled === true || ps.enabled === "on" ? "on" : "off";
	return [
		{
			id: "enabled",
			label: "Enabled",
			currentValue: enabledValue,
			values: ["auto", "on", "off"],
			description: "Auto enables if credentials are detected.",
		},
		{
			id: "fetchStatus",
			label: "Fetch Status",
			currentValue: ps.fetchStatus ? "on" : "off",
			values: ["on", "off"],
			description: "Fetch status page indicator for this provider.",
		},
	];
}

function resolveEnabledValue(value: string): CoreProviderSettings["enabled"] {
	if (value === "auto") return "auto";
	return value === "on";
}

function applyBaseProviderSetting(ps: CoreProviderSettings, id: string, value: string): boolean {
	switch (id) {
		case "enabled":
			ps.enabled = resolveEnabledValue(value);
			return true;
		case "fetchStatus":
			ps.fetchStatus = value === "on";
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
	const items = buildBaseProviderItems(ps);

	if (provider === "anthropic") {
		const currencySymbol = ps.extraUsageCurrencySymbol?.trim();
		items.push(
			{
				id: "extraUsageCurrencySymbol",
				label: "Extra Usage Currency Symbol",
				currentValue: currencySymbol ? currencySymbol : "none",
				values: ["none", CUSTOM_OPTION],
				description: "Prefix symbol for Extra usage amounts.",
			},
			{
				id: "extraUsageDecimalSeparator",
				label: "Extra Usage Decimal Separator",
				currentValue: ps.extraUsageDecimalSeparator === "," ? "," : ".",
				values: [".", ","],
				description: "Decimal separator for Extra usage amounts.",
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

	switch (id) {
		case "extraUsageCurrencySymbol":
			if (value === CUSTOM_OPTION) {
				return settings;
			}
			if (value === "none") {
				delete ps.extraUsageCurrencySymbol;
				return settings;
			}
			ps.extraUsageCurrencySymbol = value;
			return settings;
		case "extraUsageDecimalSeparator":
			ps.extraUsageDecimalSeparator = value === "," ? "," : ".";
			return settings;
		default:
			return settings;
	}
}

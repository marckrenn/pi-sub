/**
 * Settings menu item builders.
 */

import type { SelectItem } from "@earendil-works/pi-tui";
import type { Settings } from "../settings-types.js";
import { PROVIDER_DISPLAY_NAMES } from "../providers/metadata.js";

export type TooltipSelectItem = SelectItem & { tooltip?: string };

export function buildMainMenuItems(settings: Settings): TooltipSelectItem[] {
	const enabledCount = Object.values(settings.providers).filter((p) => p.enabled !== "off" && p.enabled !== false).length;
	const totalCount = Object.keys(settings.providers).length;
	const toolEnabledCount = [settings.tools.usageTool, settings.tools.allUsageTool].filter(Boolean).length;
	const toolTotalCount = 2;

	return [
		{
			value: "providers",
			label: "Provider Settings",
			description: `${enabledCount}/${totalCount} enabled`,
			tooltip: "Enable providers, toggle status fetch, and adjust provider settings.",
		},
		{
			value: "behavior",
			label: "Usage Refresh Settings",
			description: `refresh ${settings.behavior.refreshInterval}s`,
			tooltip: "Control usage refresh interval and triggers.",
		},
		{
			value: "status-refresh",
			label: "Status Refresh Settings",
			description: `refresh ${settings.statusRefresh.refreshInterval}s`,
			tooltip: "Control status refresh interval and triggers.",
		},
		{
			value: "tools",
			label: "Tool Settings",
			description: `${toolEnabledCount}/${toolTotalCount} enabled`,
			tooltip: "Enable sub-core tools (requires /reload to take effect).",
		},
		{
			value: "provider-order",
			label: "Provider Order",
			description: settings.providerOrder.slice(0, 3).join(", ") + "...",
			tooltip: "Reorder providers for cycling and auto-selection.",
		},
		{
			value: "reset",
			label: "Reset to Defaults",
			description: "restore all settings",
			tooltip: "Restore all sub-core settings to defaults.",
		},
	];
}

export function buildProviderListItems(settings: Settings): TooltipSelectItem[] {
	return settings.providerOrder.map((provider) => {
		const ps = settings.providers[provider];
		const enabledValue = ps.enabled === "auto" ? "auto" : ps.enabled === true || ps.enabled === "on" ? "on" : "off";
		const statusIcon = ps.fetchStatus ? ", status fetch on" : "";
		return {
			value: `provider-${provider}`,
			label: PROVIDER_DISPLAY_NAMES[provider],
			description: `enabled ${enabledValue}${statusIcon}`,
			tooltip: `Enable ${PROVIDER_DISPLAY_NAMES[provider]} and configure status fetching.`,
		};
	});
}

export function buildProviderOrderItems(settings: Settings): TooltipSelectItem[] {
	const activeProviders = settings.providerOrder.filter((provider) => {
		const enabled = settings.providers[provider].enabled;
		return enabled !== "off" && enabled !== false;
	});
	return activeProviders.map((provider, index) => ({
		value: provider,
		label: `${index + 1}. ${PROVIDER_DISPLAY_NAMES[provider]}`,
		tooltip: "Reorder enabled providers (Space to toggle move mode).",
	}));
}


/**
 * Settings menu item builders.
 */

import type { SelectItem } from "@mariozechner/pi-tui";
import type { CoreProviderSettingsMap } from "@marckrenn/pi-sub-shared";
import type { Settings } from "../settings-types.js";
import type { ProviderName } from "../types.js";
import { PROVIDERS, PROVIDER_DISPLAY_NAMES } from "../providers/metadata.js";

export type TooltipSelectItem = SelectItem & { tooltip?: string };

export function buildMainMenuItems(settings: Settings, pinnedProvider?: ProviderName | null): TooltipSelectItem[] {
	const pinnedLabel = pinnedProvider ? PROVIDER_DISPLAY_NAMES[pinnedProvider] : "auto (current provider)";
	const kb = settings.keybindings;
	const kbDesc = `cycle: ${kb.cycleProvider}, reset: ${kb.toggleResetFormat}`;
	return [
		{
			value: "display-theme",
			label: "Themes",
			description: "save, manage, share",
			tooltip: "Save, load, and share display themes.",
		},
		{
			value: "display",
			label: "Adv. Display Settings",
			description: "layout, bars, colors",
			tooltip: "Adjust layout, colors, bar styling, status indicators, and dividers.",
		},
		{
			value: "providers",
			label: "Provider Settings",
			description: "provider specific settings",
			tooltip: "Configure provider display toggles and window visibility.",
		},
		{
			value: "pin-provider",
			label: "Provider Shown",
			description: pinnedLabel,
			tooltip: "Select which provider is shown in the widget.",
		},
		{
			value: "keybindings",
			label: "Keybindings",
			description: kbDesc,
			tooltip: "Configure keyboard shortcuts. Changes take effect after pi restart.",
		},
		{
			value: "open-core-settings",
			label: "Additional settings",
			description: "in /sub-core:settings",
			tooltip: "Open /sub-core:settings for refresh behavior and provider enablement.",
		},
	];
}

export function buildProviderListItems(settings: Settings, coreProviders?: CoreProviderSettingsMap): TooltipSelectItem[] {
	const orderedProviders = settings.providerOrder.length > 0 ? settings.providerOrder : PROVIDERS;
	const items: TooltipSelectItem[] = orderedProviders.map((provider) => {
		const ps = settings.providers[provider];
		const core = coreProviders?.[provider];
		const enabledValue = core
			? core.enabled === "auto"
				? "auto"
				: core.enabled === true || core.enabled === "on"
					? "on"
					: "off"
			: "auto";
		const status = ps.showStatus ? "status on" : "status off";
		return {
			value: `provider-${provider}`,
			label: PROVIDER_DISPLAY_NAMES[provider],
			description: `enabled ${enabledValue}, ${status}`,
			tooltip: `Configure ${PROVIDER_DISPLAY_NAMES[provider]} display settings.`,
		};
	});

	items.push({
		value: "reset-providers",
		label: "Reset Provider Defaults",
		description: "restore provider settings",
		tooltip: "Restore provider display settings to their defaults.",
	});

	return items;
}

export function buildDisplayMenuItems(): TooltipSelectItem[] {
	return [
		{
			value: "display-layout",
			label: "Layout & Structure",
			description: "alignment, wrapping, padding",
			tooltip: "Control alignment, wrapping, and padding.",
		},
		{
			value: "display-bar",
			label: "Bars",
			description: "style, width, character",
			tooltip: "Customize bar type, width, and bar styling.",
		},
		{
			value: "display-provider",
			label: "Labels & Text",
			description: "labels, titles, usage text",
			tooltip: "Adjust provider label visibility and text styling.",
		},
		{
			value: "display-reset",
			label: "Reset Timer",
			description: "position, format, wrapping",
			tooltip: "Control reset timer placement and formatting.",
		},
		{
			value: "display-status",
			label: "Status",
			description: "mode, icons, text",
			tooltip: "Configure status mode and icon packs.",
		},
		{
			value: "display-divider",
			label: "Dividers",
			description: "character, blanks, status separators",
			tooltip: "Change divider character, spacing, status separators, and widget divider lines.",
		},
		{
			value: "display-color",
			label: "Colors",
			description: "base, scheme, thresholds",
			tooltip: "Tune base colors, color scheme, and thresholds.",
		},
	];
}

export function buildDisplayThemeMenuItems(): TooltipSelectItem[] {
	return [
		{
			value: "display-theme-save",
			label: "Save Theme",
			description: "store current theme",
			tooltip: "Save the current display theme with a custom name.",
		},
		{
			value: "display-theme-load",
			label: "Load & Manage themes",
			description: "load, share, rename and delete themes",
			tooltip: "Load, share, delete, rename, and restore saved themes.",
		},
		{
			value: "display-theme-share",
			label: "Share Theme",
			description: "share current theme",
			tooltip: "Post a share string for the current theme.",
		},
		{
			value: "display-theme-import",
			label: "Import theme",
			description: "from share string",
			tooltip: "Import a shared theme string.",
		},
		{
			value: "display-theme-random",
			label: "Random theme",
			description: "generate a new theme",
			tooltip: "Generate a random display theme as inspiration or a starting point.",
		},
		{
			value: "display-theme-restore",
			label: "Restore previous state",
			description: "restore your last theme",
			tooltip: "Restore your previous display theme.",
		},
	];
}

export function buildProviderSettingsItems(settings: Settings): TooltipSelectItem[] {
	return buildProviderListItems(settings);
}

export function getProviderFromCategory(category: string): ProviderName | null {
	const match = category.match(/^provider-(\w+)$/);
	return match ? (match[1] as ProviderName) : null;
}

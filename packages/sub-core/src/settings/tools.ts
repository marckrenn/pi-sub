/**
 * Tool settings UI helpers.
 */

import type { SettingItem } from "@earendil-works/pi-tui";
import type { Settings, ToolSettings } from "../settings-types.js";

export function buildToolItems(settings: ToolSettings): SettingItem[] {
	return [
		{
			id: "usageTool",
			label: "Usage Tool",
			currentValue: settings.usageTool ? "on" : "off",
			values: ["on", "off"],
			description: "Expose sub_get_usage/get_current_usage (requires /reload).",
		},
		{
			id: "allUsageTool",
			label: "All Usage Tool",
			currentValue: settings.allUsageTool ? "on" : "off",
			values: ["on", "off"],
			description: "Expose sub_get_all_usage/get_all_usage (requires /reload).",
		},
	];
}

export function applyToolChange(settings: Settings, id: string, value: string): Settings {
	const enabled = value === "on";
	switch (id) {
		case "usageTool":
			settings.tools.usageTool = enabled;
			break;
		case "allUsageTool":
			settings.tools.allUsageTool = enabled;
			break;
	}
	return settings;
}

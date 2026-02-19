/**
 * Display settings UI helpers.
 */

import type { SettingItem } from "@mariozechner/pi-tui";
import type {
	Settings,
	BarStyle,
	BarType,
	ColorScheme,
	BarCharacter,
	DividerCharacter,
	WidgetWrapping,
	DisplayAlignment,
	BarWidth,
	DividerBlanks,
	ProviderLabel,
	BaseTextColor,
	WidgetBackgroundColor,
	ResetTimeFormat,
	ResetTimerContainment,
	StatusIndicatorMode,
	StatusIconPack,
	DividerColor,
	UsageColorTargets,
} from "../settings-types.js";
import {
	BASE_COLOR_OPTIONS,
	WIDGET_BACKGROUND_OPTIONS,
	DIVIDER_COLOR_OPTIONS,
	normalizeBaseTextColor,
	normalizeBackgroundColor,
	normalizeDividerColor,
} from "../settings-types.js";
import { CUSTOM_OPTION } from "../ui/settings-list.js";

export function buildDisplayLayoutItems(settings: Settings): SettingItem[] {
	return [
		{
			id: "showContextBar",
			label: "Show Context Bar",
			currentValue: settings.display.showContextBar ? "on" : "off",
			values: ["on", "off"],
			description: "Show context window usage as leftmost progress bar.",
		},
		{
			id: "alignment",
			label: "Alignment",
			currentValue: settings.display.alignment,
			values: ["left", "center", "right", "split"] as DisplayAlignment[],
			description: "Align the usage line inside the widget.",
		},
		{
			id: "overflow",
			label: "Overflow",
			currentValue: settings.display.overflow,
			values: ["truncate", "wrap"] as WidgetWrapping[],
			description: "Wrap the usage line or truncate with ellipsis (requires bar width ≠ fill and alignment ≠ split).",
		},
		{
			id: "paddingLeft",
			label: "Padding Left",
			currentValue: String(settings.display.paddingLeft ?? 0),
			values: ["0", "1", "2", "3", "4", CUSTOM_OPTION],
			description: "Add left padding inside the widget.",
		},
		{
			id: "paddingRight",
			label: "Padding Right",
			currentValue: String(settings.display.paddingRight ?? 0),
			values: ["0", "1", "2", "3", "4", CUSTOM_OPTION],
			description: "Add right padding inside the widget.",
		},
	];
}

export function buildDisplayResetItems(settings: Settings): SettingItem[] {
	return [
		{
			id: "resetTimePosition",
			label: "Reset Timer",
			currentValue: settings.display.resetTimePosition,
			values: ["off", "front", "back", "integrated"],
			description: "Where to show the reset timer in each window.",
		},
		{
			id: "resetTimeFormat",
			label: "Reset Timer Format",
			currentValue: settings.display.resetTimeFormat ?? "relative",
			values: ["relative", "datetime"] as ResetTimeFormat[],
			description: "Show relative countdown or reset datetime.",
		},
		{
			id: "resetTimeContainment",
			label: "Reset Timer Containment",
			currentValue: settings.display.resetTimeContainment ?? "()",
			values: ["none", "blank", "()", "[]", "<>", CUSTOM_OPTION] as ResetTimerContainment[],
			description: "Wrapping characters for the reset timer (custom supported).",
		},
	];
}

export function resolveUsageColorTargets(targets?: UsageColorTargets): UsageColorTargets {
	return {
		title: targets?.title ?? true,
		timer: targets?.timer ?? true,
		bar: targets?.bar ?? true,
		usageLabel: targets?.usageLabel ?? true,
		status: targets?.status ?? true,
	};
}

export function formatUsageColorTargetsSummary(targets?: UsageColorTargets): string {
	const resolved = resolveUsageColorTargets(targets);
	const enabled = [
		resolved.title ? "Title" : null,
		resolved.timer ? "Timer" : null,
		resolved.bar ? "Bar" : null,
		resolved.usageLabel ? "Usage label" : null,
		resolved.status ? "Status" : null,
	].filter(Boolean) as string[];
	if (enabled.length === 0) return "off";
	if (enabled.length === 5) return "all";
	return enabled.join(", ");
}

export function buildUsageColorTargetItems(settings: Settings): SettingItem[] {
	const targets = resolveUsageColorTargets(settings.display.usageColorTargets);
	return [
		{
			id: "usageColorTitle",
			label: "Title",
			currentValue: targets.title ? "on" : "off",
			values: ["on", "off"],
			description: "Color the window title by usage.",
		},
		{
			id: "usageColorTimer",
			label: "Timer",
			currentValue: targets.timer ? "on" : "off",
			values: ["on", "off"],
			description: "Color the reset timer by usage.",
		},
		{
			id: "usageColorBar",
			label: "Bar",
			currentValue: targets.bar ? "on" : "off",
			values: ["on", "off"],
			description: "Color the usage bar by usage.",
		},
		{
			id: "usageColorLabel",
			label: "Usage label",
			currentValue: targets.usageLabel ? "on" : "off",
			values: ["on", "off"],
			description: "Color the percentage text by usage.",
		},
		{
			id: "usageColorStatus",
			label: "Status",
			currentValue: targets.status ? "on" : "off",
			values: ["on", "off"],
			description: "Color the status indicator by status.",
		},
	];
}

export function buildDisplayColorItems(settings: Settings): SettingItem[] {
	return [
		{
			id: "baseTextColor",
			label: "Base Color",
			currentValue: normalizeBaseTextColor(settings.display.baseTextColor),
			values: [...BASE_COLOR_OPTIONS] as BaseTextColor[],
			description: "Base color for neutral labels and dividers.",
		},
		{
			id: "backgroundColor",
			label: "Background Color",
			currentValue: normalizeBackgroundColor(settings.display.backgroundColor),
			values: [...WIDGET_BACKGROUND_OPTIONS] as WidgetBackgroundColor[],
			description: "Background color for the widget line.",
		},
		{
			id: "colorScheme",
			label: "Color Indicator Scheme",
			currentValue: settings.display.colorScheme,
			values: [
				"base-warning-error",
				"success-base-warning-error",
				"monochrome",
			] as ColorScheme[],
			description: "Choose how usage/status indicators are color-coded.",
		},
		{
			id: "usageColorTargets",
			label: "Color Indicator Targets",
			currentValue: formatUsageColorTargetsSummary(settings.display.usageColorTargets),
			description: "Pick which elements use the indicator colors.",
		},
		{
			id: "errorThreshold",
			label: "Error Threshold (%)",
			currentValue: String(settings.display.errorThreshold),
			values: ["10", "15", "20", "25", "30", "35", "40", CUSTOM_OPTION],
			description: "Percent remaining below which usage is red.",
		},
		{
			id: "warningThreshold",
			label: "Warning Threshold (%)",
			currentValue: String(settings.display.warningThreshold),
			values: ["30", "40", "50", "60", "70", CUSTOM_OPTION],
			description: "Percent remaining below which usage is yellow.",
		},
		{
			id: "successThreshold",
			label: "Success Threshold (%)",
			currentValue: String(settings.display.successThreshold),
			values: ["60", "70", "75", "80", "90", CUSTOM_OPTION],
			description: "Percent remaining above which usage is green.",
		},
	];
}

export function buildDisplayBarItems(settings: Settings): SettingItem[] {
	const items: SettingItem[] = [
		{
			id: "barType",
			label: "Bar Type",
			currentValue: settings.display.barType,
			values: [
				"horizontal-bar",
				"horizontal-single",
				"vertical",
				"braille",
				"shade",
			] as BarType[],
			description: "Choose the bar glyph style for usage.",
		},
	];

	if (settings.display.barType === "horizontal-bar") {
		items.push({
			id: "barCharacter",
			label: "H. Bar Character",
			currentValue: settings.display.barCharacter,
			values: ["light", "heavy", "double", "block", CUSTOM_OPTION],
			description: "Custom bar character(s), set 1 or 2 (fill/empty)",
		});
	}

	items.push(
		{
			id: "barWidth",
			label: "Bar Width",
			currentValue: String(settings.display.barWidth),
			values: ["1", "4", "6", "8", "10", "12", "fill", CUSTOM_OPTION],
			description: "Set the bar width or fill available space.",
		},
		{
			id: "containBar",
			label: "Contain Bar",
			currentValue: settings.display.containBar ? "on" : "off",
			values: ["on", "off"],
			description: "Wrap the bar with ▕ and ▏ caps.",
		},
	);

	if (settings.display.barType === "braille") {
		items.push(
			{
				id: "brailleFillEmpty",
				label: "Braille Empty Fill",
				currentValue: settings.display.brailleFillEmpty ? "on" : "off",
				values: ["on", "off"],
				description: "Fill empty braille cells with dim blocks.",
			},
			{
				id: "brailleFullBlocks",
				label: "Braille Full Blocks",
				currentValue: settings.display.brailleFullBlocks ? "on" : "off",
				values: ["on", "off"],
				description: "Use full 8-dot braille blocks for filled segments.",
			},
		);
	}

	items.push({
		id: "barStyle",
		label: "Bar Style",
		currentValue: settings.display.barStyle,
		values: ["bar", "percentage", "both"] as BarStyle[],
		description: "Show bar, percentage, or both.",
	});

	return items;
}

export function buildDisplayProviderItems(settings: Settings): SettingItem[] {
	return [
		{
			id: "showProviderName",
			label: "Show Provider Name",
			currentValue: settings.display.showProviderName ? "on" : "off",
			values: ["on", "off"],
			description: "Toggle the provider name prefix.",
		},
		{
			id: "providerLabel",
			label: "Provider Label",
			currentValue: settings.display.providerLabel,
			values: ["none", "plan", "subscription", "sub", CUSTOM_OPTION] as (ProviderLabel | typeof CUSTOM_OPTION)[],
			description: "Suffix appended after the provider name.",
		},
		{
			id: "providerLabelColon",
			label: "Provider Label Colon",
			currentValue: settings.display.providerLabelColon ? "on" : "off",
			values: ["on", "off"],
			description: "Show a colon after the provider label.",
		},
		{
			id: "providerLabelBold",
			label: "Show in Bold",
			currentValue: settings.display.providerLabelBold ? "on" : "off",
			values: ["on", "off"],
			description: "Bold the provider name and colon.",
		},
		{
			id: "showUsageLabels",
			label: "Show Usage Labels",
			currentValue: settings.display.showUsageLabels ? "on" : "off",
			values: ["on", "off"],
			description: "Show “used/rem.” labels after percentages.",
		},
		{
			id: "showWindowTitle",
			label: "Show Title",
			currentValue: settings.display.showWindowTitle ? "on" : "off",
			values: ["on", "off"],
			description: "Show window titles like 5h, Week, etc.",
		},
		{
			id: "boldWindowTitle",
			label: "Bold Title",
			currentValue: settings.display.boldWindowTitle ? "on" : "off",
			values: ["on", "off"],
			description: "Bold window titles like 5h, Week, etc.",
		},
	];
}

const STATUS_ICON_PACK_PREVIEW = {
	minimal: "minimal (✓ ⚠ × ?)",
	emoji: "emoji (✅ ⚠️ 🔴 ❓)",
	faces: "faces (😎 😳 😵 🤔)",
} as const;

const STATUS_ICON_FACES_PRESET = "😎😳😵🤔";

const STATUS_ICON_CUSTOM_FALLBACK = ["✓", "⚠", "×", "?"];
const STATUS_ICON_CUSTOM_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function resolveCustomStatusIcons(value?: string): [string, string, string, string] {
	if (!value) return STATUS_ICON_CUSTOM_FALLBACK as [string, string, string, string];
	const segments = Array.from(STATUS_ICON_CUSTOM_SEGMENTER.segment(value), (entry) => entry.segment)
		.map((segment) => segment.trim())
		.filter(Boolean);
	if (segments.length < 3) return STATUS_ICON_CUSTOM_FALLBACK as [string, string, string, string];
	if (segments.length === 3) {
		return [segments[0], segments[1], segments[2], STATUS_ICON_CUSTOM_FALLBACK[3]] as [string, string, string, string];
	}
	return [segments[0], segments[1], segments[2], segments[3]] as [string, string, string, string];
}

function formatCustomStatusIcons(value?: string): string {
	return resolveCustomStatusIcons(value).join(" ");
}

function formatStatusIconPack(pack: Exclude<StatusIconPack, "custom">): string {
	return STATUS_ICON_PACK_PREVIEW[pack] ?? pack;
}

function parseStatusIconPack(value: string): StatusIconPack {
	if (value.startsWith("minimal")) return "minimal";
	if (value.startsWith("emoji")) return "emoji";
	return "emoji";
}

export function buildDisplayStatusItems(settings: Settings): SettingItem[] {
	const rawMode = settings.display.statusIndicatorMode ?? "icon";
	const mode: StatusIndicatorMode = rawMode === "text" || rawMode === "icon+text" || rawMode === "icon"
		? rawMode
		: "icon";
	const items: SettingItem[] = [
		{
			id: "statusIndicatorMode",
			label: "Status Mode",
			currentValue: mode,
			values: ["icon", "text", "icon+text"] as StatusIndicatorMode[],
			description: "Use icons, text, or both for status indicators.",
		},
	];

	if (mode === "icon" || mode === "icon+text") {
		const pack = settings.display.statusIconPack ?? "emoji";
		const customIcons = settings.display.statusIconCustom;
		items.push({
			id: "statusIconPack",
			label: "Status Icon Pack",
			currentValue: pack === "custom" ? formatCustomStatusIcons(customIcons) : formatStatusIconPack(pack),
			values: [
				formatStatusIconPack("minimal"),
				formatStatusIconPack("emoji"),
				STATUS_ICON_PACK_PREVIEW.faces,
				CUSTOM_OPTION,
			],
			description: "Pick the icon set used for status indicators. Choose custom to edit icons (OK/warn/error/unknown).",
		});
	}

	items.push(
		{
			id: "statusDismissOk",
			label: "Dismiss Operational Status",
			currentValue: settings.display.statusDismissOk ? "on" : "off",
			values: ["on", "off"],
			description: "Hide status indicators when there are no incidents.",
		}
	);

	return items;
}

export function buildDisplayDividerItems(settings: Settings): SettingItem[] {
	return [
		{
			id: "dividerCharacter",
			label: "Divider Character",
			currentValue: settings.display.dividerCharacter,
			values: ["none", "blank", "|", "│", "┃", "┆", "┇", "║", "•", "●", "○", "◇", CUSTOM_OPTION] as DividerCharacter[],
			description: "Choose the divider glyph between windows.",
		},
		{
			id: "dividerColor",
			label: "Divider Color",
			currentValue: normalizeDividerColor(settings.display.dividerColor ?? "borderMuted"),
			values: [...DIVIDER_COLOR_OPTIONS] as DividerColor[],
			description: "Color used for divider glyphs and lines.",
		},
		{
			id: "statusProviderDivider",
			label: "Status/Provider Divider",
			currentValue: settings.display.statusProviderDivider ? "on" : "off",
			values: ["on", "off"],
			description: "Add a divider between status and provider label.",
		},
		{
			id: "dividerBlanks",
			label: "Blanks Before/After Divider",
			currentValue: String(settings.display.dividerBlanks),
			values: ["0", "1", "2", "3", "fill", CUSTOM_OPTION],
			description: "Padding around the divider character.",
		},
		{
			id: "showProviderDivider",
			label: "Show Provider Divider",
			currentValue: settings.display.showProviderDivider ? "on" : "off",
			values: ["on", "off"],
			description: "Show the divider after the provider label.",
		},
		{
			id: "showTopDivider",
			label: "Show Top Divider",
			currentValue: settings.display.showTopDivider ? "on" : "off",
			values: ["on", "off"],
			description: "Show a divider line above the widget.",
		},
		{
			id: "showBottomDivider",
			label: "Show Bottom Divider",
			currentValue: settings.display.showBottomDivider ? "on" : "off",
			values: ["on", "off"],
			description: "Show a divider line below the widget.",
		},
		{
			id: "dividerFooterJoin",
			label: "Connect Dividers",
			currentValue: settings.display.dividerFooterJoin ? "on" : "off",
			values: ["on", "off"],
			description: "Draw reverse-T connectors for top/bottom dividers.",
		},

	];
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function parseClampedNumber(value: string, min: number, max: number): number | null {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) return null;
	return clampNumber(parsed, min, max);
}

export function applyDisplayChange(settings: Settings, id: string, value: string): Settings {
	switch (id) {
		case "alignment":
			settings.display.alignment = value as DisplayAlignment;
			break;
		case "barType":
			settings.display.barType = value as BarType;
			break;
		case "barStyle":
			settings.display.barStyle = value as BarStyle;
			break;
		case "barWidth": {
			if (value === "fill") {
				settings.display.barWidth = "fill" as BarWidth;
				break;
			}
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.barWidth = parsed;
			}
			break;
		}
		case "containBar":
			settings.display.containBar = value === "on";
			break;
		case "barCharacter":
			settings.display.barCharacter = value as BarCharacter;
			break;
		case "brailleFillEmpty":
			settings.display.brailleFillEmpty = value === "on";
			break;
		case "brailleFullBlocks":
			settings.display.brailleFullBlocks = value === "on";
			break;
		case "colorScheme":
			settings.display.colorScheme = value as ColorScheme;
			break;
		case "usageColorTitle":
			settings.display.usageColorTargets = {
				...resolveUsageColorTargets(settings.display.usageColorTargets),
				title: value === "on",
			};
			break;
		case "usageColorTimer":
			settings.display.usageColorTargets = {
				...resolveUsageColorTargets(settings.display.usageColorTargets),
				timer: value === "on",
			};
			break;
		case "usageColorBar":
			settings.display.usageColorTargets = {
				...resolveUsageColorTargets(settings.display.usageColorTargets),
				bar: value === "on",
			};
			break;
		case "usageColorLabel":
			settings.display.usageColorTargets = {
				...resolveUsageColorTargets(settings.display.usageColorTargets),
				usageLabel: value === "on",
			};
			break;
		case "usageColorStatus":
			settings.display.usageColorTargets = {
				...resolveUsageColorTargets(settings.display.usageColorTargets),
				status: value === "on",
			};
			break;
		case "usageColorTargets":
			settings.display.usageColorTargets = resolveUsageColorTargets(settings.display.usageColorTargets);
			break;
		case "resetTimePosition":
			settings.display.resetTimePosition = value as "off" | "front" | "back" | "integrated";
			break;
		case "resetTimeFormat":
			settings.display.resetTimeFormat = value as ResetTimeFormat;
			break;
		case "resetTimeContainment":
			if (value === CUSTOM_OPTION) {
				break;
			}
			settings.display.resetTimeContainment = value as ResetTimerContainment;
			break;
		case "statusIndicatorMode":
			settings.display.statusIndicatorMode = value as StatusIndicatorMode;
			break;
		case "statusIconPack":
			if (value === CUSTOM_OPTION) {
				settings.display.statusIconPack = "custom";
				break;
			}
			if (value.startsWith("minimal") || value.startsWith("emoji")) {
				settings.display.statusIconPack = parseStatusIconPack(value);
				break;
			}
			if (value.startsWith("faces")) {
				settings.display.statusIconCustom = STATUS_ICON_FACES_PRESET;
				settings.display.statusIconPack = "custom";
				break;
			}
			settings.display.statusIconCustom = value;
			settings.display.statusIconPack = "custom";
			break;
		case "statusIconCustom":
			settings.display.statusIconCustom = value;
			settings.display.statusIconPack = "custom";
			break;
		case "statusProviderDivider":
			settings.display.statusProviderDivider = value === "on";
			break;
		case "statusDismissOk":
			settings.display.statusDismissOk = value === "on";
			break;
		case "showProviderName":
			settings.display.showProviderName = value === "on";
			break;
		case "providerLabel":
			settings.display.providerLabel = value as ProviderLabel;
			break;
		case "providerLabelColon":
			settings.display.providerLabelColon = value === "on";
			break;
		case "providerLabelBold":
			settings.display.providerLabelBold = value === "on";
			break;
		case "baseTextColor":
			settings.display.baseTextColor = normalizeBaseTextColor(value);
			break;
		case "backgroundColor":
			settings.display.backgroundColor = normalizeBackgroundColor(value);
			break;
		case "showUsageLabels":
			settings.display.showUsageLabels = value === "on";
			break;
		case "showWindowTitle":
			settings.display.showWindowTitle = value === "on";
			break;
		case "boldWindowTitle":
			settings.display.boldWindowTitle = value === "on";
			break;
		case "showContextBar":
			settings.display.showContextBar = value === "on";
			break;
		case "paddingLeft": {
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.paddingLeft = parsed;
			}
			break;
		}
		case "paddingRight": {
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.paddingRight = parsed;
			}
			break;
		}
		case "dividerCharacter":
			settings.display.dividerCharacter = value as DividerCharacter;
			break;
		case "dividerColor":
			settings.display.dividerColor = normalizeDividerColor(value);
			break;
		case "dividerBlanks": {
			if (value === "fill") {
				settings.display.dividerBlanks = "fill" as DividerBlanks;
				break;
			}
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.dividerBlanks = parsed;
			}
			break;
		}
		case "showProviderDivider":
			settings.display.showProviderDivider = value === "on";
			break;
		case "dividerFooterJoin":
			settings.display.dividerFooterJoin = value === "on";
			break;
		case "showTopDivider":
			settings.display.showTopDivider = value === "on";
			break;
		case "showBottomDivider":
			settings.display.showBottomDivider = value === "on";
			break;
		case "overflow":
			settings.display.overflow = value as WidgetWrapping;
			break;
		case "widgetWrapping":
			settings.display.overflow = value as WidgetWrapping;
			break;
		case "errorThreshold": {
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.errorThreshold = parsed;
			}
			break;
		}
		case "warningThreshold": {
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.warningThreshold = parsed;
			}
			break;
		}
		case "successThreshold": {
			const parsed = parseClampedNumber(value, 0, 100);
			if (parsed !== null) {
				settings.display.successThreshold = parsed;
			}
			break;
		}
	}
	return settings;
}

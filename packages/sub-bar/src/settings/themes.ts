import type { Settings } from "../settings-types.js";
import type { TooltipSelectItem } from "./menu.js";

type DisplaySettings = Settings["display"];
type BarType = DisplaySettings["barType"];
type BarStyle = DisplaySettings["barStyle"];
type BarCharacter = DisplaySettings["barCharacter"];
type BarWidth = DisplaySettings["barWidth"];
type DividerCharacter = DisplaySettings["dividerCharacter"];
type DividerBlanks = DisplaySettings["dividerBlanks"];
type DisplayAlignment = DisplaySettings["alignment"];
type OverflowMode = DisplaySettings["overflow"];
type BaseTextColor = DisplaySettings["baseTextColor"];
type DividerColor = DisplaySettings["dividerColor"];
type ResetTimeFormat = DisplaySettings["resetTimeFormat"];
type ResetTimerContainment = DisplaySettings["resetTimeContainment"];
type StatusIndicatorMode = DisplaySettings["statusIndicatorMode"];
type StatusIconPack = DisplaySettings["statusIconPack"];
type ProviderLabel = DisplaySettings["providerLabel"];

const RANDOM_BAR_TYPES: BarType[] = ["horizontal-bar", "horizontal-single", "vertical", "braille", "shade"];
const RANDOM_BAR_STYLES: BarStyle[] = ["bar", "percentage", "both"];
const RANDOM_BAR_WIDTHS: BarWidth[] = [1, 4, 6, 8, 10, 12, "fill"];
const RANDOM_BAR_CHARACTERS: BarCharacter[] = [
	"light",
	"heavy",
	"double",
	"block",
	"▮▯",
	"■□",
	"●○",
	"▲△",
	"◆◇",
	"🚀_",
];
const RANDOM_ALIGNMENTS: DisplayAlignment[] = ["left", "center", "right", "split"];
const RANDOM_OVERFLOW: OverflowMode[] = ["truncate", "wrap"];
const RANDOM_RESET_POSITIONS: DisplaySettings["resetTimePosition"][] = ["off", "front", "back", "integrated"];
const RANDOM_RESET_FORMATS: ResetTimeFormat[] = ["relative", "datetime"];
const RANDOM_RESET_CONTAINMENTS: ResetTimerContainment[] = ["none", "blank", "()", "[]", "<>"];
const RANDOM_STATUS_MODES: StatusIndicatorMode[] = ["icon", "text", "icon+text"];
const RANDOM_STATUS_PACKS: StatusIconPack[] = ["minimal", "emoji"];
const RANDOM_PROVIDER_LABELS: ProviderLabel[] = ["plan", "subscription", "sub", "none"];
const RANDOM_DIVIDER_CHARACTERS: DividerCharacter[] = ["none", "blank", "|", "│", "┃", "┆", "┇", "║", "•", "●", "○", "◇"];
const RANDOM_DIVIDER_BLANKS: DividerBlanks[] = [0, 1, 2, 3];
const RANDOM_COLOR_SCHEMES: DisplaySettings["colorScheme"][] = [
	"base-warning-error",
	"success-base-warning-error",
	"monochrome",
];
const RANDOM_BASE_TEXT_COLORS: BaseTextColor[] = ["dim", "muted", "text", "primary", "success", "warning", "error", "border", "borderMuted"];
const RANDOM_BACKGROUND_COLORS: BaseTextColor[] = [
	"text",
	"selectedBg",
	"userMessageBg",
	"customMessageBg",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
];
const RANDOM_DIVIDER_COLORS: DividerColor[] = [
	"primary",
	"text",
	"muted",
	"dim",
	"success",
	"warning",
	"error",
	"border",
	"borderMuted",
	"borderAccent",
];
const RANDOM_PADDING: number[] = [0, 1, 2, 3, 4];

function pickRandom<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)] ?? items[0]!;
}

function randomBool(probability = 0.5): boolean {
	return Math.random() < probability;
}

const THEME_ID_LENGTH = 24;
const THEME_ID_FALLBACK = "theme";

function buildThemeId(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, THEME_ID_LENGTH) || THEME_ID_FALLBACK;
}

export interface DisplayThemeTarget {
	id?: string;
	name: string;
	display: Settings["display"];
	deletable: boolean;
}

export function buildDisplayThemeItems(
	settings: Settings,
): TooltipSelectItem[] {
	const items: TooltipSelectItem[] = [];
	items.push({
		value: "user",
		label: "Restore backup",
		description: "restore your last theme",
		tooltip: "Restore your previous display theme.",
	});
	items.push({
		value: "default",
		label: "Default",
		description: "restore default settings",
		tooltip: "Reset display settings to defaults.",
	});
	items.push({
		value: "minimal",
		label: "Default Minimal",
		description: "compact display",
		tooltip: "Apply the default minimal theme.",
	});
	for (const theme of settings.displayThemes) {
		const description = theme.source === "imported" ? "manually imported theme" : "manually saved theme";
		items.push({
			value: `theme:${theme.id}`,
			label: theme.name,
			description,
			tooltip: `Manage ${theme.name}.`,
		});
	}
	return items;
}

export function resolveDisplayThemeTarget(
	value: string,
	settings: Settings,
	defaults: Settings,
	fallbackUser: Settings["display"] | null,
): DisplayThemeTarget | null {
	if (value === "user") {
		const display = settings.displayUserTheme ?? fallbackUser ?? settings.display;
		return { name: "Restore backup", display, deletable: false };
	}
	if (value === "default") {
		return { name: "Default", display: { ...defaults.display }, deletable: false };
	}
	if (value === "minimal") {
		return {
			name: "Default Minimal",
			display: {
				...defaults.display,
				alignment: "split",
				barStyle: "percentage",
				barType: "horizontal-bar",
				barWidth: 1,
				barCharacter: "heavy",
				containBar: true,
				brailleFillEmpty: false,
				brailleFullBlocks: false,
				colorScheme: "base-warning-error",
				usageColorTargets: {
					title: true,
					timer: true,
					bar: true,
					usageLabel: true,
					status: true,
				},
				resetTimePosition: "off",
				resetTimeFormat: "relative",
				resetTimeContainment: "blank",
				statusIndicatorMode: "icon",
				statusIconPack: "minimal",
				statusProviderDivider: false,
				statusDismissOk: true,
				showProviderName: false,
				providerLabel: "none",
				providerLabelColon: false,
				providerLabelBold: true,
				baseTextColor: "muted",
				backgroundColor: "text",
				showWindowTitle: false,
				boldWindowTitle: true,
				showUsageLabels: false,
				dividerCharacter: "none",
				dividerColor: "dim",
				dividerBlanks: 1,
				showProviderDivider: true,
				statusLeadingDivider: false,
				statusTrailingDivider: false,
				dividerFooterJoin: true,
				showTopDivider: false,
				showBottomDivider: false,
				paddingLeft: 1,
				paddingRight: 1,
				widgetPlacement: "belowEditor",
				errorThreshold: 25,
				warningThreshold: 50,
				overflow: "truncate",
				successThreshold: 75,
			},
			deletable: false,
		};
	}
	if (value.startsWith("theme:")) {
		const id = value.replace("theme:", "");
		const theme = settings.displayThemes.find((entry) => entry.id === id);
		if (!theme) return null;
		return { id: theme.id, name: theme.name, display: theme.display, deletable: true };
	}
	return null;
}

export function buildRandomDisplay(base: DisplaySettings): DisplaySettings {
	const display: DisplaySettings = { ...base };

	display.alignment = pickRandom(RANDOM_ALIGNMENTS);
	display.overflow = pickRandom(RANDOM_OVERFLOW);
	const padding = pickRandom(RANDOM_PADDING);
	display.paddingLeft = padding;
	display.paddingRight = padding;
	display.barStyle = pickRandom(RANDOM_BAR_STYLES);
	display.barType = pickRandom(RANDOM_BAR_TYPES);
	display.barWidth = pickRandom(RANDOM_BAR_WIDTHS);
	display.barCharacter = pickRandom(RANDOM_BAR_CHARACTERS);
	display.containBar = randomBool();
	display.brailleFillEmpty = randomBool();
	display.brailleFullBlocks = randomBool();
	display.colorScheme = pickRandom(RANDOM_COLOR_SCHEMES);

	const usageColorTargets = {
		title: randomBool(),
		timer: randomBool(),
		bar: randomBool(),
		usageLabel: randomBool(),
		status: randomBool(),
	};
	if (!usageColorTargets.title && !usageColorTargets.timer && !usageColorTargets.bar && !usageColorTargets.usageLabel && !usageColorTargets.status) {
		usageColorTargets.bar = true;
	}
	display.usageColorTargets = usageColorTargets;
	display.resetTimePosition = pickRandom(RANDOM_RESET_POSITIONS);
	display.resetTimeFormat = pickRandom(RANDOM_RESET_FORMATS);
	display.resetTimeContainment = pickRandom(RANDOM_RESET_CONTAINMENTS);
	display.statusIndicatorMode = pickRandom(RANDOM_STATUS_MODES);
	display.statusIconPack = pickRandom(RANDOM_STATUS_PACKS);
	display.statusProviderDivider = randomBool();
	display.statusDismissOk = randomBool();
	display.showProviderName = randomBool();
	display.providerLabel = pickRandom(RANDOM_PROVIDER_LABELS);
	display.providerLabelColon = display.providerLabel !== "none" && randomBool();
	display.providerLabelBold = randomBool();
	display.baseTextColor = pickRandom(RANDOM_BASE_TEXT_COLORS);
	display.backgroundColor = pickRandom(RANDOM_BACKGROUND_COLORS);
	display.boldWindowTitle = randomBool();
	display.showUsageLabels = randomBool();
	display.dividerCharacter = pickRandom(RANDOM_DIVIDER_CHARACTERS);
	display.dividerColor = pickRandom(RANDOM_DIVIDER_COLORS);
	display.dividerBlanks = pickRandom(RANDOM_DIVIDER_BLANKS);
	display.showProviderDivider = randomBool();
	display.statusLeadingDivider = randomBool();
	display.statusTrailingDivider = randomBool();
	display.dividerFooterJoin = randomBool();
	display.showTopDivider = randomBool();
	display.showBottomDivider = randomBool();

	if (display.dividerCharacter === "none") {
		display.showProviderDivider = false;
		display.statusLeadingDivider = false;
		display.statusTrailingDivider = false;
		display.dividerFooterJoin = false;
		display.showTopDivider = false;
		display.showBottomDivider = false;
	}
	if (display.providerLabel === "none") {
		display.providerLabelColon = false;
	}

	return display;
}

export function buildThemeActionItems(target: DisplayThemeTarget): TooltipSelectItem[] {
	const items: TooltipSelectItem[] = [
		{
			value: "load",
			label: "Load",
			description: "apply this theme",
			tooltip: "Apply the selected theme.",
		},
		{
			value: "share",
			label: "Share",
			description: "post share string",
			tooltip: "Post a shareable theme string to chat.",
		},
	];
	if (target.deletable) {
		items.push({
			value: "rename",
			label: "Rename",
			description: "rename saved theme",
			tooltip: "Rename this saved theme.",
		});
		items.push({
			value: "delete",
			label: "Delete",
			description: "remove saved theme",
			tooltip: "Remove this theme from saved themes.",
		});
	}
	return items;
}

export function upsertDisplayTheme(
	settings: Settings,
	name: string,
	display: Settings["display"],
	source?: "saved" | "imported",
): Settings {
	const trimmed = name.trim() || "Theme";
	const id = buildThemeId(trimmed);
	const snapshot = { ...display };
	const existing = settings.displayThemes.find((theme) => theme.id === id);
	const resolvedSource = source ?? existing?.source ?? "saved";
	if (existing) {
		existing.name = trimmed;
		existing.display = snapshot;
		existing.source = resolvedSource;
	} else {
		settings.displayThemes.push({ id, name: trimmed, display: snapshot, source: resolvedSource });
	}
	return settings;
}

export function renameDisplayTheme(settings: Settings, id: string, name: string): Settings {
	const trimmed = name.trim() || "Theme";
	const nextId = buildThemeId(trimmed);
	const existing = settings.displayThemes.find((theme) => theme.id === id);
	if (!existing) return settings;
	if (nextId === id) {
		existing.name = trimmed;
		return settings;
	}
	const collision = settings.displayThemes.find((theme) => theme.id === nextId);
	if (collision) {
		collision.name = trimmed;
		collision.display = existing.display;
		collision.source = existing.source;
		settings.displayThemes = settings.displayThemes.filter((theme) => theme.id !== id);
		return settings;
	}
	existing.id = nextId;
	existing.name = trimmed;
	return settings;
}

export function saveDisplayTheme(settings: Settings, name: string): Settings {
	return upsertDisplayTheme(settings, name, settings.display, "saved");
}

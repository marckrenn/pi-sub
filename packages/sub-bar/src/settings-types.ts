/**
 * Settings types and defaults for sub-bar
 */

import type { CoreSettings, ProviderName } from "@marckrenn/pi-sub-shared";
import { PROVIDERS } from "@marckrenn/pi-sub-shared";
import type { ThemeColor } from "@mariozechner/pi-coding-agent";

/**
 * Bar display style
 */
export type BarStyle = "bar" | "percentage" | "both";

/**
 * Bar rendering type
 */
export type BarType = "horizontal-bar" | "horizontal-single" | "vertical" | "braille" | "shade";

/**
 * Color scheme for usage bars
 */
export type ColorScheme = "monochrome" | "base-warning-error" | "success-base-warning-error";

/**
 * Progress bar character style
 */
export type BarCharacter = "light" | "heavy" | "double" | "block" | (string & {});

/**
 * Divider character style
 */
export type DividerCharacter =
	| "none"
	| "blank"
	| "|"
	| "│"
	| "┃"
	| "┆"
	| "┇"
	| "║"
	| "•"
	| "●"
	| "○"
	| "◇"
	| (string & {});

/**
 * Widget overflow mode
 */
export type OverflowMode = "truncate" | "wrap";
export type WidgetWrapping = OverflowMode;

/**
 * Widget placement
 */
export type WidgetPlacement = "belowEditor";

/**
 * Alignment for the widget
 */
export type DisplayAlignment = "left" | "center" | "right" | "split";

/**
 * Provider label prefix
 */
export type ProviderLabel = "plan" | "subscription" | "sub" | "none" | (string & {});

/**
 * Reset timer format
 */
export type ResetTimeFormat = "relative" | "datetime";

/**
 * Reset timer containment style
 */
export type ResetTimerContainment = "none" | "blank" | "()" | "[]" | "<>" | (string & {});

/**
 * Status indicator display mode
 */
export type StatusIndicatorMode = "icon" | "text" | "icon+text";

/**
 * Status icon pack selection
 */
export type StatusIconPack = "minimal" | "emoji" | "custom";

export interface UsageColorTargets {
	title: boolean;
	timer: boolean;
	bar: boolean;
	usageLabel: boolean;
	status: boolean;
}

/**
 * Divider color options (subset of theme colors).
 */
export const DIVIDER_COLOR_OPTIONS = [
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
] as const;

export type DividerColor = (typeof DIVIDER_COLOR_OPTIONS)[number];

/**
 * Background color options (theme background colors).
 */
export const BACKGROUND_COLOR_OPTIONS = [
	"selectedBg",
	"userMessageBg",
	"customMessageBg",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
] as const;

export type BackgroundColor = (typeof BACKGROUND_COLOR_OPTIONS)[number];

/**
 * Base text/background color options.
 */
export const BASE_COLOR_OPTIONS = [...DIVIDER_COLOR_OPTIONS, ...BACKGROUND_COLOR_OPTIONS] as const;

/**
 * Base text color for widget labels
 */
export type BaseTextColor = (typeof BASE_COLOR_OPTIONS)[number];

/**
 * Background options for the widget line.
 */
export const WIDGET_BACKGROUND_OPTIONS = ["none", ...BASE_COLOR_OPTIONS] as const;

export type WidgetBackgroundColor = (typeof WIDGET_BACKGROUND_OPTIONS)[number];

export function normalizeDividerColor(value?: string): DividerColor {
	if (!value) return "borderMuted";
	if (value === "accent" || value === "primary") return "primary";
	if ((DIVIDER_COLOR_OPTIONS as readonly string[]).includes(value)) {
		return value as DividerColor;
	}
	return "borderMuted";
}

export function resolveDividerColor(value?: string): ThemeColor {
	const normalized = normalizeDividerColor(value);
	switch (normalized) {
		case "primary":
			return "accent";
		case "border":
		case "borderMuted":
		case "borderAccent":
		case "success":
		case "warning":
		case "error":
		case "muted":
		case "dim":
		case "text":
			return normalized as ThemeColor;
		default:
			return "borderMuted";
	}
}

export function isBackgroundColor(value?: BaseTextColor): value is BackgroundColor {
	return !!value && (BACKGROUND_COLOR_OPTIONS as readonly string[]).includes(value);
}

export function normalizeBaseTextColor(value?: string): BaseTextColor {
	if (!value) return "dim";
	if (value === "accent" || value === "primary") return "primary";
	if ((BASE_COLOR_OPTIONS as readonly string[]).includes(value)) {
		return value as BaseTextColor;
	}
	return "dim";
}

export function normalizeBackgroundColor(value?: string): WidgetBackgroundColor {
	if (!value || value === "none" || value === "transparent") return "none";
	if (value === "accent" || value === "primary") return "primary";
	if ((BASE_COLOR_OPTIONS as readonly string[]).includes(value)) {
		return value as BaseTextColor;
	}
	return "none";
}

export function resolveBaseTextColor(value?: string): BaseTextColor {
	return normalizeBaseTextColor(value);
}

export function resolveBackgroundColor(value?: string): WidgetBackgroundColor {
	return normalizeBackgroundColor(value);
}

/**
 * Bar width configuration
 */
export type BarWidth = number | "fill";

/**
 * Divider blank spacing configuration
 */
export type DividerBlanks = number | "fill";

/**
 * Provider settings (UI-only)
 */
export interface BaseProviderSettings {
	/** Show status indicator */
	showStatus: boolean;
}

export interface AnthropicProviderSettings extends BaseProviderSettings {
	windows: {
		show5h: boolean;
		show7d: boolean;
		showExtra: boolean;
	};
}

export interface CopilotProviderSettings extends BaseProviderSettings {
	showMultiplier: boolean;
	showRequestsLeft: boolean;
	quotaDisplay: "percentage" | "requests";
	windows: {
		showMonth: boolean;
	};
}

export interface GeminiProviderSettings extends BaseProviderSettings {
	windows: {
		showPro: boolean;
		showFlash: boolean;
	};
}

export interface AntigravityProviderSettings extends BaseProviderSettings {
	showCurrentModel: boolean;
	showScopedModels: boolean;
	windows: {
		showModels: boolean;
	};
	modelVisibility: Record<string, boolean>;
	modelOrder: string[];
}

export interface CodexProviderSettings extends BaseProviderSettings {
	invertUsage: boolean;
	windows: {
		showPrimary: boolean;
		showSecondary: boolean;
	};
}

export interface KiroProviderSettings extends BaseProviderSettings {
	windows: {
		showCredits: boolean;
	};
}

export interface ZaiProviderSettings extends BaseProviderSettings {
	windows: {
		showTokens: boolean;
		showMonthly: boolean;
	};
}

export interface ProviderSettingsMap {
	anthropic: AnthropicProviderSettings;
	copilot: CopilotProviderSettings;
	gemini: GeminiProviderSettings;
	antigravity: AntigravityProviderSettings;
	codex: CodexProviderSettings;
	kiro: KiroProviderSettings;
	zai: ZaiProviderSettings;
}

export type { BehaviorSettings, CoreSettings } from "@marckrenn/pi-sub-shared";

/**
 * Keybinding settings.
 * Values are key-combo strings accepted by pi's registerShortcut (e.g. "ctrl+alt+p").
 * Use "none" to disable a shortcut.
 * Changes take effect after pi restart.
 */
export interface KeybindingSettings {
	/** Shortcut to cycle through providers */
	cycleProvider: string;
	/** Shortcut to toggle reset timer format */
	toggleResetFormat: string;
}

/**
 * Display settings
 */
export interface DisplaySettings {
	/** Alignment */
	alignment: DisplayAlignment;
	/** Bar display style */
	barStyle: BarStyle;
	/** Bar type */
	barType: BarType;
	/** Width of the progress bar in characters */
	barWidth: BarWidth;
	/** Progress bar character */
	barCharacter: BarCharacter;
	/** Contain bar within ▕ and ▏ */
	containBar: boolean;
	/** Fill empty braille segments with dim full blocks */
	brailleFillEmpty: boolean;
	/** Use full braille blocks for filled segments */
	brailleFullBlocks: boolean;
	/** Color scheme for bars */
	colorScheme: ColorScheme;
	/** Elements colored by the usage scheme */
	usageColorTargets: UsageColorTargets;
	/** Reset time display position */
	resetTimePosition: "off" | "front" | "back" | "integrated";
	/** Reset time format */
	resetTimeFormat: ResetTimeFormat;
	/** Reset timer containment */
	resetTimeContainment: ResetTimerContainment;
	/** Status indicator mode */
	statusIndicatorMode: StatusIndicatorMode;
	/** Status icon pack */
	statusIconPack: StatusIconPack;
	/** Custom status icon pack (four characters) */
	statusIconCustom: string;
	/** Show divider between status and provider */
	statusProviderDivider: boolean;
	/** Dismiss status when operational */
	statusDismissOk: boolean;
	/** Show provider display name */
	showProviderName: boolean;
	/** Provider label prefix */
	providerLabel: ProviderLabel;
	/** Show colon after provider label */
	providerLabelColon: boolean;
	/** Bold provider name and colon */
	providerLabelBold: boolean;
	/** Base text color for widget labels */
	baseTextColor: BaseTextColor;
	/** Background color for the widget line */
	backgroundColor: WidgetBackgroundColor;
	/** Show window titles (5h, Week, etc.) */
	showWindowTitle: boolean;
	/** Bold window titles (5h, Week, etc.) */
	boldWindowTitle: boolean;
	/** Show usage labels (used/rem.) */
	showUsageLabels: boolean;
	/** Divider character */
	dividerCharacter: DividerCharacter;
	/** Divider color */
	dividerColor: DividerColor;
	/** Blanks before and after divider */
	dividerBlanks: DividerBlanks;
	/** Show divider between provider label and usage */
	showProviderDivider: boolean;
	/** Connect divider glyphs to the bottom divider line */
	dividerFooterJoin: boolean;
	/** Show divider line above the bar */
	showTopDivider: boolean;
	/** Show divider line below the bar */
	showBottomDivider: boolean;
	/** Widget overflow mode */
	overflow: OverflowMode;
	/** Left padding inside widget */
	paddingLeft: number;
	/** Right padding inside widget */
	paddingRight: number;
	/** Widget placement */
	widgetPlacement: WidgetPlacement;
	/** Show context window usage as leftmost progress bar */
	showContextBar: boolean;
	/** Error threshold (percentage remaining below this = red) */
	errorThreshold: number;
	/** Warning threshold (percentage remaining below this = yellow) */
	warningThreshold: number;
	/** Success threshold (percentage remaining above this = green, gradient only) */
	successThreshold: number;
}


/**
 * All settings
 */
export interface DisplayTheme {
	id: string;
	name: string;
	display: DisplaySettings;
	source?: "saved" | "imported";
}

export interface Settings extends Omit<CoreSettings, "providers"> {
	/** Version for migration */
	version: number;
	/** Provider-specific UI settings */
	providers: ProviderSettingsMap;
	/** Display settings */
	display: DisplaySettings;
	/** Stored display themes */
	displayThemes: DisplayTheme[];
	/** Snapshot of the previous display theme */
	displayUserTheme: DisplaySettings | null;
	/** Pinned provider override for display */
	pinnedProvider: ProviderName | null;
	/** Keybinding settings (changes require pi restart) */
	keybindings: KeybindingSettings;
}

/**
 * Current settings version
 */
export const SETTINGS_VERSION = 2;

/**
 * Default settings
 */
export function getDefaultSettings(): Settings {
	return {
		version: SETTINGS_VERSION,
		providers: {
			anthropic: {
				showStatus: true,
				windows: {
					show5h: true,
					show7d: true,
					showExtra: false,
				},
			},
			copilot: {
				showStatus: true,
				showMultiplier: true,
				showRequestsLeft: true,
				quotaDisplay: "percentage",
				windows: {
					showMonth: true,
				},
			},
			gemini: {
				showStatus: true,
				windows: {
					showPro: true,
					showFlash: true,
				},
			},
			antigravity: {
				showStatus: true,
				showCurrentModel: true,
				showScopedModels: true,
				windows: {
					showModels: true,
				},
				modelVisibility: {},
				modelOrder: [],
			},
			codex: {
				showStatus: true,
				invertUsage: false,
				windows: {
					showPrimary: true,
					showSecondary: true,
				},
			},
			kiro: {
				showStatus: false,
				windows: {
					showCredits: true,
				},
			},
			zai: {
				showStatus: false,
				windows: {
					showTokens: true,
					showMonthly: true,
				},
			},
		},
		display: {
			alignment: "split",
			barStyle: "both",
			barType: "horizontal-bar",
			barWidth: "fill",
			barCharacter: "heavy",
			containBar: false,
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
			resetTimePosition: "front",
			resetTimeFormat: "relative",
			resetTimeContainment: "blank",
			statusIndicatorMode: "icon",
			statusIconPack: "emoji",
			statusIconCustom: "✓⚠×?",
			statusProviderDivider: false,
			statusDismissOk: true,
			showProviderName: true,
			providerLabel: "none",
			providerLabelColon: false,
			providerLabelBold: true,
			baseTextColor: "muted",
			backgroundColor: "text",
			showWindowTitle: true,
			boldWindowTitle: true,
			showUsageLabels: true,
			dividerCharacter: "│",
			dividerColor: "dim",
			dividerBlanks: 1,
			showProviderDivider: true,
			dividerFooterJoin: true,
			showTopDivider: false,
			showBottomDivider: true,
			paddingLeft: 1,
			paddingRight: 1,
			widgetPlacement: "belowEditor",
			showContextBar: false,
			errorThreshold: 25,
			warningThreshold: 50,
			overflow: "truncate",
			successThreshold: 75,
		},

		displayThemes: [],
		displayUserTheme: null,
		pinnedProvider: null,

		keybindings: {
			cycleProvider: "ctrl+alt+p",
			toggleResetFormat: "ctrl+alt+r",
		},

		behavior: {
			refreshInterval: 60,
			minRefreshInterval: 10,
			refreshOnTurnStart: false,
			refreshOnToolResult: false,
		},
		statusRefresh: {
			refreshInterval: 60,
			minRefreshInterval: 10,
			refreshOnTurnStart: false,
			refreshOnToolResult: false,
		},
		providerOrder: [...PROVIDERS],
		defaultProvider: null,
	};
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
	const result = { ...target };
	for (const key of Object.keys(source) as (keyof T)[]) {
		const sourceValue = source[key];
		const targetValue = target[key];
		if (
			sourceValue !== undefined &&
			typeof sourceValue === "object" &&
			sourceValue !== null &&
			!Array.isArray(sourceValue) &&
			typeof targetValue === "object" &&
			targetValue !== null &&
			!Array.isArray(targetValue)
		) {
			result[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
		} else if (sourceValue !== undefined) {
			result[key] = sourceValue as T[keyof T];
		}
	}
	return result;
}

/**
 * Merge settings with defaults (no legacy migrations).
 */
export function mergeSettings(loaded: Partial<Settings>): Settings {
	const migrated = migrateSettings(loaded);
	return deepMerge(getDefaultSettings(), migrated);
}

function migrateDisplaySettings(display?: Partial<DisplaySettings> | null): void {
	if (!display) return;
	const displayAny = display as Partial<DisplaySettings> & { widgetWrapping?: OverflowMode; paddingX?: number };
	if (displayAny.widgetWrapping !== undefined && displayAny.overflow === undefined) {
		displayAny.overflow = displayAny.widgetWrapping;
	}
	if (displayAny.paddingX !== undefined) {
		if (displayAny.paddingLeft === undefined) {
			displayAny.paddingLeft = displayAny.paddingX;
		}
		if (displayAny.paddingRight === undefined) {
			displayAny.paddingRight = displayAny.paddingX;
		}
		delete (displayAny as { paddingX?: unknown }).paddingX;
	}
	if ("widgetWrapping" in displayAny) {
		delete (displayAny as { widgetWrapping?: unknown }).widgetWrapping;
	}
}

function migrateSettings(loaded: Partial<Settings>): Partial<Settings> {
	migrateDisplaySettings(loaded.display);
	migrateDisplaySettings(loaded.displayUserTheme);
	if (Array.isArray(loaded.displayThemes)) {
		for (const theme of loaded.displayThemes) {
			migrateDisplaySettings(theme.display as Partial<DisplaySettings> | undefined);
		}
	}
	return loaded;
}

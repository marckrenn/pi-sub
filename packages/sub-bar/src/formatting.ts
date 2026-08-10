/**
 * UI formatting utilities for the sub-bar extension
 */

import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { RateWindow, UsageSnapshot, ProviderStatus, ModelInfo } from "./types.js";
import type {
	BaseTextColor,
	BarStyle,
	BarType,
	BarCharacter,
	ColorScheme,
	ResetTimerContainment,
	Settings,
} from "./settings-types.js";
import { isBackgroundColor, resolveBaseTextColor, resolveDividerColor } from "./settings-types.js";
import { formatErrorForDisplay, isExpectedMissingData } from "./errors.js";
import { getStatusIcon, getStatusLabel } from "./status.js";
import { shouldShowWindow } from "./providers/windows.js";
import { getUsageExtras } from "./providers/extras.js";
import { normalizeTokens } from "./utils.js";

export interface UsageWindowParts {
	label: string;
	bar: string;
	pct: string;
	reset: string;
}

/**
 * Context window usage info from the pi framework
 */
export interface ContextInfo {
	tokens: number;
	contextWindow: number;
	percent: number;
}

type ModelInput = ModelInfo | string | undefined;

function resolveModelInfo(model?: ModelInput): ModelInfo | undefined {
	if (!model) return undefined;
	return typeof model === "string" ? { id: model } : model;
}

function isCodexSparkModel(model?: ModelInput): boolean {
	const tokens = normalizeTokens(typeof model === "string" ? model : model?.id ?? "");
	return tokens.includes("codex") && tokens.includes("spark");
}

function isCodexSparkWindow(window: RateWindow): boolean {
	const tokens = normalizeTokens(window.label ?? "");
	return tokens.includes("codex") && tokens.includes("spark");
}

function getDisplayWindowLabel(window: RateWindow, model?: ModelInput): string {
	if (!isCodexSparkWindow(window)) return window.label;
	if (!isCodexSparkModel(model)) return window.label;
	const parts = window.label.trim().split(/\s+/);
	const suffix = parts.at(-1) ?? "";
	if (/^\d+h$/i.test(suffix) || /^day$/i.test(suffix) || /^week$/i.test(suffix)) {
		return suffix;
	}
	return window.label;
}

/**
 * Get the characters to use for progress bars
 */
function getBarCharacters(barCharacter: BarCharacter): { filled: string; empty: string } {
	let filled = "━";
	let empty = "━";
	switch (barCharacter) {
		case "light":
			filled = "─";
			empty = "─";
			break;
		case "heavy":
			filled = "━";
			empty = "━";
			break;
		case "double":
			filled = "═";
			empty = "═";
			break;
		case "block":
			filled = "█";
			empty = "█";
			break;
		default: {
			const raw = String(barCharacter);
			const trimmed = raw.trim();
			if (!trimmed) return { filled, empty };
			const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
			const segments = Array.from(segmenter.segment(raw), (entry) => entry.segment);
			const first = segments[0] ?? trimmed[0] ?? "━";
			const second = segments[1];
			filled = first;
			empty = second ?? first;
			break;
		}
	}
	return { filled, empty };
}

/**
 * Get color based on percentage and color scheme
 */
function getUsageColor(
	percent: number,
	isRemaining: boolean,
	colorScheme: ColorScheme,
	errorThreshold: number = 25,
	warningThreshold: number = 50,
	successThreshold: number = 75
): "error" | "warning" | "base" | "success" {
	if (colorScheme === "monochrome") {
		return "base";
	}

	// For remaining percentage (Codex style), invert the logic
	const effectivePercent = isRemaining ? percent : 100 - percent;

	if (colorScheme === "success-base-warning-error") {
		// >75%: success, >50%: base, >25%: warning, <=25%: error
		if (effectivePercent < errorThreshold) return "error";
		if (effectivePercent < warningThreshold) return "warning";
		if (effectivePercent < successThreshold) return "base";
		return "success";
	}

	// base-warning-error (default)
	// >50%: base, >25%: warning, <=25%: error
	if (effectivePercent < errorThreshold) return "error";
	if (effectivePercent < warningThreshold) return "warning";
	return "base";
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}

function getStatusColor(
	indicator: NonNullable<UsageSnapshot["status"]>["indicator"],
	colorScheme: ColorScheme
): "error" | "warning" | "success" | "base" {
	if (colorScheme === "monochrome") {
		return "base";
	}
	if (indicator === "minor" || indicator === "maintenance") {
		return "warning";
	}
	if (indicator === "major" || indicator === "critical") {
		return "error";
	}
	if (indicator === "none") {
		return colorScheme === "success-base-warning-error" ? "success" : "base";
	}
	return "base";
}

function resolveStatusTintColor(
	color: "error" | "warning" | "success" | "base",
	baseTextColor: BaseTextColor
): BaseTextColor {
	return color === "base" ? baseTextColor : color;
}

function fgFromBgAnsi(ansi: string): string {
	return ansi.replace(/\x1b\[48;/g, "\x1b[38;").replace(/\x1b\[49m/g, "\x1b[39m");
}

function applyBaseTextColor(theme: Theme, color: BaseTextColor, text: string): string {
	if (isBackgroundColor(color)) {
		const fgAnsi = fgFromBgAnsi(theme.getBgAnsi(color as Parameters<Theme["getBgAnsi"]>[0]));
		return `${fgAnsi}${text}\x1b[39m`;
	}
	return theme.fg(resolveDividerColor(color), text);
}

function resolveUsageColorTargets(settings?: Settings): {
	title: boolean;
	timer: boolean;
	bar: boolean;
	usageLabel: boolean;
	status: boolean;
} {
	const targets = settings?.display.usageColorTargets;
	return {
		title: targets?.title ?? true,
		timer: targets?.timer ?? true,
		bar: targets?.bar ?? true,
		usageLabel: targets?.usageLabel ?? true,
		status: targets?.status ?? true,
	};
}

function formatElapsedSince(timestamp: number): string {
	const diffMs = Date.now() - timestamp;
	if (diffMs < 60000) {
		const seconds = Math.max(1, Math.floor(diffMs / 1000));
		return `${seconds}s`;
	}

	const diffMins = Math.floor(diffMs / 60000);
	if (diffMins < 60) return `${diffMins}m`;

	const hours = Math.floor(diffMins / 60);
	const mins = diffMins % 60;
	if (hours < 24) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;

	const days = Math.floor(hours / 24);
	const remHours = hours % 24;
	return remHours > 0 ? `${days}d${remHours}h` : `${days}d`;
}

const RESET_CONTAINMENT_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function wrapResetContainment(text: string, containment: ResetTimerContainment): { wrapped: string; attachWithSpace: boolean } {
	switch (containment) {
		case "none":
			return { wrapped: text, attachWithSpace: true };
		case "blank":
			return { wrapped: text, attachWithSpace: true };
		case "[]":
			return { wrapped: `[${text}]`, attachWithSpace: true };
		case "<>":
			return { wrapped: `<${text}>`, attachWithSpace: true };
		case "()":
			return { wrapped: `(${text})`, attachWithSpace: true };
		default: {
			const trimmed = String(containment).trim();
			if (!trimmed) return { wrapped: `(${text})`, attachWithSpace: true };
			const segments = Array.from(RESET_CONTAINMENT_SEGMENTER.segment(trimmed), (entry) => entry.segment)
				.map((segment) => segment.trim())
				.filter(Boolean);
			if (segments.length === 0) return { wrapped: `(${text})`, attachWithSpace: true };
			const left = segments[0];
			const right = segments[1] ?? left;
			return { wrapped: `${left}${text}${right}`, attachWithSpace: true };
		}
	}
}

function formatResetDateTime(resetAt: string): string {
	const date = new Date(resetAt);
	if (Number.isNaN(date.getTime())) return resetAt;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function getBarTypeLevels(barType: BarType): string[] | null {
	switch (barType) {
		case "horizontal-single":
			return ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
		case "vertical":
			return ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
		case "braille":
			return ["⡀", "⡄", "⣄", "⣆", "⣇", "⣧", "⣷", "⣿"];
		case "shade":
			return ["░", "▒", "▓", "█"];
		default:
			return null;
	}
}

function renderBarSegments(
	percent: number,
	width: number,
	levels: string[],
	options?: { allowMinimum?: boolean; emptyChar?: string }
): { segments: Array<{ char: string; filled: boolean }>; minimal: boolean } {
	const totalUnits = Math.max(1, width) * levels.length;
	let filledUnits = Math.round((percent / 100) * totalUnits);
	let minimal = false;
	if (options?.allowMinimum && percent > 0 && filledUnits === 0) {
		filledUnits = 1;
		minimal = true;
	}
	const emptyChar = options?.emptyChar ?? " ";
	const segments: Array<{ char: string; filled: boolean }> = [];
	for (let i = 0; i < Math.max(1, width); i++) {
		if (filledUnits >= levels.length) {
			segments.push({ char: levels[levels.length - 1], filled: true });
			filledUnits -= levels.length;
			continue;
		}
		if (filledUnits > 0) {
			segments.push({ char: levels[Math.min(levels.length - 1, filledUnits - 1)], filled: true });
			filledUnits = 0;
			continue;
		}
		segments.push({ char: emptyChar, filled: false });
	}
	return { segments, minimal };
}

function formatProviderLabel(theme: Theme, usage: UsageSnapshot, settings?: Settings, model?: ModelInput): string {
	const showProviderName = settings?.display.showProviderName ?? true;
	const showStatus = settings?.providers[usage.provider]?.showStatus ?? true;
	const error = usage.error;
	const fetchError = Boolean(error && !isExpectedMissingData(error));
	const baseStatus = showStatus ? usage.status : undefined;
	const lastSuccessAt = usage.lastSuccessAt;
	const elapsed = lastSuccessAt ? formatElapsedSince(lastSuccessAt) : undefined;
	const fetchDescription = elapsed
		? (elapsed === "just now" ? "Last upd.: just now" : `Last upd.: ${elapsed} ago`)
		: "Fetch failed";
	const fetchStatus: ProviderStatus | undefined = fetchError
		? { indicator: "minor", description: fetchDescription }
		: undefined;
	const status = showStatus ? (fetchStatus ?? baseStatus) : undefined;
	const statusDismissOk = settings?.display.statusDismissOk ?? true;
	const statusModeRaw = settings?.display.statusIndicatorMode ?? "icon";
	const statusMode = statusModeRaw === "icon" || statusModeRaw === "text" || statusModeRaw === "icon+text"
		? statusModeRaw
		: "icon";
	const statusIconPack = settings?.display.statusIconPack ?? "emoji";
	const statusIconCustom = settings?.display.statusIconCustom;
	const providerLabelSetting = settings?.display.providerLabel ?? "none";
	const showColon = settings?.display.providerLabelColon ?? true;
	const boldProviderLabel = settings?.display.providerLabelBold ?? false;
	const baseTextColor = resolveBaseTextColor(settings?.display.baseTextColor);
	const usageTargets = resolveUsageColorTargets(settings);

	const statusActive = Boolean(status && (!statusDismissOk || status.indicator !== "none"));
	const showIcon = statusActive && (statusMode === "icon" || statusMode === "icon+text");
	const showText = statusActive && (statusMode === "text" || statusMode === "icon+text");

	const labelSuffix = providerLabelSetting === "plan"
		? "Plan"
		: providerLabelSetting === "subscription"
			? "Subscription"
			: providerLabelSetting === "sub"
				? "Sub."
				: providerLabelSetting === "none"
					? ""
					: String(providerLabelSetting);

	const rawName = usage.displayName?.trim() ?? "";
	const baseName = rawName.replace(/\s+(plan|subscription|sub\.?)[\s]*$/i, "").trim();
	const resolvedProviderName = baseName || rawName;
	const isSpark = usage.provider === "codex" && isCodexSparkModel(model);
	const providerName = isSpark ? `${resolvedProviderName} (Spark)` : resolvedProviderName;
	const providerLabel = showProviderName
		? [providerName, labelSuffix].filter(Boolean).join(" ")
		: "";
	const providerLabelWithColon = providerLabel && showColon ? `${providerLabel}:` : providerLabel;

	const icon = showIcon && status ? getStatusIcon(status, statusIconPack, statusIconCustom) : "";
	const statusText = showText && status ? getStatusLabel(status) : "";
	const rawStatusColor = status
		? getStatusColor(status.indicator, settings?.display.colorScheme ?? "base-warning-error")
		: "base";
	const statusTint = usageTargets.status
		? resolveStatusTintColor(rawStatusColor, baseTextColor)
		: baseTextColor;
	const statusColor = statusTint;
	const dividerEnabled = settings?.display.statusProviderDivider ?? false;
	const dividerChar = settings?.display.dividerCharacter ?? "│";
	const dividerColor = resolveDividerColor(settings?.display.dividerColor);
	const dividerGlyph = dividerChar === "none"
		? ""
		: dividerChar === "blank"
			? " "
			: dividerChar;

	const statusParts: string[] = [];
	if (icon) statusParts.push(applyBaseTextColor(theme, statusColor, icon));
	if (statusText) statusParts.push(applyBaseTextColor(theme, statusColor, statusText));

	const parts: string[] = [];
	if (statusParts.length > 0) {
		parts.push(statusParts.join(" "));
	}
	if (providerLabelWithColon) {
		if (statusParts.length > 0 && dividerEnabled && dividerGlyph) {
			parts.push(theme.fg(dividerColor, dividerGlyph));
		}
		const colored = applyBaseTextColor(theme, baseTextColor, providerLabelWithColon);
		parts.push(boldProviderLabel ? theme.bold(colored) : colored);
	}
	if (parts.length === 0) return "";
	return parts.join(" ");
}

/**
 * Format a single usage window as a styled string
 */
export function formatUsageWindow(
	theme: Theme,
	window: RateWindow,
	isCodex: boolean,
	settings?: Settings,
	usage?: UsageSnapshot,
	options?: { useNormalColors?: boolean; barWidthOverride?: number },
	model?: ModelInput
): string {
	const parts = formatUsageWindowParts(theme, window, isCodex, settings, usage, options, model);
	const baseTextColor = resolveBaseTextColor(settings?.display.baseTextColor);
	const usageTargets = resolveUsageColorTargets(settings);

	// Special handling for Extra usage label
	if (window.label.startsWith("Extra [")) {
		const match = window.label.match(/^(Extra \[)(on|active)(\] .*)$/);
		if (match) {
			const [, prefix, status, suffix] = match;
			const styledLabel =
				status === "active"
					? applyBaseTextColor(theme, baseTextColor, prefix)
						+ theme.fg("text", status)
						+ applyBaseTextColor(theme, baseTextColor, suffix)
					: applyBaseTextColor(theme, baseTextColor, window.label);
			const extraParts = [styledLabel, parts.bar, parts.pct].filter(Boolean);
			return extraParts.join(" ");
		}
		if (!usageTargets.title) {
			const extraParts = [applyBaseTextColor(theme, baseTextColor, window.label), parts.bar, parts.pct].filter(Boolean);
			return extraParts.join(" ");
		}
		const extraColor = getUsageColor(window.usedPercent, false, settings?.display.colorScheme ?? "base-warning-error");
		const extraTextColor = (options?.useNormalColors && extraColor === "base")
			? "text"
			: extraColor === "base"
				? baseTextColor
				: extraColor;
		const extraParts = [applyBaseTextColor(theme, extraTextColor, window.label), parts.bar, parts.pct].filter(Boolean);
		return extraParts.join(" ");
	}

	const joinedParts = [parts.label, parts.bar, parts.pct, parts.reset].filter(Boolean);
	return joinedParts.join(" ");
}

export function formatUsageWindowParts(
	theme: Theme,
	window: RateWindow,
	isCodex: boolean,
	settings?: Settings,
	usage?: UsageSnapshot,
	options?: { useNormalColors?: boolean; barWidthOverride?: number },
	model?: ModelInput
): UsageWindowParts {
	const barStyle: BarStyle = settings?.display.barStyle ?? "both";
	const barWidthSetting = settings?.display.barWidth;
	const barWidth = options?.barWidthOverride ?? (typeof barWidthSetting === "number" ? barWidthSetting : 6);
	const barType: BarType = settings?.display.barType ?? "horizontal-bar";
	const brailleFillEmpty = settings?.display.brailleFillEmpty ?? false;
	const brailleFullBlocks = settings?.display.brailleFullBlocks ?? false;
	const barCharacter: BarCharacter = settings?.display.barCharacter ?? "heavy";
	const colorScheme: ColorScheme = settings?.display.colorScheme ?? "base-warning-error";
	const resetTimePosition = settings?.display.resetTimePosition ?? "front";
	const resetTimeFormat = settings?.display.resetTimeFormat ?? "relative";
	const showUsageLabels = settings?.display.showUsageLabels ?? true;
	const showWindowTitle = settings?.display.showWindowTitle ?? true;
	const boldWindowTitle = settings?.display.boldWindowTitle ?? false;
	const baseTextColor = resolveBaseTextColor(settings?.display.baseTextColor);
	const errorThreshold = settings?.display.errorThreshold ?? 25;
	const warningThreshold = settings?.display.warningThreshold ?? 50;
	const successThreshold = settings?.display.successThreshold ?? 75;

	const rawUsedPct = Math.round(window.usedPercent);
	const usedPct = clampPercent(rawUsedPct);
	const displayPct = isCodex ? clampPercent(100 - usedPct) : usedPct;
	const isRemaining = isCodex;

	const barPercent = clampPercent(displayPct);

	const baseColor = getUsageColor(displayPct, isRemaining, colorScheme, errorThreshold, warningThreshold, successThreshold);
	const usageTargets = resolveUsageColorTargets(settings);
	const usageTextColor = (options?.useNormalColors && baseColor === "base")
		? "text"
		: baseColor === "base"
			? baseTextColor
			: baseColor;
	const neutralTextColor = options?.useNormalColors ? "text" : baseTextColor;
	const titleColor = usageTargets.title ? usageTextColor : neutralTextColor;
	const timerColor = usageTargets.timer ? usageTextColor : neutralTextColor;
	const usageLabelColor = usageTargets.usageLabel ? usageTextColor : neutralTextColor;
	const barUsageColor = (options?.useNormalColors && baseColor === "base") ? "text" : baseColor === "base" ? "muted" : baseColor;
	const neutralBarColor = baseTextColor === "dim" ? "dim" : "muted";
	const barColor = usageTargets.bar ? barUsageColor : neutralBarColor;
	const { filled: filledChar, empty: emptyChar } = getBarCharacters(barCharacter);

	const emptyColor = "dim";
	
	let barStr = "";
	if ((barStyle === "bar" || barStyle === "both") && barWidth > 0) {
		let levels = getBarTypeLevels(barType);
		if (barType === "braille" && brailleFullBlocks) {
			levels = ["⣿"];
		}
		if (!levels || barType === "horizontal-bar") {
			const filledCharWidth = Math.max(1, visibleWidth(filledChar));
			const emptyCharWidth = Math.max(1, visibleWidth(emptyChar));
			const segmentCount = barWidth > 0 ? Math.floor(barWidth / filledCharWidth) : 0;
			const filledSegments = segmentCount > 0 ? Math.round((barPercent / 100) * segmentCount) : 0;
			const filledStr = filledChar.repeat(filledSegments);
			const filledWidth = filledSegments * filledCharWidth;
			const remainingWidth = Math.max(0, barWidth - filledWidth);
			const emptySegments = emptyCharWidth > 0 ? Math.floor(remainingWidth / emptyCharWidth) : 0;
			const emptyStr = emptyChar.repeat(emptySegments);
			const emptyRendered = emptyChar === " " ? emptyStr : theme.fg(emptyColor, emptyStr);
			barStr = theme.fg(barColor as Parameters<typeof theme.fg>[0], filledStr) + emptyRendered;
			const barVisualWidth = visibleWidth(barStr);
			if (barVisualWidth < barWidth) {
				barStr += " ".repeat(barWidth - barVisualWidth);
			}
		} else {
			const emptyChar = barType === "braille" && brailleFillEmpty && barWidth > 1 ? "⣿" : " ";
			const { segments, minimal } = renderBarSegments(barPercent, barWidth, levels, {
				allowMinimum: true,
				emptyChar,
			});
			const filledColor = minimal ? "dim" : barColor;
			barStr = segments
				.map((segment) => {
					if (segment.filled) {
						return theme.fg(filledColor as Parameters<typeof theme.fg>[0], segment.char);
					}
					if (segment.char === " ") {
						return segment.char;
					}
					return theme.fg("dim", segment.char);
				})
				.join("");
		}

		if (settings?.display.containBar && barStr) {
			const leftCap = theme.fg(barColor as Parameters<typeof theme.fg>[0], "▕");
			const rightCap = theme.fg(barColor as Parameters<typeof theme.fg>[0], "▏");
			barStr = leftCap + barStr + rightCap;
		}
	}

	let pctStr = "";
	if (barStyle === "percentage" || barStyle === "both") {
		// Special handling for Copilot Month window - can show percentage or requests
		if (window.label === "Month" && usage?.provider === "copilot") {
			const quotaDisplay = settings?.providers.copilot.quotaDisplay ?? "percentage";
			if (quotaDisplay === "requests" && usage.requestsRemaining !== undefined && usage.requestsEntitlement !== undefined) {
				const used = usage.requestsEntitlement - usage.requestsRemaining;
				const suffix = showUsageLabels ? " used" : "";
				pctStr = applyBaseTextColor(theme, usageLabelColor, `${used}/${usage.requestsEntitlement}${suffix}`);
			} else {
				const suffix = showUsageLabels ? " used" : "";
				pctStr = applyBaseTextColor(theme, usageLabelColor, `${usedPct}%${suffix}`);
			}
		} else if (isCodex) {
			const suffix = showUsageLabels ? " rem." : "";
			pctStr = applyBaseTextColor(theme, usageLabelColor, `${displayPct}%${suffix}`);
		} else {
			const suffix = showUsageLabels ? " used" : "";
			pctStr = applyBaseTextColor(theme, usageLabelColor, `${usedPct}%${suffix}`);
		}
	}

	const isActiveReset = window.resetDescription === "__ACTIVE__";
	const resetText = isActiveReset
		? undefined
		: resetTimeFormat === "datetime"
			? (window.resetAt ? formatResetDateTime(window.resetAt) : window.resetDescription)
			: window.resetDescription;
	const resetContainment = settings?.display.resetTimeContainment ?? "()";
	const leftSuffix = resetText && resetTimeFormat === "relative" && showUsageLabels ? " left" : "";

	const displayLabel = getDisplayWindowLabel(window, model);
	const coloredTitle = applyBaseTextColor(theme, titleColor, displayLabel);
	const titlePart = showWindowTitle ? (boldWindowTitle ? theme.bold(coloredTitle) : coloredTitle) : "";

	let labelPart = titlePart;
	if (resetText) {
		const resetBody = `${resetText}${leftSuffix}`;
		const { wrapped, attachWithSpace } = wrapResetContainment(resetBody, resetContainment);
		const coloredReset = applyBaseTextColor(theme, timerColor, wrapped);
		if (resetTimePosition === "front") {
			if (!titlePart) {
				labelPart = coloredReset;
			} else {
				labelPart = attachWithSpace ? `${titlePart} ${coloredReset}` : `${titlePart}${coloredReset}`;
			}
		} else if (resetTimePosition === "integrated") {
			labelPart = titlePart ? `${applyBaseTextColor(theme, timerColor, `${wrapped}/`)}${titlePart}` : coloredReset;
		} else if (resetTimePosition === "back") {
			labelPart = titlePart;
		}
	} else if (!titlePart) {
		labelPart = "";
	}

	const resetPart =
		resetTimePosition === "back" && resetText
			? applyBaseTextColor(theme, timerColor, wrapResetContainment(`${resetText}${leftSuffix}`, resetContainment).wrapped)
			: "";

	return {
		label: labelPart,
		bar: barStr,
		pct: pctStr,
		reset: resetPart,
	};
}

/**
 * Format context window usage as a progress bar
 */
export function formatContextBar(
	theme: Theme,
	context: ContextInfo,
	settings?: Settings,
	options?: { barWidthOverride?: number }
): string {
	// Create a pseudo-RateWindow for context display
	const contextWindow: RateWindow = {
		label: "Ctx",
		usedPercent: context.percent,
		// No reset description for context
	};
	// Format using the same window formatting logic, but with "used" semantics (not inverted)
	return formatUsageWindow(theme, contextWindow, false, settings, undefined, options);
}

/**
 * Format a complete usage snapshot as a usage line
 */
export function formatUsageStatus(
	theme: Theme,
	usage: UsageSnapshot,
	model?: ModelInput,
	settings?: Settings,
	context?: ContextInfo
): string | undefined {
	const baseTextColor = resolveBaseTextColor(settings?.display.baseTextColor);
	const modelInfo = resolveModelInfo(model);
	const label = formatProviderLabel(theme, usage, settings, modelInfo);

	// If no windows, just show the provider name with error
	if (usage.windows.length === 0) {
		const errorMsg = usage.error
			? applyBaseTextColor(theme, baseTextColor, `(${formatErrorForDisplay(usage.error)})`)
			: "";
		if (!label) {
			return errorMsg;
		}
		return errorMsg ? `${label} ${errorMsg}` : label;
	}

	// Build usage bars
	const parts: string[] = [];
	const isCodex = usage.provider === "codex";
	const invertUsage = isCodex && (settings?.providers.codex.invertUsage ?? false);
	const modelId = modelInfo?.id;

	// Add context bar as leftmost element if enabled
	const showContextBar = settings?.display.showContextBar ?? false;
	if (showContextBar && context && context.contextWindow > 0) {
		parts.push(formatContextBar(theme, context, settings));
	}

	for (const w of usage.windows) {
		// Skip windows that are disabled in settings
		if (!shouldShowWindow(usage, w, settings, modelInfo)) {
			continue;
		}
		parts.push(formatUsageWindow(theme, w, invertUsage, settings, usage, undefined, modelInfo));
	}

	// Add extra usage lines (extra usage off, copilot multiplier, etc.)
	const extras = getUsageExtras(usage, settings, modelId);
	for (const extra of extras) {
		parts.push(applyBaseTextColor(theme, baseTextColor, extra.label));
	}

	// Build divider from settings
	const dividerChar = settings?.display.dividerCharacter ?? "•";
	const dividerColor = resolveDividerColor(settings?.display.dividerColor);
	const blanksSetting = settings?.display.dividerBlanks ?? 1;
	const showProviderDivider = settings?.display.showProviderDivider ?? false;
	const blanksPerSide = typeof blanksSetting === "number" ? blanksSetting : 1;
	const spacing = " ".repeat(blanksPerSide);
	const charToDisplay = dividerChar === "blank" ? " " : dividerChar === "none" ? "" : dividerChar;
	const divider = charToDisplay ? spacing + theme.fg(dividerColor, charToDisplay) + spacing : spacing + spacing;
	const labelGap = label && parts.length > 0
		? showProviderDivider && charToDisplay !== ""
			? divider
			: spacing
		: "";

	return label + labelGap + parts.join(divider);
}

export function formatUsageStatusWithWidth(
	theme: Theme,
	usage: UsageSnapshot,
	width: number,
	model?: ModelInput,
	settings?: Settings,
	options?: { labelGapFill?: boolean },
	context?: ContextInfo
): string | undefined {
	const labelGapFill = options?.labelGapFill ?? false;
	const baseTextColor = resolveBaseTextColor(settings?.display.baseTextColor);
	const modelInfo = resolveModelInfo(model);
	const label = formatProviderLabel(theme, usage, settings, modelInfo);
	const showContextBar = settings?.display.showContextBar ?? false;
	const hasContext = showContextBar && context && context.contextWindow > 0;

	// If no windows, just show the provider name with error
	if (usage.windows.length === 0) {
		const errorMsg = usage.error
			? applyBaseTextColor(theme, baseTextColor, `(${formatErrorForDisplay(usage.error)})`)
			: "";
		if (!label) {
			return errorMsg;
		}
		return errorMsg ? `${label} ${errorMsg}` : label;
	}

	const barStyle: BarStyle = settings?.display.barStyle ?? "both";
	const hasBar = barStyle === "bar" || barStyle === "both";
	const barWidthSetting = settings?.display.barWidth ?? 6;
	const dividerBlanksSetting = settings?.display.dividerBlanks ?? 1;
	const dividerColor = resolveDividerColor(settings?.display.dividerColor);
	const showProviderDivider = settings?.display.showProviderDivider ?? false;
	const containBar = settings?.display.containBar ?? false;

	const barFill = barWidthSetting === "fill";
	const barBaseWidth = typeof barWidthSetting === "number" ? barWidthSetting : (hasBar ? 1 : 0);
	const barContainerExtra = containBar && hasBar ? 2 : 0;
	const barBaseContentWidth = barFill ? 0 : barBaseWidth;
	const barBaseWidthCalc = barFill ? 0 : barBaseContentWidth + barContainerExtra;
	const barTotalBaseWidth = barBaseWidthCalc;
	const baseDividerBlanks = typeof dividerBlanksSetting === "number" ? dividerBlanksSetting : 1;

	const dividerFill = dividerBlanksSetting === "fill";

	// Build usage windows
	const windows: RateWindow[] = [];
	const isCodex = usage.provider === "codex";
	const invertUsage = isCodex && (settings?.providers.codex.invertUsage ?? false);
	const modelId = modelInfo?.id;

	// Add context window as first entry if enabled
	let contextWindowIndex = -1;
	if (hasContext) {
		contextWindowIndex = windows.length;
		windows.push({
			label: "Ctx",
			usedPercent: context!.percent,
		});
	}

	for (const w of usage.windows) {
		if (!shouldShowWindow(usage, w, settings, modelInfo)) {
			continue;
		}
		windows.push(w);
	}

	const barEligibleCount = hasBar ? windows.length : 0;
	const extras = getUsageExtras(usage, settings, modelId);
	const extraParts = extras.map((extra) => applyBaseTextColor(theme, baseTextColor, extra.label));

	const barSpacerWidth = hasBar ? 1 : 0;
	const baseWindowWidths = windows.map((w, i) => {
		// Context window uses false for invertUsage (always show used percentage)
		const isContext = i === contextWindowIndex;
		return (
			visibleWidth(
				formatUsageWindow(
					theme,
					w,
					isContext ? false : invertUsage,
					settings,
					isContext ? undefined : usage,
					{ barWidthOverride: 0 },
					modelInfo
				)
			) + barSpacerWidth
		);
	});
	const extraWidths = extraParts.map((part) => visibleWidth(part));

	const partCount = windows.length + extraParts.length;
	const dividerCount = Math.max(0, partCount - 1);
	const dividerChar = settings?.display.dividerCharacter ?? "•";
	const charToDisplay = dividerChar === "blank" ? " " : dividerChar === "none" ? "" : dividerChar;
	const dividerBaseWidth = (charToDisplay ? 1 : 0) + baseDividerBlanks * 2;
	const labelGapEnabled = partCount > 0 && (label !== "" || labelGapFill);
	const providerDividerActive = showProviderDivider && charToDisplay !== "" && label !== "";
	const labelGapBaseWidth = labelGapEnabled
		? providerDividerActive
			? dividerBaseWidth
			: baseDividerBlanks
		: 0;

	const labelWidth = visibleWidth(label);
	const baseTotalWidth =
		labelWidth +
		labelGapBaseWidth +
		baseWindowWidths.reduce((sum, w) => sum + w, 0) +
		extraWidths.reduce((sum, w) => sum + w, 0) +
		(barEligibleCount * barTotalBaseWidth) +
		(dividerCount * dividerBaseWidth);

	let remainingWidth = width - baseTotalWidth;
	if (remainingWidth < 0) {
		remainingWidth = 0;
	}

	const useBars = barFill && barEligibleCount > 0;
	const labelGapUnits = labelGapEnabled ? (providerDividerActive ? 2 : 1) : 0;
	const dividerUnits = dividerCount * 2 + labelGapUnits;
	const useDividers = dividerFill && dividerUnits > 0;

	let barExtraTotal = 0;
	let dividerExtraTotal = 0;
	if (remainingWidth > 0 && (useBars || useDividers)) {
		const barWeight = useBars ? barEligibleCount : 0;
		const dividerWeight = useDividers ? dividerUnits : 0;
		const totalWeight = barWeight + dividerWeight;
		if (totalWeight > 0) {
			barExtraTotal = Math.floor((remainingWidth * barWeight) / totalWeight);
			dividerExtraTotal = remainingWidth - barExtraTotal;
		}
	}

	const barWidths: number[] = windows.map(() => barBaseWidthCalc);
	if (useBars && barEligibleCount > 0) {
		const perBar = Math.floor(barExtraTotal / barEligibleCount);
		let remainder = barExtraTotal % barEligibleCount;
		for (let i = 0; i < barWidths.length; i++) {
			barWidths[i] = barBaseWidthCalc + perBar + (remainder > 0 ? 1 : 0);
			if (remainder > 0) remainder -= 1;
		}
	}

	let labelBlanks = labelGapEnabled ? baseDividerBlanks : 0;
	const dividerBlanks: number[] = [];
	if (dividerUnits > 0) {
		const baseUnit = useDividers ? Math.floor(dividerExtraTotal / dividerUnits) : 0;
		let remainderUnits = useDividers ? dividerExtraTotal % dividerUnits : 0;
		if (labelGapEnabled) {
			if (useDividers && providerDividerActive) {
				let extraUnits = baseUnit * 2;
				if (remainderUnits >= 2) {
					extraUnits += 2;
					remainderUnits -= 2;
				}
				labelBlanks = baseDividerBlanks + Math.floor(extraUnits / 2);
			} else if (useDividers) {
				labelBlanks = baseDividerBlanks + baseUnit + (remainderUnits > 0 ? 1 : 0);
				if (remainderUnits > 0) remainderUnits -= 1;
			}
		}
		for (let i = 0; i < dividerCount; i++) {
			let extraUnits = baseUnit * 2;
			if (remainderUnits >= 2) {
				extraUnits += 2;
				remainderUnits -= 2;
			}
			const blanks = baseDividerBlanks + Math.floor(extraUnits / 2);
			dividerBlanks.push(blanks);
		}
	}

	const parts: string[] = [];
	for (let i = 0; i < windows.length; i++) {
		const totalWidth = barWidths[i] ?? barBaseWidthCalc;
		const contentWidth = containBar ? Math.max(0, totalWidth - barContainerExtra) : totalWidth;
		const isContext = i === contextWindowIndex;
		parts.push(
			formatUsageWindow(
				theme,
				windows[i],
				isContext ? false : invertUsage,
				settings,
				isContext ? undefined : usage,
				{ barWidthOverride: contentWidth },
				modelInfo
			)
		);
	}
	for (const extra of extraParts) {
		parts.push(extra);
	}

	let rest = "";
	for (let i = 0; i < parts.length; i++) {
		rest += parts[i];
		if (i < dividerCount) {
			const blanks = dividerBlanks[i] ?? baseDividerBlanks;
			const spacing = " ".repeat(Math.max(0, blanks));
			rest += charToDisplay
				? spacing + theme.fg(dividerColor, charToDisplay) + spacing
				: spacing + spacing;
		}
	}

	let labelGapExtra = 0;
	if (labelGapFill && labelGapEnabled) {
		const restWidth = visibleWidth(rest);
		const labelGapWidth = providerDividerActive
			? (Math.max(0, labelBlanks) * 2) + (charToDisplay ? 1 : 0)
			: Math.max(0, labelBlanks);
		const totalWidth = visibleWidth(label) + restWidth + labelGapWidth;
		labelGapExtra = Math.max(0, width - totalWidth);
	}

	let output = label;
	if (labelGapEnabled) {
		if (providerDividerActive) {
			const spacing = " ".repeat(Math.max(0, labelBlanks));
			output += spacing + theme.fg(dividerColor, charToDisplay) + spacing + " ".repeat(labelGapExtra);
		} else {
			output += " ".repeat(Math.max(0, labelBlanks + labelGapExtra));
		}
	}
	output += rest;

	if (width > 0 && visibleWidth(output) > width) {
		return truncateToWidth(output, width, "");
	}

	return output;
}

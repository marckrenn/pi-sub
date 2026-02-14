/**
 * sub-bar - Usage Widget Extension
 * Shows current provider's usage in a widget above the editor.
 * Only shows stats for the currently selected provider.
 */

import type { ExtensionAPI, ExtensionContext, Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { Container, Input, SelectList, Spacer, Text, truncateToWidth, wrapTextWithAnsi, visibleWidth } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderName, ProviderUsageEntry, SubCoreAllState, SubCoreState, UsageSnapshot } from "./src/types.js";
import { type Settings, type BaseTextColor } from "./src/settings-types.js";
import { isBackgroundColor, resolveBaseTextColor, resolveDividerColor } from "./src/settings-types.js";
import { buildDividerLine } from "./src/dividers.js";
import type { CoreSettings } from "@marckrenn/pi-sub-shared";
import type { KeyId } from "@mariozechner/pi-tui";
import { formatUsageStatus, formatUsageStatusWithWidth } from "./src/formatting.js";
import type { ContextInfo } from "./src/formatting.js";
import { clearSettingsCache, loadSettings, saveSettings, SETTINGS_PATH } from "./src/settings.js";
import { showSettingsUI } from "./src/settings-ui.js";
import { decodeDisplayShareString } from "./src/share.js";
import { upsertDisplayTheme } from "./src/settings/themes.js";
import { getFallbackCoreSettings } from "./src/core-settings.js";

type SubCoreRequest =
	| {
			type?: "current";
			includeSettings?: boolean;
			reply: (payload: { state: SubCoreState; settings?: CoreSettings }) => void;
	  }
	| {
			type: "entries";
			force?: boolean;
			reply: (payload: { entries: ProviderUsageEntry[] }) => void;
	  };

type SubCoreAction = {
	type: "refresh" | "cycleProvider";
	force?: boolean;
};

function applyBackground(lines: string[], theme: Theme, color: BaseTextColor, width: number): string[] {
	const bgAnsi = isBackgroundColor(color)
		? theme.getBgAnsi(color as Parameters<Theme["getBgAnsi"]>[0])
		: theme.getFgAnsi(resolveDividerColor(color)).replace(/\x1b\[38;/g, "\x1b[48;").replace(/\x1b\[39m/g, "\x1b[49m");
	if (!bgAnsi || bgAnsi === "\x1b[49m") return lines;
	return lines.map((line) => {
		const padding = Math.max(0, width - visibleWidth(line));
		return `${bgAnsi}${line}${" ".repeat(padding)}\x1b[49m`;
	});
}

function applyBaseTextColor(theme: Theme, color: BaseTextColor, text: string): string {
	if (isBackgroundColor(color)) {
		const fgAnsi = theme
			.getBgAnsi(color as Parameters<Theme["getBgAnsi"]>[0])
			.replace(/\x1b\[48;/g, "\x1b[38;")
			.replace(/\x1b\[49m/g, "\x1b[39m");
		return `${fgAnsi}${text}\x1b[39m`;
	}
	return theme.fg(resolveDividerColor(color), text);
}

type PiSettings = {
	enabledModels?: unknown;
};

const AGENT_SETTINGS_ENV = "PI_CODING_AGENT_DIR";
const DEFAULT_AGENT_DIR = join(homedir(), ".pi", "agent");
const PROJECT_SETTINGS_DIR = ".pi";
const SETTINGS_FILE_NAME = "settings.json";

let scopedModelPatternsCache: { cwd: string; patterns: string[] } | undefined;

function expandTilde(value: string): string {
	if (value === "~") return homedir();
	if (value.startsWith("~/")) return join(homedir(), value.slice(2));
	return value;
}

function resolveAgentSettingsPath(): string {
	const envDir = process.env[AGENT_SETTINGS_ENV];
	const agentDir = envDir ? expandTilde(envDir) : DEFAULT_AGENT_DIR;
	return join(agentDir, SETTINGS_FILE_NAME);
}

function readPiSettings(path: string): PiSettings | null {
	try {
		if (!fs.existsSync(path)) return null;
		const content = fs.readFileSync(path, "utf-8");
		return JSON.parse(content) as PiSettings;
	} catch {
		return null;
	}
}

function loadScopedModelPatterns(cwd: string): string[] {
	if (scopedModelPatternsCache?.cwd === cwd) {
		return scopedModelPatternsCache.patterns;
	}

	const globalSettings = readPiSettings(resolveAgentSettingsPath());
	const projectSettingsPath = join(cwd, PROJECT_SETTINGS_DIR, SETTINGS_FILE_NAME);
	const projectSettings = readPiSettings(projectSettingsPath);

	let enabledModels = Array.isArray(globalSettings?.enabledModels)
		? (globalSettings?.enabledModels as string[])
		: undefined;

	if (projectSettings && Object.prototype.hasOwnProperty.call(projectSettings, "enabledModels")) {
		enabledModels = Array.isArray(projectSettings.enabledModels)
			? (projectSettings.enabledModels as string[])
			: [];
	}

	const patterns = !enabledModels || enabledModels.length === 0
		? []
		: enabledModels.filter((value) => typeof value === "string");
	scopedModelPatternsCache = { cwd, patterns };
	return patterns;
}

/**
 * Create the extension
 */
export default function createExtension(pi: ExtensionAPI) {
	let lastContext: ExtensionContext | undefined;
	let settings: Settings = loadSettings();
	let uiEnabled = true;
	let currentUsage: UsageSnapshot | undefined;
	let usageEntries: Partial<Record<ProviderName, UsageSnapshot>> = {};
	let coreAvailable = false;
	let coreSettings: CoreSettings = getFallbackCoreSettings(settings);
	let fetchFailureTimer: NodeJS.Timeout | undefined;
	const antigravityHiddenModels = new Set(["tab_flash_lite_preview"]);
	let settingsWatcher: fs.FSWatcher | undefined;
	let settingsPoll: NodeJS.Timeout | undefined;
	let settingsDebounce: NodeJS.Timeout | undefined;
	let settingsSnapshot = "";
	let settingsMtimeMs = 0;
	let settingsWatchStarted = false;
	let subCoreBootstrapAttempted = false;

	async function probeSubCore(timeoutMs = 200): Promise<boolean> {
		return new Promise((resolve) => {
			let resolved = false;
			const timer = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					resolve(false);
				}
			}, timeoutMs);

			const request: SubCoreRequest = {
				type: "current",
				reply: () => {
					if (resolved) return;
					resolved = true;
					clearTimeout(timer);
					resolve(true);
				},
			};
			pi.events.emit("sub-core:request", request);
		});
	}

	async function ensureSubCoreLoaded(): Promise<void> {
		if (subCoreBootstrapAttempted) return;
		subCoreBootstrapAttempted = true;
		const hasCore = await probeSubCore();
		if (hasCore) return;
		try {
			const bundledUrl = new URL("./node_modules/@marckrenn/pi-sub-core/index.ts", import.meta.url);
			const module = await import(bundledUrl.toString());
			const createCore = module.default as undefined | ((api: ExtensionAPI) => void | Promise<void>);
			if (typeof createCore === "function") {
				void createCore(pi);
				return;
			}
		} catch {
			// Fall back to package resolution
		}
		try {
			const module = await import("@marckrenn/pi-sub-core");
			const createCore = module.default as undefined | ((api: ExtensionAPI) => void | Promise<void>);
			if (typeof createCore === "function") {
				void createCore(pi);
			}
		} catch (error) {
			console.warn("Failed to auto-load sub-core:", error);
		}
	}


	async function promptImportAction(ctx: ExtensionContext): Promise<"save-apply" | "save" | "cancel"> {
		return new Promise((resolve) => {
			ctx.ui.custom<void>((_tui, theme, _kb, done) => {
				const items = [
					{ value: "save-apply", label: "Save & apply", description: "save and use this theme" },
					{ value: "save", label: "Save", description: "save without applying" },
					{ value: "cancel", label: "Cancel", description: "discard import" },
				];
				const list = new SelectList(items, items.length, {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("muted", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				});
				list.onSelect = (item) => {
					done(undefined);
					resolve(item.value as "save-apply" | "save" | "cancel");
				};
				list.onCancel = () => {
					done(undefined);
					resolve("cancel");
				};
				return list;
			});
		});
	}

	async function promptImportString(ctx: ExtensionContext): Promise<string | undefined> {
		return new Promise((resolve) => {
			ctx.ui.custom<void>((_tui, theme, _kb, done) => {
				const input = new Input();
				input.focused = true;
				input.onSubmit = (value) => {
					done(undefined);
					resolve(value.trim());
				};
				input.onEscape = () => {
					done(undefined);
					resolve(undefined);
				};
				const container = new Container();
				container.addChild(new Text(theme.fg("muted", "Paste Theme Share string"), 1, 0));
				container.addChild(new Spacer(1));
				container.addChild(input);
				return {
					render: (width: number) => container.render(width),
					invalidate: () => container.invalidate(),
					handleInput: (data: string) => input.handleInput(data),
				};
			});
		});
	}

	async function promptImportName(ctx: ExtensionContext): Promise<string | undefined> {
		while (true) {
			const name = await ctx.ui.input("Theme name", "Theme");
			if (name === undefined) return undefined;
			const trimmed = name.trim();
			if (trimmed) return trimmed;
			ctx.ui.notify("Enter a theme name", "warning");
		}
	}

	const THEME_GIST_FILE_BASE = "pi-sub-bar Theme";
	const THEME_GIST_STATUS_KEY = "sub-bar:share";

	function buildThemeGistFileName(name: string): string {
		const trimmed = name.trim();
		if (!trimmed) return THEME_GIST_FILE_BASE;
		const safeName = trimmed.replace(/[\\/:*?"<>|]+/g, "-").trim();
		return safeName ? `${THEME_GIST_FILE_BASE} ${safeName}` : THEME_GIST_FILE_BASE;
	}

	async function createThemeGist(ctx: ExtensionContext, name: string, shareString: string): Promise<string | null> {
		const notify = (message: string, level: "info" | "warning" | "error") => {
			if (ctx.hasUI) {
				ctx.ui.notify(message, level);
				return;
			}
			if (level === "error") {
				console.error(message);
			} else if (level === "warning") {
				console.warn(message);
			} else {
				console.log(message);
			}
		};

		try {
			const authResult = await pi.exec("gh", ["auth", "status"]);
			if (authResult.code !== 0) {
				notify("GitHub CLI is not logged in. Run 'gh auth login' first.", "error");
				return null;
			}
		} catch {
			notify("GitHub CLI (gh) is not installed. Install it from https://cli.github.com/", "error");
			return null;
		}

		const tempDir = fs.mkdtempSync(join(tmpdir(), "pi-sub-bar-"));
		const fileName = buildThemeGistFileName(name);
		const filePath = join(tempDir, fileName);
		fs.writeFileSync(filePath, shareString, "utf-8");

		if (ctx.hasUI) {
			ctx.ui.setStatus(THEME_GIST_STATUS_KEY, "Creating gist...");
		}

		try {
			const result = await pi.exec("gh", ["gist", "create", "--public=false", filePath]);
			if (result.code !== 0) {
				const errorMsg = result.stderr?.trim() || "Unknown error";
				notify(`Failed to create gist: ${errorMsg}`, "error");
				return null;
			}
			const gistUrl = result.stdout?.trim();
			if (!gistUrl) {
				notify("Failed to create gist: empty response", "error");
				return null;
			}
			return gistUrl;
		} catch (error) {
			notify(`Failed to create gist: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
			return null;
		} finally {
			if (ctx.hasUI) {
				ctx.ui.setStatus(THEME_GIST_STATUS_KEY, undefined);
			}
			try {
				fs.rmSync(tempDir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}

	async function shareThemeString(
		ctx: ExtensionContext,
		name: string,
		shareString: string,
		mode: "prompt" | "gist" | "string" = "prompt",
	): Promise<void> {
		const trimmedName = name.trim();
		const notify = (message: string, level: "info" | "warning" | "error") => {
			if (ctx.hasUI) {
				ctx.ui.notify(message, level);
				return;
			}
			if (level === "error") {
				console.error(message);
			} else if (level === "warning") {
				console.warn(message);
			} else {
				console.log(message);
			}
		};
		let resolvedMode = mode;
		if (resolvedMode === "prompt") {
			if (!ctx.hasUI) {
				resolvedMode = "string";
			} else {
				const wantsGist = await ctx.ui.confirm("Share Theme", "Upload to a secret GitHub gist?");
				resolvedMode = wantsGist ? "gist" : "string";
			}
		}

		if (resolvedMode === "gist") {
			const gistUrl = await createThemeGist(ctx, trimmedName, shareString);
			if (gistUrl) {
				pi.sendMessage({
					customType: "sub-bar",
					content: `Theme gist:\n${gistUrl}`,
					display: true,
				});
				notify("Theme gist posted to chat", "info");
				return;
			}
			notify("Posting share string instead.", "warning");
		}

		pi.sendMessage({
			customType: "sub-bar",
			content: `Theme share string:\n${shareString}`,
			display: true,
		});
		notify("Theme share string posted to chat", "info");
	}

	function readSettingsFile(): string | undefined {
		try {
			return fs.readFileSync(SETTINGS_PATH, "utf-8");
		} catch {
			return undefined;
		}
	}

	function applySettingsFromDisk(): void {
		clearSettingsCache();
		const loaded = loadSettings();
		settings = {
			...settings,
			version: loaded.version,
			display: loaded.display,
			providers: loaded.providers,
			displayThemes: loaded.displayThemes,
			displayUserTheme: loaded.displayUserTheme,
			pinnedProvider: loaded.pinnedProvider,
			keybindings: loaded.keybindings,
		};
		coreSettings = getFallbackCoreSettings(settings);
		updateFetchFailureTicker();
		void ensurePinnedEntries(settings.pinnedProvider ?? null);
		if (lastContext) {
			renderCurrent(lastContext);
		}
	}

	function refreshSettingsSnapshot(): void {
		const content = readSettingsFile();
		if (!content || content === settingsSnapshot) return;
		try {
			JSON.parse(content);
		} catch {
			return;
		}
		settingsSnapshot = content;
		applySettingsFromDisk();
	}

	function checkSettingsFile(): void {
		try {
			const stat = fs.statSync(SETTINGS_PATH, { throwIfNoEntry: false });
			if (!stat || !stat.mtimeMs) return;
			if (stat.mtimeMs === settingsMtimeMs) return;
			settingsMtimeMs = stat.mtimeMs;
			refreshSettingsSnapshot();
		} catch {
			// Ignore missing files
		}
	}

	function scheduleSettingsRefresh(): void {
		if (settingsDebounce) clearTimeout(settingsDebounce);
		settingsDebounce = setTimeout(() => checkSettingsFile(), 200);
	}

	function startSettingsWatch(): void {
		if (settingsWatchStarted) return;
		settingsWatchStarted = true;
		if (!settingsSnapshot) {
			const content = readSettingsFile();
			if (content) {
				settingsSnapshot = content;
				try {
					const stat = fs.statSync(SETTINGS_PATH, { throwIfNoEntry: false });
					if (stat?.mtimeMs) settingsMtimeMs = stat.mtimeMs;
				} catch {
					// Ignore
				}
			}
		}
		try {
			settingsWatcher = fs.watch(SETTINGS_PATH, scheduleSettingsRefresh);
			settingsWatcher.unref?.();
		} catch {
			settingsWatcher = undefined;
		}
		settingsPoll = setInterval(() => checkSettingsFile(), 2000);
		settingsPoll.unref?.();
	}

	function formatUsageContent(
		ctx: ExtensionContext,
		theme: Theme,
		usage: UsageSnapshot | undefined,
		contentWidth: number,
		message?: string,
		options?: { forceNoFill?: boolean; forceLeftAlignment?: boolean }
	): string[] {
		const paddingLeft = settings.display.paddingLeft ?? 0;
		const paddingRight = settings.display.paddingRight ?? 0;
		const innerWidth = Math.max(1, contentWidth - paddingLeft - paddingRight);
		const configuredAlignment = settings.display.alignment ?? "left";
		const alignment = options?.forceLeftAlignment ? "left" : configuredAlignment;
		const configuredHasFill = settings.display.barWidth === "fill" || settings.display.dividerBlanks === "fill";
		const hasFill = options?.forceNoFill ? false : configuredHasFill;
		const wantsSplit = options?.forceNoFill ? false : alignment === "split";
		const shouldAlign = !hasFill && !wantsSplit && (alignment === "center" || alignment === "right");
		const baseTextColor = resolveBaseTextColor(settings.display.baseTextColor);
		const scopedModelPatterns = loadScopedModelPatterns(ctx.cwd);
		const modelInfo = ctx.model
			? { provider: ctx.model.provider, id: ctx.model.id, scopedModelPatterns }
			: { scopedModelPatterns };

		// Get context usage info from pi framework
		const ctxUsage = ctx.getContextUsage?.();
		const contextInfo: ContextInfo | undefined = ctxUsage && ctxUsage.contextWindow > 0
			? { tokens: ctxUsage.tokens, contextWindow: ctxUsage.contextWindow, percent: ctxUsage.percent }
			: undefined;

		const formatted = message
			? applyBaseTextColor(theme, baseTextColor, message)
			: (!usage)
				? undefined
				: (hasFill || wantsSplit)
					? formatUsageStatusWithWidth(theme, usage, innerWidth, modelInfo, settings, { labelGapFill: wantsSplit }, contextInfo)
					: formatUsageStatus(theme, usage, modelInfo, settings, contextInfo);

		const alignLine = (line: string) => {
			if (!shouldAlign) return line;
			const lineWidth = visibleWidth(line);
			if (lineWidth >= innerWidth) return line;
			const padding = innerWidth - lineWidth;
			const leftPad = alignment === "center" ? Math.floor(padding / 2) : padding;
			return " ".repeat(leftPad) + line;
		};

		let lines: string[] = [];
		if (!formatted) {
			lines = [];
		} else if (settings.display.overflow === "wrap") {
			lines = wrapTextWithAnsi(formatted, innerWidth).map(alignLine);
		} else {
			const trimmed = alignLine(truncateToWidth(formatted, innerWidth, theme.fg("dim", "...")));
			lines = [trimmed];
		}

		if (paddingLeft > 0 || paddingRight > 0) {
			const leftPad = " ".repeat(paddingLeft);
			const rightPad = " ".repeat(paddingRight);
			lines = lines.map((line) => `${leftPad}${line}${rightPad}`);
		}

		return lines;
	}

	function buildStatusEdgeDivider(theme: Theme): string {
		const dividerChar = settings.display.dividerCharacter ?? "│";
		if (dividerChar === "none") return "";
		const dividerColor: ThemeColor = resolveDividerColor(settings.display.dividerColor);
		const dividerGlyph = dividerChar === "blank" ? " " : dividerChar;
		if (!dividerGlyph) return "";
		const blanks = typeof settings.display.dividerBlanks === "number" ? settings.display.dividerBlanks : 1;
		const spacing = " ".repeat(Math.max(0, blanks));
		return `${spacing}${theme.fg(dividerColor, dividerGlyph)}${spacing}`;
	}

	function renderUsageWidget(ctx: ExtensionContext, usage: UsageSnapshot | undefined, message?: string): void {
		if (!ctx.hasUI || !uiEnabled) {
			return;
		}

		const placement = settings.display.widgetPlacement ?? "belowEditor";

		if (placement === "status") {
			ctx.ui.setWidget("usage", undefined);
			if (!usage && !message) {
				ctx.ui.setStatus("sub-bar", "");
				return;
			}
			const theme = ctx.ui.theme;
			const terminalWidth = process.stdout.columns || 80;
			// In status-line placement we must not use fill-based layouts (they assume full terminal width).
			// The Pi footer concatenates *all* extension statuses onto one line and then truncates,
			// so we render at natural width here to avoid padding that would overflow when other
			// status hooks are present.
			const lines = formatUsageContent(ctx, theme, usage, terminalWidth, message, {
				forceNoFill: true,
				forceLeftAlignment: true,
			});
			if (lines.length === 0) {
				ctx.ui.setStatus("sub-bar", "");
				return;
			}
			let statusLine = lines.join(" ");
			const edgeDivider = buildStatusEdgeDivider(theme);
			if (edgeDivider) {
				if (settings.display.statusLeadingDivider) {
					statusLine = `${edgeDivider}${statusLine}`;
				}
				if (settings.display.statusTrailingDivider) {
					statusLine = `${statusLine}${edgeDivider}`;
				}
			}
			ctx.ui.setStatus("sub-bar", truncateToWidth(statusLine, terminalWidth, theme.fg("dim", "...")));
			return;
		}

		ctx.ui.setStatus("sub-bar", "");
		if (!usage && !message) {
			ctx.ui.setWidget("usage", undefined);
			return;
		}

		const widgetPlacement = placement === "aboveEditor" ? "aboveEditor" : "belowEditor";
		const setWidgetWithPlacement = (ctx.ui as unknown as { setWidget: (...args: unknown[]) => void }).setWidget;
		setWidgetWithPlacement(
			"usage",
			(_tui: unknown, theme: Theme) => ({
				render(width: number) {
					const safeWidth = Math.max(1, width);
					const showTopDivider = settings.display.showTopDivider ?? false;
					const showBottomDivider = settings.display.showBottomDivider ?? true;
					const dividerChar = settings.display.dividerCharacter ?? "•";
					const dividerColor: ThemeColor = resolveDividerColor(settings.display.dividerColor);
					const dividerConnect = settings.display.dividerFooterJoin ?? false;
					const dividerLine = theme.fg(dividerColor, "─".repeat(safeWidth));

					let lines = formatUsageContent(ctx, theme, usage, safeWidth, message);

					if (showTopDivider) {
						const baseLine = lines.length > 0 ? lines[0] : "";
						const topLine = dividerConnect
							? buildDividerLine(safeWidth, baseLine, dividerChar, dividerConnect, "top", dividerColor, theme)
							: dividerLine;
						lines = [topLine, ...lines];
					}
					if (showBottomDivider) {
						const baseLine = lines.length > 0 ? lines[lines.length - 1] : "";
						const footerLine = dividerConnect
							? buildDividerLine(safeWidth, baseLine, dividerChar, dividerConnect, "bottom", dividerColor, theme)
							: dividerLine;
						lines = [...lines, footerLine];
					}

					const backgroundColor = resolveBaseTextColor(settings.display.backgroundColor);
					return applyBackground(lines, theme, backgroundColor, safeWidth);
				},
				invalidate() {},
			}),
			{ placement: widgetPlacement },
		);
	}

	function resolveDisplayedUsage(): UsageSnapshot | undefined {
		const pinned = settings.pinnedProvider ?? null;
		if (pinned) {
			return usageEntries[pinned] ?? currentUsage;
		}
		return currentUsage;
	}

	function syncAntigravityModels(usage?: UsageSnapshot): void {
		if (!usage || usage.provider !== "antigravity") return;
		const normalizeModel = (label: string) => label.toLowerCase().replace(/\s+/g, "_");
		const labels = usage.windows
			.map((window) => window.label?.trim())
			.filter((label): label is string => Boolean(label))
			.filter((label) => !antigravityHiddenModels.has(normalizeModel(label)));
		const uniqueModels = Array.from(new Set(labels));
		const antigravitySettings = settings.providers.antigravity;
		const visibility = { ...(antigravitySettings.modelVisibility ?? {}) };
		const modelSet = new Set(uniqueModels);
		let changed = false;

		for (const model of uniqueModels) {
			if (!(model in visibility)) {
				visibility[model] = false;
				changed = true;
			}
		}

		for (const existing of Object.keys(visibility)) {
			if (!modelSet.has(existing)) {
				delete visibility[existing];
				changed = true;
			}
		}

		const currentOrder = antigravitySettings.modelOrder ?? [];
		const orderChanged = currentOrder.length !== uniqueModels.length
			|| currentOrder.some((model, index) => model !== uniqueModels[index]);
		if (orderChanged) {
			changed = true;
		}

		if (!changed) return;
		antigravitySettings.modelVisibility = visibility;
		antigravitySettings.modelOrder = uniqueModels;
		saveSettings(settings);
	}

	function updateEntries(entries: ProviderUsageEntry[] | undefined): void {
		if (!entries) return;
		const next: Partial<Record<ProviderName, UsageSnapshot>> = {};
		for (const entry of entries) {
			if (!entry.usage) continue;
			next[entry.provider] = entry.usage;
		}
		usageEntries = next;
		syncAntigravityModels(next.antigravity);
		updateFetchFailureTicker();
	}

	function updateFetchFailureTicker(): void {
		if (!uiEnabled) {
			if (fetchFailureTimer) {
				clearInterval(fetchFailureTimer);
				fetchFailureTimer = undefined;
			}
			return;
		}
		const usage = resolveDisplayedUsage();
		const shouldTick = Boolean(usage?.error && usage.lastSuccessAt);
		if (shouldTick && !fetchFailureTimer) {
			fetchFailureTimer = setInterval(() => {
				if (!lastContext) return;
				renderCurrent(lastContext);
			}, 60000);
			fetchFailureTimer.unref?.();
		}
		if (!shouldTick && fetchFailureTimer) {
			clearInterval(fetchFailureTimer);
			fetchFailureTimer = undefined;
		}
	}

	function renderCurrent(ctx: ExtensionContext): void {
		if (!coreAvailable) {
			renderUsageWidget(ctx, undefined, "pi-sub-core required. install with: pi install npm:@marckrenn/pi-sub-core");
			return;
		}
		const usage = resolveDisplayedUsage();
		renderUsageWidget(ctx, usage);
	}

	function updateUsage(usage: UsageSnapshot | undefined): void {
		currentUsage = usage;
		syncAntigravityModels(usage);
		updateFetchFailureTicker();
		if (lastContext) {
			renderCurrent(lastContext);
		}
	}

	function applyCoreSettings(next?: CoreSettings): void {
		if (!next) return;
		coreSettings = next;
		settings.behavior = next.behavior ?? settings.behavior;
		settings.statusRefresh = next.statusRefresh ?? settings.statusRefresh;
		settings.providerOrder = next.providerOrder ?? settings.providerOrder;
		settings.defaultProvider = next.defaultProvider ?? settings.defaultProvider;
	}

	function applyCoreSettingsPatch(patch: Partial<CoreSettings>): void {
		if (patch.providers) {
			for (const [provider, value] of Object.entries(patch.providers)) {
				const key = provider as ProviderName;
				const current = coreSettings.providers[key];
				if (!current) continue;
				coreSettings.providers[key] = { ...current, ...value };
			}
		}
		if (patch.behavior) {
			coreSettings.behavior = { ...coreSettings.behavior, ...patch.behavior };
		}
		if (patch.statusRefresh) {
			coreSettings.statusRefresh = { ...coreSettings.statusRefresh, ...patch.statusRefresh };
		}
		if (patch.providerOrder) {
			coreSettings.providerOrder = [...patch.providerOrder];
		}
		if (patch.defaultProvider !== undefined) {
			coreSettings.defaultProvider = patch.defaultProvider;
		}
	}

	function emitCoreAction(action: SubCoreAction): void {
		pi.events.emit("sub-core:action", action);
	}

	function requestCoreState(timeoutMs = 1000): Promise<SubCoreState | undefined> {
		return new Promise((resolve) => {
			let resolved = false;
			const timer = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					resolve(undefined);
				}
			}, timeoutMs);

			const request: SubCoreRequest = {
				type: "current",
				includeSettings: true,
				reply: (payload) => {
					if (resolved) return;
					resolved = true;
					clearTimeout(timer);
					applyCoreSettings(payload.settings);
					resolve(payload.state);
				},
			};

			pi.events.emit("sub-core:request", request);
		});
	}

	function requestCoreEntries(timeoutMs = 1000): Promise<ProviderUsageEntry[] | undefined> {
		return new Promise((resolve) => {
			let resolved = false;
			const timer = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					resolve(undefined);
				}
			}, timeoutMs);

			const request: SubCoreRequest = {
				type: "entries",
				reply: (payload) => {
					if (resolved) return;
					resolved = true;
					clearTimeout(timer);
					resolve(payload.entries);
				},
			};

			pi.events.emit("sub-core:request", request);
		});
	}

	async function ensurePinnedEntries(pinned: ProviderName | null): Promise<void> {
		if (!pinned) return;
		if (usageEntries[pinned]) return;
		const entries = await requestCoreEntries();
		updateEntries(entries);
		if (lastContext) {
			renderCurrent(lastContext);
		}
	}

	pi.events.on("sub-core:update-all", (payload) => {
		coreAvailable = true;
		const state = payload as { state?: SubCoreAllState };
		updateEntries(state.state?.entries);
		if (lastContext) {
			renderCurrent(lastContext);
		}
	});

	pi.events.on("sub-core:update-current", (payload) => {
		coreAvailable = true;
		const state = payload as { state?: SubCoreState };
		updateUsage(state.state?.usage);
	});

	pi.events.on("sub-core:ready", (payload) => {
		coreAvailable = true;
		const state = payload as { state?: SubCoreState; settings?: CoreSettings };
		applyCoreSettings(state.settings);
		updateUsage(state.state?.usage);
	});

	pi.events.on("sub-core:settings:updated", (payload) => {
		const update = payload as { settings?: CoreSettings };
		applyCoreSettings(update.settings);
		if (lastContext) {
			renderCurrent(lastContext);
		}
	});

	// Register command to open settings
	pi.registerCommand("sub-bar:settings", {
		description: "Open sub-bar settings",
		handler: async (_args, ctx) => {
			const newSettings = await showSettingsUI(ctx, {
				coreSettings,
				onOpenCoreSettings: async () => {
					ctx.ui.setEditorText("/sub-core:settings");
				},
				onSettingsChange: async (updatedSettings) => {
					const previousPinned = settings.pinnedProvider ?? null;
					settings = updatedSettings;
					updateFetchFailureTicker();
					if (settings.pinnedProvider && settings.pinnedProvider !== previousPinned) {
						void ensurePinnedEntries(settings.pinnedProvider);
					}
					if (lastContext) {
						renderCurrent(lastContext);
					}
				},
				onCoreSettingsChange: async (patch, _next) => {
					applyCoreSettingsPatch(patch);
					pi.events.emit("sub-core:settings:patch", { patch });
					if (lastContext) {
						renderCurrent(lastContext);
					}
				},
				onDisplayThemeApplied: (name, options) => {
					const content = options?.source === "manual"
						? `sub-bar Theme ${name} loaded`
						: `sub-bar Theme ${name} loaded / applied / saved. Restore settings in /sub-bar:settings -> Themes -> Load & Manage themes`;
					pi.sendMessage({
						customType: "sub-bar",
						content,
						display: true,
					});
				},
				onDisplayThemeShared: (name, shareString, mode) => shareThemeString(ctx, name, shareString, mode ?? "prompt"),
			});
			settings = newSettings;
			void ensurePinnedEntries(settings.pinnedProvider ?? null);
			if (lastContext) {
				renderCurrent(lastContext);
			}
		},
	});

	pi.registerCommand("sub-bar:import", {
		description: "Import a shared display theme",
		handler: async (args, ctx) => {
			let input = String(args ?? "").trim();
			if (input.startsWith("/sub-bar:import")) {
				input = input.replace(/^\/sub-bar:import\s*/i, "").trim();
			} else if (input.startsWith("sub-bar:import")) {
				input = input.replace(/^sub-bar:import\s*/i, "").trim();
			}
			if (!input) {
				const typed = await promptImportString(ctx);
				if (!typed) return;
				input = typed;
			}
			const decoded = decodeDisplayShareString(input);
			if (!decoded) {
				ctx.ui.notify("Invalid theme share string", "error");
				return;
			}
			const backup = { ...settings.display };
			settings.display = { ...decoded.display };
			if (lastContext) {
				renderUsageWidget(lastContext, currentUsage);
			}

			const action = await promptImportAction(ctx);
			let resolvedName = decoded.name;
			if ((action === "save-apply" || action === "save") && !decoded.hasName) {
				const providedName = await promptImportName(ctx);
				if (!providedName) {
					settings.display = { ...backup };
					if (lastContext) {
						renderUsageWidget(lastContext, currentUsage);
					}
					return;
				}
				resolvedName = providedName;
			}
			const notifyImported = (name: string) => {
				const message = decoded.isNewerVersion
					? `Imported ${name} (newer version, some fields may be ignored)`
					: `Imported ${name}`;
				ctx.ui.notify(message, decoded.isNewerVersion ? "warning" : "info");
			};

			if (action === "save-apply") {
				settings.displayUserTheme = { ...backup };
				settings = upsertDisplayTheme(settings, resolvedName, decoded.display, "imported");
				settings.display = { ...decoded.display };
				saveSettings(settings);
				if (lastContext) {
					renderUsageWidget(lastContext, currentUsage);
				}
				notifyImported(resolvedName);
				pi.sendMessage({
					customType: "sub-bar",
					content: `sub-bar Theme ${resolvedName} loaded`,
					display: true,
				});
				return;
			}

			if (action === "save") {
				settings = upsertDisplayTheme(settings, resolvedName, decoded.display, "imported");
				settings.display = { ...backup };
				saveSettings(settings);
				notifyImported(resolvedName);
				if (lastContext) {
					renderUsageWidget(lastContext, currentUsage);
				}
				return;
			}

			settings.display = { ...backup };
			if (lastContext) {
				renderUsageWidget(lastContext, currentUsage);
			}
		},
	});

	// Register shortcut to cycle providers
	const cycleProviderKey = settings.keybindings?.cycleProvider || "ctrl+alt+p";
	if (cycleProviderKey !== "none") {
		pi.registerShortcut(cycleProviderKey as KeyId, {
			description: "Cycle usage provider",
			handler: async () => {
				emitCoreAction({ type: "cycleProvider" });
			},
		});
	}

	// Register shortcut to toggle reset timer format
	const toggleResetFormatKey = settings.keybindings?.toggleResetFormat || "ctrl+alt+r";
	if (toggleResetFormatKey !== "none") {
		pi.registerShortcut(toggleResetFormatKey as KeyId, {
			description: "Toggle reset timer format",
			handler: async () => {
				settings.display.resetTimeFormat = settings.display.resetTimeFormat === "datetime" ? "relative" : "datetime";
				saveSettings(settings);
				if (lastContext && currentUsage) {
					renderUsageWidget(lastContext, currentUsage);
				}
			},
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		lastContext = ctx;
		uiEnabled = ctx.hasUI;
		if (!uiEnabled) {
			return;
		}
		settings = loadSettings();
		coreSettings = getFallbackCoreSettings(settings);
		if (!settingsSnapshot) {
			const content = readSettingsFile();
			if (content) {
				settingsSnapshot = content;
				try {
					const stat = fs.statSync(SETTINGS_PATH, { throwIfNoEntry: false });
					if (stat?.mtimeMs) settingsMtimeMs = stat.mtimeMs;
				} catch {
					// Ignore
				}
			}
		}

		const watchTimer = setTimeout(() => startSettingsWatch(), 0);
		watchTimer.unref?.();

		const sessionContext = ctx;
		void (async () => {
			await ensureSubCoreLoaded();
			if (!lastContext || lastContext !== sessionContext || !uiEnabled) return;
			const state = await requestCoreState();
			if (!lastContext || lastContext !== sessionContext || !uiEnabled) return;
			if (state) {
				coreAvailable = true;
				updateUsage(state.usage);
				if (settings.pinnedProvider) {
					const entries = await requestCoreEntries();
					if (!lastContext || lastContext !== sessionContext || !uiEnabled) return;
					updateEntries(entries);
					if (lastContext) {
						renderCurrent(lastContext);
					}
				}
			} else if (lastContext && !coreAvailable) {
				coreAvailable = false;
				renderCurrent(lastContext);
			}
		})();
	});

	pi.on("model_select" as unknown as "session_start", async (_event: unknown, ctx: ExtensionContext) => {
		lastContext = ctx;
		if (!uiEnabled || !ctx.hasUI) {
			return;
		}
		if (currentUsage) {
			renderUsageWidget(ctx, currentUsage);
		}
	});

	pi.on("session_shutdown", async () => {
		lastContext = undefined;
		if (fetchFailureTimer) {
			clearInterval(fetchFailureTimer);
			fetchFailureTimer = undefined;
		}
	});

}

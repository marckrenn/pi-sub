/**
 * Settings UI for sub-bar
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, Input, SelectList, Spacer, Text } from "@mariozechner/pi-tui";
import { SettingsList, type SettingItem, CUSTOM_OPTION } from "../ui/settings-list.js";
import type { ProviderName } from "../types.js";
import type { Settings } from "../settings-types.js";
import type { CoreSettings } from "@marckrenn/pi-sub-shared";
import { getFallbackCoreSettings } from "../core-settings.js";
import { getDefaultSettings } from "../settings-types.js";
import { getSettings, saveSettings } from "../settings.js";
import { PROVIDER_DISPLAY_NAMES } from "../providers/metadata.js";
import { buildProviderSettingsItems, applyProviderSettingsChange } from "../providers/settings.js";
import {
	buildDisplayLayoutItems,
	buildDisplayResetItems,
	buildDisplayColorItems,
	buildDisplayBarItems,
	buildDisplayProviderItems,
	buildDisplayStatusItems,
	buildDisplayDividerItems,
	buildUsageColorTargetItems,
	formatUsageColorTargetsSummary,
	applyDisplayChange,
} from "./display.js";
import {
	buildMainMenuItems,
	buildProviderListItems,
	buildDisplayMenuItems,
	buildDisplayThemeMenuItems,
	getProviderFromCategory,
	type TooltipSelectItem,
} from "./menu.js";
import {
	buildDisplayThemeItems,
	buildThemeActionItems,
	buildRandomDisplay,
	resolveDisplayThemeTarget,
	saveDisplayTheme,
	renameDisplayTheme,
	upsertDisplayTheme,
} from "./themes.js";
import {
	buildDisplayShareString,
	buildDisplayShareStringWithoutName,
	decodeDisplayShareString,
	type DecodedDisplayShare,
} from "../share.js";

/**
 * Settings category
 */
type ProviderCategory = `provider-${ProviderName}`;

type SettingsCategory =
	| "main"
	| "providers"
	| "pin-provider"
	| ProviderCategory
	| "keybindings"
	| "display"
	| "display-theme"
	| "display-theme-save"
	| "display-theme-share"
	| "display-theme-load"
	| "display-theme-action"
	| "display-theme-import"
	| "display-theme-import-action"
	| "display-theme-import-name"
	| "display-theme-rename"
	| "display-theme-random"
	| "display-theme-restore"
	| "display-layout"
	| "display-bar"
	| "display-provider"
	| "display-reset"
	| "display-status"
	| "display-divider"
	| "display-color";

/**
 * Show the settings UI
 */
export async function showSettingsUI(
	ctx: ExtensionContext,
	options?: {
		coreSettings?: CoreSettings;
		onSettingsChange?: (settings: Settings) => void | Promise<void>;
		onCoreSettingsChange?: (patch: Partial<CoreSettings>, next: CoreSettings) => void | Promise<void>;
		onOpenCoreSettings?: () => void | Promise<void>;
		onDisplayThemeApplied?: (name: string, options?: { source?: "manual" }) => void | Promise<void>;
		onDisplayThemeShared?: (name: string, shareString: string, mode?: "prompt" | "gist" | "string") => void | Promise<void>;
	}
): Promise<Settings> {
	const onSettingsChange = options?.onSettingsChange;
	const onCoreSettingsChange = options?.onCoreSettingsChange;
	const onOpenCoreSettings = options?.onOpenCoreSettings;
	let settings = getSettings();
	let coreSettings = options?.coreSettings ?? getFallbackCoreSettings(settings);
	const onDisplayThemeApplied = options?.onDisplayThemeApplied;
	const onDisplayThemeShared = options?.onDisplayThemeShared;
	let currentCategory: SettingsCategory = "main";

	return new Promise((resolve) => {
		ctx.ui.custom<Settings>((tui, theme, _kb, done) => {
			let container = new Container();
			let activeList: SelectList | SettingsList | { handleInput: (data: string) => void } | null = null;
			let themeActionTarget: { id?: string; name: string; display: Settings["display"]; deletable: boolean } | null = null;
			let displayPreviewBackup: Settings["display"] | null = null;
			let randomThemeBackup: Settings["display"] | null = null;
			let displayThemeSelection: string | null = null;
			let pinnedProviderBackup: ProviderName | null | undefined;
			let importCandidate: DecodedDisplayShare | null = null;
			let importBackup: Settings["display"] | null = null;
			let importPendingAction: "save" | "save-apply" | null = null;
			let pendingShare: { name: string; shareString: string; backCategory: SettingsCategory } | null = null;
			const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

			const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

			const buildInputSubmenu = (
				label: string,
				parseValue: (value: string) => string | null,
				formatInitial?: (value: string) => string,
				description?: string,
			) => {
				return (currentValue: string, done: (selectedValue?: string) => void) => {
					const input = new Input();
					input.focused = true;
					input.setValue(formatInitial ? formatInitial("") : "");
					input.onSubmit = (value) => {
						const parsed = parseValue(value);
						if (!parsed) return;
						done(parsed);
					};
					input.onEscape = () => {
						done();
					};

					const container = new Container();
					container.addChild(new Text(theme.fg("muted", label), 1, 0));
					if (description) {
						container.addChild(new Text(theme.fg("dim", description), 1, 0));
					}
					container.addChild(new Spacer(1));
					container.addChild(input);

					return {
						render: (width: number) => container.render(width),
						invalidate: () => container.invalidate(),
						handleInput: (data: string) => input.handleInput(data),
					};
				};
			};

			const requestThemeShare = (name: string, shareString: string, backCategory: SettingsCategory) => {
				pendingShare = { name, shareString, backCategory };
				displayThemeSelection = "display-theme-share";
				currentCategory = "display-theme-share";
				rebuild();
				tui.requestRender();
			};

			const parseInteger = (raw: string, min: number, max: number): string | null => {
				const trimmed = raw.trim().replace(/%$/, "");
				if (!trimmed) {
					ctx.ui.notify("Enter a value", "warning");
					return null;
				}
				const parsed = Number.parseInt(trimmed, 10);
				if (Number.isNaN(parsed)) {
					ctx.ui.notify("Enter a number", "warning");
					return null;
				}
				return String(clamp(parsed, min, max));
			};

			const parseBarWidth = (raw: string): string | null => {
				const trimmed = raw.trim().toLowerCase();
				if (!trimmed) {
					ctx.ui.notify("Enter a value", "warning");
					return null;
				}
				if (trimmed === "fill") {
					if ((settings.display.widgetPlacement ?? "belowEditor") === "status") {
						ctx.ui.notify("fill is unavailable in status-line placement", "warning");
						return null;
					}
					return "fill";
				}
				return parseInteger(trimmed, 0, 100);
			};

			const parseDividerBlanks = (raw: string): string | null => {
				const trimmed = raw.trim().toLowerCase();
				if (!trimmed) {
					ctx.ui.notify("Enter a value", "warning");
					return null;
				}
				if (trimmed === "fill") return "fill";
				return parseInteger(trimmed, 0, 100);
			};

			const parseResetContainment = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter 1-2 characters", "warning");
					return null;
				}
				const normalized = trimmed.toLowerCase();
				if (["none", "blank", "()", "[]", "<>"].includes(normalized)) {
					return normalized;
				}
				const segments = Array.from(segmenter.segment(trimmed), (entry) => entry.segment)
					.map((segment) => segment.trim())
					.filter(Boolean);
				if (segments.length === 0) {
					ctx.ui.notify("Enter 1-2 characters", "warning");
					return null;
				}
				const first = segments[0];
				const second = segments[1] ?? first;
				return `${first}${second}`;
			};

			const parseDividerCharacter = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter a character", "warning");
					return null;
				}
				const normalized = trimmed.toLowerCase();
				if (normalized === "none" || normalized === "blank") {
					return normalized;
				}
				const iterator = segmenter.segment(trimmed)[Symbol.iterator]();
				const first = iterator.next().value?.segment ?? trimmed[0];
				return first;
			};

			const parseBarCharacter = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter a character", "warning");
					return null;
				}
				const normalized = trimmed.toLowerCase();
				if (["light", "heavy", "double", "block"].includes(normalized)) {
					return normalized;
				}
				const segments = Array.from(segmenter.segment(raw), (entry) => entry.segment).filter((segment) => segment !== "\n" && segment !== "\r");
				const first = segments[0] ?? trimmed[0];
				const second = segments[1];
				return second ? `${first}${second}` : first;
			};

			const parseStatusIconCustom = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter four characters", "warning");
					return null;
				}
				const segments = Array.from(segmenter.segment(trimmed), (entry) => entry.segment)
					.map((segment) => segment.trim())
					.filter(Boolean);
				if (segments.length < 4) {
					ctx.ui.notify("Enter four characters", "warning");
					return null;
				}
				return segments.slice(0, 4).join("");
			};

			const parseProviderLabel = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter a label", "warning");
					return null;
				}
				const normalized = trimmed.toLowerCase();
				if (["none", "plan", "subscription", "sub"].includes(normalized)) {
					return normalized;
				}
				return trimmed;
			};

			const attachCustomInputs = (
				items: SettingItem[],
				handlers: Record<string, ReturnType<typeof buildInputSubmenu>>,
			) => {
				for (const item of items) {
					if (!item.values || !item.values.includes(CUSTOM_OPTION)) continue;
					const handler = handlers[item.id];
					if (!handler) continue;
					item.submenu = handler;
				}
			};

			const buildUsageColorSubmenu = () => {
				return (_currentValue: string, done: (selectedValue?: string) => void) => {
					const items = buildUsageColorTargetItems(settings);
					const handleChange = (id: string, value: string) => {
						settings = applyDisplayChange(settings, id, value);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
					};
					const list = new SettingsList(
						items,
						Math.min(items.length + 2, 10),
						getSettingsListTheme(),
						handleChange,
						() => {
							done(formatUsageColorTargetsSummary(settings.display.usageColorTargets));
						}
					);
					return list;
				};
			};

			function rebuild(): void {
				container = new Container();
				let tooltipText: Text | null = null;

				const attachTooltip = (items: TooltipSelectItem[], selectList: SelectList): void => {
					if (!items.some((item) => item.tooltip)) return;
					const tooltipComponent = new Text("", 1, 0);
					const setTooltip = (item?: TooltipSelectItem | null) => {
						const tooltip = item?.tooltip?.trim();
						tooltipComponent.setText(tooltip ? theme.fg("dim", tooltip) : "");
					};
					setTooltip(selectList.getSelectedItem() as TooltipSelectItem | null);
					const existingHandler = selectList.onSelectionChange;
					selectList.onSelectionChange = (item) => {
						if (existingHandler) existingHandler(item);
						setTooltip(item as TooltipSelectItem);
						tui.requestRender();
					};
					tooltipText = tooltipComponent;
				};

				// Top border
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				// Title
				const titles: Record<string, string> = {
					main: "sub-bar Settings",
					providers: "Provider Settings",
					"pin-provider": "Provider Shown",
					keybindings: "Keybindings",
					display: "Adv. Display Settings",
					"display-theme": "Themes",
					"display-theme-save": "Save Theme",
					"display-theme-share": "Share Theme",
					"display-theme-rename": "Rename Theme",
					"display-theme-load": "Load & Manage themes",
					"display-theme-action": "Manage Theme",
					"display-theme-import": "Import Theme",
					"display-theme-import-name": "Name Theme",
					"display-theme-restore": "Restore Theme",
					"display-layout": "Layout & Structure",
					"display-bar": "Bars",
					"display-provider": "Labels & Text",
					"display-reset": "Reset Timer",
					"display-status": "Status",
					"display-divider": "Dividers",
					"display-color": "Colors",
				};
				const providerCategory = getProviderFromCategory(currentCategory);
				let title = providerCategory
					? `${PROVIDER_DISPLAY_NAMES[providerCategory]} Settings`
					: (titles[currentCategory] ?? "sub-bar Settings");
				if (currentCategory === "display-theme-action" && themeActionTarget) {
					title = `Manage ${themeActionTarget.name}`;
				}
				container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
				container.addChild(new Spacer(1));

				if (currentCategory === "main") {
					const items = buildMainMenuItems(settings, settings.pinnedProvider);
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);
					selectList.onSelect = (item) => {
						if (item.value === "open-core-settings") {
							saveSettings(settings);
							done(settings);
							if (onOpenCoreSettings) {
								setTimeout(() => void onOpenCoreSettings(), 0);
							}
							return;
						}
						currentCategory = item.value as SettingsCategory;
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						saveSettings(settings);
						done(settings);
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "pin-provider") {
					if (pinnedProviderBackup === undefined) {
						pinnedProviderBackup = settings.pinnedProvider ?? null;
					}
					const orderedProviders = settings.providerOrder.length > 0 ? settings.providerOrder : (Object.keys(settings.providers) as ProviderName[]);
					const items: TooltipSelectItem[] = [
						{
							value: "none",
							label: "Auto",
							description: "current provider",
							tooltip: "Show the current provider automatically.",
						},
						...orderedProviders.map((provider) => ({
							value: provider,
							label: PROVIDER_DISPLAY_NAMES[provider],
							description: provider === settings.pinnedProvider ? "pinned" : "",
							tooltip: `Pin ${PROVIDER_DISPLAY_NAMES[provider]} as the current provider.`,
						})),
					];
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);
					selectList.onSelectionChange = (item) => {
						if (!item) return;
						const nextPinned = item.value === "none" ? null : (item.value as ProviderName);
						if (settings.pinnedProvider === nextPinned) return;
						settings.pinnedProvider = nextPinned;
						if (onSettingsChange) void onSettingsChange(settings);
					};
					selectList.onSelect = (item) => {
						settings.pinnedProvider = item.value === "none" ? null : (item.value as ProviderName);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						pinnedProviderBackup = undefined;
						currentCategory = "main";
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						if (pinnedProviderBackup !== undefined && settings.pinnedProvider !== pinnedProviderBackup) {
							settings.pinnedProvider = pinnedProviderBackup;
							if (onSettingsChange) void onSettingsChange(settings);
						}
						pinnedProviderBackup = undefined;
						currentCategory = "main";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "keybindings") {
					const parseKeybinding = (raw: string): string | null => {
						const trimmed = raw.trim().toLowerCase();
						if (!trimmed) {
							ctx.ui.notify("Enter a key combo (e.g. ctrl+alt+p) or 'none' to disable", "warning");
							return null;
						}
						if (trimmed === "none") return "none";
						const parts = trimmed.split("+");
						const modifiers = new Set(["ctrl", "shift", "alt"]);
						const baseKeys = parts.filter((p) => !modifiers.has(p));
						if (baseKeys.length !== 1) {
							ctx.ui.notify("Invalid key combo. Use format like ctrl+alt+p or ctrl+s", "warning");
							return null;
						}
						return trimmed;
					};

					const kbItems: SettingItem[] = [
						{
							id: "cycleProvider",
							label: "Cycle Provider",
							currentValue: settings.keybindings.cycleProvider,
							description: "Shortcut to cycle through providers. Changes take effect after pi restart.",
							submenu: buildInputSubmenu(
								"Cycle Provider shortcut",
								parseKeybinding,
								undefined,
								"Enter a key combo (e.g. ctrl+alt+p) or 'none' to disable.",
							),
						},
						{
							id: "toggleResetFormat",
							label: "Toggle Reset Format",
							currentValue: settings.keybindings.toggleResetFormat,
							description: "Shortcut to toggle reset timer format. Changes take effect after pi restart.",
							submenu: buildInputSubmenu(
								"Toggle Reset Format shortcut",
								parseKeybinding,
								undefined,
								"Enter a key combo (e.g. ctrl+alt+r) or 'none' to disable.",
							),
						},
					];

					const handleKbChange = (id: string, value: string) => {
						if (id === "cycleProvider" || id === "toggleResetFormat") {
							settings.keybindings = { ...settings.keybindings, [id]: value };
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
						}
					};

					const kbList = new SettingsList(
						kbItems,
						Math.min(kbItems.length + 3, 10),
						getSettingsListTheme(),
						handleKbChange,
						() => {
							currentCategory = "main";
							rebuild();
							tui.requestRender();
						},
					);
					activeList = kbList;
					container.addChild(kbList);
				} else if (currentCategory === "providers") {
					const items = buildProviderListItems(settings, coreSettings.providers);
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);
					selectList.onSelect = (item) => {
						if (item.value === "reset-providers") {
							const defaults = getDefaultSettings();
							settings.providers = { ...defaults.providers };
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
							ctx.ui.notify("Provider settings reset to defaults", "info");
							rebuild();
							tui.requestRender();
							return;
						}
						currentCategory = item.value as SettingsCategory;
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						currentCategory = "main";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (providerCategory) {
					const items = buildProviderSettingsItems(settings, providerCategory);
					const coreProvider = coreSettings.providers[providerCategory];
					const enabledValue = coreProvider.enabled === "auto"
						? "auto"
						: coreProvider.enabled === true || coreProvider.enabled === "on"
							? "on"
							: "off";
					items.unshift({
						id: "enabled",
						label: "Enabled",
						currentValue: enabledValue,
						values: ["auto", "on", "off"],
						description: "Auto enables if credentials are detected.",
					});
					const handleChange = (id: string, value: string) => {
						if (id === "enabled") {
							const nextEnabled = value === "auto" ? "auto" : value === "on";
							coreProvider.enabled = nextEnabled;
							if (onCoreSettingsChange) {
								const patch = {
									providers: {
										[providerCategory]: { enabled: nextEnabled },
									},
								} as unknown as Partial<CoreSettings>;
								void onCoreSettingsChange(patch, coreSettings);
							}
							return;
						}
						settings = applyProviderSettingsChange(settings, providerCategory, id, value);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
					};
					const settingsHintText = "↓ navigate • ←/→ change • Enter/Space edit custom • Esc to cancel";
					const customTheme = {
						...getSettingsListTheme(),
						hint: (text: string) => {
							if (text.includes("Enter/Space")) {
								return theme.fg("dim", settingsHintText);
							}
							return theme.fg("dim", text);
						},
					};
					const settingsList = new SettingsList(
						items,
						Math.min(items.length + 2, 15),
						customTheme,
						handleChange,
						() => {
							currentCategory = "providers";
							rebuild();
							tui.requestRender();
						}
					);
					activeList = settingsList;
					container.addChild(settingsList);
				} else if (currentCategory === "display") {
					const items = buildDisplayMenuItems();
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);
					selectList.onSelect = (item) => {
						currentCategory = item.value as SettingsCategory;
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						currentCategory = "main";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "display-theme") {
					const items = buildDisplayThemeMenuItems();
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					if (displayThemeSelection) {
						const index = items.findIndex((item) => item.value === displayThemeSelection);
						if (index >= 0) {
							selectList.setSelectedIndex(index);
						}
					}
					attachTooltip(items, selectList);
					selectList.onSelect = (item) => {
						displayThemeSelection = item.value;
						currentCategory = item.value as SettingsCategory;
						pendingShare = null;
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						currentCategory = "display";
						pendingShare = null;
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "display-theme-save") {
					const input = new Input();
					input.focused = true;
					const titleText = new Text(theme.fg("muted", "Theme name"), 1, 0);
					input.onSubmit = (value) => {
						const trimmed = value.trim();
						if (!trimmed) {
							ctx.ui.notify("Enter a theme name", "warning");
							return;
						}
						settings = saveDisplayTheme(settings, trimmed);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						ctx.ui.notify(`Theme ${trimmed} saved`, "info");
						const shareString = buildDisplayShareString(trimmed, settings.display);
						if (onDisplayThemeShared) {
							requestThemeShare(trimmed, shareString, "display-theme");
							return;
						}
						ctx.ui.notify(shareString, "info");
						currentCategory = "display-theme";
						rebuild();
						tui.requestRender();
					};
					input.onEscape = () => {
						currentCategory = "display-theme";
						rebuild();
						tui.requestRender();
					};
					container.addChild(titleText);
					container.addChild(new Spacer(1));
					container.addChild(input);
					activeList = input;
				} else if (currentCategory === "display-theme-share") {
					displayThemeSelection = "display-theme-share";
					const shareTarget = pendingShare ?? {
						name: "",
						shareString: buildDisplayShareStringWithoutName(settings.display),
						backCategory: "display-theme" as SettingsCategory,
					};
					pendingShare = shareTarget;

					const shareItems: TooltipSelectItem[] = [
						{
							value: "gist",
							label: "Upload secret gist",
							description: "share via GitHub gist",
							tooltip: "Create a secret GitHub gist using the gh CLI.",
						},
						{
							value: "string",
							label: "Post share string",
							description: "share in chat",
							tooltip: "Post the raw share string to chat.",
						},
						{
							value: "cancel",
							label: "Cancel",
							description: "discard share",
							tooltip: "Cancel without sharing.",
						},
					];

					const selectList = new SelectList(shareItems, shareItems.length, {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(shareItems, selectList);

					selectList.onSelect = (item) => {
						if (item.value === "gist" || item.value === "string") {
							if (onDisplayThemeShared) {
								void onDisplayThemeShared(shareTarget.name, shareTarget.shareString, item.value as "gist" | "string");
							} else {
								ctx.ui.notify(shareTarget.shareString, "info");
							}
						}
						pendingShare = null;
						currentCategory = shareTarget.backCategory;
						rebuild();
						tui.requestRender();
					};

					selectList.onCancel = () => {
						pendingShare = null;
						currentCategory = shareTarget.backCategory;
						rebuild();
						tui.requestRender();
					};

					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "display-theme-load") {
					if (!displayPreviewBackup) {
						displayPreviewBackup = { ...settings.display };
					}
					const defaults = getDefaultSettings();
					const fallbackUser = settings.displayUserTheme ?? displayPreviewBackup;
					const themeItems = buildDisplayThemeItems(settings);

					const selectList = new SelectList(themeItems, Math.min(themeItems.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					selectList.onSelectionChange = (item) => {
						if (!item) return;
						const target = resolveDisplayThemeTarget(item.value, settings, defaults, fallbackUser);
						if (!target) return;
						settings.display = { ...target.display };
						if (onSettingsChange) void onSettingsChange(settings);
						tui.requestRender();
					};
					attachTooltip(themeItems, selectList);

					selectList.onSelect = (item) => {
						const target = resolveDisplayThemeTarget(item.value, settings, defaults, fallbackUser);
						if (!target) return;
						if (item.value.startsWith("theme:")) {
							themeActionTarget = target;
							currentCategory = "display-theme-action";
							rebuild();
							tui.requestRender();
							return;
						}

						const backup = displayPreviewBackup ?? settings.display;
						settings.displayUserTheme = { ...backup };
						settings.display = { ...target.display };
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						if (onDisplayThemeApplied) void onDisplayThemeApplied(target.name, { source: "manual" });
						displayPreviewBackup = null;
						currentCategory = "display-theme";
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						if (displayPreviewBackup) {
							settings.display = { ...displayPreviewBackup };
							if (onSettingsChange) void onSettingsChange(settings);
						}
						displayPreviewBackup = null;
						currentCategory = "display-theme";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "display-theme-random") {
					if (!randomThemeBackup) {
						randomThemeBackup = { ...settings.display };
						settings.displayUserTheme = { ...randomThemeBackup };
					}
					displayThemeSelection = "display-theme-random";
					const randomDisplay = buildRandomDisplay(settings.display);
					settings.display = { ...randomDisplay };
					saveSettings(settings);
					if (onSettingsChange) void onSettingsChange(settings);
					currentCategory = "display-theme";
					rebuild();
					tui.requestRender();
				} else if (currentCategory === "display-theme-restore") {
					displayThemeSelection = "display-theme-restore";
					const defaults = getDefaultSettings();
					const fallbackUser = settings.displayUserTheme ?? settings.display;
					const target = resolveDisplayThemeTarget("user", settings, defaults, fallbackUser);
					if (target) {
						const backup = displayPreviewBackup ?? settings.display;
						settings.displayUserTheme = { ...backup };
						settings.display = { ...target.display };
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						if (onDisplayThemeApplied) void onDisplayThemeApplied(target.name, { source: "manual" });
						displayPreviewBackup = null;
					}
					currentCategory = "display-theme";
					rebuild();
					tui.requestRender();
				} else if (currentCategory === "display-theme-import") {
					const input = new Input();
					input.focused = true;
					const titleText = new Text(theme.fg("muted", "Paste Theme Share string"), 1, 0);
					input.onSubmit = (value) => {
						const trimmed = value.trim();
						if (!trimmed) {
							ctx.ui.notify("Enter a theme share string", "warning");
							return;
						}
						const decoded = decodeDisplayShareString(trimmed);
						if (!decoded) {
							ctx.ui.notify("Invalid theme share string", "error");
							return;
						}
						if (!displayPreviewBackup) {
							displayPreviewBackup = { ...settings.display };
						}
						importBackup = displayPreviewBackup;
						importCandidate = decoded;
						settings.display = { ...decoded.display };
						if (onSettingsChange) void onSettingsChange(settings);
						currentCategory = "display-theme-import-action";
						rebuild();
						tui.requestRender();
					};
					input.onEscape = () => {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					container.addChild(titleText);
					container.addChild(new Spacer(1));
					container.addChild(input);
					activeList = input;
				} else if (currentCategory === "display-theme-import-action") {
					const candidate = importCandidate;
					if (!candidate) {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
						return;
					}

					const importItems: TooltipSelectItem[] = [
						{
							value: "save-apply",
							label: "Save & apply",
							description: "save and use this theme",
							tooltip: "Save the theme and keep it applied.",
						},
						{
							value: "save",
							label: "Save",
							description: "save without applying",
							tooltip: "Save the theme and restore the previous display.",
						},
						{
							value: "cancel",
							label: "Cancel",
							description: "discard import",
							tooltip: "Discard and restore the previous display.",
						},
					];

					const notifyImported = (name: string) => {
						const message = candidate.isNewerVersion
							? `Imported ${name} (newer version, some fields may be ignored)`
							: `Imported ${name}`;
						ctx.ui.notify(message, candidate.isNewerVersion ? "warning" : "info");
					};

					const restoreBackup = () => {
						if (importBackup) {
							settings.display = { ...importBackup };
							if (onSettingsChange) void onSettingsChange(settings);
						}
					};

					const selectList = new SelectList(importItems, importItems.length, {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					selectList.onSelectionChange = (item) => {
						if (!item) return;
						if (item.value === "save-apply") {
							settings.display = { ...candidate.display };
							if (onSettingsChange) void onSettingsChange(settings);
							return;
						}
						restoreBackup();
					};
					attachTooltip(importItems, selectList);

					selectList.onSelect = (item) => {
						if ((item.value === "save-apply" || item.value === "save") && !candidate.hasName) {
							importPendingAction = item.value as "save" | "save-apply";
							currentCategory = "display-theme-import-name";
							rebuild();
							tui.requestRender();
							return;
						}
						if (item.value === "save-apply") {
							const resolvedName = candidate.name;
							if (importBackup) {
								settings.displayUserTheme = { ...importBackup };
							}
							settings = upsertDisplayTheme(settings, resolvedName, candidate.display, "imported");
							settings.display = { ...candidate.display };
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
							if (onDisplayThemeApplied) void onDisplayThemeApplied(resolvedName, { source: "manual" });
							notifyImported(resolvedName);
							displayPreviewBackup = null;
							importCandidate = null;
							importBackup = null;
							importPendingAction = null;
							currentCategory = "display-theme";
							rebuild();
							tui.requestRender();
							return;
						}
						if (item.value === "save") {
							const resolvedName = candidate.name;
							settings = upsertDisplayTheme(settings, resolvedName, candidate.display, "imported");
							restoreBackup();
							saveSettings(settings);
							notifyImported(resolvedName);
							importCandidate = null;
							importBackup = null;
							importPendingAction = null;
							currentCategory = "display-theme-load";
							rebuild();
							tui.requestRender();
							return;
						}
						restoreBackup();
						importCandidate = null;
						importBackup = null;
						importPendingAction = null;
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					selectList.onCancel = () => {
						restoreBackup();
						importCandidate = null;
						importBackup = null;
						importPendingAction = null;
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "display-theme-import-name") {
					const candidate = importCandidate;
					if (!candidate) {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
						return;
					}

					const notifyImported = (name: string) => {
						const message = candidate.isNewerVersion
							? `Imported ${name} (newer version, some fields may be ignored)`
							: `Imported ${name}`;
						ctx.ui.notify(message, candidate.isNewerVersion ? "warning" : "info");
					};

					const restoreBackup = () => {
						if (importBackup) {
							settings.display = { ...importBackup };
							if (onSettingsChange) void onSettingsChange(settings);
						}
					};

					const input = new Input();
					input.focused = true;
					const titleText = new Text(theme.fg("muted", "Theme name"), 1, 0);
					input.onSubmit = (value) => {
						const trimmed = value.trim();
						if (!trimmed) {
							ctx.ui.notify("Enter a theme name", "warning");
							return;
						}
						const applyImport = importPendingAction === "save-apply";
						if (applyImport && importBackup) {
							settings.displayUserTheme = { ...importBackup };
						}
						settings = upsertDisplayTheme(settings, trimmed, candidate.display, "imported");
						if (applyImport) {
							settings.display = { ...candidate.display };
						} else {
							restoreBackup();
						}
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						if (applyImport && onDisplayThemeApplied) {
							void onDisplayThemeApplied(trimmed, { source: "manual" });
						}
						notifyImported(trimmed);
						displayPreviewBackup = null;
						importCandidate = null;
						importBackup = null;
						importPendingAction = null;
						currentCategory = applyImport ? "display-theme" : "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					input.onEscape = () => {
						importPendingAction = null;
						currentCategory = "display-theme-import-action";
						rebuild();
						tui.requestRender();
					};
					container.addChild(titleText);
					container.addChild(new Spacer(1));
					container.addChild(input);
					activeList = input;
				} else if (currentCategory === "display-theme-rename") {
					const target = themeActionTarget;
					if (!target || !target.id) {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
						return;
					}

					const input = new Input();
					input.focused = true;
					const titleText = new Text(theme.fg("muted", `Rename ${target.name}`), 1, 0);
					input.onSubmit = (value) => {
						const trimmed = value.trim();
						if (!trimmed) {
							ctx.ui.notify("Enter a theme name", "warning");
							return;
						}
						settings = renameDisplayTheme(settings, target.id!, trimmed);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						themeActionTarget = null;
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					input.onEscape = () => {
						currentCategory = "display-theme-action";
						rebuild();
						tui.requestRender();
					};
					container.addChild(titleText);
					container.addChild(new Spacer(1));
					container.addChild(input);
					activeList = input;
				} else if (currentCategory === "display-theme-action") {
					const target = themeActionTarget;
					if (!target) {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
						return;
					}

					const items = buildThemeActionItems(target);

					const selectList = new SelectList(items, items.length, {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);

					selectList.onSelect = (item) => {
						if (item.value === "load") {
							const backup = displayPreviewBackup ?? settings.display;
							settings.displayUserTheme = { ...backup };
							settings.display = { ...target.display };
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
							if (onDisplayThemeApplied) void onDisplayThemeApplied(target.name, { source: "manual" });
							displayPreviewBackup = null;
							themeActionTarget = null;
							currentCategory = "display-theme";
							rebuild();
							tui.requestRender();
							return;
						}
						if (item.value === "share") {
							const shareString = buildDisplayShareString(target.name, target.display);
							if (onDisplayThemeShared) {
								requestThemeShare(target.name, shareString, "display-theme-load");
								return;
							}
							ctx.ui.notify(shareString, "info");
							themeActionTarget = null;
							currentCategory = "display-theme-load";
							rebuild();
							tui.requestRender();
							return;
						}
						if (item.value === "rename" && target.deletable && target.id) {
							currentCategory = "display-theme-rename";
							rebuild();
							tui.requestRender();
							return;
						}
						if (item.value === "delete" && target.deletable && target.id) {
							settings.displayThemes = settings.displayThemes.filter((entry) => entry.id !== target.id);
							saveSettings(settings);
							if (displayPreviewBackup) {
								settings.display = { ...displayPreviewBackup };
								if (onSettingsChange) void onSettingsChange(settings);
							}
							themeActionTarget = null;
							currentCategory = "display-theme-load";
							rebuild();
							tui.requestRender();
						}
					};
					selectList.onCancel = () => {
						currentCategory = "display-theme-load";
						rebuild();
						tui.requestRender();
					};
					activeList = selectList;
					container.addChild(selectList);
				} else {
					// Settings list for category
					let items: SettingItem[];
					let handleChange: (id: string, value: string) => void;
					let backCategory: SettingsCategory = "display";

					switch (currentCategory) {
						case "display-layout":
							items = buildDisplayLayoutItems(settings);
							break;
						case "display-bar":
							items = buildDisplayBarItems(settings);
							break;
						case "display-provider":
							items = buildDisplayProviderItems(settings);
							break;
						case "display-reset":
							items = buildDisplayResetItems(settings);
							break;
						case "display-status":
							items = buildDisplayStatusItems(settings);
							break;
						case "display-divider":
							items = buildDisplayDividerItems(settings);
							break;
						case "display-color":
							items = buildDisplayColorItems(settings);
							break;
						default:
							items = [];
					}

					const customHandlers: Record<string, ReturnType<typeof buildInputSubmenu>> = {};
					if (currentCategory === "display-layout") {
						customHandlers.paddingLeft = buildInputSubmenu("Padding Left", (value) => parseInteger(value, 0, 100));
						customHandlers.paddingRight = buildInputSubmenu("Padding Right", (value) => parseInteger(value, 0, 100));
					}
					if (currentCategory === "display-color") {
						customHandlers.errorThreshold = buildInputSubmenu("Error Threshold (%)", (value) => parseInteger(value, 0, 100));
						customHandlers.warningThreshold = buildInputSubmenu("Warning Threshold (%)", (value) => parseInteger(value, 0, 100));
						customHandlers.successThreshold = buildInputSubmenu("Success Threshold (%)", (value) => parseInteger(value, 0, 100));
						const usageColorItem = items.find((item) => item.id === "usageColorTargets");
						if (usageColorItem) {
							usageColorItem.submenu = buildUsageColorSubmenu();
						}
					}
					if (currentCategory === "display-bar") {
						customHandlers.barWidth = buildInputSubmenu("Bar Width", parseBarWidth);
						customHandlers.barCharacter = buildInputSubmenu(
							"Bar Character",
							parseBarCharacter,
							undefined,
							"Custom bar character(s), set 1 or 2 (fill/empty)",
						);
					}
					if (currentCategory === "display-provider") {
						customHandlers.providerLabel = buildInputSubmenu("Provider Label", parseProviderLabel);
					}
					if (currentCategory === "display-reset") {
						customHandlers.resetTimeContainment = buildInputSubmenu(
							"Reset Timer Containment",
							parseResetContainment,
							undefined,
							"Enter 1-2 characters for left/right wrap (e.g. <>).",
						);
					}
					if (currentCategory === "display-status") {
						customHandlers.statusIconPack = buildInputSubmenu(
							"Custom Status Icons",
							parseStatusIconCustom,
							undefined,
							"Enter four characters in order: OK, warning, error, unknown (e.g. ✓⚠×?). Applied to none, minor/maintenance, major/critical, and unknown statuses.",
						);
					}
					if (currentCategory === "display-divider") {
						customHandlers.dividerCharacter = buildInputSubmenu("Divider Character", parseDividerCharacter);
						customHandlers.dividerBlanks = buildInputSubmenu("Divider Blanks", parseDividerBlanks);
					}
					attachCustomInputs(items, customHandlers);

					handleChange = (id, value) => {
						settings = applyDisplayChange(settings, id, value);
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						if (currentCategory === "display-layout" && id === "widgetPlacement") {
							rebuild();
							tui.requestRender();
							return;
						}
						if (currentCategory === "display-bar" && id === "barType") {
							rebuild();
							tui.requestRender();
							return;
						}
						if (currentCategory === "display-status") {
							if (id === "statusIndicatorMode") {
								rebuild();
								tui.requestRender();
								return;
							}
						}
					};

					const settingsHintText = "↓ navigate • ←/→ change • Enter/Space edit custom • Esc to cancel";
					const customTheme = {
						...getSettingsListTheme(),
						hint: (text: string) => {
							if (text.includes("Enter/Space")) {
								return theme.fg("dim", settingsHintText);
							}
							return theme.fg("dim", text);
						},
					};
					const settingsList = new SettingsList(
						items,
						Math.min(items.length + 2, 15),
						customTheme,
						handleChange,
						() => {
							currentCategory = backCategory;
							rebuild();
							tui.requestRender();
						}
					);
					activeList = settingsList;
					container.addChild(settingsList);
				}

				// Help text
				const usesSettingsList =
					Boolean(providerCategory) ||
					currentCategory === "keybindings" ||
					currentCategory === "display-layout" ||
					currentCategory === "display-bar" ||
					currentCategory === "display-provider" ||
					currentCategory === "display-reset" ||
					currentCategory === "display-status" ||
					currentCategory === "display-divider" ||
					currentCategory === "display-color";
				if (!usesSettingsList) {
					let helpText: string;
					if (
						currentCategory === "display-theme-save" ||
						currentCategory === "display-theme-import-name" ||
						currentCategory === "display-theme-rename"
					) {
						helpText = "Type name • Enter to save • Esc back";
					} else if (currentCategory === "display-theme-import") {
						helpText = "Paste theme share string • Enter to import • Esc back";
					} else if (
						currentCategory === "main" ||
						currentCategory === "providers" ||
						currentCategory === "display" ||
						currentCategory === "display-theme" ||
						currentCategory === "display-theme-load" ||
						currentCategory === "display-theme-action" ||
						currentCategory === "display-theme-random" ||
						currentCategory === "display-theme-restore"
					) {
						helpText = "↑↓ navigate • Enter/Space select • Esc back";
					} else {
						helpText = "↑↓ navigate • Enter/Space to change • Esc to cancel";
					}
					if (tooltipText) {
						container.addChild(new Spacer(1));
						container.addChild(tooltipText);
					}
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("dim", helpText), 1, 0));
				}

				// Bottom border
				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			}

			rebuild();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (data === " ") {
						if (activeList && "handleInput" in activeList && activeList.handleInput) {
							activeList.handleInput("\r");
						}
						tui.requestRender();
						return;
					}
					if (activeList && "handleInput" in activeList && activeList.handleInput) {
						activeList.handleInput(data);
					}
					tui.requestRender();
				},
			};
		}).then(resolve);
	});
}

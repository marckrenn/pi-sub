/**
 * Settings UI for sub-core
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, Input, SelectList, Spacer, Text } from "@earendil-works/pi-tui";
import { SettingsList, type SettingItem, CUSTOM_OPTION } from "../ui/settings-list.js";
import type { ProviderName } from "../types.js";
import type { Settings } from "../settings-types.js";
import { getSettings, saveSettings, resetSettings } from "../settings.js";
import { PROVIDER_DISPLAY_NAMES } from "../providers/metadata.js";
import { buildProviderSettingsItems, applyProviderSettingsChange } from "../providers/settings.js";
import { buildRefreshItems, applyRefreshChange } from "./behavior.js";
import { buildToolItems, applyToolChange } from "./tools.js";
import { buildMainMenuItems, buildProviderListItems, buildProviderOrderItems, type TooltipSelectItem } from "./menu.js";

/**
 * Settings category
 */
type ProviderCategory = `provider-${ProviderName}`;

type SettingsCategory =
	| "main"
	| "providers"
	| ProviderCategory
	| "behavior"
	| "status-refresh"
	| "tools"
	| "provider-order";

/**
 * Extract provider name from category
 */
function getProviderFromCategory(category: SettingsCategory): ProviderName | null {
	const match = category.match(/^provider-(\w+)$/);
	if (match && match[1] !== "order") {
		return match[1] as ProviderName;
	}
	return null;
}

/**
 * Show the settings UI
 */
export async function showSettingsUI(
	ctx: ExtensionContext,
	onSettingsChange?: (settings: Settings) => void | Promise<void>
): Promise<Settings> {
	let settings = getSettings();
	let currentCategory: SettingsCategory = "main";
	let providerOrderSelectedIndex = 0;
	let providerOrderReordering = false;
	let suppressProviderOrderChange = false;

	return new Promise((resolve) => {
		ctx.ui.custom<Settings>((tui, theme, _kb, done) => {
			let container = new Container();
			let activeList: SelectList | SettingsList | null = null;
			const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

			const buildInputSubmenu = (
				label: string,
				parseValue: (value: string) => string | null,
				formatInitial?: (value: string) => string,
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

					const inputContainer = new Container();
					inputContainer.addChild(new Text(theme.fg("muted", label), 1, 0));
					inputContainer.addChild(new Spacer(1));
					inputContainer.addChild(input);

					return {
						render: (width: number) => inputContainer.render(width),
						invalidate: () => inputContainer.invalidate(),
						handleInput: (data: string) => input.handleInput(data),
					};
				};
			};

			const parseRefreshInterval = (raw: string): string | null => {
				const trimmed = raw.trim().toLowerCase();
				if (!trimmed) {
					ctx.ui.notify("Enter a value", "warning");
					return null;
				}
				if (trimmed === "off") return "off";
				const cleaned = trimmed.replace(/s$/, "");
				const parsed = Number.parseInt(cleaned, 10);
				if (Number.isNaN(parsed)) {
					ctx.ui.notify("Enter seconds", "warning");
					return null;
				}
				const clamped = parsed <= 0 ? 0 : clamp(parsed, 5, 3600);
				return clamped === 0 ? "off" : `${clamped}s`;
			};

			const parseMinRefreshInterval = (raw: string): string | null => {
				const trimmed = raw.trim().toLowerCase();
				if (!trimmed) {
					ctx.ui.notify("Enter a value", "warning");
					return null;
				}
				if (trimmed === "off") return "off";
				const cleaned = trimmed.replace(/s$/, "");
				const parsed = Number.parseInt(cleaned, 10);
				if (Number.isNaN(parsed)) {
					ctx.ui.notify("Enter seconds", "warning");
					return null;
				}
				const clamped = parsed <= 0 ? 0 : clamp(parsed, 5, 3600);
				return clamped === 0 ? "off" : `${clamped}s`;
			};

			const parseCurrencySymbol = (raw: string): string | null => {
				const trimmed = raw.trim();
				if (!trimmed) {
					ctx.ui.notify("Enter a symbol or 'none'", "warning");
					return null;
				}
				if (trimmed.toLowerCase() === "none") return "none";
				return trimmed;
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
					main: "sub-core Settings",
					providers: "Provider Settings",
					behavior: "Usage Refresh Settings",
					"status-refresh": "Status Refresh Settings",
					tools: "Tool Settings",
					"provider-order": "Provider Order",
				};
				const providerCategory = getProviderFromCategory(currentCategory);
				const title = providerCategory
					? `${PROVIDER_DISPLAY_NAMES[providerCategory]} Settings`
					: titles[currentCategory] ?? "sub-core Settings";
				container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
				container.addChild(new Spacer(1));

				if (currentCategory === "main") {
					const items = buildMainMenuItems(settings);
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => theme.fg("accent", t),
						selectedText: (t: string) => theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});
					attachTooltip(items, selectList);
					selectList.onSelect = (item) => {
						if (item.value === "reset") {
							settings = resetSettings();
							if (onSettingsChange) void onSettingsChange(settings);
							ctx.ui.notify("Settings reset to defaults", "info");
							rebuild();
							tui.requestRender();
						} else {
							currentCategory = item.value as SettingsCategory;
							rebuild();
							tui.requestRender();
						}
					};
					selectList.onCancel = () => {
						saveSettings(settings);
						done(settings);
					};
					activeList = selectList;
					container.addChild(selectList);
				} else if (currentCategory === "providers") {
					const items = buildProviderListItems(settings);
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
				} else if (currentCategory === "provider-order") {
					const items = buildProviderOrderItems(settings);
					const isReordering = providerOrderReordering;
					const selectList = new SelectList(items, Math.min(items.length, 10), {
						selectedPrefix: (t: string) => isReordering ? theme.fg("warning", t) : theme.fg("accent", t),
						selectedText: (t: string) => isReordering ? theme.fg("warning", t) : theme.fg("accent", t),
						description: (t: string) => theme.fg("muted", t),
						scrollInfo: (t: string) => theme.fg("dim", t),
						noMatch: (t: string) => theme.fg("warning", t),
					});

					if (items.length > 0) {
						suppressProviderOrderChange = true;
						providerOrderSelectedIndex = Math.min(providerOrderSelectedIndex, items.length - 1);
						selectList.setSelectedIndex(providerOrderSelectedIndex);
						suppressProviderOrderChange = false;
					}

					selectList.onSelectionChange = (item) => {
						if (suppressProviderOrderChange) return;

						const newIndex = items.findIndex((listItem) => listItem.value === item.value);
						if (newIndex === -1) return;

						if (!providerOrderReordering) {
							providerOrderSelectedIndex = newIndex;
							return;
						}

						const activeProviders = settings.providerOrder.filter((provider) => {
							const enabled = settings.providers[provider].enabled;
							return enabled !== "off" && enabled !== false;
						});
						const oldIndex = providerOrderSelectedIndex;
						if (newIndex === oldIndex) return;
						if (oldIndex < 0 || oldIndex >= activeProviders.length) return;

						const provider = activeProviders[oldIndex];
						const updatedActive = [...activeProviders];
						updatedActive.splice(oldIndex, 1);
						updatedActive.splice(newIndex, 0, provider);

						let activeIndex = 0;
						settings.providerOrder = settings.providerOrder.map((existing) => {
							const enabled = settings.providers[existing].enabled;
							if (enabled === "off" || enabled === false) return existing;
							const next = updatedActive[activeIndex];
							activeIndex += 1;
							return next;
						});

						providerOrderSelectedIndex = newIndex;
						saveSettings(settings);
						if (onSettingsChange) void onSettingsChange(settings);
						rebuild();
						tui.requestRender();
					};

					attachTooltip(items, selectList);

					selectList.onSelect = () => {
						if (items.length === 0) return;
						providerOrderReordering = !providerOrderReordering;
						rebuild();
						tui.requestRender();
					};

					selectList.onCancel = () => {
						if (providerOrderReordering) {
							providerOrderReordering = false;
							rebuild();
							tui.requestRender();
							return;
						}
						currentCategory = "main";
						rebuild();
						tui.requestRender();
					};

					activeList = selectList;
					container.addChild(selectList);
				} else {
					let items: SettingItem[];
					let handleChange: (id: string, value: string) => void;
					let backCategory: SettingsCategory = "main";

					const provider = getProviderFromCategory(currentCategory);
					if (provider) {
						items = buildProviderSettingsItems(settings, provider);
						const customHandlers: Record<string, ReturnType<typeof buildInputSubmenu>> = {};
						if (provider === "anthropic") {
							customHandlers.extraUsageCurrencySymbol = buildInputSubmenu(
								"Extra Usage Currency Symbol",
								parseCurrencySymbol,
								undefined,
							);
						}
						for (const item of items) {
							if (item.values?.includes(CUSTOM_OPTION) && customHandlers[item.id]) {
								item.submenu = customHandlers[item.id];
							}
						}
						handleChange = (id, value) => {
							settings = applyProviderSettingsChange(settings, provider, id, value);
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
						};
						backCategory = "providers";
					} else if (currentCategory === "tools") {
						items = buildToolItems(settings.tools);
						handleChange = (id, value) => {
							settings = applyToolChange(settings, id, value);
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
						};
						backCategory = "main";
					} else {
						const refreshTarget = currentCategory === "status-refresh" ? settings.statusRefresh : settings.behavior;
						items = buildRefreshItems(refreshTarget);
						const customHandlers: Record<string, ReturnType<typeof buildInputSubmenu>> = {
							refreshInterval: buildInputSubmenu("Auto-refresh Interval (seconds)", parseRefreshInterval),
							minRefreshInterval: buildInputSubmenu("Minimum Refresh Interval (seconds)", parseMinRefreshInterval),
						};
						for (const item of items) {
							if (item.values?.includes(CUSTOM_OPTION) && customHandlers[item.id]) {
								item.submenu = customHandlers[item.id];
							}
						}
						handleChange = (id, value) => {
							applyRefreshChange(refreshTarget, id, value);
							saveSettings(settings);
							if (onSettingsChange) void onSettingsChange(settings);
						};
						backCategory = "main";
					}

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

				const usesSettingsList =
					currentCategory === "behavior" ||
					currentCategory === "status-refresh" ||
					currentCategory === "tools" ||
					getProviderFromCategory(currentCategory) !== null;
				if (!usesSettingsList) {
					let helpText: string;
					if (currentCategory === "main" || currentCategory === "providers") {
						helpText = "↑↓ navigate • Enter/Space select • Esc back";
					} else if (currentCategory === "provider-order") {
						helpText = providerOrderReordering
						? "↑↓ move provider • Esc back"
						: "↑↓ navigate • Enter/Space select • Esc back";
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
						if (currentCategory === "provider-order") {
							providerOrderReordering = !providerOrderReordering;
							rebuild();
							tui.requestRender();
							return;
						}
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

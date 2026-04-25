/**
 * sub-core - Shared usage data core for sub-* extensions.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import type { Dependencies, ProviderName, SubCoreState, UsageSnapshot } from "./src/types.js";
import { getDefaultSettings, type Settings } from "./src/settings-types.js";
import type { ProviderUsageEntry } from "./src/usage/types.js";
import { createDefaultDependencies } from "./src/dependencies.js";
import { createUsageController, type UsageUpdate } from "./src/usage/controller.js";
import { fetchUsageEntries, getCachedUsageEntries } from "./src/usage/fetch.js";
import { onCacheSnapshot, onCacheUpdate, watchCacheUpdates, type Cache } from "./src/cache.js";
import { isExpectedMissingData } from "./src/errors.js";
import { prioritizeWindowsForModel } from "./src/utils.js";
import { getStorage } from "./src/storage.js";
import { clearSettingsCache, loadSettings, saveSettings, SETTINGS_PATH } from "./src/settings.js";
import { showSettingsUI } from "./src/settings-ui.js";

type SubCoreRequest =
	| {
			type?: "current";
			includeSettings?: boolean;
			reply: (payload: { state: SubCoreState; settings?: Settings }) => void;
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

const TOOL_NAMES = {
	usage: ["sub_get_usage", "get_current_usage"],
	allUsage: ["sub_get_all_usage", "get_all_usage"],
} as const;

type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES][number];

type SubCoreGlobalState = { active: boolean };
const subCoreGlobal = globalThis as typeof globalThis & { __piSubCore?: SubCoreGlobalState };

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
	const result = { ...target } as T;
	for (const key of Object.keys(source) as (keyof T)[]) {
		const sourceValue = source[key];
		const targetValue = result[key];
		if (
			sourceValue !== undefined &&
			typeof sourceValue === "object" &&
			sourceValue !== null &&
			!Array.isArray(sourceValue) &&
			typeof targetValue === "object" &&
			targetValue !== null &&
			!Array.isArray(targetValue)
		) {
			result[key] = deepMerge(targetValue as object, sourceValue as object) as T[keyof T];
		} else if (sourceValue !== undefined) {
			result[key] = sourceValue as T[keyof T];
		}
	}
	return result;
}

function stripUsageProvider(usage?: UsageSnapshot): Omit<UsageSnapshot, "provider"> | undefined {
	if (!usage) return undefined;
	const { provider: _provider, ...rest } = usage;
	return rest;
}

/**
 * Create the extension
 */
export default function createExtension(pi: ExtensionAPI, deps: Dependencies = createDefaultDependencies()): void {
	if (subCoreGlobal.__piSubCore?.active) {
		return;
	}
	subCoreGlobal.__piSubCore = { active: true };

	let usageRefreshInterval: ReturnType<typeof setInterval> | undefined;
	let statusRefreshInterval: ReturnType<typeof setInterval> | undefined;
	let lastContext: ExtensionContext | undefined;
	let lastUsageRefreshAt = 0;
	let lastStatusRefreshAt = 0;
	let settings: Settings = getDefaultSettings();
	let settingsLoaded = false;
	let toolsRegistered = false;
	let lastState: SubCoreState = {};
	let settingsSnapshot = "";
	let settingsMtimeMs = 0;
	let settingsDebounce: NodeJS.Timeout | undefined;
	let settingsWatcher: fs.FSWatcher | undefined;
	let settingsPoll: NodeJS.Timeout | undefined;
	let settingsWatchStarted = false;

	const controller = createUsageController(deps);
	const controllerState = {
		currentProvider: undefined as ProviderName | undefined,
		cachedUsage: undefined as UsageSnapshot | undefined,
		providerCycleIndex: 0,
	};

	let lastAllSnapshot = "";
	let lastCurrentSnapshot = "";

	const emitCurrentUpdate = (provider?: ProviderName, usage?: UsageSnapshot): void => {
		const model = lastContext?.model;
		const sorted = usage && model
			? { ...usage, windows: prioritizeWindowsForModel(usage.windows, model) }
			: usage;
		lastState = { provider, usage: sorted };
		const payload = JSON.stringify(lastState);
		if (payload === lastCurrentSnapshot) return;
		lastCurrentSnapshot = payload;
		pi.events.emit("sub-core:update-current", { state: lastState });
	};

	const unsubscribeCacheSnapshot = onCacheSnapshot((cache: Cache) => {
		const ttlMs = settings.behavior.refreshInterval * 1000;
		const now = Date.now();
		const entries: ProviderUsageEntry[] = [];
		for (const provider of settings.providerOrder) {
			const entry = cache[provider];
			if (!entry || !entry.usage) continue;
			if (now - entry.fetchedAt >= ttlMs) continue;
			const usage = { ...entry.usage, status: entry.status };
			if (usage.error && isExpectedMissingData(usage.error)) continue;
			entries.push({ provider, usage });
		}
		const payload = JSON.stringify({ provider: controllerState.currentProvider, entries });
		if (payload === lastAllSnapshot) return;
		lastAllSnapshot = payload;
		pi.events.emit("sub-core:update-all", {
			state: { provider: controllerState.currentProvider, entries },
		});
	});

	const unsubscribeCache = onCacheUpdate((provider, entry) => {
		if (!controllerState.currentProvider || provider !== controllerState.currentProvider) return;
		const usage = entry?.usage ? { ...entry.usage, status: entry.status } : undefined;
		controllerState.cachedUsage = usage;
		emitCurrentUpdate(controllerState.currentProvider, usage);
	});

	let stopCacheWatch: (() => void) | undefined;
	let cacheWatchStarted = false;

	const startCacheWatch = (): void => {
		if (cacheWatchStarted) return;
		cacheWatchStarted = true;
		stopCacheWatch = watchCacheUpdates();
	};

	function emitUpdate(update: UsageUpdate): void {
		emitCurrentUpdate(update.provider, update.usage);
	}

	async function refresh(
		ctx: ExtensionContext,
		options?: { force?: boolean; allowStaleCache?: boolean; skipFetch?: boolean }
	) {
		lastContext = ctx;
		ensureSettingsLoaded();
		try {
			await controller.refresh(ctx, settings, controllerState, emitUpdate, options);
		} finally {
			if (!options?.skipFetch) {
				lastUsageRefreshAt = Date.now();
			}
		}
	}

	async function refreshStatus(
		ctx: ExtensionContext,
		options?: { force?: boolean; allowStaleCache?: boolean; skipFetch?: boolean }
	) {
		lastContext = ctx;
		ensureSettingsLoaded();
		try {
			await controller.refreshStatus(ctx, settings, controllerState, emitUpdate, options);
		} finally {
			if (!options?.skipFetch) {
				lastStatusRefreshAt = Date.now();
			}
		}
	}

	async function cycleProvider(ctx: ExtensionContext): Promise<void> {
		ensureSettingsLoaded();
		await controller.cycleProvider(ctx, settings, controllerState, emitUpdate);
	}

	function setupRefreshInterval(): void {
		if (usageRefreshInterval) {
			clearInterval(usageRefreshInterval);
			usageRefreshInterval = undefined;
		}
		if (statusRefreshInterval) {
			clearInterval(statusRefreshInterval);
			statusRefreshInterval = undefined;
		}

		const usageIntervalMs = settings.behavior.refreshInterval * 1000;
		if (usageIntervalMs > 0) {
			const usageTickMs = Math.min(usageIntervalMs, 10000);
			usageRefreshInterval = setInterval(() => {
				if (!lastContext) return;
				const elapsed = lastUsageRefreshAt ? Date.now() - lastUsageRefreshAt : usageIntervalMs + 1;
				if (elapsed >= usageIntervalMs) {
					void refresh(lastContext);
				}
			}, usageTickMs);
			usageRefreshInterval.unref?.();
		}

		const statusIntervalMs = settings.statusRefresh.refreshInterval * 1000;
		if (statusIntervalMs > 0) {
			const statusTickMs = Math.min(statusIntervalMs, 10000);
			statusRefreshInterval = setInterval(() => {
				if (!lastContext) return;
				const elapsed = lastStatusRefreshAt ? Date.now() - lastStatusRefreshAt : statusIntervalMs + 1;
				if (elapsed >= statusIntervalMs) {
					void refreshStatus(lastContext);
				}
			}, statusTickMs);
			statusRefreshInterval.unref?.();
		}
	}

	function applySettingsPatch(patch: Partial<Settings>): void {
		ensureSettingsLoaded();
		settings = deepMerge(settings, patch);
		saveSettings(settings);
		setupRefreshInterval();
		pi.events.emit("sub-core:settings:updated", { settings });
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
		settings = loadSettings();
		registerToolsFromSettings(settings);
		setupRefreshInterval();
		pi.events.emit("sub-core:settings:updated", { settings });
		if (lastContext) {
			void refresh(lastContext, { allowStaleCache: true, skipFetch: true });
			void refreshStatus(lastContext, { allowStaleCache: true, skipFetch: true });
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

	async function getEntries(force?: boolean): Promise<ProviderUsageEntry[]> {
		ensureSettingsLoaded();
		const enabledProviders = controller.getEnabledProviders(settings);
		if (enabledProviders.length === 0) return [];
		if (force) {
			return fetchUsageEntries(deps, settings, enabledProviders, { force: true });
		}
		return getCachedUsageEntries(enabledProviders, settings);
	}

	const registerUsageTool = (name: ToolName): void => {
		pi.registerTool({
			name,
			label: "Sub Usage",
			description: "Refresh and return the latest subscription usage snapshot.",
			parameters: Type.Object({
				force: Type.Optional(Type.Boolean({ description: "Force refresh" })),
			}),
			async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
				const { force } = params as { force?: boolean };
				await refresh(ctx, { force: force ?? true });
				const payload = { provider: lastState.provider, usage: stripUsageProvider(lastState.usage) };
				return {
					content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
					details: payload,
				};
			},
		});
	};

	const registerAllUsageTool = (name: ToolName): void => {
		pi.registerTool({
			name,
			label: "Sub All Usage",
			description: "Refresh and return usage snapshots for all enabled providers.",
			parameters: Type.Object({
				force: Type.Optional(Type.Boolean({ description: "Force refresh" })),
			}),
			async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
				const { force } = params as { force?: boolean };
				const entries = await getEntries(force ?? true);
				const payload = entries.map((entry) => ({
					provider: entry.provider,
					usage: stripUsageProvider(entry.usage),
				}));
				return {
					content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
					details: { entries: payload },
				};
			},
		});
	};

	function registerToolsFromSettings(nextSettings: Settings): void {
		if (toolsRegistered) return;
		const usageToolEnabled = nextSettings.tools?.usageTool ?? false;
		const allUsageToolEnabled = nextSettings.tools?.allUsageTool ?? false;

		if (usageToolEnabled) {
			for (const name of TOOL_NAMES.usage) {
				registerUsageTool(name);
			}
		}
		if (allUsageToolEnabled) {
			for (const name of TOOL_NAMES.allUsage) {
				registerAllUsageTool(name);
			}
		}
		toolsRegistered = true;
	}

	function ensureSettingsLoaded(): void {
		if (settingsLoaded) return;
		settings = loadSettings();
		settingsLoaded = true;
		registerToolsFromSettings(settings);
		setupRefreshInterval();
		const watchTimer = setTimeout(() => {
			startCacheWatch();
			startSettingsWatch();
		}, 0);
		watchTimer.unref?.();
	}
	pi.registerCommand("sub-core:settings", {
		description: "Open sub-core settings",
		handler: async (_args, ctx) => {
			ensureSettingsLoaded();
			const handleSettingsChange = async (updatedSettings: Settings) => {
				applySettingsPatch(updatedSettings);
				if (lastContext) {
					await refresh(lastContext);
				}
			};

			const newSettings = await showSettingsUI(ctx, handleSettingsChange);
			settings = newSettings;
			applySettingsPatch(newSettings);
			if (lastContext) {
				await refresh(lastContext);
			}
		},
	});

	pi.events.on("sub-core:request", async (payload) => {
		ensureSettingsLoaded();
		const request = payload as SubCoreRequest;
		if (request.type === "entries") {
			const entries = await getEntries(request.force);
			if (lastContext && settings.statusRefresh.refreshInterval > 0) {
				await refreshStatus(lastContext, { force: request.force });
			}
			request.reply({ entries });
			return;
		}
		request.reply({
			state: lastState,
			settings: request.includeSettings ? settings : undefined,
		});
	});

	pi.events.on("sub-core:settings:patch", (payload) => {
		const patch = (payload as { patch?: Partial<Settings> }).patch;
		if (!patch) return;
		applySettingsPatch(patch);
		if (lastContext) {
			void refresh(lastContext);
		}
	});

	pi.events.on("sub-core:action", (payload) => {
		const action = payload as SubCoreAction;
		if (!lastContext) return;
		switch (action.type) {
			case "refresh":
				void refresh(lastContext, { force: action.force });
				break;
			case "cycleProvider":
				void cycleProvider(lastContext);
				break;
		}
	});

	pi.on("session_start", async (_event, ctx) => {
		lastContext = ctx;
		ensureSettingsLoaded();
		void refresh(ctx, { allowStaleCache: true, skipFetch: true });
		void refreshStatus(ctx, { allowStaleCache: true, skipFetch: true });
		pi.events.emit("sub-core:ready", { state: lastState, settings });
	});

	pi.on("turn_start", async (_event, ctx) => {
		if (settings.behavior.refreshOnTurnStart) {
			await refresh(ctx);
		}
		if (settings.statusRefresh.refreshOnTurnStart) {
			await refreshStatus(ctx);
		}
	});

	pi.on("tool_result", async (_event, ctx) => {
		if (settings.behavior.refreshOnToolResult) {
			await refresh(ctx);
		}
		if (settings.statusRefresh.refreshOnToolResult) {
			await refreshStatus(ctx);
		}
	});

	pi.on("turn_end", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		controllerState.currentProvider = undefined;
		controllerState.cachedUsage = undefined;
		await refresh(ctx);
		await refreshStatus(ctx);
	});

	pi.on("session_branch" as unknown as "session_start", async (_event: unknown, ctx: ExtensionContext) => {
		controllerState.currentProvider = undefined;
		controllerState.cachedUsage = undefined;
		await refresh(ctx);
		await refreshStatus(ctx);
	});

	pi.on("model_select" as unknown as "session_start", async (_event: unknown, ctx: ExtensionContext) => {
		controllerState.currentProvider = undefined;
		controllerState.cachedUsage = undefined;
		void refresh(ctx, { force: true, allowStaleCache: true });
		void refreshStatus(ctx, { force: true, allowStaleCache: true });
	});

	pi.on("session_shutdown", async () => {
		if (usageRefreshInterval) {
			clearInterval(usageRefreshInterval);
			usageRefreshInterval = undefined;
		}
		if (statusRefreshInterval) {
			clearInterval(statusRefreshInterval);
			statusRefreshInterval = undefined;
		}
		if (settingsDebounce) {
			clearTimeout(settingsDebounce);
			settingsDebounce = undefined;
		}
		if (settingsPoll) {
			clearInterval(settingsPoll);
			settingsPoll = undefined;
		}
		settingsWatcher?.close();
		settingsWatcher = undefined;
		settingsWatchStarted = false;
		settingsSnapshot = "";
		settingsMtimeMs = 0;
		unsubscribeCache();
		unsubscribeCacheSnapshot();
		stopCacheWatch?.();
		stopCacheWatch = undefined;
		cacheWatchStarted = false;
		lastContext = undefined;
		subCoreGlobal.__piSubCore = undefined;
	});
}

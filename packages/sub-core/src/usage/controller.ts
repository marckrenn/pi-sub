/**
 * Usage refresh and provider selection controller.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ProviderName, UsageSnapshot } from "../types.js";
import type { Settings } from "../settings-types.js";
import { detectProviderFromModel } from "../providers/detection.js";
import { isExpectedMissingData } from "../errors.js";
import { formatElapsedSince } from "../utils.js";
import { fetchUsageForProvider, refreshStatusForProvider } from "./fetch.js";
import type { Dependencies } from "../types.js";
import { getCachedData, readCache } from "../cache.js";
import { hasProviderCredentials } from "../providers/registry.js";

export interface UsageControllerState {
	currentProvider?: ProviderName;
	cachedUsage?: UsageSnapshot;
	lastSuccessAt?: number;
	providerCycleIndex: number;
}

export interface UsageUpdate {
	provider?: ProviderName;
	usage?: UsageSnapshot;
}

export type UsageUpdateHandler = (update: UsageUpdate) => void;

export function createUsageController(deps: Dependencies) {
	function isProviderAvailable(
		settings: Settings,
		provider: ProviderName,
		options?: { skipCredentials?: boolean }
	): boolean {
		const setting = settings.providers[provider];
		if (setting.enabled === "off" || setting.enabled === false) return false;
		if (setting.enabled === "on" || setting.enabled === true) return true;
		if (options?.skipCredentials) return true;
		return hasProviderCredentials(provider, deps);
	}

	function getEnabledProviders(settings: Settings): ProviderName[] {
		return settings.providerOrder.filter((p) => isProviderAvailable(settings, p));
	}

	function resolveProvider(
		ctx: ExtensionContext,
		settings: Settings,
		state: UsageControllerState,
		options?: { skipCredentials?: boolean }
	): ProviderName | undefined {
		const detected = detectProviderFromModel(ctx.model);
		if (detected && isProviderAvailable(settings, detected, options)) {
			return detected;
		}
		return undefined;
	}

	function emitUpdate(state: UsageControllerState, onUpdate: UsageUpdateHandler): void {
		onUpdate({
			provider: state.currentProvider,
			usage: state.cachedUsage,
		});
	}

	async function refresh(
		ctx: ExtensionContext,
		settings: Settings,
		state: UsageControllerState,
		onUpdate: UsageUpdateHandler,
		options?: { force?: boolean; allowStaleCache?: boolean; forceStatus?: boolean; skipFetch?: boolean }
	): Promise<void> {
		const provider = resolveProvider(ctx, settings, state, { skipCredentials: options?.skipFetch });
		if (!provider) {
			state.currentProvider = undefined;
			state.cachedUsage = undefined;
			emitUpdate(state, onUpdate);
			return;
		}

		const providerChanged = provider !== state.currentProvider;
		state.currentProvider = provider;
		if (providerChanged) {
			state.cachedUsage = undefined;
		}

		const cache = readCache();
		let cachedEntry = await getCachedData(provider, settings.behavior.refreshInterval * 1000, cache);
		if (!cachedEntry && options?.allowStaleCache) {
			cachedEntry = cache[provider] ?? null;
		}
		if (cachedEntry?.usage) {
			state.cachedUsage = {
				...cachedEntry.usage,
				status: cachedEntry.status,
				lastSuccessAt: cachedEntry.fetchedAt,
			};
			if (!cachedEntry.usage.error) {
				state.lastSuccessAt = cachedEntry.fetchedAt;
			}
		}
		emitUpdate(state, onUpdate);

		if (options?.skipFetch) {
			return;
		}

		const result = await fetchUsageForProvider(deps, settings, provider, options);
		const error = result.usage?.error;
		const fetchError = Boolean(error && !isExpectedMissingData(error));
		if (fetchError) {
			let fallback = state.cachedUsage;
			let fallbackFetchedAt = state.lastSuccessAt;
			if (!fallback || fallback.windows.length === 0) {
				const cachedEntry = cache[provider];
				const cachedUsage = cachedEntry?.usage ? { ...cachedEntry.usage, status: cachedEntry.status } : undefined;
				fallback = cachedUsage && cachedUsage.windows.length > 0 ? cachedUsage : undefined;
				if (cachedEntry?.fetchedAt) fallbackFetchedAt = cachedEntry.fetchedAt;
			}
			if (fallback && fallback.windows.length > 0) {
				const lastSuccessAt = fallbackFetchedAt ?? state.lastSuccessAt;
				const elapsed = lastSuccessAt ? formatElapsedSince(lastSuccessAt) : undefined;
				const description = elapsed ? (elapsed === "just now" ? "just now" : `${elapsed} ago`) : "Fetch failed";
				state.cachedUsage = {
					...fallback,
					lastSuccessAt,
					error,
					status: { indicator: "minor", description },
				};
			} else {
				state.cachedUsage = result.usage ? { ...result.usage, status: result.status } : undefined;
			}
		} else {
			const successAt = Date.now();
			state.cachedUsage = result.usage
				? { ...result.usage, status: result.status, lastSuccessAt: successAt }
				: undefined;
			if (result.usage && !result.usage.error) {
				state.lastSuccessAt = successAt;
			}
		}
		emitUpdate(state, onUpdate);
	}

	async function refreshStatus(
		ctx: ExtensionContext,
		settings: Settings,
		state: UsageControllerState,
		onUpdate: UsageUpdateHandler,
		options?: { force?: boolean; allowStaleCache?: boolean; skipFetch?: boolean }
	): Promise<void> {
		const provider = resolveProvider(ctx, settings, state, { skipCredentials: options?.skipFetch });
		if (!provider) {
			state.currentProvider = undefined;
			state.cachedUsage = undefined;
			emitUpdate(state, onUpdate);
			return;
		}

		const providerChanged = provider !== state.currentProvider;
		state.currentProvider = provider;
		if (providerChanged) {
			state.cachedUsage = undefined;
		}

		const cache = readCache();
		let cachedEntry = await getCachedData(provider, settings.behavior.refreshInterval * 1000, cache);
		if (!cachedEntry && options?.allowStaleCache) {
			cachedEntry = cache[provider] ?? null;
		}
		if (cachedEntry?.usage) {
			state.cachedUsage = {
				...cachedEntry.usage,
				status: cachedEntry.status,
				lastSuccessAt: cachedEntry.fetchedAt,
			};
			if (!cachedEntry.usage.error) {
				state.lastSuccessAt = cachedEntry.fetchedAt;
			}
		}

		if (options?.skipFetch) {
			emitUpdate(state, onUpdate);
			return;
		}

		const status = await refreshStatusForProvider(deps, settings, provider, { force: options?.force });
		if (status && state.cachedUsage) {
			state.cachedUsage = { ...state.cachedUsage, status };
		}

		emitUpdate(state, onUpdate);
	}

	async function cycleProvider(
		ctx: ExtensionContext,
		settings: Settings,
		state: UsageControllerState,
		onUpdate: UsageUpdateHandler
	): Promise<void> {
		const enabledProviders = getEnabledProviders(settings);
		if (enabledProviders.length === 0) {
			state.currentProvider = undefined;
			state.cachedUsage = undefined;
			emitUpdate(state, onUpdate);
			return;
		}

		const currentIndex = state.currentProvider
			? enabledProviders.indexOf(state.currentProvider)
			: -1;
		if (currentIndex >= 0) {
			state.providerCycleIndex = currentIndex;
		}

		const total = enabledProviders.length;
		for (let i = 0; i < total; i += 1) {
			state.providerCycleIndex = (state.providerCycleIndex + 1) % total;
			const nextProvider = enabledProviders[state.providerCycleIndex];
			const result = await fetchUsageForProvider(deps, settings, nextProvider);
			if (!isUsageAvailable(result.usage)) {
				continue;
			}
			state.currentProvider = nextProvider;
			state.cachedUsage = result.usage ? { ...result.usage, status: result.status } : undefined;
			emitUpdate(state, onUpdate);
			return;
		}

		state.currentProvider = undefined;
		state.cachedUsage = undefined;
		emitUpdate(state, onUpdate);
	}

	function isUsageAvailable(usage: UsageSnapshot | undefined): usage is UsageSnapshot {
		if (!usage) return false;
		if (usage.windows.length > 0) return true;
		if (!usage.error) return false;
		return !isExpectedMissingData(usage.error);
	}

	return {
		getEnabledProviders,
		resolveProvider,
		refresh,
		refreshStatus,
		cycleProvider,
	};
}

/**
 * Cache management for sub-bar
 * Shared cache across all pi instances to avoid redundant API calls
 */

import * as path from "node:path";
import * as fs from "node:fs";
import type { ProviderName, ProviderStatus, UsageSnapshot } from "./types.js";
import { isExpectedMissingData } from "./errors.js";
import { getStorage } from "./storage.js";
import {
	getCachePath,
	getCacheLockPath,
	getLegacyAgentCacheLockPath,
	getLegacyAgentCachePath,
	getLegacyCacheLockPath,
	getLegacyCachePath,
} from "./paths.js";
import { tryAcquireFileLock, releaseFileLock, waitForLockRelease } from "./storage/lock.js";

/**
 * Cache entry for a provider
 */
export interface CacheEntry {
	fetchedAt: number;
	statusFetchedAt?: number;
	usage?: UsageSnapshot;
	status?: ProviderStatus;
}

/**
 * Cache structure
 */
export interface Cache {
	[provider: string]: CacheEntry;
}

export type CacheUpdateListener = (provider: ProviderName, entry?: CacheEntry) => void;
export type CacheSnapshotListener = (cache: Cache) => void;

const cacheUpdateListeners = new Set<CacheUpdateListener>();
const cacheSnapshotListeners = new Set<CacheSnapshotListener>();

let lastCacheSnapshot: Cache | null = null;
let lastCacheContent = "";
let lastCacheMtimeMs = 0;
let legacyCacheMigrated = false;

function updateCacheSnapshot(cache: Cache, content: string, mtimeMs: number): void {
	lastCacheSnapshot = cache;
	lastCacheContent = content;
	lastCacheMtimeMs = mtimeMs;
}

function resetCacheSnapshot(): void {
	lastCacheSnapshot = {};
	lastCacheContent = "";
	lastCacheMtimeMs = 0;
}

function migrateLegacyCache(): void {
	if (legacyCacheMigrated) return;
	legacyCacheMigrated = true;
	const storage = getStorage();
	try {
		const legacyCachePaths = [LEGACY_AGENT_CACHE_PATH, LEGACY_CACHE_PATH];
		if (!storage.exists(CACHE_PATH)) {
			const legacyPath = legacyCachePaths.find((path) => storage.exists(path));
			if (legacyPath) {
				const content = storage.readFile(legacyPath);
				if (content) {
					ensureCacheDir();
					storage.writeFile(CACHE_PATH, content);
				}
			}
		}
		for (const legacyPath of legacyCachePaths) {
			if (storage.exists(legacyPath)) {
				storage.removeFile(legacyPath);
			}
		}
		for (const legacyLockPath of [LEGACY_AGENT_LOCK_PATH, LEGACY_LOCK_PATH]) {
			if (storage.exists(legacyLockPath)) {
				storage.removeFile(legacyLockPath);
			}
		}
	} catch (error) {
		console.error("Failed to migrate cache:", error);
	}
}

export function onCacheUpdate(listener: CacheUpdateListener): () => void {
	cacheUpdateListeners.add(listener);
	return () => {
		cacheUpdateListeners.delete(listener);
	};
}

export function onCacheSnapshot(listener: CacheSnapshotListener): () => void {
	cacheSnapshotListeners.add(listener);
	return () => {
		cacheSnapshotListeners.delete(listener);
	};
}

function emitCacheUpdate(provider: ProviderName, entry?: CacheEntry): void {
	for (const listener of cacheUpdateListeners) {
		try {
			listener(provider, entry);
		} catch (error) {
			console.error("Failed to notify cache update:", error);
		}
	}
}

function emitCacheSnapshot(cache: Cache): void {
	for (const listener of cacheSnapshotListeners) {
		try {
			listener(cache);
		} catch (error) {
			console.error("Failed to notify cache snapshot:", error);
		}
	}
}

/**
 * Cache file path
 */
export const CACHE_PATH = getCachePath();
const LEGACY_CACHE_PATH = getLegacyCachePath();
const LEGACY_AGENT_CACHE_PATH = getLegacyAgentCachePath();

/**
 * Lock file path
 */
const LOCK_PATH = getCacheLockPath();
const LEGACY_LOCK_PATH = getLegacyCacheLockPath();
const LEGACY_AGENT_LOCK_PATH = getLegacyAgentCacheLockPath();

/**
 * Lock timeout in milliseconds
 */
const LOCK_TIMEOUT_MS = 5000;
const CACHE_WRITE_RETRY_ATTEMPTS = 8;
const CACHE_WRITE_RETRY_DELAY_MS = 25;
const RETRYABLE_RENAME_ERROR_CODES = new Set(["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"]);
const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4));

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
	const storage = getStorage();
	const dir = path.dirname(CACHE_PATH);
	storage.ensureDir(dir);
}

/**
 * Read cache from disk
 */
export function readCache(): Cache {
	migrateLegacyCache();
	const storage = getStorage();
	try {
		const cacheExists = storage.exists(CACHE_PATH);
		if (!cacheExists) {
			if (lastCacheMtimeMs !== 0 || lastCacheContent) {
				resetCacheSnapshot();
			}
			return lastCacheSnapshot ?? {};
		}

		const stat = fs.statSync(CACHE_PATH, { throwIfNoEntry: false });
		if (stat && stat.mtimeMs === lastCacheMtimeMs && lastCacheSnapshot) {
			return lastCacheSnapshot;
		}

		const content = storage.readFile(CACHE_PATH);
		if (!content) {
			updateCacheSnapshot({}, "", stat?.mtimeMs ?? 0);
			return {};
		}
		if (!stat && content === lastCacheContent && lastCacheSnapshot) {
			return lastCacheSnapshot;
		}

		try {
			const parsed = JSON.parse(content) as Cache;
			updateCacheSnapshot(parsed, content, stat?.mtimeMs ?? Date.now());
			return parsed;
		} catch (error) {
			const lastBrace = content.lastIndexOf("}");
			if (lastBrace > 0) {
				const trimmed = content.slice(0, lastBrace + 1);
				try {
					const parsed = JSON.parse(trimmed) as Cache;
					if (stat) {
						writeCache(parsed);
					} else {
						updateCacheSnapshot(parsed, trimmed, Date.now());
					}
					return parsed;
				} catch {
					// fall through to log below
				}
			}
			console.error("Failed to read cache:", error);
		}
	} catch (error) {
		console.error("Failed to read cache:", error);
	}
	return {};
}

/**
 * Write cache to disk
 */
function writeCache(cache: Cache): void {
	migrateLegacyCache();
	const storage = getStorage();
	try {
		ensureCacheDir();
		const content = JSON.stringify(cache, null, 2);
		const cacheExists = storage.exists(CACHE_PATH);
		if (cacheExists && content === lastCacheContent) {
			const stat = fs.statSync(CACHE_PATH, { throwIfNoEntry: false });
			updateCacheSnapshot(cache, content, stat?.mtimeMs ?? lastCacheMtimeMs);
			return;
		}
		const tempPath = `${CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;
		fs.writeFileSync(tempPath, content, "utf-8");
		try {
			renameCacheFileWithRetry(tempPath, CACHE_PATH);
		} finally {
			removeTempCacheFile(tempPath);
		}
		const stat = fs.statSync(CACHE_PATH, { throwIfNoEntry: false });
		updateCacheSnapshot(cache, content, stat?.mtimeMs ?? Date.now());
	} catch (error) {
		console.error("Failed to write cache:", error);
	}
}

function renameCacheFileWithRetry(fromPath: string, toPath: string): void {
	let lastError: unknown;
	for (let attempt = 0; attempt < CACHE_WRITE_RETRY_ATTEMPTS; attempt++) {
		try {
			fs.renameSync(fromPath, toPath);
			return;
		} catch (error) {
			if (!isRetryableRenameError(error)) {
				throw error;
			}
			lastError = error;
			if (attempt >= CACHE_WRITE_RETRY_ATTEMPTS - 1) {
				break;
			}
			sleepSync(CACHE_WRITE_RETRY_DELAY_MS * (attempt + 1));
		}
	}
	if (lastError) {
		throw lastError;
	}
	throw new Error("Failed to rename cache file");
}

function removeTempCacheFile(tempPath: string): void {
	try {
		if (fs.existsSync(tempPath)) {
			fs.unlinkSync(tempPath);
		}
	} catch {
		// Ignore cleanup errors
	}
}

function isRetryableRenameError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const code = "code" in error ? (error as { code?: unknown }).code : undefined;
	return typeof code === "string" && RETRYABLE_RENAME_ERROR_CODES.has(code);
}

function sleepSync(ms: number): void {
	if (ms <= 0) return;
	Atomics.wait(SLEEP_ARRAY, 0, 0, ms);
}

export interface CacheWatchOptions {
	debounceMs?: number;
	pollIntervalMs?: number;
	lockRetryMs?: number;
}

export function watchCacheUpdates(options?: CacheWatchOptions): () => void {
	migrateLegacyCache();
	const debounceMs = options?.debounceMs ?? 250;
	const pollIntervalMs = options?.pollIntervalMs ?? 5000;
	const lockRetryMs = options?.lockRetryMs ?? 1000;
	let debounceTimer: NodeJS.Timeout | undefined;
	let lockRetryPending = false;
	let lastSnapshot = "";
	let lastMtimeMs = 0;
	let stopped = false;

	const scheduleLockRetry = () => {
		if (lockRetryPending || stopped) return;
		lockRetryPending = true;
		void waitForLockRelease(LOCK_PATH, lockRetryMs).then((released) => {
			lockRetryPending = false;
			if (released) {
				emitFromCache();
			}
		});
	};

	const emitFromCache = () => {
		try {
			if (fs.existsSync(LOCK_PATH)) {
				scheduleLockRetry();
				return;
			}
			const stat = fs.statSync(CACHE_PATH, { throwIfNoEntry: false });
			if (!stat || !stat.mtimeMs) return;
			if (stat.mtimeMs === lastMtimeMs) return;
			lastMtimeMs = stat.mtimeMs;
			const content = fs.readFileSync(CACHE_PATH, "utf-8");
			if (content === lastSnapshot) return;
			lastSnapshot = content;
			const cache = JSON.parse(content) as Cache;
			updateCacheSnapshot(cache, content, stat.mtimeMs);
			emitCacheSnapshot(cache);
			for (const [provider, entry] of Object.entries(cache)) {
				emitCacheUpdate(provider as ProviderName, entry);
			}
		} catch {
			// Ignore parse or read errors (likely mid-write)
		}
	};

	const scheduleEmit = () => {
		if (stopped) return;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => emitFromCache(), debounceMs);
	};

	let watcher: fs.FSWatcher | undefined;
	try {
		watcher = fs.watch(CACHE_PATH, scheduleEmit);
		watcher.unref?.();
	} catch {
		watcher = undefined;
	}

const pollTimer = setInterval(() => emitFromCache(), pollIntervalMs);
	pollTimer.unref?.();

	return () => {
		stopped = true;
		if (debounceTimer) clearTimeout(debounceTimer);
		if (pollTimer) clearInterval(pollTimer);
		watcher?.close();
	};
}

/**
 * Wait for lock to be released and re-check cache
 * Returns the cache entry if it became fresh while waiting
 */
async function waitForLockAndRecheck(
	provider: ProviderName,
	ttlMs: number,
	maxWaitMs: number = 3000
): Promise<CacheEntry | null> {
	const released = await waitForLockRelease(LOCK_PATH, maxWaitMs);
	if (!released) {
		return null;
	}

	const cache = readCache();
	const entry = cache[provider];
	if (entry && entry.usage?.error && !isExpectedMissingData(entry.usage.error)) {
		return null;
	}
	if (entry && Date.now() - entry.fetchedAt < ttlMs) {
		return entry;
	}
	return null;
}

/**
 * Get cached data for a provider if fresh, or null if stale/missing
 */
export async function getCachedData(
	provider: ProviderName,
	ttlMs: number,
	cacheSnapshot?: Cache
): Promise<CacheEntry | null> {
	const cache = cacheSnapshot ?? readCache();
	const entry = cache[provider];

	if (!entry) {
		return null;
	}

	if (entry.usage?.error && !isExpectedMissingData(entry.usage.error)) {
		return null;
	}

	const age = Date.now() - entry.fetchedAt;
	if (age < ttlMs) {
		return entry;
	}

	return null;
}

/**
 * Fetch data with lock coordination
 * Returns cached data if fresh, or executes fetchFn if cache is stale
 */
export async function fetchWithCache<T extends { usage?: UsageSnapshot; status?: ProviderStatus; statusFetchedAt?: number }>(
	provider: ProviderName,
	ttlMs: number,
	fetchFn: () => Promise<T>,
	options?: { force?: boolean }
): Promise<T> {
	const forceRefresh = options?.force === true;

	if (!forceRefresh) {
		// Check cache first
		const cached = await getCachedData(provider, ttlMs);
		if (cached) {
			return { usage: cached.usage, status: cached.status } as T;
		}
	}
	
	// Cache is stale or forced refresh, try to acquire lock
	const lockToken = tryAcquireFileLock(LOCK_PATH, LOCK_TIMEOUT_MS);

	if (!lockToken) {
		// Another process is fetching. Re-check once, then skip duplicate fetch work.
		const freshEntry = await waitForLockAndRecheck(provider, ttlMs);
		if (freshEntry) {
			return { usage: freshEntry.usage, status: freshEntry.status } as T;
		}
		const cache = readCache();
		const staleEntry = cache[provider];
		if (staleEntry) {
			return { usage: staleEntry.usage, status: staleEntry.status } as T;
		}
		return {} as T;
	}
	
	try {
		// Fetch fresh data
		const result = await fetchFn();
		
		// Only cache if we got valid usage data (not just no-credentials/errors)
		const hasCredentialError = result.usage?.error && isExpectedMissingData(result.usage.error);
		const hasError = Boolean(result.usage?.error);
		const shouldCache = result.usage && !hasCredentialError && !hasError;
		
		const cache = readCache();
		
		if (shouldCache) {
			// Update cache with valid data
			const fetchedAt = Date.now();
			const previous = cache[provider];
			const statusFetchedAt = result.statusFetchedAt ?? (result.status ? fetchedAt : previous?.statusFetchedAt);
			cache[provider] = {
				fetchedAt,
				statusFetchedAt,
				usage: result.usage,
				status: result.status,
			};
			writeCache(cache);
			emitCacheUpdate(provider, cache[provider]);
			emitCacheSnapshot(cache);
		} else if (hasCredentialError) {
			// Remove from cache if no credentials
			if (cache[provider]) {
				delete cache[provider];
				writeCache(cache);
				emitCacheUpdate(provider, undefined);
				emitCacheSnapshot(cache);
			}
		}
		
		return result;
	} finally {
		if (lockToken) {
			releaseFileLock(LOCK_PATH, lockToken);
		}
	}
}

export async function updateCacheStatus(
	provider: ProviderName,
	status: ProviderStatus,
	options?: { statusFetchedAt?: number }
): Promise<void> {
	const lockToken = tryAcquireFileLock(LOCK_PATH, LOCK_TIMEOUT_MS);
	if (!lockToken) {
		return;
	}
	try {
		const cache = readCache();
		const entry = cache[provider];
		const statusFetchedAt = options?.statusFetchedAt ?? Date.now();
		cache[provider] = {
			fetchedAt: entry?.fetchedAt ?? 0,
			statusFetchedAt,
			usage: entry?.usage,
			status,
		};
		writeCache(cache);
		emitCacheUpdate(provider, cache[provider]);
		emitCacheSnapshot(cache);
	} finally {
		if (lockToken) {
			releaseFileLock(LOCK_PATH, lockToken);
		}
	}
}

/**
 * Clear cache for a specific provider or all providers
 */
export function clearCache(provider?: ProviderName): void {
	const storage = getStorage();
	if (provider) {
		const cache = readCache();
		delete cache[provider];
		writeCache(cache);
	} else {
		try {
			if (storage.exists(CACHE_PATH)) {
				storage.removeFile(CACHE_PATH);
			}
			resetCacheSnapshot();
		} catch (error) {
			console.error("Failed to clear cache:", error);
		}
	}
}

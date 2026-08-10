/**
 * Shared path helpers for sub-core storage.
 */

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SETTINGS_FILE_NAME = "pi-sub-core-settings.json";
const CACHE_DIR_NAME = "cache";
const CACHE_NAMESPACE_DIR = "sub-core";
const CACHE_FILE_NAME = "cache.json";
const CACHE_LOCK_FILE_NAME = "cache.lock";
const LEGACY_AGENT_CACHE_FILE_NAME = "pi-sub-core-cache.json";
const LEGACY_AGENT_LOCK_FILE_NAME = "pi-sub-core-cache.lock";

export function getExtensionDir(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function getCacheDir(): string {
	return join(getAgentDir(), CACHE_DIR_NAME, CACHE_NAMESPACE_DIR);
}

export function getCachePath(): string {
	return join(getCacheDir(), CACHE_FILE_NAME);
}

export function getCacheLockPath(): string {
	return join(getCacheDir(), CACHE_LOCK_FILE_NAME);
}

export function getLegacyCachePath(): string {
	return join(getExtensionDir(), "cache.json");
}

export function getLegacyCacheLockPath(): string {
	return join(getExtensionDir(), "cache.lock");
}

export function getLegacyAgentCachePath(): string {
	return join(getAgentDir(), LEGACY_AGENT_CACHE_FILE_NAME);
}

export function getLegacyAgentCacheLockPath(): string {
	return join(getAgentDir(), LEGACY_AGENT_LOCK_FILE_NAME);
}

export function getSettingsPath(): string {
	return join(getAgentDir(), SETTINGS_FILE_NAME);
}

export function getLegacySettingsPath(): string {
	return join(getExtensionDir(), "settings.json");
}

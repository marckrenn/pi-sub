/**
 * Shared path helpers for sub-bar settings storage.
 */

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SETTINGS_FILE_NAME = "pi-sub-bar-settings.json";

export function getExtensionDir(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function getSettingsPath(): string {
	return join(getAgentDir(), SETTINGS_FILE_NAME);
}

export function getLegacySettingsPath(): string {
	return join(getExtensionDir(), "settings.json");
}

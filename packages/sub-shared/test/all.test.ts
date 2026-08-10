import test from "node:test";
import assert from "node:assert/strict";
import {
	DEFAULT_BEHAVIOR_SETTINGS,
	getDefaultCoreProviderSettings,
	getDefaultCoreSettings,
	PROVIDER_DISPLAY_NAMES,
	PROVIDER_METADATA,
	PROVIDERS,
} from "../index.js";

test("providers expose metadata and display names", () => {
	for (const provider of PROVIDERS) {
		const metadata = PROVIDER_METADATA[provider];
		assert.ok(metadata, `Expected metadata for ${provider}`);
		assert.equal(typeof metadata.displayName, "string");
		assert.ok(metadata.displayName.length > 0, `Expected display name for ${provider}`);
		assert.equal(PROVIDER_DISPLAY_NAMES[provider], metadata.displayName);
	}
});

test("provider display name keys match providers", () => {
	assert.deepEqual(Object.keys(PROVIDER_DISPLAY_NAMES).sort(), [...PROVIDERS].sort());
});

test("default provider settings include every provider as auto", () => {
	const settings = getDefaultCoreProviderSettings();

	assert.deepEqual(Object.keys(settings).sort(), [...PROVIDERS].sort());
	for (const provider of PROVIDERS) {
		assert.equal(settings[provider].enabled, "auto");
		assert.equal(settings[provider].fetchStatus, Boolean(PROVIDER_METADATA[provider]?.status));
	}
});

test("default core settings include provider order and behavior", () => {
	const settings = getDefaultCoreSettings();

	assert.deepEqual(settings.providerOrder, [...PROVIDERS]);
	assert.deepEqual(settings.providers, getDefaultCoreProviderSettings());
	assert.deepEqual(settings.behavior, DEFAULT_BEHAVIOR_SETTINGS);
	assert.deepEqual(settings.statusRefresh, DEFAULT_BEHAVIOR_SETTINGS);
	assert.equal(settings.defaultProvider, null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { getUsageExtras } from "../src/providers/extras.js";
import { getDefaultSettings } from "../src/settings-types.js";
import type { UsageSnapshot } from "../src/types.js";

function buildCopilotUsage(): UsageSnapshot {
	return {
		provider: "copilot",
		displayName: "GitHub Copilot",
		windows: [],
		requestsRemaining: 100,
		requestsEntitlement: 200,
	};
}

function buildOpenRouterUsage(): UsageSnapshot {
	return {
		provider: "openrouter",
		displayName: "OpenRouter Credits",
		windows: [],
		creditTotal: 20,
		creditUsage: 7.25,
		creditRemaining: 12.75,
	};
}

test("copilot extras include multiplier and requests left", () => {
	const settings = getDefaultSettings();
	settings.providers.copilot.showMultiplier = true;
	settings.providers.copilot.showRequestsLeft = true;

	const extras = getUsageExtras(buildCopilotUsage(), settings, "GPT-4o");
	assert.equal(extras.length, 1);
	assert.ok(extras[0].label.includes("Model multiplier: 0x"));
	assert.ok(extras[0].label.includes("req. left"));
});

test("copilot extras respect toggle settings", () => {
	const settings = getDefaultSettings();
	settings.providers.copilot.showMultiplier = false;

	const extras = getUsageExtras(buildCopilotUsage(), settings, "GPT-4o");
	assert.equal(extras.length, 0);

	settings.providers.copilot.showMultiplier = true;
	settings.providers.copilot.showRequestsLeft = false;

	const withMultiplierOnly = getUsageExtras(buildCopilotUsage(), settings, "GPT-4o");
	assert.equal(withMultiplierOnly.length, 1);
	assert.ok(withMultiplierOnly[0].label.includes("Model multiplier: 0x"));
	assert.ok(!withMultiplierOnly[0].label.includes("req. left"));
});

test("openrouter extras show remaining credit by default", () => {
	const settings = getDefaultSettings();

	const extras = getUsageExtras(buildOpenRouterUsage(), settings);
	assert.equal(extras.length, 1);
	assert.equal(extras[0].label, "$12.75 left");
});

test("openrouter extras can include breakdown", () => {
	const settings = getDefaultSettings();
	settings.providers.openrouter.showCreditBreakdown = true;

	const extras = getUsageExtras(buildOpenRouterUsage(), settings);
	assert.equal(extras.length, 1);
	assert.equal(extras[0].label, "$12.75 left ($7.25/$20.00 used)");
});

test("openrouter extras respect showRemainingCredit toggle", () => {
	const settings = getDefaultSettings();
	settings.providers.openrouter.showRemainingCredit = false;

	const extras = getUsageExtras(buildOpenRouterUsage(), settings);
	assert.equal(extras.length, 0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { formatUsageStatus, formatUsageStatusWithWidth, formatUsageWindowParts } from "../src/formatting.js";
import { shouldShowWindow } from "../src/providers/windows.js";
import { getDefaultSettings } from "../src/settings-types.js";
import type { UsageSnapshot } from "../src/types.js";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
} as unknown as Theme;

function buildUsage(): UsageSnapshot {
	return {
		provider: "codex",
		displayName: "Codex Plan",
		windows: [
			{
				label: "5h",
				usedPercent: 3,
				resetDescription: "4h",
				resetAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
			},
			{
				label: "Week",
				usedPercent: 7,
				resetDescription: "6d",
				resetAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
			},
		],
	};
}

function buildUsageWithStatus(
	indicator: NonNullable<UsageSnapshot["status"]>["indicator"],
	description?: string
): UsageSnapshot {
	return {
		...buildUsage(),
		status: {
			indicator,
			description,
		},
	};
}

test("fill width with contained vertical bars does not overflow", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "vertical";
	settings.display.barWidth = "fill";
	settings.display.containBar = true;

	const output = formatUsageStatusWithWidth(theme, buildUsage(), 80, undefined, settings);
	assert.ok(output);
	assert.ok(visibleWidth(output) <= 80);
});

test("fill width with contained horizontal bars does not overflow", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "horizontal-bar";
	settings.display.barWidth = "fill";
	settings.display.containBar = true;

	const output = formatUsageStatusWithWidth(theme, buildUsage(), 80, undefined, settings);
	assert.ok(output);
	assert.ok(visibleWidth(output) <= 80);
});

test("bar width 1 contained vertical bars stay compact", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "vertical";
	settings.display.barWidth = 1;
	settings.display.containBar = true;

	const output = formatUsageStatus(theme, buildUsage(), undefined, settings);
	assert.ok(output);
	assert.match(output, /▕▁▏/);
});

test("status indicator layout includes icon text provider colon", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "icon+text";
	settings.display.statusIconPack = "minimal";
	settings.display.statusDismissOk = false;
	settings.display.providerLabelColon = true;

	const output = formatUsageStatus(
		theme,
		buildUsageWithStatus("major", "Outage"),
		undefined,
		settings,
	);
	assert.ok(output);
	assert.ok(output.startsWith("⚠ Outage Codex:"));
});

test("status/provider divider renders only when status is present", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "icon+text";
	settings.display.statusIconPack = "minimal";
	settings.display.statusDismissOk = false;
	settings.display.statusProviderDivider = true;
	settings.display.dividerCharacter = "│";

	const output = formatUsageStatus(
		theme,
		buildUsageWithStatus("major", "Outage"),
		undefined,
		settings,
	);
	assert.ok(output.includes("│"));
});

test("custom status icon pack uses provided characters", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "icon";
	settings.display.statusIconPack = "custom";
	settings.display.statusIconCustom = "o!x?";
	settings.display.statusDismissOk = false;

	const output = formatUsageStatus(
		theme,
		buildUsageWithStatus("major"),
		undefined,
		settings,
	);
	assert.ok(output.includes("x"));
});

test("status dismiss ok hides operational text", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "icon+text";
	settings.display.statusIconPack = "emoji";
	settings.display.statusDismissOk = true;

	const output = formatUsageStatus(
		theme,
		buildUsageWithStatus("none", "All Systems Operational"),
		undefined,
		settings,
	);
	assert.ok(output);
	assert.ok(!output.includes("Operational"));
	assert.ok(!output.includes("✅"));
});

test("unknown status shows label in text mode", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "text";
	settings.display.statusIconPack = "emoji";
	settings.display.statusDismissOk = false;

	const output = formatUsageStatus(
		theme,
		buildUsageWithStatus("unknown"),
		undefined,
		settings,
	);
	assert.ok(!output.includes("❓"));
	assert.ok(output.includes("Status Unknown"));
});

test("fetch errors rely on status text instead of appended warning", () => {
	const settings = getDefaultSettings();
	settings.display.statusIndicatorMode = "text";

	const usage = buildUsage();
	usage.error = { code: "FETCH_FAILED", message: "Fetch failed" };
	usage.lastSuccessAt = Date.now() - 5 * 60 * 1000;
	usage.status = { indicator: "minor", description: "Fetch failed" };

	const output = formatUsageStatus(theme, usage, undefined, settings);
	assert.ok(output);
	assert.ok(output.includes("Last upd.: 5m ago"));
	assert.ok(!output.includes("(Fetch failed)"));
	assert.ok(output.includes("5h"));
});

test("background base text color uses theme background ansi", () => {
	const settings = getDefaultSettings();
	settings.display.baseTextColor = "selectedBg";

	const bgTheme = {
		fg: (_color: string, text: string) => text,
		bold: (text: string) => text,
		getBgAnsi: (_color: string) => "\x1b[48;5;120m",
	} as unknown as Theme;

	const output = formatUsageStatus(bgTheme, buildUsage(), undefined, settings);
	assert.ok(output);
	assert.ok(output.includes("\x1b[38;5;120m"));
	assert.ok(output.includes("\x1b[39m"));
});

test("reset timer placement works without titles or usage labels", () => {
	const settings = getDefaultSettings();
	settings.display.showWindowTitle = false;
	settings.display.showUsageLabels = false;
	settings.display.barStyle = "percentage";

	const usage = buildUsage();
	const window = usage.windows[0];

	const cases: Array<{ position: "off" | "front" | "back" | "integrated"; label: boolean; reset: boolean }> = [
		{ position: "front", label: true, reset: false },
		{ position: "back", label: false, reset: true },
		{ position: "integrated", label: true, reset: false },
		{ position: "off", label: false, reset: false },
	];

	for (const entry of cases) {
		settings.display.resetTimePosition = entry.position;
		const parts = formatUsageWindowParts(theme, window, false, settings, usage);
		assert.equal(parts.label.includes("5h"), false);
		assert.equal(parts.pct.includes("used"), false);
		if (entry.label) {
			assert.ok(parts.label.includes("4h"));
		} else {
			assert.equal(parts.label, "");
		}
		if (entry.reset) {
			assert.ok(parts.reset.includes("4h"));
		} else {
			assert.equal(parts.reset, "");
		}
	}
});

test("extras render even when usage windows are hidden", () => {
	const settings = getDefaultSettings();
	settings.providers.anthropic.windows.show5h = false;
	settings.providers.anthropic.windows.show7d = false;
	settings.providers.anthropic.windows.showExtra = true;

	const usage: UsageSnapshot = {
		provider: "anthropic",
		displayName: "Anthropic (Claude)",
		windows: [
			{ label: "5h", usedPercent: 10 },
			{ label: "Week", usedPercent: 20 },
		],
		extraUsageEnabled: false,
	};

	const output = formatUsageStatus(theme, usage, undefined, settings);
	assert.ok(output);
	assert.ok(output.includes("Extra [off]"));
	assert.ok(!output.includes("5h"));
	assert.ok(!output.includes("Week"));
});

test("percentage labels clamp to bounds", () => {
	const settings = getDefaultSettings();
	settings.display.barStyle = "percentage";
	settings.display.showUsageLabels = false;

	const usage = buildUsage();
	const highWindow = { ...usage.windows[0], usedPercent: 150 };
	const highParts = formatUsageWindowParts(theme, highWindow, false, settings, usage);
	assert.ok(highParts.pct.includes("100%"));

	const lowWindow = { ...usage.windows[0], usedPercent: -20 };
	const lowParts = formatUsageWindowParts(theme, lowWindow, false, settings, usage);
	assert.ok(lowParts.pct.includes("0%"));
});

test("emoji bar characters respect narrow widths", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "horizontal-bar";
	settings.display.barStyle = "bar";
	settings.display.barWidth = 1;
	settings.display.barCharacter = "🚀";

	const usage = buildUsage();
	const parts = formatUsageWindowParts(theme, usage.windows[0], false, settings, usage);
	assert.equal(visibleWidth(parts.bar), 1);
});

test("percentage style ignores containBar caps", () => {
	const settings = getDefaultSettings();
	settings.display.barStyle = "percentage";
	settings.display.containBar = true;

	const usage = buildUsage();
	const parts = formatUsageWindowParts(theme, usage.windows[0], false, settings, usage);
	assert.equal(parts.bar, "");
});

test("divider fill and label gap fill stay within width", () => {
	const settings = getDefaultSettings();
	settings.display.dividerBlanks = "fill";
	settings.display.barWidth = 6;

	const output = formatUsageStatusWithWidth(theme, buildUsage(), 60, undefined, settings, { labelGapFill: true });
	assert.ok(output);
	assert.ok(visibleWidth(output) <= 60);
});

test("narrow widths truncate without errors", () => {
	const settings = getDefaultSettings();
	settings.display.barWidth = 6;

	const output = formatUsageStatusWithWidth(theme, buildUsage(), 10, undefined, settings, { labelGapFill: true });
	assert.ok(output);
	assert.ok(visibleWidth(output) <= 10);
});

test("fill bars with extras stay within width", () => {
	const settings = getDefaultSettings();
	settings.display.barWidth = "fill";
	settings.display.containBar = true;
	settings.display.dividerBlanks = "fill";
	settings.providers.copilot.showMultiplier = true;
	settings.providers.copilot.showRequestsLeft = true;

	const usage: UsageSnapshot = {
		provider: "copilot",
		displayName: "GitHub Copilot",
		windows: [{ label: "Month", usedPercent: 12 }],
		requestsRemaining: 120,
		requestsEntitlement: 200,
	};

	const output = formatUsageStatusWithWidth(theme, usage, 140, "GPT-4o", settings, { labelGapFill: true });
	assert.ok(output);
	assert.ok(output.includes("Model multiplier"));
	assert.ok(visibleWidth(output) <= 140);
});


test("codex shows model-specific usage for GPT-5.3-Codex-Spark", () => {
	const settings = getDefaultSettings();
	const usage: UsageSnapshot = {
		provider: "codex",
		displayName: "Codex Plan",
		windows: [
			{ label: "5h", usedPercent: 12 },
			{ label: "GPT-5.3-Codex-Spark 5h", usedPercent: 3 },
			{ label: "GPT-5.3-Codex-Spark Week", usedPercent: 4 },
		],
	};

	assert.equal(shouldShowWindow(usage, usage.windows[1], settings, { id: "gpt-5.3-codex-spark" }), true);
	assert.equal(shouldShowWindow(usage, usage.windows[0], settings, { id: "gpt-5.3-codex-spark" }), false);

	assert.equal(shouldShowWindow(usage, usage.windows[1], settings, { id: "gpt-4o" }), false);
	assert.equal(shouldShowWindow(usage, usage.windows[0], settings, { id: "gpt-4o" }), true);
	assert.equal(shouldShowWindow(usage, usage.windows[2], settings, { id: "gpt-4o" }), false);
});

test("codex spark usage window labels hide model prefix", () => {
	const settings = getDefaultSettings();
	const usage: UsageSnapshot = {
		provider: "codex",
		displayName: "Codex Plan",
		windows: [
			{ label: "GPT-5.3-Codex-Spark 5h", usedPercent: 3 },
			{ label: "GPT-5.3-Codex-Spark Week", usedPercent: 4 },
		],
	};

	const output = formatUsageStatus(theme, usage, "gpt-5.3-codex-spark", settings);
	assert.equal(output?.includes("GPT-5.3-Codex-Spark"), false);
	assert.equal(output?.includes("5h"), true);
	assert.equal(output?.includes("Week"), true);
});

test("codex spark provider label uses Codex (Spark)", () => {
	const settings = getDefaultSettings();
	const usage: UsageSnapshot = {
		provider: "codex",
		displayName: "Codex Plan",
		windows: [{ label: "5h", usedPercent: 3 }],
	};

	const output = formatUsageStatus(theme, usage, "gpt-5.3-codex-spark", settings);
	assert.equal(output?.includes("Codex (Spark)"), true);
	assert.equal(output?.includes("Codex Plan"), false);
});

test("context bar appears as leftmost element when enabled", () => {
	const settings = getDefaultSettings();
	settings.display.showContextBar = true;
	settings.display.barWidth = 6;

	const contextInfo = { tokens: 50000, contextWindow: 200000, percent: 25 };
	const output = formatUsageStatus(theme, buildUsage(), undefined, settings, contextInfo);
	assert.ok(output);
	assert.ok(output.includes("Ctx"));
	assert.ok(output.includes("25%"));
});

test("context bar is hidden when showContextBar is false", () => {
	const settings = getDefaultSettings();
	settings.display.showContextBar = false;
	settings.display.barWidth = 6;

	const contextInfo = { tokens: 50000, contextWindow: 200000, percent: 25 };
	const output = formatUsageStatus(theme, buildUsage(), undefined, settings, contextInfo);
	assert.ok(output);
	assert.ok(!output.includes("Ctx"));
});

test("context bar with fill width stays within bounds", () => {
	const settings = getDefaultSettings();
	settings.display.showContextBar = true;
	settings.display.barWidth = "fill";
	settings.display.containBar = true;

	const contextInfo = { tokens: 100000, contextWindow: 200000, percent: 50 };
	const output = formatUsageStatusWithWidth(
		theme,
		buildUsage(),
		100,
		undefined,
		settings,
		{ labelGapFill: true },
		contextInfo
	);
	assert.ok(output);
	assert.ok(output.includes("Ctx"));
	assert.ok(visibleWidth(output) <= 100);
});

test("context bar not shown when contextWindow is 0", () => {
	const settings = getDefaultSettings();
	settings.display.showContextBar = true;
	settings.display.barWidth = 6;

	const contextInfo = { tokens: 0, contextWindow: 0, percent: 0 };
	const output = formatUsageStatus(theme, buildUsage(), undefined, settings, contextInfo);
	assert.ok(output);
	assert.ok(!output.includes("Ctx"));

});

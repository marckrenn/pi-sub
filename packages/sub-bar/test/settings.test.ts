import test from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";
import { formatUsageStatus, formatUsageWindowParts } from "../src/formatting.js";
import { buildDisplayShareString, decodeDisplayShareString } from "../src/share.js";
import { applyDisplayChange, buildDisplayColorItems } from "../src/settings/display.js";
import { buildDisplayThemeItems, saveDisplayTheme, upsertDisplayTheme } from "../src/settings/themes.js";
import { getDefaultSettings, resolveBaseTextColor } from "../src/settings-types.js";
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
				usedPercent: 12,
				resetDescription: "4h",
				resetAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
			},
		],
	};
}

test("custom provider label is appended", () => {
	const settings = getDefaultSettings();
	settings.display.providerLabel = "Team";
	settings.display.providerLabelColon = true;

	const output = formatUsageStatus(theme, buildUsage(), undefined, settings);
	assert.ok(output);
	assert.ok(output.startsWith("Codex Team:"));
});

test("custom bar character is used", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "horizontal-bar";
	settings.display.barStyle = "bar";
	settings.display.barWidth = 4;
	settings.display.barCharacter = "★";

	const usage = buildUsage();
	const parts = formatUsageWindowParts(theme, usage.windows[0], false, settings, usage);
	assert.ok(parts.bar.includes("★"));
});

test("mixed bar characters fill full width", () => {
	const settings = getDefaultSettings();
	settings.display.barType = "horizontal-bar";
	settings.display.barStyle = "bar";
	settings.display.barWidth = 22;
	settings.display.barCharacter = "🚀_";

	const usage = buildUsage();
	usage.windows[0].usedPercent = 57;

	const parts = formatUsageWindowParts(theme, usage.windows[0], false, settings, usage);
	assert.equal(visibleWidth(parts.bar), 22);
	assert.ok(parts.bar.includes("🚀"));
	assert.ok(parts.bar.includes("_"));
});

test("applyDisplayChange clamps custom numeric values", () => {
	const settings = getDefaultSettings();

	applyDisplayChange(settings, "paddingLeft", "-5");
	assert.equal(settings.display.paddingLeft, 0);

	applyDisplayChange(settings, "paddingRight", "-3");
	assert.equal(settings.display.paddingRight, 0);

	applyDisplayChange(settings, "barWidth", "150");
	assert.equal(settings.display.barWidth, 100);

	applyDisplayChange(settings, "dividerBlanks", "-2");
	assert.equal(settings.display.dividerBlanks, 0);

	applyDisplayChange(settings, "errorThreshold", "-10");
	assert.equal(settings.display.errorThreshold, 0);

	applyDisplayChange(settings, "warningThreshold", "250");
	assert.equal(settings.display.warningThreshold, 100);
});

test("share string preserves custom values and tolerates unknown colors", () => {
	const defaults = getDefaultSettings();
	const display = {
		...defaults.display,
		providerLabel: "Team",
		barCharacter: "★",
		baseTextColor: "not-a-color",
	};

	const share = buildDisplayShareString("Custom", display);
	const decoded = decodeDisplayShareString(share);
	assert.ok(decoded);
	assert.equal(decoded?.display.providerLabel, "Team");
	assert.equal(decoded?.display.barCharacter, "★");
	assert.equal(resolveBaseTextColor(decoded?.display.baseTextColor), "dim");
});

test("theme source labels imported vs saved", () => {
	const settings = getDefaultSettings();
	upsertDisplayTheme(settings, "Imported", settings.display, "imported");
	saveDisplayTheme(settings, "Saved");

	const items = buildDisplayThemeItems(settings);
	const importedItem = items.find((item) => item.label === "Imported");
	const savedItem = items.find((item) => item.label === "Saved");

	assert.equal(importedItem?.description, "manually imported theme");
	assert.equal(savedItem?.description, "manually saved theme");
});

test("imported source persists when updated", () => {
	const settings = getDefaultSettings();
	upsertDisplayTheme(settings, "Imported", settings.display, "imported");
	upsertDisplayTheme(settings, "Imported", { ...settings.display, barWidth: 8 });

	const items = buildDisplayThemeItems(settings);
	const importedItem = items.find((item) => item.label === "Imported");
	assert.equal(importedItem?.description, "manually imported theme");
});

test("decode marks newer share versions", () => {
	const payload = { v: 99, display: getDefaultSettings().display };
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const decoded = decodeDisplayShareString(`Future:${encoded}`);
	assert.ok(decoded?.isNewerVersion);
});

test("applyDisplayChange ignores invalid numeric values", () => {
	const settings = getDefaultSettings();
	const initialBarWidth = settings.display.barWidth;
	const initialDividerBlanks = settings.display.dividerBlanks;
	const initialPaddingLeft = settings.display.paddingLeft;
	const initialPaddingRight = settings.display.paddingRight;

	applyDisplayChange(settings, "barWidth", "abc");
	assert.equal(settings.display.barWidth, initialBarWidth);

	applyDisplayChange(settings, "dividerBlanks", "nope");
	assert.equal(settings.display.dividerBlanks, initialDividerBlanks);

	applyDisplayChange(settings, "paddingLeft", "NaN");
	assert.equal(settings.display.paddingLeft, initialPaddingLeft);

	applyDisplayChange(settings, "paddingRight", "NaN");
	assert.equal(settings.display.paddingRight, initialPaddingRight);
});

test("applyDisplayChange supports fill and numeric values", () => {
	const settings = getDefaultSettings();

	applyDisplayChange(settings, "barWidth", "fill");
	assert.equal(settings.display.barWidth, "fill");
	applyDisplayChange(settings, "barWidth", "12");
	assert.equal(settings.display.barWidth, 12);

	applyDisplayChange(settings, "dividerBlanks", "fill");
	assert.equal(settings.display.dividerBlanks, "fill");
	applyDisplayChange(settings, "dividerBlanks", "3");
	assert.equal(settings.display.dividerBlanks, 3);
});

test("background color accepts none", () => {
	const settings = getDefaultSettings();
	applyDisplayChange(settings, "backgroundColor", "none");
	assert.equal(settings.display.backgroundColor, "none");
});

test("display color items include none for background", () => {
	const settings = getDefaultSettings();
	const items = buildDisplayColorItems(settings);
	const backgroundItem = items.find((item) => item.id === "backgroundColor");
	assert.ok(backgroundItem);
	assert.ok(backgroundItem.values?.includes("none"));
});

test("status icon pack parsing handles preview labels", () => {
	const settings = getDefaultSettings();

	applyDisplayChange(settings, "statusIconPack", "minimal (✓ ⚠ × ?)");
	assert.equal(settings.display.statusIconPack, "minimal");

	applyDisplayChange(settings, "statusIconPack", "emoji (✅ ⚠️ 🔴 ❓)");
	assert.equal(settings.display.statusIconPack, "emoji");

	applyDisplayChange(settings, "statusIconPack", "faces (😎 😳 😵 🤔)");
	assert.equal(settings.display.statusIconPack, "custom");
	assert.equal(settings.display.statusIconCustom, "😎😳😵🤔");

	applyDisplayChange(settings, "statusIconPack", "__custom__");
	assert.equal(settings.display.statusIconPack, "custom");
});

test("applyDisplayChange stores custom status icons", () => {
	const settings = getDefaultSettings();
	applyDisplayChange(settings, "statusIconCustom", "✓⚠×?");
	assert.equal(settings.display.statusIconPack, "custom");
	assert.equal(settings.display.statusIconCustom, "✓⚠×?");
});

test("applyDisplayChange toggles status/provider divider", () => {
	const settings = getDefaultSettings();
	applyDisplayChange(settings, "statusProviderDivider", "on");
	assert.equal(settings.display.statusProviderDivider, true);
	applyDisplayChange(settings, "statusProviderDivider", "off");
	assert.equal(settings.display.statusProviderDivider, false);
});

test("applyDisplayChange accepts custom reset containment", () => {
	const settings = getDefaultSettings();
	applyDisplayChange(settings, "resetTimeContainment", "{}");
	assert.equal(settings.display.resetTimeContainment, "{}");
});

test("decodeDisplayShareString rejects invalid payloads", () => {
	assert.equal(decodeDisplayShareString("NoSeparator"), null);
	assert.equal(decodeDisplayShareString("Name:"), null);
	assert.equal(decodeDisplayShareString("Name:!!!"), null);

	const nonObjectPayload = Buffer.from(JSON.stringify(42)).toString("base64url");
	assert.equal(decodeDisplayShareString(`Name:${nonObjectPayload}`), null);
});

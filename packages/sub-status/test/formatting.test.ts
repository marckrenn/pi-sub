import test from "node:test";
import assert from "node:assert/strict";
import type { ProviderStatus, UsageSnapshot } from "@eiei114/pi-sub-shared";
import { formatCompactStatus } from "../src/format.js";

function buildUsage(overrides?: Partial<UsageSnapshot>): UsageSnapshot {
	return {
		provider: "anthropic",
		displayName: "Anthropic (Claude)",
		windows: [
			{ label: "5h", usedPercent: 3, resetDescription: "3h4m" },
			{ label: "Week", usedPercent: 7, resetDescription: "6d11h" },
			{ label: "Extra", usedPercent: 11, resetDescription: "Tomorrow" },
		],
		...overrides,
	};
}

function withStatus(indicator: ProviderStatus["indicator"]): UsageSnapshot {
	return buildUsage({ status: { indicator } });
}

test("formats the first two windows using reset descriptions when available", () => {
	assert.equal(formatCompactStatus(buildUsage()), "3h4m 3% · 6d11h 7%");
});

test("falls back to the window label when reset description is missing", () => {
	const usage = buildUsage({
		windows: [
			{ label: "5h", usedPercent: 3, resetDescription: "3h4m" },
			{ label: "Week", usedPercent: 7 },
		],
	});

	assert.equal(formatCompactStatus(usage), "3h4m 3% · Week 7%");
});

test("formats a single window without provider label noise", () => {
	const usage = buildUsage({ windows: [{ label: "Month", usedPercent: 42 }] });

	assert.equal(formatCompactStatus(usage), "Month 42%");
});

test("formats rounded percent after reset descriptions", () => {
	const usage = buildUsage({ windows: [{ label: "Month", usedPercent: 42.6, resetDescription: "2d" }] });

	assert.equal(formatCompactStatus(usage), "2d 43%");
});

test("appends stale suffix text for fallback data", () => {
	const usage = buildUsage({
		error: { code: "FETCH_FAILED", message: "Fetch failed" },
		lastSuccessAt: Date.now() - 60_000,
	});

	assert.equal(formatCompactStatus(usage), "3h4m 3% · 6d11h 7% · stale");
});

test("maps minor incidents to degraded suffix text", () => {
	assert.equal(formatCompactStatus(withStatus("minor")), "3h4m 3% · 6d11h 7% · degraded");
});

test("maps major incidents to outage suffix text", () => {
	assert.equal(formatCompactStatus(withStatus("major")), "3h4m 3% · 6d11h 7% · outage");
});

test("maps critical incidents to outage suffix text", () => {
	assert.equal(formatCompactStatus(withStatus("critical")), "3h4m 3% · 6d11h 7% · outage");
});

test("maps maintenance incidents to maintenance suffix text", () => {
	assert.equal(formatCompactStatus(withStatus("maintenance")), "3h4m 3% · 6d11h 7% · maintenance");
});

test("maps unknown incidents to unknown suffix text", () => {
	assert.equal(formatCompactStatus(withStatus("unknown")), "3h4m 3% · 6d11h 7% · unknown");
});

test("does not append noise for operational status", () => {
	assert.equal(formatCompactStatus(withStatus("none")), "3h4m 3% · 6d11h 7%");
});

test("stale fallback suppresses synthetic incident text", () => {
	const usage = buildUsage({
		status: { indicator: "minor", description: "5m ago" },
		error: { code: "FETCH_FAILED", message: "Fetch failed" },
		lastSuccessAt: Date.now() - 60_000,
	});

	assert.equal(formatCompactStatus(usage), "3h4m 3% · 6d11h 7% · stale");
});

test("formats combined stale and real incident suffixes when both are present", () => {
	const usage = buildUsage({
		status: { indicator: "maintenance" },
		error: { code: "HTTP_ERROR", message: "HTTP 500", httpStatus: 500 },
		lastSuccessAt: Date.now() - 60_000,
	});

	assert.equal(formatCompactStatus(usage), "3h4m 3% · 6d11h 7% · stale · maintenance");
});

test("returns undefined for missing usage", () => {
	assert.equal(formatCompactStatus(undefined), undefined);
});

test("returns undefined for usage with no windows", () => {
	assert.equal(formatCompactStatus(buildUsage({ windows: [] })), undefined);
});

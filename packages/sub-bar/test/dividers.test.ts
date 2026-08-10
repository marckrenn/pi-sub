import test from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { buildDividerLine } from "../src/dividers.js";

const theme = {
	fg: (_color: string, text: string) => text,
} as unknown as Theme;

test("divider join aligns after wide emoji", () => {
	const baseLine = "🙂|"; // emoji width 2, divider at column 2
	const line = buildDividerLine(4, baseLine, "|", true, "bottom", "text", theme);
	assert.equal(line[2], "┴");
});

test("divider join disabled keeps base line intact", () => {
	const baseLine = "| | |";
	const line = buildDividerLine(5, baseLine, "|", false, "top", "text", theme);
	assert.equal(line, "─────");
	assert.ok(!line.includes("┬"));
});

test("divider join ignores unsupported characters", () => {
	const baseLine = "• • •";
	const line = buildDividerLine(5, baseLine, "•", true, "bottom", "text", theme);
	assert.equal(line, "─────");
	assert.ok(!line.includes("┴"));
});

test("divider join handles ansi codes and wide characters", () => {
	const baseLine = "\x1b[31m🙂│\x1b[0m";
	const line = buildDividerLine(4, baseLine, "│", true, "top", "text", theme);
	assert.equal(line[2], "┬");
});

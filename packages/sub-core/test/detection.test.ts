import test from "node:test";
import assert from "node:assert/strict";
import { detectProviderFromModel } from "../src/providers/detection.js";


test("detectProviderFromModel prefers provider tokens over model tokens", () => {
	const provider = detectProviderFromModel({ provider: "OpenAI", id: "claude-3-opus" });
	assert.equal(provider, "codex");
});

test("detectProviderFromModel is case-insensitive", () => {
	const provider = detectProviderFromModel({ provider: "GITHUB", id: "copilot" });
	assert.equal(provider, "copilot");
});

test("detectProviderFromModel falls back to model tokens", () => {
	const provider = detectProviderFromModel({ id: "claude-3.5-sonnet" });
	assert.equal(provider, "anthropic");
});

test("detectProviderFromModel handles overlapping provider tokens", () => {
	const provider = detectProviderFromModel({ provider: "z.ai", id: "model" });
	assert.equal(provider, "zai");
});

test("detectProviderFromModel detects openrouter by provider", () => {
	const provider = detectProviderFromModel({ provider: "openrouter", id: "openrouter/auto" });
	assert.equal(provider, "openrouter");
});

test("detectProviderFromModel detects openrouter case-insensitively", () => {
	const provider = detectProviderFromModel({ provider: "OpenRouter", id: "meta-llama" });
	assert.equal(provider, "openrouter");
});

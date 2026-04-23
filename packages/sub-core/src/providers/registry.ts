/**
 * Provider registry - exports all providers
 */

export { AnthropicProvider } from "./impl/anthropic.js";
export { CopilotProvider } from "./impl/copilot.js";
export { GeminiProvider } from "./impl/gemini.js";
export { AntigravityProvider } from "./impl/antigravity.js";
export { CodexProvider } from "./impl/codex.js";
export { KiroProvider } from "./impl/kiro.js";
export { ZaiProvider } from "./impl/zai.js";
export { KimiCodingProvider } from "./impl/kimi-coding.js";

import type { Dependencies, ProviderName } from "../types.js";
import type { UsageProvider } from "../provider.js";
import { PROVIDERS } from "./metadata.js";
import { AnthropicProvider } from "./impl/anthropic.js";
import { CopilotProvider } from "./impl/copilot.js";
import { GeminiProvider } from "./impl/gemini.js";
import { AntigravityProvider } from "./impl/antigravity.js";
import { CodexProvider } from "./impl/codex.js";
import { KiroProvider } from "./impl/kiro.js";
import { ZaiProvider } from "./impl/zai.js";
import { KimiCodingProvider } from "./impl/kimi-coding.js";

const PROVIDER_FACTORIES: Record<ProviderName, () => UsageProvider> = {
	anthropic: () => new AnthropicProvider(),
	copilot: () => new CopilotProvider(),
	gemini: () => new GeminiProvider(),
	antigravity: () => new AntigravityProvider(),
	codex: () => new CodexProvider(),
	kiro: () => new KiroProvider(),
	zai: () => new ZaiProvider(),
	"kimi-coding": () => new KimiCodingProvider(),
};

/**
 * Create a provider instance by name
 */
export function createProvider(name: ProviderName): UsageProvider {
	return PROVIDER_FACTORIES[name]();
}

/**
 * Get all provider instances
 */
export function getAllProviders(): UsageProvider[] {
	return PROVIDERS.map((name) => PROVIDER_FACTORIES[name]());
}

export function hasProviderCredentials(name: ProviderName, deps: Dependencies): boolean {
	const provider = createProvider(name);
	if (provider.hasCredentials) {
		return provider.hasCredentials(deps);
	}
	return true;
}

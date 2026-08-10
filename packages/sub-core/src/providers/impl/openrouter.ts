/**
 * OpenRouter usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError, apiError } from "../../errors.js";
import { createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS, OPENROUTER_CREDITS_URL } from "../../config.js";

interface OpenRouterCreditsResponse {
	data?: {
		total_credits?: number;
		total_usage?: number;
	};
}

function normalizeApiKey(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function loadOpenRouterApiKey(deps: Dependencies): string | undefined {
	const envApiKey = normalizeApiKey(deps.env.OPENROUTER_API_KEY ?? deps.env.OPENROUTER_KEY);
	if (envApiKey) return envApiKey;

	const authPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(authPath)) {
			const auth = JSON.parse(deps.readFile(authPath) ?? "{}") as Record<string, unknown>;
			const openrouterAuth = auth.openrouter as Record<string, unknown> | undefined;
			return (
				normalizeApiKey(openrouterAuth?.access)
				?? normalizeApiKey(openrouterAuth?.key)
				?? normalizeApiKey(openrouterAuth?.apiKey)
			);
		}
	} catch {
		// Ignore parse errors
	}

	return undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampPercent(value: number): number {
	return Math.max(0, Math.min(100, value));
}

export class OpenRouterProvider extends BaseProvider {
	readonly name = "openrouter" as const;
	readonly displayName = "OpenRouter";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadOpenRouterApiKey(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const apiKey = loadOpenRouterApiKey(deps);
		if (!apiKey) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch(OPENROUTER_CREDITS_URL, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					Accept: "application/json",
				},
				signal: controller.signal,
			});
			clear();

			if (!res.ok) {
				return this.emptySnapshot(httpError(res.status));
			}

			let data: OpenRouterCreditsResponse;
			try {
				data = (await res.json()) as OpenRouterCreditsResponse;
			} catch {
				return this.emptySnapshot(apiError("Invalid OpenRouter credits response"));
			}

			const totalCredits = toFiniteNumber(data.data?.total_credits);
			const totalUsage = toFiniteNumber(data.data?.total_usage);

			if (totalCredits === undefined || totalUsage === undefined) {
				return this.emptySnapshot(apiError("Invalid OpenRouter credits response"));
			}

			const usedPercent = totalCredits > 0
				? clampPercent((totalUsage / totalCredits) * 100)
				: 0;
			const windows: RateWindow[] = [
				{
					label: "Credits",
					usedPercent,
				},
			];

			return this.snapshot({
				windows,
				creditTotal: totalCredits,
				creditUsage: totalUsage,
				creditRemaining: Math.max(0, totalCredits - totalUsage),
			});
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}
}

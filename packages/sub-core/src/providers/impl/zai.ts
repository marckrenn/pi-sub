/**
 * z.ai usage provider
 */

import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError, apiError } from "../../errors.js";
import { formatReset, createTimeoutController, getPiAuthPath } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";

/**
 * Load z.ai API key from environment or auth.json
 */
function loadZaiApiKey(deps: Dependencies): string | undefined {
	// Try environment variable first
	if (deps.env.ZAI_API_KEY) {
		return deps.env.ZAI_API_KEY;
	}
	if (deps.env.Z_AI_API_KEY) {
		return deps.env.Z_AI_API_KEY;
	}

	// Try pi auth.json
	const authPath = getPiAuthPath(deps);
	try {
		if (deps.fileExists(authPath)) {
			const auth = JSON.parse(deps.readFile(authPath) ?? "{}");
			return auth["z-ai"]?.access || auth["z-ai"]?.key || auth["zai"]?.access || auth["zai"]?.key;
		}
	} catch {
		// Ignore parse errors
	}

	return undefined;
}

export class ZaiProvider extends BaseProvider {
	readonly name = "zai" as const;
	readonly displayName = "z.ai Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadZaiApiKey(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const apiKey = loadZaiApiKey(deps);
		if (!apiKey) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
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

			const data = (await res.json()) as {
				success?: boolean;
				code?: number;
				msg?: string;
				data?: {
					limits?: Array<{
						type?: string;
						unit?: number;
						number?: number;
						percentage?: number;
						nextResetTime?: string;
					}>;
				};
			};

			if (!data.success || data.code !== 200) {
				return this.emptySnapshot(apiError(data.msg || "API error"));
			}

			const windows: RateWindow[] = [];
			const limits = data.data?.limits || [];

			for (const limit of limits) {
				const percent = limit.percentage || 0;
				const nextReset = limit.nextResetTime ? new Date(limit.nextResetTime) : undefined;

				if (limit.type === "TOKENS_LIMIT") {
					windows.push({
						label: "Tokens",
						usedPercent: percent,
						resetDescription: nextReset ? formatReset(nextReset) : undefined,
						resetAt: nextReset?.toISOString(),
					});
				} else if (limit.type === "TIME_LIMIT") {
					windows.push({
						label: "Monthly",
						usedPercent: percent,
						resetDescription: nextReset ? formatReset(nextReset) : undefined,
						resetAt: nextReset?.toISOString(),
					});
				}
			}

			return this.snapshot({ windows });
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}

	// z.ai doesn't have a public status page
}

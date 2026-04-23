/**
 * Kimi for Coding usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";

/**
 * Load Kimi for Coding token from various sources.
 *
 * Supports both pi-mono's auth.json format (`{ type: "api_key", key: "..." }`)
 * and legacy OAuth format (`{ access: "..." }`), plus environment variables.
 */
function loadKimiCodingToken(deps: Dependencies): string | undefined {
	// pi-mono convention
	const envToken = deps.env.KIMI_API_KEY?.trim();
	if (envToken) return envToken;

	// Legacy pi-sub override (keep for backward compat)
	const legacyEnvToken = deps.env.KIMI_CODING_OAUTH_TOKEN?.trim();
	if (legacyEnvToken) return legacyEnvToken;

	// Try pi auth.json next
	const piAuthPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(piAuthPath)) {
			const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
			const entry = data["kimi-coding"];
			if (entry?.access) return entry.access;
			if (entry?.key) return entry.key;
		}
	} catch {
		// Ignore parse errors
	}

	return undefined;
}

interface KimiLimitDetail {
	limit?: string;
	used?: string;
	remaining?: string;
	resetTime?: string;
}

interface KimiRateLimit {
	window?: {
		duration?: number;
		timeUnit?: string;
	};
	detail?: KimiLimitDetail;
}

interface KimiUsageResponse {
	usage?: KimiLimitDetail;
	limits?: KimiRateLimit[];
}

function parseDetailToWindow(label: string, detail: KimiLimitDetail | undefined): RateWindow | undefined {
	if (!detail) return undefined;
	const limit = parseFloat(detail.limit ?? "0");
	const used = parseFloat(detail.used ?? "0");
	if (limit <= 0) return undefined;
	const resetAt = detail.resetTime ? new Date(detail.resetTime) : undefined;
	return {
		label,
		usedPercent: (used / limit) * 100,
		resetDescription: resetAt ? formatReset(resetAt) : undefined,
		resetAt: resetAt?.toISOString(),
	};
}

export class KimiCodingProvider extends BaseProvider {
	readonly name = "kimi-coding" as const;
	readonly displayName = "Kimi for Coding";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadKimiCodingToken(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const token = loadKimiCodingToken(deps);
		if (!token) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch("https://api.kimi.com/coding/v1/usages", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/json",
				},
				signal: controller.signal,
			});
			clear();

			if (!res.ok) {
				return this.emptySnapshot(httpError(res.status));
			}

			const data = (await res.json()) as KimiUsageResponse;
			const windows: RateWindow[] = [];

			// 5h rolling window from limits — search for the 300-minute window
			const limits = data.limits ?? [];
			const fiveHourLimit = limits.find(
				(l) => l.window?.duration === 300 && l.window?.timeUnit === "TIME_UNIT_MINUTE"
			);
			const fiveHourWindow = parseDetailToWindow("5h", fiveHourLimit?.detail);
			if (fiveHourWindow) {
				windows.push(fiveHourWindow);
			}

			// Week window from top-level usage detail
			const weekWindow = parseDetailToWindow("Week", data.usage);
			if (weekWindow) {
				windows.push(weekWindow);
			}

			return this.snapshot({ windows });
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}
}

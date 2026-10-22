/**
 * OpenAI Codex usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";

interface CodexRateWindow {
	reset_at?: number;
	limit_window_seconds?: number;
	used_percent?: number;
}

interface CodexRateLimit {
	primary_window?: CodexRateWindow;
	secondary_window?: CodexRateWindow;
}

interface CodexAdditionalRateLimit {
	limit_name?: string;
	metered_feature?: string;
	rate_limit?: CodexRateLimit;
}

/**
 * Load Codex credentials from auth.json
 * First tries pi's auth.json, then falls back to legacy codex location
 */
function loadCodexCredentials(deps: Dependencies): { accessToken?: string; accountId?: string } {
	// Explicit override via env var
	const envAccessToken = (
		deps.env.OPENAI_CODEX_OAUTH_TOKEN ||
		deps.env.OPENAI_CODEX_ACCESS_TOKEN ||
		deps.env.CODEX_OAUTH_TOKEN ||
		deps.env.CODEX_ACCESS_TOKEN
	)?.trim();
	const envAccountId = (deps.env.OPENAI_CODEX_ACCOUNT_ID || deps.env.CHATGPT_ACCOUNT_ID)?.trim();
	if (envAccessToken) {
		return { accessToken: envAccessToken, accountId: envAccountId || undefined };
	}

	// Try pi's auth.json first
	const piAuthPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(piAuthPath)) {
			const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
			if (data["openai-codex"]?.access) {
				return {
					accessToken: data["openai-codex"].access,
					accountId: data["openai-codex"].accountId,
				};
			}
		}
	} catch {
		// Ignore parse errors, try legacy location
	}

	// Fall back to legacy codex location
	const codexHome = deps.env.CODEX_HOME || path.join(deps.homedir(), ".codex");
	const authPath = path.join(codexHome, "auth.json");
	try {
		if (deps.fileExists(authPath)) {
			const data = JSON.parse(deps.readFile(authPath) ?? "{}");
			if (data.OPENAI_API_KEY) {
				return { accessToken: data.OPENAI_API_KEY };
			} else if (data.tokens?.access_token) {
				return {
					accessToken: data.tokens.access_token,
					accountId: data.tokens.account_id,
				};
			}
		}
	} catch {
		// Ignore parse errors
	}

	return {};
}

function getWindowLabel(windowSeconds?: number, fallbackWindowSeconds?: number): string {
	const safeWindowSeconds =
		typeof windowSeconds === "number" && windowSeconds > 0
			? windowSeconds
			: typeof fallbackWindowSeconds === "number" && fallbackWindowSeconds > 0
				? fallbackWindowSeconds
				: 0;
	if (!safeWindowSeconds) {
		return "0h";
	}
	const windowHours = Math.round(safeWindowSeconds / 3600);
	if (windowHours >= 144) return "Week";
	if (windowHours >= 24) return "Day";
	return `${windowHours}h`;
}

function pushWindow(
	windows: RateWindow[],
	prefix: string | undefined,
	window: CodexRateWindow | undefined,
	fallbackWindowSeconds?: number
): void {
	if (!window) return;
	const resetDate = window.reset_at ? new Date(window.reset_at * 1000) : undefined;
	const label = getWindowLabel(window.limit_window_seconds, fallbackWindowSeconds);
	const windowLabel = prefix ? `${prefix} ${label}` : label;
	const rateWindow: RateWindow = {
		label: windowLabel,
		usedPercent: window.used_percent || 0,
		resetDescription: resetDate ? formatReset(resetDate) : undefined,
		resetAt: resetDate?.toISOString(),
	};
	const windowSeconds = window.limit_window_seconds;

	if (typeof windowSeconds === 'number' && Number.isFinite(windowSeconds) && windowSeconds > 0) {
		rateWindow.windowSeconds = windowSeconds;
	}

	windows.push(rateWindow);
}

function addRateWindows(windows: RateWindow[], rateLimit: CodexRateLimit | undefined, prefix?: string): void {
	pushWindow(windows, prefix, rateLimit?.primary_window, 10800);
	pushWindow(windows, prefix, rateLimit?.secondary_window, 86400);
}

export class CodexProvider extends BaseProvider {
	readonly name = "codex" as const;
	readonly displayName = "Codex Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadCodexCredentials(deps).accessToken);
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const { accessToken, accountId } = loadCodexCredentials(deps);
		if (!accessToken) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const headers: Record<string, string> = {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			};
			if (accountId) {
				headers["ChatGPT-Account-Id"] = accountId;
			}

			const res = await deps.fetch("https://chatgpt.com/backend-api/wham/usage", {
				headers,
				signal: controller.signal,
			});
			clear();

			if (!res.ok) {
				return this.emptySnapshot(httpError(res.status));
			}

			const data = (await res.json()) as {
				rate_limit?: CodexRateLimit;
				additional_rate_limits?: CodexAdditionalRateLimit[];
			};

			const windows: RateWindow[] = [];
			addRateWindows(windows, data.rate_limit);

			if (Array.isArray(data.additional_rate_limits)) {
				for (const entry of data.additional_rate_limits) {
					if (!entry || typeof entry !== "object") continue;
					const prefix =
						typeof entry.limit_name === "string" && entry.limit_name.trim().length > 0
							? entry.limit_name.trim()
							: typeof entry.metered_feature === "string" && entry.metered_feature.trim().length > 0
								? entry.metered_feature.trim()
								: "Additional";
					addRateWindows(windows, entry.rate_limit, prefix);
				}
			}

			return this.snapshot({ windows });
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}

}

/**
 * Anthropic/Claude usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";
import { getSettings } from "../../settings.js";

/**
 * Load Claude API token from various sources
 */
function loadClaudeToken(deps: Dependencies): string | undefined {
	// Explicit override via env var (useful in CI / menu bar apps)
	const envToken = deps.env.ANTHROPIC_OAUTH_TOKEN?.trim();
	if (envToken) return envToken;

	// Try pi auth.json next
	const piAuthPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(piAuthPath)) {
			const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
			if (data.anthropic?.access) return data.anthropic.access;
		}
	} catch {
		// Ignore parse errors
	}

	// Try Claude Code credentials file (current CLI storage location)
	const claudeCredentialsPath = path.join(deps.homedir(), ".claude", ".credentials.json");
	try {
		if (deps.fileExists(claudeCredentialsPath)) {
			const data = JSON.parse(deps.readFile(claudeCredentialsPath) ?? "{}");
			const oauth = data.claudeAiOauth ?? data;
			if (typeof oauth?.accessToken === "string" && oauth.accessToken.length > 0) {
				return oauth.accessToken;
			}
		}
	} catch {
		// Ignore parse errors
	}

	// Try macOS Keychain (Claude Code credentials)
	try {
		const keychainData = deps.execFileSync(
			"security",
			["find-generic-password", "-s", "Claude Code-credentials", "-w"],
			{ encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
		).trim();
		if (keychainData) {
			const parsed = JSON.parse(keychainData);
			const oauth = parsed.claudeAiOauth ?? parsed;
			if (typeof oauth?.accessToken === "string" && oauth.accessToken.length > 0) {
				return oauth.accessToken;
			}
		}
	} catch {
		// Keychain access failed
	}

	return undefined;
}

type AnthropicUsageWindow = {
	utilization?: number;
	resets_at?: string;
};

function pushUsageWindow(
	windows: RateWindow[],
	label: string,
	window?: AnthropicUsageWindow,
): void {
	if (window?.utilization === undefined) return;
	const resetAt = window.resets_at ? new Date(window.resets_at) : undefined;
	windows.push({
		label,
		usedPercent: window.utilization,
		resetDescription: resetAt ? formatReset(resetAt) : undefined,
		resetAt: resetAt?.toISOString(),
	});
}

function pushWeekWindow(windows: RateWindow[], data: {
	seven_day?: AnthropicUsageWindow;
	seven_day_sonnet?: AnthropicUsageWindow;
	seven_day_opus?: AnthropicUsageWindow;
	seven_day_oauth_apps?: AnthropicUsageWindow;
}): void {
	if (data.seven_day?.utilization !== undefined) {
		pushUsageWindow(windows, "Week", data.seven_day);
		return;
	}
	if (data.seven_day_sonnet?.utilization !== undefined) {
		pushUsageWindow(windows, "Week", data.seven_day_sonnet);
		return;
	}
	if (data.seven_day_opus?.utilization !== undefined) {
		pushUsageWindow(windows, "Week", data.seven_day_opus);
		return;
	}
	if (data.seven_day_oauth_apps?.utilization !== undefined) {
		pushUsageWindow(windows, "Week", data.seven_day_oauth_apps);
	}
}

type ExtraUsageFormat = {
	symbol: string;
	decimalSeparator: "." | ",";
};

function getExtraUsageFormat(): ExtraUsageFormat {
	const settings = getSettings();
	const providerSettings = settings.providers.anthropic;
	return {
		symbol: providerSettings.extraUsageCurrencySymbol?.trim() ?? "",
		decimalSeparator: providerSettings.extraUsageDecimalSeparator === "," ? "," : ".",
	};
}

function formatExtraUsageCredits(credits: number, format: ExtraUsageFormat): string {
	const amount = (credits / 100).toFixed(2);
	const formatted = format.decimalSeparator === "," ? amount.replace(".", ",") : amount;
	return format.symbol ? `${format.symbol}${formatted}` : formatted;
}


export class AnthropicProvider extends BaseProvider {
	readonly name = "anthropic" as const;
	readonly displayName = "Claude Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadClaudeToken(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const token = loadClaudeToken(deps);
		if (!token) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch("https://api.anthropic.com/api/oauth/usage", {
				headers: {
					Authorization: `Bearer ${token}`,
					"anthropic-beta": "oauth-2025-04-20",
				},
				signal: controller.signal,
			});
			clear();

			if (!res.ok) {
				return this.emptySnapshot(httpError(res.status));
			}

			const data = (await res.json()) as {
				five_hour?: AnthropicUsageWindow;
				seven_day?: AnthropicUsageWindow;
				seven_day_sonnet?: AnthropicUsageWindow;
				seven_day_opus?: AnthropicUsageWindow;
				seven_day_oauth_apps?: AnthropicUsageWindow;
				extra_usage?: {
					is_enabled?: boolean;
					used_credits?: number;
					monthly_limit?: number;
					utilization?: number;
				};
			};

			const windows: RateWindow[] = [];

			pushUsageWindow(windows, "5h", data.five_hour);
			pushWeekWindow(windows, data);

			// Extra usage
			const extraUsageEnabled = data.extra_usage?.is_enabled === true;
			const fiveHourUsage = data.five_hour?.utilization ?? 0;

			if (extraUsageEnabled) {
				const extra = data.extra_usage!;
				const usedCredits = extra.used_credits || 0;
				const monthlyLimit = extra.monthly_limit;
				const utilization = extra.utilization || 0;
				const format = getExtraUsageFormat();
				// "active" when 5h >= 99%, otherwise "on"
				const extraStatus = fiveHourUsage >= 99 ? "active" : "on";
				let label: string;
				if (monthlyLimit && monthlyLimit > 0) {
					label = `Extra [${extraStatus}] ${formatExtraUsageCredits(usedCredits, format)}/${formatExtraUsageCredits(monthlyLimit, format)}`;
				} else {
					label = `Extra [${extraStatus}] ${formatExtraUsageCredits(usedCredits, format)}`;
				}

				windows.push({
					label,
					usedPercent: utilization,
					resetDescription: extraStatus === "active" ? "__ACTIVE__" : undefined,
				});
			}

			return this.snapshot({
				windows,
				extraUsageEnabled,
				fiveHourUsage,
			});
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}

}

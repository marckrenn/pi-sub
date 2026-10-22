/**
 * Anthropic/Claude usage provider
 */

import * as path from "node:path";
import type {
	CredentialSource,
	Dependencies,
	RateWindow,
	UsageSnapshot,
} from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";
import { getSettings } from "../../settings.js";

/**
 * Load Claude API token from various sources
 */
function loadClaudeCredentials(
	deps: Dependencies,
): { token: string; credentialSource: CredentialSource } | undefined {
	// Explicit override via env var (useful in CI / menu bar apps)
	const envToken = deps.env.ANTHROPIC_OAUTH_TOKEN?.trim();
	if (envToken) return { token: envToken, credentialSource: "environment" };

	// Try pi auth.json next
	const piAuthPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(piAuthPath)) {
			const data = JSON.parse(deps.readFile(piAuthPath) ?? "{}");
			if (data.anthropic?.access) return { token: data.anthropic.access, credentialSource: "pi" };
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
			const scopes = parsed.claudeAiOauth?.scopes || [];
			if (scopes.includes("user:profile") && parsed.claudeAiOauth?.accessToken) {
				return { token: parsed.claudeAiOauth.accessToken, credentialSource: "claude-code-keychain" };
			}
		}
	} catch {
		// Keychain access failed
	}

	return undefined;
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
		return Boolean(loadClaudeCredentials(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const credentials = loadClaudeCredentials(deps);
		if (!credentials) {
			return this.emptySnapshot(noCredentials());
		}

		const { token, credentialSource } = credentials;
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
				five_hour?: { utilization?: number; resets_at?: string };
				seven_day?: { utilization?: number; resets_at?: string };
				extra_usage?: {
					is_enabled?: boolean;
					used_credits?: number;
					monthly_limit?: number;
					utilization?: number;
				};
			};

			const windows: RateWindow[] = [];

			if (data.five_hour?.utilization !== undefined) {
				const resetAt = data.five_hour.resets_at ? new Date(data.five_hour.resets_at) : undefined;
				windows.push({
					label: "5h",
					usedPercent: data.five_hour.utilization,
					resetDescription: resetAt ? formatReset(resetAt) : undefined,
					resetAt: resetAt?.toISOString(),
				});
			}

			if (data.seven_day?.utilization !== undefined) {
				const resetAt = data.seven_day.resets_at ? new Date(data.seven_day.resets_at) : undefined;
				windows.push({
					label: "Week",
					usedPercent: data.seven_day.utilization,
					resetDescription: resetAt ? formatReset(resetAt) : undefined,
					resetAt: resetAt?.toISOString(),
				});
			}

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
				credentialSource,
				extraUsageEnabled,
				fiveHourUsage,
			});
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}

}

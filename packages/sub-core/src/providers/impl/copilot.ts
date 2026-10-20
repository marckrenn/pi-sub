/**
 * GitHub Copilot usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController, getPiAuthPath } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";

/**
 * Copilot token entries stored by legacy GitHub Copilot CLI
 */
type CopilotHostEntry = {
	oauth_token?: string;
	user_token?: string;
	github_token?: string;
	token?: string;
};

const COPILOT_TOKEN_KEYS: Array<keyof CopilotHostEntry> = [
	"oauth_token",
	"user_token",
	"github_token",
	"token",
];

function getTokenFromHostEntry(entry: CopilotHostEntry | undefined): string | undefined {
	if (!entry) return undefined;
	for (const key of COPILOT_TOKEN_KEYS) {
		const value = entry[key];
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}
	return undefined;
}

function loadLegacyCopilotToken(deps: Dependencies): string | undefined {
	const configHome = deps.env.XDG_CONFIG_HOME || path.join(deps.homedir(), ".config");
	const legacyPaths = [
		path.join(configHome, "github-copilot", "hosts.json"),
		path.join(deps.homedir(), ".github-copilot", "hosts.json"),
	];

	for (const hostsPath of legacyPaths) {
		try {
			if (!deps.fileExists(hostsPath)) continue;
			const data = JSON.parse(deps.readFile(hostsPath) ?? "{}");
			if (!data || typeof data !== "object") continue;

			const normalizedHosts: Record<string, CopilotHostEntry> = {};
			for (const [host, entry] of Object.entries(data as Record<string, CopilotHostEntry>)) {
				normalizedHosts[host.toLowerCase()] = entry;
			}

			const preferredToken =
				getTokenFromHostEntry(normalizedHosts["github.com"]) ||
				getTokenFromHostEntry(normalizedHosts["api.github.com"]);
			if (preferredToken) return preferredToken;

			for (const entry of Object.values(normalizedHosts)) {
				const token = getTokenFromHostEntry(entry);
				if (token) return token;
			}
		} catch {
			// Ignore parse errors
		}
	}

	return undefined;
}

/**
 * Load Copilot token from pi auth.json first, then fallback to legacy locations.
 */
function loadCopilotToken(deps: Dependencies): string | undefined {
	// Explicit override via env var
	const envToken = (deps.env.COPILOT_GITHUB_TOKEN || deps.env.GH_TOKEN || deps.env.GITHUB_TOKEN || deps.env.COPILOT_TOKEN)?.trim();
	if (envToken) return envToken;

	const authPath = getPiAuthPath(deps);
	try {
		if (deps.fileExists(authPath)) {
			const data = JSON.parse(deps.readFile(authPath) ?? "{}");
			// Prefer refresh token (GitHub access token) for GitHub API endpoints.
			const piToken = data["github-copilot"]?.refresh || data["github-copilot"]?.access;
			if (typeof piToken === "string" && piToken.length > 0) return piToken;
		}
	} catch {
		// Ignore parse errors
	}

	return loadLegacyCopilotToken(deps);
}

export class CopilotProvider extends BaseProvider {
	readonly name = "copilot" as const;
	readonly displayName = "Copilot Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadCopilotToken(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const token = loadCopilotToken(deps);
		if (!token) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch("https://api.github.com/copilot_internal/user", {
				headers: {
					"Editor-Version": "vscode/1.96.2",
					"User-Agent": "GitHubCopilotChat/0.26.7",
					"X-Github-Api-Version": "2025-04-01",
					Accept: "application/json",
					Authorization: `token ${token}`,
				},
				signal: controller.signal,
			});
			clear();

			if (!res.ok) {
				return this.emptySnapshot(httpError(res.status));
			}

			const data = (await res.json()) as {
				quota_reset_date_utc?: string;
				quota_snapshots?: {
					premium_interactions?: {
						percent_remaining?: number;
						remaining?: number;
						entitlement?: number;
					};
				};
			};

			const windows: RateWindow[] = [];
			const resetDate = data.quota_reset_date_utc ? new Date(data.quota_reset_date_utc) : undefined;
			const resetDesc = resetDate ? formatReset(resetDate) : undefined;

			let requestsRemaining: number | undefined;
			let requestsEntitlement: number | undefined;

			if (data.quota_snapshots?.premium_interactions) {
				const pi = data.quota_snapshots.premium_interactions;
				const monthUsedPercent = Math.max(0, 100 - (pi.percent_remaining || 0));
				windows.push({
					label: "Month",
					usedPercent: monthUsedPercent,
					resetDescription: resetDesc,
					resetAt: resetDate?.toISOString(),
				});

				const remaining = pi.remaining ?? 0;
				const entitlement = pi.entitlement ?? 0;
				requestsRemaining = remaining;
				requestsEntitlement = entitlement;
			}

			return this.snapshot({
				windows,
				requestsRemaining,
				requestsEntitlement,
			});
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}

}

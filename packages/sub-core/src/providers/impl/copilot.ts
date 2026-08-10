/**
 * GitHub Copilot usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
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

	const authPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
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

type CopilotQuotaDetail = {
	percent_remaining?: number;
	remaining?: number;
	entitlement?: number;
	unlimited?: boolean;
};

type CopilotQuotaSnapshots = {
	premium_interactions?: CopilotQuotaDetail;
	chat?: CopilotQuotaDetail;
	completions?: CopilotQuotaDetail;
};

function parseCopilotQuotaWindow(
	label: string,
	quota: CopilotQuotaDetail | undefined,
	resetDate?: Date,
	resetDesc?: string,
): RateWindow | undefined {
	if (!quota || quota.unlimited) return undefined;
	if (quota.percent_remaining === undefined && quota.remaining === undefined && quota.entitlement === undefined) {
		return undefined;
	}
	const monthUsedPercent = Math.max(0, 100 - (quota.percent_remaining ?? 0));
	return {
		label,
		usedPercent: monthUsedPercent,
		resetDescription: resetDesc,
		resetAt: resetDate?.toISOString(),
	};
}

function pickPrimaryQuota(quota?: CopilotQuotaDetail): CopilotQuotaDetail | undefined {
	if (!quota || quota.unlimited) return undefined;
	return quota;
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
				quota_reset_date?: string;
				quota_snapshots?: CopilotQuotaSnapshots;
			};

			const windows: RateWindow[] = [];
			const resetRaw = data.quota_reset_date_utc ?? data.quota_reset_date;
			const resetDate = resetRaw ? new Date(resetRaw) : undefined;
			const resetDesc = resetDate && !Number.isNaN(resetDate.getTime()) ? formatReset(resetDate) : undefined;

			const snapshots = data.quota_snapshots;
			const premium = parseCopilotQuotaWindow("Month", snapshots?.premium_interactions, resetDate, resetDesc);
			const chat = parseCopilotQuotaWindow("Chat", snapshots?.chat, resetDate, resetDesc);
			const completions = parseCopilotQuotaWindow("Completions", snapshots?.completions, resetDate, resetDesc);

			if (premium) windows.push(premium);
			if (chat) windows.push(chat);
			if (completions) windows.push(completions);

			const primaryQuota =
				pickPrimaryQuota(snapshots?.premium_interactions) ??
				pickPrimaryQuota(snapshots?.chat) ??
				pickPrimaryQuota(snapshots?.completions);

			const requestsRemaining = primaryQuota?.remaining;
			const requestsEntitlement = primaryQuota?.entitlement;

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

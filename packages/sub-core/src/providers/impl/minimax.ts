/**
 * MiniMax usage provider
 */

import * as path from "node:path";
import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCredentials, fetchFailed, httpError } from "../../errors.js";
import { formatReset, createTimeoutController } from "../../utils.js";
import { API_TIMEOUT_MS } from "../../config.js";

const USAGE_URL = "https://api.minimax.io/v1/api/openplatform/coding_plan/remains";

// MiniMax-AI/MiniMax-M2#99: despite the name, `*_usage_count` fields contain
// *remaining* quota, not consumed usage. We derive consumed = total - remaining.
// When the upstream fix lands, change this to: return fieldValue;
function toConsumed(total: number, fieldValue: number): number {
	return total - fieldValue;
}

function loadMiniMaxApiKey(deps: Dependencies): string | undefined {
	const envKey = (deps.env.MINIMAX_API_KEY || deps.env.MINIMAX_TOKEN)?.trim();
	if (envKey) return envKey;

	const authPath = path.join(deps.homedir(), ".pi", "agent", "auth.json");
	try {
		if (deps.fileExists(authPath)) {
			const auth = JSON.parse(deps.readFile(authPath)!);
			const entry = auth["minimax"];
			if (entry?.key) return String(entry.key);
			if (entry?.access) return String(entry.access);
		}
	} catch {
	}

	return undefined;
}

interface ModelRemains {
	model_name: string;
	current_interval_total_count: number;
	current_interval_usage_count: number; // see toConsumed()
	remains_time: number;                 // ms until 5h window resets
	current_weekly_total_count?: number;
	current_weekly_usage_count?: number;  // see toConsumed()
	weekly_end_time?: number;             // unix ms of weekly reset
}

export class MiniMaxProvider extends BaseProvider {
	readonly name = "minimax" as const;
	readonly displayName = "MiniMax";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(loadMiniMaxApiKey(deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const apiKey = loadMiniMaxApiKey(deps);
		if (!apiKey) {
			return this.emptySnapshot(noCredentials());
		}

		const { controller, clear } = createTimeoutController(API_TIMEOUT_MS);

		try {
			const res = await deps.fetch(USAGE_URL, {
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

			const data = (await res.json()) as { model_remains?: ModelRemains[] };
			const model = data.model_remains?.find((m) => m.model_name.toLowerCase().includes("minimax-m"));
			if (!model) {
				return this.snapshot({ windows: [] });
			}

			const windows: RateWindow[] = [];

			const total5h = model.current_interval_total_count;
			if (total5h > 0) {
				const resetAt = new Date(Date.now() + model.remains_time);
				windows.push({
					label: "5h",
					usedPercent: Math.round((toConsumed(total5h, model.current_interval_usage_count) / total5h) * 100),
					resetDescription: formatReset(resetAt),
					resetAt: resetAt.toISOString(),
				});
			}

			const totalWeek = model.current_weekly_total_count ?? 0;
			if (totalWeek > 0 && model.weekly_end_time) {
				const resetAt = new Date(model.weekly_end_time);
				windows.push({
					label: "Week",
					usedPercent: Math.round((toConsumed(totalWeek, model.current_weekly_usage_count ?? 0) / totalWeek) * 100),
					resetDescription: formatReset(resetAt),
					resetAt: resetAt.toISOString(),
				});
			}

			return this.snapshot({ windows });
		} catch {
			clear();
			return this.emptySnapshot(fetchFailed());
		}
	}
}

/**
 * AWS Kiro usage provider
 */

import type { Dependencies, RateWindow, UsageSnapshot } from "../../types.js";
import { BaseProvider } from "../../provider.js";
import { noCli, notLoggedIn, fetchFailed } from "../../errors.js";
import { formatReset, stripAnsi, whichSync } from "../../utils.js";
import { CLI_TIMEOUT_MS } from "../../config.js";

export class KiroProvider extends BaseProvider {
	readonly name = "kiro" as const;
	readonly displayName = "Kiro Plan";

	hasCredentials(deps: Dependencies): boolean {
		return Boolean(whichSync("kiro-cli", deps));
	}

	async fetchUsage(deps: Dependencies): Promise<UsageSnapshot> {
		const kiroBinary = whichSync("kiro-cli", deps);
		if (!kiroBinary) {
			return this.emptySnapshot(noCli("kiro-cli"));
		}

		try {
			// Check if logged in
			try {
				deps.execFileSync(kiroBinary, ["whoami"], {
					encoding: "utf-8",
					timeout: API_TIMEOUT_MS,
					stdio: ["ignore", "pipe", "pipe"],
				});
			} catch {
				return this.emptySnapshot(notLoggedIn());
			}

			// Get usage. kiro-cli writes some usage data to stderr, so capture
			// both streams. We use the shell-free capture path on purpose so it
			// works on Windows too — a `/bin/sh -c "... 2>&1"` redirect would
			// only run on Unix.
			const { stdout, stderr } = deps.execFileSyncWithStderr(
				kiroBinary,
				["chat", "--no-interactive", "/usage"],
				{
					encoding: "utf-8",
					timeout: CLI_TIMEOUT_MS,
					env: { ...deps.env, TERM: "xterm-256color" },
					stdio: ["ignore", "pipe", "pipe"],
				},
			);

			const stripped = stripAnsi(stdout + stderr);
			const windows: RateWindow[] = [];

			// Parse credits percentage from "████...█ X%"
			let creditsPercent = 0;
			const percentMatch = stripped.match(/█+\s*(\d+)%/);
			if (percentMatch) {
				creditsPercent = parseInt(percentMatch[1], 10);
			}

			// Parse credits used/total from "(X.XX of Y covered in plan)"
			const creditsMatch = stripped.match(/\((\d+\.?\d*)\s+of\s+(\d+)\s+covered/);
			if (creditsMatch && !percentMatch) {
				const creditsUsed = parseFloat(creditsMatch[1]);
				const creditsTotal = parseFloat(creditsMatch[2]);
				if (creditsTotal > 0) {
					creditsPercent = (creditsUsed / creditsTotal) * 100;
				}
			}

			// Parse reset date from "resets on 2026-06-01" or "resets on 01/01"
			let resetsAt: Date | undefined;
			const resetMatchISO = stripped.match(/resets on (\d{4})-(\d{2})-(\d{2})/);
			const resetMatchSlash = stripped.match(/resets on (\d{2})\/(\d{2})/);
			if (resetMatchISO) {
				const [, y, m, d] = resetMatchISO;
				resetsAt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
			} else if (resetMatchSlash) {
				const month = parseInt(resetMatchSlash[1], 10);
				const day = parseInt(resetMatchSlash[2], 10);
				const now = new Date();
				const year = now.getFullYear();
				resetsAt = new Date(year, month - 1, day);
				if (resetsAt < now) resetsAt.setFullYear(year + 1);
			}

			windows.push({
				label: "Credits",
				usedPercent: creditsPercent,
				resetDescription: resetsAt ? formatReset(resetsAt) : undefined,
				resetAt: resetsAt?.toISOString(),
			});

			return this.snapshot({ windows });
		} catch {
			return this.emptySnapshot(fetchFailed());
		}
	}

	// Kiro doesn't have a public status page
}

const API_TIMEOUT_MS = 5000;

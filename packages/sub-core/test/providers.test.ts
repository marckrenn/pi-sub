import test from "node:test";
import assert from "node:assert/strict";
import { AnthropicProvider } from "../src/providers/impl/anthropic.js";
import { CopilotProvider } from "../src/providers/impl/copilot.js";
import { GeminiProvider } from "../src/providers/impl/gemini.js";
import { AntigravityProvider } from "../src/providers/impl/antigravity.js";
import { CodexProvider } from "../src/providers/impl/codex.js";
import { KiroProvider } from "../src/providers/impl/kiro.js";
import { ZaiProvider } from "../src/providers/impl/zai.js";
import { MiniMaxProvider } from "../src/providers/impl/minimax.js";
import { createDeps, createJsonResponse, getAuthPath } from "./helpers.js";
import type { UsageSnapshot } from "../src/types.js";

function withAuth(files: Map<string, string>, payload: Record<string, unknown>, home: string): void {
	files.set(getAuthPath(home), JSON.stringify(payload));
}

function assertWindow(usage: UsageSnapshot, label: string): void {
	const found = usage.windows.find((window) => window.label === label);
	assert.ok(found, `Expected window ${label}`);
}

test("anthropic reads token from ANTHROPIC_OAUTH_TOKEN env var", async () => {
	const provider = new AnthropicProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { ANTHROPIC_OAUTH_TOKEN: "env-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({});
		},
		execFileSync: () => "",
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer env-token");
});

test("anthropic env token overrides auth.json", async () => {
	const provider = new AnthropicProvider();
	let authorization: string | undefined;

	const { deps, files } = createDeps({
		env: { ANTHROPIC_OAUTH_TOKEN: "env-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({});
		},
		execFileSync: () => "",
	});
	withAuth(files, { anthropic: { access: "file-token" } }, deps.homedir());

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer env-token");
});

test("anthropic parses windows and extra usage", async () => {
	const provider = new AnthropicProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			five_hour: { utilization: 99, resets_at: new Date(Date.now() + 3600_000).toISOString() },
			seven_day: { utilization: 20, resets_at: new Date(Date.now() + 86400_000).toISOString() },
			extra_usage: { is_enabled: true, used_credits: 1234, monthly_limit: 5000, utilization: 40 },
		}),
		execFileSync: () => "",
	});
	withAuth(files, { anthropic: { access: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "5h");
	assertWindow(usage, "Week");
	const extra = usage.windows.find((window) => window.label.startsWith("Extra"));
	assert.ok(extra?.label.includes("Extra [active]"));
	assert.equal(usage.extraUsageEnabled, true);
});

test("copilot reads token from GITHUB_TOKEN env var", async () => {
	const provider = new CopilotProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { GITHUB_TOKEN: "gh-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({});
		},
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "token gh-token");
});

test("gemini reads token from GOOGLE_GEMINI_CLI_OAUTH_TOKEN env var", async () => {
	const provider = new GeminiProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { GOOGLE_GEMINI_CLI_OAUTH_TOKEN: "g-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({ buckets: [] });
		},
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer g-token");
});

test("antigravity reads token from GOOGLE_ANTIGRAVITY_OAUTH_TOKEN env var", async () => {
	const provider = new AntigravityProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { GOOGLE_ANTIGRAVITY_OAUTH_TOKEN: "ag-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({ models: {} });
		},
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer ag-token");
});

test("codex reads token from OPENAI_CODEX_OAUTH_TOKEN env var", async () => {
	const provider = new CodexProvider();
	let authorization: string | undefined;
	let accountIdHeader: string | undefined;

	const { deps } = createDeps({
		env: { OPENAI_CODEX_OAUTH_TOKEN: "c-token", OPENAI_CODEX_ACCOUNT_ID: "acct_123" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			accountIdHeader = (init as any)?.headers?.["ChatGPT-Account-Id"];
			return createJsonResponse({
				rate_limit: {
					primary_window: { reset_at: Math.floor(Date.now() / 1000) + 3600, limit_window_seconds: 10800, used_percent: 12 },
					secondary_window: { reset_at: Math.floor(Date.now() / 1000) + 86400, limit_window_seconds: 86400, used_percent: 34 },
				},
			});
		},
	});

	const usage = await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer c-token");
	assert.equal(accountIdHeader, "acct_123");
	assertWindow(usage, "3h");
	assertWindow(usage, "Day");
});

test("zai reads token from ZAI_API_KEY env var", async () => {
	const provider = new ZaiProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { ZAI_API_KEY: "z-token" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse({ success: true, code: 200, data: { limits: [] } });
		},
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer z-token");
});

test("copilot handles missing quota snapshots", async () => {
	const provider = new CopilotProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({}),
	});
	withAuth(files, { "github-copilot": { refresh: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.windows.length, 0);
});

test("copilot parses quotas and requests", async () => {
	const provider = new CopilotProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			quota_reset_date_utc: "2026-01-01T00:00:00Z",
			quota_snapshots: {
				premium_interactions: {
					percent_remaining: 70,
					remaining: 10,
					entitlement: 50,
				},
			},
		}),
	});
	withAuth(files, { "github-copilot": { refresh: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "Month");
	assert.equal(usage.windows[0]?.usedPercent, 30);
	assert.equal(usage.requestsRemaining, 10);
	assert.equal(usage.requestsEntitlement, 50);
});

test("copilot reports http errors", async () => {
	const provider = new CopilotProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({}, { ok: false, status: 500 }),
	});
	withAuth(files, { "github-copilot": { refresh: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.error?.code, "HTTP_ERROR");
});

test("gemini handles empty buckets", async () => {
	const provider = new GeminiProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({ buckets: [] }),
	});
	withAuth(files, { "google-gemini-cli": { access: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.windows.length, 0);
});

test("gemini aggregates pro and flash quotas", async () => {
	const provider = new GeminiProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			buckets: [
				{ modelId: "Gemini Pro", remainingFraction: 0.2 },
				{ modelId: "Gemini Flash", remainingFraction: 0.6 },
			],
		}),
	});
	withAuth(files, { "google-gemini-cli": { access: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "Pro");
	assertWindow(usage, "Flash");
});

test("antigravity falls back to unknown model labels", async () => {
	const provider = new AntigravityProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			models: {
				"1": { displayName: "Unknown A", quotaInfo: { remainingFraction: 0.8 } },
				"2": { displayName: "Unknown B", quotaInfo: { remainingFraction: 0.7 } },
			},
		}),
	});
	withAuth(files, { "google-antigravity": { access: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.ok(usage.windows.some((window) => window.label === "Unknown A"));
	assert.ok(usage.windows.some((window) => window.label === "Unknown B"));
});

test("codex formats primary and secondary windows", async () => {
	const provider = new CodexProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			rate_limit: {
				primary_window: {
					reset_at: Math.floor(Date.now() / 1000) + 3600,
					limit_window_seconds: 18000,
					used_percent: 12,
				},
				secondary_window: {
					reset_at: Math.floor(Date.now() / 1000) + 86400,
					limit_window_seconds: 86400,
					used_percent: 30,
				},
			},
		}),
	});
	withAuth(files, { "openai-codex": { access: "token", accountId: "acct" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "5h");
	assertWindow(usage, "Day");
});

test("codex includes additional rate limits for model-specific usage", async () => {
	const provider = new CodexProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({
			rate_limit: {
				primary_window: {
					reset_at: Math.floor(Date.now() / 1000) + 3600,
					limit_window_seconds: 3600,
					used_percent: 12,
				},
			},
			additional_rate_limits: [
				{
					limit_name: "GPT-5.3-Codex-Spark",
					rate_limit: {
						primary_window: {
							reset_at: Math.floor(Date.now() / 1000) + 1800,
							limit_window_seconds: 18000,
							used_percent: 1,
						},
						secondary_window: {
							reset_at: Math.floor(Date.now() / 1000) + 1800 + 604_800,
							limit_window_seconds: 604_800,
							used_percent: 2,
						},
					},
				},
			],
		}),
	});
	withAuth(files, { "openai-codex": { access: "token", accountId: "acct" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "1h");
	assertWindow(usage, "GPT-5.3-Codex-Spark 5h");
	assertWindow(usage, "GPT-5.3-Codex-Spark Week");
});

test("kiro parses percentage and reset date", async () => {
	const provider = new KiroProvider();
	const output = "██████ 12%\nresets on 01/01";
	const { deps } = createDeps({
		execFileSync: (file: string, args: string[]) => {
			if (file === "which" && args[0] === "kiro-cli") return "/usr/local/bin/kiro-cli";
			if (file === "/usr/local/bin/kiro-cli" && args[0] === "whoami") return "user";
			if (file === "/usr/local/bin/kiro-cli" && args[0] === "chat") return output;
			throw new Error(`Unexpected command ${file} ${args.join(" ")}`);
		},
	});

	const usage = await provider.fetchUsage(deps);
	assertWindow(usage, "Credits");
	assert.equal(usage.windows[0]?.usedPercent, 12);
	assert.ok(usage.windows[0]?.resetAt);
});

test("kiro parses credits when percent is missing", async () => {
	const provider = new KiroProvider();
	const output = "(1.5 of 10 covered in plan) resets on 12/31";
	const { deps } = createDeps({
		execFileSync: (file: string, args: string[]) => {
			if (file === "which" && args[0] === "kiro-cli") return "/usr/local/bin/kiro-cli";
			if (file === "/usr/local/bin/kiro-cli" && args[0] === "whoami") return "user";
			if (file === "/usr/local/bin/kiro-cli" && args[0] === "chat") return output;
			throw new Error(`Unexpected command ${file} ${args.join(" ")}`);
		},
	});

	const usage = await provider.fetchUsage(deps);
	assert.equal(Math.round(usage.windows[0]?.usedPercent ?? 0), 15);
});

test("zai reports api errors and parses limits", async () => {
	const provider = new ZaiProvider();
	const home = "/home/test";
	const authPath = getAuthPath(home);

	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({ success: false, code: 500, msg: "Bad" }),
		homedir: home,
	});
	files.set(authPath, JSON.stringify({ "z-ai": { access: "token" } }));
	const errorUsage = await provider.fetchUsage(deps);
	assert.equal(errorUsage.error?.code, "API_ERROR");

	const { deps: okDeps, files: okFiles } = createDeps({
		fetch: async () => createJsonResponse({
			success: true,
			code: 200,
			data: {
				limits: [
					{ type: "TOKENS_LIMIT", percentage: 12, nextResetTime: "2026-01-01T00:00:00Z" },
					{ type: "TIME_LIMIT", percentage: 34, nextResetTime: "2026-02-01T00:00:00Z" },
				],
			},
		}),
		homedir: home,
	});
	okFiles.set(authPath, JSON.stringify({ "zai": { access: "token" } }));

	const usage = await provider.fetchUsage(okDeps);
	assertWindow(usage, "Tokens");
	assertWindow(usage, "Monthly");
});

// MiniMax tests

const MINIMAX_RESPONSE = {
	model_remains: [
		{
			model_name: "MiniMax-M*",
			current_interval_total_count: 4500,
			current_interval_usage_count: 4195, // remaining, not consumed
			remains_time: 7_200_000,            // 2 hours in ms
			current_weekly_total_count: 45_000,
			current_weekly_usage_count: 41_898, // remaining, not consumed
			weekly_end_time: Date.now() + 6 * 24 * 60 * 60 * 1000,
		},
	],
};

test("minimax reads key from MINIMAX_API_KEY env var", async () => {
	const provider = new MiniMaxProvider();
	let authorization: string | undefined;

	const { deps } = createDeps({
		env: { MINIMAX_API_KEY: "env-key" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse(MINIMAX_RESPONSE);
		},
	});

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer env-key");
});

test("minimax reads key from auth.json", async () => {
	const provider = new MiniMaxProvider();
	let authorization: string | undefined;

	const { deps, files } = createDeps({
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse(MINIMAX_RESPONSE);
		},
	});
	withAuth(files, { minimax: { key: "file-key" } }, deps.homedir());

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer file-key");
});

test("minimax env key overrides auth.json", async () => {
	const provider = new MiniMaxProvider();
	let authorization: string | undefined;

	const { deps, files } = createDeps({
		env: { MINIMAX_API_KEY: "env-key" },
		fetch: async (_url, init) => {
			authorization = (init as any)?.headers?.Authorization;
			return createJsonResponse(MINIMAX_RESPONSE);
		},
	});
	withAuth(files, { minimax: { key: "file-key" } }, deps.homedir());

	await provider.fetchUsage(deps);
	assert.equal(authorization, "Bearer env-key");
});

test("minimax returns no-credentials when key is absent", async () => {
	const provider = new MiniMaxProvider();
	const { deps } = createDeps({ fetch: async () => createJsonResponse({}) });
	assert.equal(provider.hasCredentials(deps), false);

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.windows.length, 0);
	assert.equal(usage.error?.code, "NO_CREDENTIALS");
});

test("minimax parses 5h and Week windows correctly", async () => {
	const provider = new MiniMaxProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse(MINIMAX_RESPONSE),
	});
	withAuth(files, { minimax: { key: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);

	assertWindow(usage, "5h");
	assertWindow(usage, "Week");

	const fiveHr = usage.windows.find((w) => w.label === "5h")!;
	// usedPercent = round((4500 - 4195) / 4500 * 100) = round(6.78) = 7
	assert.equal(fiveHr.usedPercent, 7);
	assert.ok(fiveHr.resetDescription, "5h window should have a reset description");
	assert.ok(fiveHr.resetAt, "5h window should have a resetAt timestamp");

	const week = usage.windows.find((w) => w.label === "Week")!;
	// usedPercent = round((45000 - 41898) / 45000 * 100) = round(6.89) = 7
	assert.equal(week.usedPercent, 7);
	assert.ok(week.resetDescription, "Week window should have a reset description");
});

test("minimax returns fetch-failed on HTTP error", async () => {
	const provider = new MiniMaxProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({}, { ok: false, status: 429 }),
	});
	withAuth(files, { minimax: { key: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.windows.length, 0);
	assert.equal(usage.error?.code, "HTTP_ERROR");
});

test("minimax returns empty windows when response has no text model entry", async () => {
	const provider = new MiniMaxProvider();
	const { deps, files } = createDeps({
		fetch: async () => createJsonResponse({ model_remains: [] }),
	});
	withAuth(files, { minimax: { key: "token" } }, deps.homedir());

	const usage = await provider.fetchUsage(deps);
	assert.equal(usage.windows.length, 0);
	assert.equal(usage.error, undefined); // credentials were fine, model just not in plan
});

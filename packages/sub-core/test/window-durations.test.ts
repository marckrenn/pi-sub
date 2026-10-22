import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicProvider } from '../src/providers/impl/anthropic.js';
import { CodexProvider } from '../src/providers/impl/codex.js';
import { createDeps } from './helpers.js';

test('codex exposes reported durations for general and model-specific windows', async () => {
	const { deps } = createDeps({
		env: { OPENAI_CODEX_OAUTH_TOKEN: 'fixture-token' },
		fetch: async () =>
			Response.json({
				rate_limit: {
					primary_window: { used_percent: 15, limit_window_seconds: 18_000 },
					secondary_window: { used_percent: 18, limit_window_seconds: 604_800 },
				},
				additional_rate_limits: [
					{
						limit_name: 'Spark',
						rate_limit: {
							primary_window: { used_percent: 30, limit_window_seconds: 10_800 },
							secondary_window: { used_percent: 45, limit_window_seconds: 86_400 },
						},
					},
				],
			}),
	});

	const usage = await new CodexProvider().fetchUsage(deps);

	assert.deepEqual(usage, {
		provider: 'codex',
		displayName: 'Codex Plan',
		windows: [
			{
				label: '5h',
				usedPercent: 15,
				windowSeconds: 18_000,
				resetDescription: undefined,
				resetAt: undefined,
			},
			{
				label: 'Week',
				usedPercent: 18,
				windowSeconds: 604_800,
				resetDescription: undefined,
				resetAt: undefined,
			},
			{
				label: 'Spark 3h',
				usedPercent: 30,
				windowSeconds: 10_800,
				resetDescription: undefined,
				resetAt: undefined,
			},
			{
				label: 'Spark Day',
				usedPercent: 45,
				windowSeconds: 86_400,
				resetDescription: undefined,
				resetAt: undefined,
			},
		],
	});
});

for (const seconds of [undefined, null, 0, -1, '18000']) {
	test(`codex leaves duration unknown for ${String(seconds)} instead of using its label fallback`, async () => {
		const { deps } = createDeps({
			env: { OPENAI_CODEX_OAUTH_TOKEN: 'fixture-token' },
			fetch: async () =>
				Response.json({
					rate_limit: { primary_window: { used_percent: 15, limit_window_seconds: seconds } },
				}),
		});

		const usage = await new CodexProvider().fetchUsage(deps);

		assert.deepEqual(usage, {
			provider: 'codex',
			displayName: 'Codex Plan',
			windows: [
				{
					label: '3h',
					usedPercent: 15,
					resetDescription: undefined,
					resetAt: undefined,
				},
			],
		});
	});
}

test('anthropic exposes the defined five-hour and seven-day durations', async () => {
	const { deps } = createDeps({
		env: { ANTHROPIC_OAUTH_TOKEN: 'fixture-token' },
		fetch: async () =>
			Response.json({
				five_hour: { utilization: 15 },
				seven_day: { utilization: 18 },
			}),
	});

	const usage = await new AnthropicProvider().fetchUsage(deps);

	assert.deepEqual(usage, {
		provider: 'anthropic',
		displayName: 'Claude Plan',
		windows: [
			{
				label: '5h',
				usedPercent: 15,
				windowSeconds: 18_000,
				resetDescription: undefined,
				resetAt: undefined,
			},
			{
				label: 'Week',
				usedPercent: 18,
				windowSeconds: 604_800,
				resetDescription: undefined,
				resetAt: undefined,
			},
		],
		extraUsageEnabled: false,
		fiveHourUsage: 15,
	});
});

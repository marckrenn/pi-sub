import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { AnthropicProvider } from '../src/providers/impl/anthropic.js';
import { CodexProvider } from '../src/providers/impl/codex.js';
import { httpError, noCredentials } from '../src/errors.js';
import type { CredentialSource } from '../src/types.js';
import { createDeps, getAuthPath } from './helpers.js';

const home = '/home/test';
const piPath = getAuthPath(home);
const codexPath = path.join(home, '.codex', 'auth.json');
const customHome = path.join(home, 'custom-codex');
const piAuth = JSON.stringify({
	'openai-codex': { access: 'fixture-pi-token', accountId: 'pi-account' },
	anthropic: { access: 'fixture-pi-anthropic-token' },
});
const codexAuth = JSON.stringify({
	tokens: { access_token: 'fixture-codex-token', account_id: 'codex-account' },
});

interface CodexCase {
	label: string;
	env?: NodeJS.ProcessEnv;
	files?: Record<string, string>;
	token: string;
	accountId?: string;
	source: CredentialSource;
}

const codexCases: CodexCase[] = [
	{
		label: 'environment before credential files',
		env: {
			OPENAI_CODEX_OAUTH_TOKEN: ' fixture-env-token ',
			OPENAI_CODEX_ACCOUNT_ID: ' env-account ',
		},
		files: { [piPath]: piAuth, [codexPath]: codexAuth },
		token: 'fixture-env-token',
		accountId: 'env-account',
		source: 'environment',
	},
	{
		label: 'pi before legacy Codex credentials',
		files: { [piPath]: piAuth, [codexPath]: codexAuth },
		token: 'fixture-pi-token',
		accountId: 'pi-account',
		source: 'pi',
	},
	{
		label: 'legacy Codex OAuth credentials',
		files: { [codexPath]: codexAuth },
		token: 'fixture-codex-token',
		accountId: 'codex-account',
		source: 'codex',
	},
	{
		label: 'legacy API key before its OAuth credentials',
		files: {
			[codexPath]: JSON.stringify({
				OPENAI_API_KEY: 'fixture-api-key',
				tokens: { access_token: 'fixture-unused-token', account_id: 'unused-account' },
			}),
		},
		token: 'fixture-api-key',
		source: 'codex',
	},
	{
		label: 'environment credentials without an account identifier',
		env: { OPENAI_CODEX_ACCESS_TOKEN: 'fixture-env-token' },
		token: 'fixture-env-token',
		source: 'environment',
	},
	{
		label: 'custom CODEX_HOME',
		env: { CODEX_HOME: customHome },
		files: { [path.join(customHome, 'auth.json')]: codexAuth },
		token: 'fixture-codex-token',
		accountId: 'codex-account',
		source: 'codex',
	},
];

for (const fixture of codexCases) {
	test(`codex reports provenance for ${fixture.label}`, async () => {
		const requests: { url: string; headers: Record<string, string> }[] = [];
		const { deps } = createDeps({
			homedir: home,
			env: fixture.env,
			files: fixture.files,
			fetch: async (input, init) => {
				requests.push({
					url: String(input),
					headers: Object.fromEntries(new Headers(init?.headers).entries()),
				});
				return Response.json({ rate_limit: { primary_window: { used_percent: 25 } } });
			},
		});

		const usage = await new CodexProvider().fetchUsage(deps);

		assert.deepEqual(
			{ usage, requests },
			{
				usage: {
					provider: 'codex',
					displayName: 'Codex Plan',
					windows: [
						{ label: '3h', usedPercent: 25, resetDescription: undefined, resetAt: undefined },
					],
					credentialSource: fixture.source,
					...(fixture.accountId ? { accountId: fixture.accountId } : {}),
				},
				requests: [
					{
						url: 'https://chatgpt.com/backend-api/wham/usage',
						headers: {
							accept: 'application/json',
							authorization: `Bearer ${fixture.token}`,
							...(fixture.accountId ? { 'chatgpt-account-id': fixture.accountId } : {}),
						},
					},
				],
			},
		);
	});
}

for (const [label, accountId] of [
	['non-string', { accessToken: 'must-not-publish' }],
	['blank', '   '],
] as const) {
	test(`codex omits a ${label} account identifier from public metadata`, async () => {
		const { deps } = createDeps({
			files: {
				[piPath]: JSON.stringify({ 'openai-codex': { access: 'fixture-token', accountId } }),
			},
			fetch: async () => Response.json({}),
		});

		const usage = await new CodexProvider().fetchUsage(deps);

		assert.deepEqual(usage, {
			provider: 'codex',
			displayName: 'Codex Plan',
			windows: [],
			credentialSource: 'pi',
		});
	});
}

const keychain = JSON.stringify({
	claudeAiOauth: { accessToken: 'fixture-keychain-token', scopes: ['user:profile'] },
});
const anthropicCases: {
	label: string;
	env?: NodeJS.ProcessEnv;
	files?: Record<string, string>;
	token: string;
	source: CredentialSource;
}[] = [
	{
		label: 'environment before credential files',
		env: { ANTHROPIC_OAUTH_TOKEN: ' fixture-env-token ' },
		files: { [piPath]: piAuth },
		token: 'fixture-env-token',
		source: 'environment',
	},
	{
		label: 'pi before the Claude Code keychain',
		files: { [piPath]: piAuth },
		token: 'fixture-pi-anthropic-token',
		source: 'pi',
	},
	{
		label: 'the Claude Code keychain',
		token: 'fixture-keychain-token',
		source: 'claude-code-keychain',
	},
];

for (const fixture of anthropicCases) {
	test(`anthropic reports provenance for ${fixture.label}`, async () => {
		const requests: { url: string; headers: Record<string, string> }[] = [];
		const commands: { file: string; args: string[] }[] = [];
		const { deps } = createDeps({
			env: fixture.env,
			files: fixture.files,
			execFileSync: (file, args) => {
				commands.push({ file, args });
				return keychain;
			},
			fetch: async (input, init) => {
				requests.push({
					url: String(input),
					headers: Object.fromEntries(new Headers(init?.headers).entries()),
				});
				return Response.json({ five_hour: { utilization: 25 } });
			},
		});

		const usage = await new AnthropicProvider().fetchUsage(deps);

		assert.deepEqual(
			{ usage, requests, commands },
			{
				usage: {
					provider: 'anthropic',
					displayName: 'Claude Plan',
					windows: [
						{ label: '5h', usedPercent: 25, resetDescription: undefined, resetAt: undefined },
					],
					extraUsageEnabled: false,
					fiveHourUsage: 25,
					credentialSource: fixture.source,
				},
				requests: [
					{
						url: 'https://api.anthropic.com/api/oauth/usage',
						headers: {
							authorization: `Bearer ${fixture.token}`,
							'anthropic-beta': 'oauth-2025-04-20',
						},
					},
				],
				commands:
					fixture.source === 'claude-code-keychain'
						? [
								{
									file: 'security',
									args: ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
								},
							]
						: [],
			},
		);
	});
}

for (const Provider of [CodexProvider, AnthropicProvider]) {
	test(`${Provider.name} omits provenance when credentials are unavailable`, async () => {
		const provider = new Provider();
		const { deps } = createDeps();

		const usage = await provider.fetchUsage(deps);

		assert.deepEqual(usage, {
			provider: provider.name,
			displayName: provider.displayName,
			windows: [],
			error: noCredentials(),
		});
	});

	test(`${Provider.name} does not attach new provenance to an HTTP error`, async () => {
		const provider = new Provider();
		const { deps } = createDeps({
			env: { OPENAI_CODEX_OAUTH_TOKEN: 'fixture-token', ANTHROPIC_OAUTH_TOKEN: 'fixture-token' },
			fetch: async () => Response.json({}, { status: 401 }),
		});

		const usage = await provider.fetchUsage(deps);

		assert.deepEqual(usage, {
			provider: provider.name,
			displayName: provider.displayName,
			windows: [],
			error: httpError(401),
		});
	});
}

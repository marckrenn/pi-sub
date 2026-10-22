import fs from 'node:fs';
import path from 'node:path';
import {
	createEventBus,
	type ExtensionAPI,
	type ExtensionContext,
} from '@mariozechner/pi-coding-agent';
import createExtension from '../../index.js';
import { CACHE_PATH, updateCacheStatus } from '../../src/cache.js';
import { SETTINGS_PATH } from '../../src/settings.js';
import { getDefaultSettings } from '../../src/settings-types.js';
import type { ProviderStatus, SubCoreState, UsageSnapshot } from '../../src/types.js';
import { createDeps } from '../helpers.js';

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

const settings = getDefaultSettings();

settings.behavior.refreshInterval = 0;
settings.statusRefresh.refreshInterval = 0;

const usage: UsageSnapshot = {
	provider: 'codex',
	displayName: 'Codex Plan',
	windows: [{ label: 'Week', usedPercent: 42 }],
};
const statuses: ProviderStatus[] = [
	{ indicator: 'none', description: 'Operational' },
	{ indicator: 'minor', description: 'Degraded' },
	{ indicator: 'maintenance', description: 'Scheduled maintenance' },
];

fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings));
fs.writeFileSync(
	CACHE_PATH,
	JSON.stringify({
		codex: { fetchedAt: 1_700_000_000_000, usage, status: statuses[0] },
	}),
);

const handlers = new Map<string, Handler>();
const updates: SubCoreState[] = [];
const pi = {
	events: createEventBus(),
	on(event: string, handler: Handler) {
		handlers.set(event, handler);
	},
	registerCommand: () => {},
	registerTool: () => {},
} as unknown as ExtensionAPI;
const ctx = { model: { provider: 'openai-codex', id: 'gpt-5-codex' } } as ExtensionContext;
const unsubscribe = pi.events.on('sub-core:update-current', (payload) => {
	updates.push((payload as { state: SubCoreState }).state);
});
const { deps } = createDeps();

try {
	createExtension(pi, deps);

	await handlers.get('session_start')?.({ type: 'session_start' }, ctx);
	await new Promise((resolve) => setTimeout(resolve, 0));

	for (const status of statuses.slice(1)) {
		await updateCacheStatus('codex', status);
	}

	const stored = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));

	console.log(JSON.stringify({ updates, storedStatus: stored.codex.status }));
} finally {
	await handlers.get('session_shutdown')?.({ type: 'session_shutdown' }, ctx);
	unsubscribe();
}

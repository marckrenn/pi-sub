import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import createExtension from '../index.js';
import { CACHE_PATH, clearCache } from '../src/cache.js';
import { SETTINGS_PATH } from '../src/settings.js';
import { getStorage, setStorage, type StorageAdapter } from '../src/storage.js';
import { createDeps, getAuthPath } from './helpers.js';

interface PiHarness {
	pi: ExtensionAPI;
	emitLifecycle: (event: string, ctx: ExtensionContext) => Promise<void>;
}

/**
 * Build a minimal ExtensionAPI mock that captures lifecycle handlers
 * (`pi.on(event, handler)`) and exposes them via `emitLifecycle` for
 * deterministic invocation in tests.
 */
function createPiHarness(): PiHarness {
	const lifecycle = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
	const eventListeners = new Map<string, Array<(payload: unknown) => unknown>>();

	const events = {
		on(event: string, handler: (payload: unknown) => unknown) {
			const list = eventListeners.get(event) ?? [];
			list.push(handler);
			eventListeners.set(event, list);
		},
		emit(event: string, payload?: unknown) {
			for (const handler of eventListeners.get(event) ?? []) {
				handler(payload);
			}
		},
	};

	const pi = {
		events,
		on(event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) {
			const list = lifecycle.get(event) ?? [];
			list.push(handler);
			lifecycle.set(event, list);
		},
		registerCommand: () => {},
		registerTool: () => {},
		registerShortcut: () => {},
		registerFlag: () => {},
		getFlag: () => undefined,
		registerMessageRenderer: () => {},
		sendMessage: () => {},
		sendUserMessage: () => {},
		appendEntry: () => {},
		setSessionName: () => {},
		getSessionName: () => undefined,
		setLabel: () => {},
		exec: async () => ({ code: 0, stdout: '', stderr: '' }),
		getActiveTools: () => [],
		getAllTools: () => [],
		setActiveTools: () => {},
		setModel: async () => true,
		getThinkingLevel: () => 'high',
		setThinkingLevel: () => {},
		registerProvider: () => {},
	} as unknown as ExtensionAPI;

	return {
		pi,
		async emitLifecycle(event, ctx) {
			for (const handler of lifecycle.get(event) ?? []) {
				await handler({ type: event }, ctx);
			}
		},
	};
}

function createMemoryStorage(): { storage: StorageAdapter; files: Map<string, string> } {
	const files = new Map<string, string>();
	const storage: StorageAdapter = {
		readFile: (filePath) => files.get(filePath),
		writeFile: (filePath, contents) => {
			files.set(filePath, contents);
		},
		writeFileExclusive: (filePath, contents) => {
			if (files.has(filePath)) return false;
			files.set(filePath, contents);
			return true;
		},
		exists: (filePath) => files.has(filePath),
		removeFile: (filePath) => {
			files.delete(filePath);
		},
		ensureDir: () => {},
	};
	return { storage, files };
}

function createCtx(): ExtensionContext {
	return {
		ui: {
			select: async () => undefined,
			confirm: async () => false,
			input: async () => undefined,
			notify: () => {},
			setStatus: () => {},
			setWorkingMessage: () => {},
			setWidget: () => {},
			setFooter: () => {},
			setHeader: () => {},
			setTitle: () => {},
			custom: async () => undefined,
			setEditorText: () => {},
		},
		hasUI: false,
		cwd: '/tmp/project',
		sessionManager: {} as ExtensionContext['sessionManager'],
		modelRegistry: {} as ExtensionContext['modelRegistry'],
		model: { provider: 'anthropic', id: 'claude-opus-4-7' } as ExtensionContext['model'],
		isIdle: () => true,
		abort: () => {},
		hasPendingMessages: () => false,
		shutdown: () => {},
		getContextUsage: () => undefined,
		compact: () => {},
		getSystemPrompt: () => '',
	} as ExtensionContext;
}

function resetGlobal(): void {
	const g = globalThis as typeof globalThis & { __piSubCore?: { active: boolean } };
	g.__piSubCore = undefined;
}

/**
 * Regression for marckrenn/pi-sub#58.
 *
 * Before the fix, `turn_end` and `tool_result` (with `refreshOnToolResult` enabled)
 * called `refresh(ctx, { force: true })`. That bypassed the cache TTL and triggered
 * an upstream fetch on every turn, hammering rate-limited endpoints (e.g. anthropic
 * OAuth `/usage`) and, when the endpoint started returning 429, leaving the cache
 * stuck because `fetchWithCache` refuses to write entries with errors.
 *
 * With the fix, both handlers call `refresh(ctx)` without `force`, so the existing
 * `behavior.refreshInterval` (60s) and `behavior.minRefreshInterval` (10s) gates
 * correctly suppress redundant network calls when the cache is fresh.
 */
test('turn_end and tool_result do not bypass the cache TTL when the entry is fresh', async () => {
	const originalStorage = getStorage();
	const { storage, files } = createMemoryStorage();
	setStorage(storage);
	clearCache();
	resetGlobal();

	try {
		const home = '/home/test';
		let fetchCount = 0;
		const { deps, files: depFiles } = createDeps({
			fetch: async () => {
				fetchCount += 1;
				return {
					ok: true,
					status: 200,
					json: async () => ({}),
				} as Response;
			},
			homedir: home,
		});
		// anthropic provider reads ~/.pi/agent/auth.json under `anthropic.access`.
		depFiles.set(getAuthPath(home), JSON.stringify({ anthropic: { access: 'token' } }));

		// Pre-populate the cache: 30s old. That's past the 10s minRefreshInterval but
		// well within the 60s ttl. Without `force`, fetchUsageForProvider must return
		// the cached value; with `force: true` (the bug) it bypasses the ttl and fetches.
		const fetchedAt = Date.now() - 30_000;
		files.set(
			CACHE_PATH,
			JSON.stringify({
				anthropic: {
					fetchedAt,
					statusFetchedAt: fetchedAt,
					usage: {
						provider: 'anthropic',
						displayName: 'Anthropic (Claude)',
						windows: [
							{ label: '5h', usedPercent: 12, resetDescription: '4h' },
							{ label: 'Week', usedPercent: 25, resetDescription: '3d' },
						],
					},
					status: { indicator: 'none' },
				},
			}),
		);

		// Enable refresh on tool result so the tool_result handler actually calls refresh.
		files.set(
			SETTINGS_PATH,
			JSON.stringify({
				version: 3,
				behavior: { refreshOnToolResult: true, refreshInterval: 60, minRefreshInterval: 10 },
				statusRefresh: { refreshOnToolResult: true, refreshInterval: 60, minRefreshInterval: 10 },
				providers: { anthropic: { enabled: 'on', fetchStatus: false } },
			}),
		);

		const harness = createPiHarness();
		createExtension(harness.pi, deps);

		const ctx = createCtx();
		await harness.emitLifecycle('session_start', ctx);
		// session_start emits with skipFetch:true, so it should not hit the network.
		assert.equal(fetchCount, 0, 'session_start should never fetch');

		await harness.emitLifecycle('turn_end', ctx);
		assert.equal(
			fetchCount,
			0,
			'turn_end must respect cache TTL and not refetch when the entry is fresh',
		);

		await harness.emitLifecycle('tool_result', ctx);
		assert.equal(
			fetchCount,
			0,
			'tool_result must respect cache TTL and not refetch when the entry is fresh',
		);

		// Cleanup so the global guard, intervals and watchers do not leak across tests.
		await harness.emitLifecycle('session_shutdown', ctx);
	} finally {
		resetGlobal();
		setStorage(originalStorage);
		clearCache();
	}
});

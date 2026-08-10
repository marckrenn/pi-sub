import test from "node:test";
import assert from "node:assert/strict";
import { createEventBus, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubCoreState, UsageSnapshot } from "@eiei114/pi-sub-shared";
import { createStatusRuntime } from "../src/runtime.js";

type StatusCall = {
	key: string;
	text: string | undefined;
};

type WarningCall = {
	message: string;
	error: unknown;
};

type CallLog<T> = {
	calls: T[];
	push: (value: T) => void;
	waitForCount: (count: number, timeoutMs?: number) => Promise<void>;
};

type FakePi = ExtensionAPI & {
	commands: string[];
	emitEvent: (event: string, ctx: ExtensionContext) => Promise<void>;
};

function buildUsage(overrides?: Partial<UsageSnapshot>): UsageSnapshot {
	return {
		provider: "anthropic",
		displayName: "Anthropic (Claude)",
		windows: [
			{ label: "5h", usedPercent: 3, resetDescription: "3h4m" },
			{ label: "Week", usedPercent: 7, resetDescription: "6d11h" },
		],
		...overrides,
	};
}

function createCallLog<T>(): CallLog<T> {
	const calls: T[] = [];
	const waiters = new Set<() => void>();

	return {
		calls,
		push(value) {
			calls.push(value);
			for (const resolve of waiters) {
				resolve();
			}
		},
		async waitForCount(count: number, timeoutMs = 200) {
			if (calls.length >= count) {
				return;
			}

			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => {
					waiters.delete(checkCount);
					reject(new Error(`condition not met within ${timeoutMs}ms`));
				}, timeoutMs);

				const checkCount = () => {
					if (calls.length < count) {
						return;
					}
					clearTimeout(timer);
					waiters.delete(checkCount);
					resolve();
				};

				waiters.add(checkCount);
			});
		},
	};
}

function createContext(options?: { hasUI?: boolean }): { ctx: ExtensionContext; statusCalls: StatusCall[]; waitForStatusCalls: (count: number, timeoutMs?: number) => Promise<void> } {
	const statusLog = createCallLog<StatusCall>();
	const ctx = {
		ui: {
			select: async () => undefined,
			confirm: async () => false,
			input: async () => undefined,
			notify: () => {},
			setStatus: (key: string, text: string | undefined) => {
				statusLog.push({ key, text });
			},
			setWorkingMessage: () => {},
			setWidget: () => {},
			setFooter: () => {},
			setHeader: () => {},
			setTitle: () => {},
			custom: async () => undefined,
			setEditorText: () => {},
		},
		hasUI: options?.hasUI ?? false,
		cwd: "/tmp/project",
		sessionManager: {} as ExtensionContext["sessionManager"],
		modelRegistry: {} as ExtensionContext["modelRegistry"],
		model: undefined,
		isIdle: () => true,
		abort: () => {},
		hasPendingMessages: () => false,
		shutdown: () => {},
		getContextUsage: () => undefined,
		compact: () => {},
		getSystemPrompt: () => "",
	} as ExtensionContext;

	return { ctx, statusCalls: statusLog.calls, waitForStatusCalls: statusLog.waitForCount };
}

function createFakePi(): FakePi {
	const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
	const commands: string[] = [];

	const pi = {
		events: createEventBus(),
		commands,
		on(event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) {
			const current = handlers.get(event) ?? [];
			current.push(handler);
			handlers.set(event, current);
		},
		async emitEvent(event: string, ctx: ExtensionContext) {
			for (const handler of handlers.get(event) ?? []) {
				await handler({ type: event }, ctx);
			}
		},
		registerCommand(name: string) {
			commands.push(name);
		},
		registerTool: () => {
			throw new Error("registerTool should not be called by sub-status");
		},
		registerShortcut: () => {
			throw new Error("registerShortcut should not be called by sub-status");
		},
		registerFlag: () => {},
		getFlag: () => undefined,
		registerMessageRenderer: () => {},
		sendMessage: () => {},
		sendUserMessage: () => {},
		appendEntry: () => {},
		setSessionName: () => {},
		getSessionName: () => undefined,
		setLabel: () => {},
		exec: async () => ({ code: 0, stdout: "", stderr: "" }),
		getActiveTools: () => [],
		getAllTools: () => [],
		setActiveTools: () => {},
		setModel: async () => true,
		getThinkingLevel: () => "high",
		setThinkingLevel: () => {},
		registerProvider: () => {},
	} as unknown as FakePi;

	return pi;
}

function registerCurrentStateReply(pi: FakePi, state: SubCoreState): void {
	pi.events.on("sub-core:request", (payload) => {
		const request = payload as { reply: (payload: { state: SubCoreState }) => void };
		request.reply({ state });
	});
}

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

test("requests current state on startup and renders compact status without UI gating", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls, waitForStatusCalls } = createContext({ hasUI: false });
	registerCurrentStateReply(pi, { usage: buildUsage() });

	createStatusRuntime(pi);
	await pi.emitEvent("session_start", ctx);
	await waitForStatusCalls(1);

	assert.deepEqual(statusCalls, [{ key: "sub-status:usage", text: "3h4m 3% · 6d11h 7%" }]);
	assert.deepEqual(pi.commands, []);
});

test("updates the status on sub-core:update-current and suppresses duplicate writes", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls, waitForStatusCalls } = createContext();
	registerCurrentStateReply(pi, { usage: buildUsage() });

	createStatusRuntime(pi);
	await pi.emitEvent("session_start", ctx);
	await waitForStatusCalls(1);

	pi.events.emit("sub-core:update-current", { state: { usage: buildUsage({ windows: [{ label: "Month", usedPercent: 42 }] }) } });
	await waitForStatusCalls(2);
	pi.events.emit("sub-core:update-current", { state: { usage: buildUsage({ windows: [{ label: "Month", usedPercent: 42 }] }) } });

	assert.deepEqual(statusCalls, [
		{ key: "sub-status:usage", text: "3h4m 3% · 6d11h 7%" },
		{ key: "sub-status:usage", text: "Month 42%" },
	]);
});

test("clears the status when current state becomes unusable and on session shutdown", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls, waitForStatusCalls } = createContext();
	registerCurrentStateReply(pi, { usage: buildUsage() });

	createStatusRuntime(pi);
	await pi.emitEvent("session_start", ctx);
	await waitForStatusCalls(1);

	pi.events.emit("sub-core:update-current", { state: { usage: buildUsage({ windows: [] }) } });
	await waitForStatusCalls(2);
	await pi.emitEvent("session_shutdown", ctx);

	assert.deepEqual(statusCalls, [
		{ key: "sub-status:usage", text: "3h4m 3% · 6d11h 7%" },
		{ key: "sub-status:usage", text: undefined },
	]);
});

test("keeps a newer sub-core ready update when the startup request replies later with stale state", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls, waitForStatusCalls } = createContext();
	const startupRequest = createDeferred<{ reply: (payload: { state: SubCoreState }) => void }>();
	let requestCount = 0;

	pi.events.on("sub-core:request", (payload) => {
		const request = payload as { reply: (payload: { state: SubCoreState }) => void };
		requestCount += 1;
		if (requestCount === 1) {
			request.reply({ state: {} });
			return;
		}
		startupRequest.resolve(request);
	});

	createStatusRuntime(pi, { probeTimeoutMs: 1, requestTimeoutMs: 50 });
	await pi.emitEvent("session_start", ctx);
	const delayedRequest = await startupRequest.promise;

	pi.events.emit("sub-core:ready", { state: { usage: buildUsage() } });
	await waitForStatusCalls(1);
	assert.deepEqual(statusCalls, [{ key: "sub-status:usage", text: "3h4m 3% · 6d11h 7%" }]);

	delayedRequest.reply({ state: {} });
	await new Promise((resolve) => setImmediate(resolve));

	assert.deepEqual(statusCalls, [{ key: "sub-status:usage", text: "3h4m 3% · 6d11h 7%" }]);
});

test("tries bundled sub-core first and falls back to package resolution when probing fails", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls, waitForStatusCalls } = createContext();
	const imports: string[] = [];

	const importModule = async (specifier: string): Promise<unknown> => {
		imports.push(specifier);
		if (specifier.includes("node_modules/@eiei114/pi-sub-core/index.ts")) {
			throw new Error("missing bundled core");
		}
		if (specifier === "@eiei114/pi-sub-core") {
			return {
				default(api: ExtensionAPI) {
					(api.events as FakePi["events"]).on("sub-core:request", (payload) => {
						const request = payload as { reply: (payload: { state: SubCoreState }) => void };
						request.reply({ state: { usage: buildUsage({ windows: [{ label: "Month", usedPercent: 42 }] }) } });
					});
				},
			};
		}
		throw new Error(`unexpected import: ${specifier}`);
	};

	createStatusRuntime(pi, {
		probeTimeoutMs: 1,
		requestTimeoutMs: 1,
		importModule,
	});
	await pi.emitEvent("session_start", ctx);
	await waitForStatusCalls(1);

	assert.ok(imports[0].includes("node_modules/@eiei114/pi-sub-core/index.ts"));
	assert.equal(imports[1], "@eiei114/pi-sub-core");
	assert.deepEqual(statusCalls, [{ key: "sub-status:usage", text: "Month 42%" }]);
});

test("warns once when sub-core cannot be auto-loaded from either runtime import path", async () => {
	const pi = createFakePi();
	const { ctx, statusCalls } = createContext();
	const warningLog = createCallLog<WarningCall>();
	const importLog = createCallLog<string>();

	const importModule = async (specifier: string): Promise<unknown> => {
		importLog.push(specifier);
		return {};
	};

	createStatusRuntime(pi, {
		probeTimeoutMs: 1,
		requestTimeoutMs: 1,
		importModule,
		logWarning: (message, error) => warningLog.push({ message, error }),
	});
	await pi.emitEvent("session_start", ctx);
	await warningLog.waitForCount(1);
	await importLog.waitForCount(2);

	assert.equal(warningLog.calls[0].message, "Failed to auto-load sub-core");
	assert.equal(importLog.calls[1], "@eiei114/pi-sub-core");
	assert.deepEqual(statusCalls, []);
});

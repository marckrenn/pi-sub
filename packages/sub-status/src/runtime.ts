import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SubCoreState } from "@eiei114/pi-sub-shared";
import { formatCompactStatus } from "./format.js";

const STATUS_KEY = "sub-status:usage";
const DEFAULT_PROBE_TIMEOUT_MS = 200;
const DEFAULT_REQUEST_TIMEOUT_MS = 1000;

type SubCoreRequest = {
	type?: "current";
	includeSettings?: boolean;
	reply: (payload: { state: SubCoreState }) => void;
};

/**
 * Optional dependencies for testing and runtime probing.
 */
export type RuntimeDependencies = {
	probeTimeoutMs?: number;
	requestTimeoutMs?: number;
	importModule?: (specifier: string) => Promise<unknown>;
	logWarning?: (message: string, error: unknown) => void;
};

function resolveTimeout(value: number | undefined, fallback: number): number {
	return value ?? fallback;
}

function getCreateCore(module: unknown): ((api: ExtensionAPI) => void | Promise<void>) | undefined {
	const candidate = (module as { default?: unknown }).default;
	return typeof candidate === "function"
		? (candidate as (api: ExtensionAPI) => void | Promise<void>)
		: undefined;
}

function requestSubCoreCurrent<T>(
	pi: ExtensionAPI,
	timeoutMs: number,
	onReply: (payload: { state: SubCoreState }) => T,
	onTimeout: T
): Promise<T> {
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			resolve(onTimeout);
		}, timeoutMs);
		timer.unref?.();

		const request: SubCoreRequest = {
			type: "current",
			reply: (payload) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve(onReply(payload));
			},
		};

		pi.events.emit("sub-core:request", request);
	});
}

function probeSubCore(pi: ExtensionAPI, timeoutMs: number): Promise<boolean> {
	return requestSubCoreCurrent(pi, timeoutMs, () => true, false);
}

function requestCoreState(pi: ExtensionAPI, timeoutMs: number): Promise<SubCoreState | undefined> {
	return requestSubCoreCurrent(pi, timeoutMs, (payload) => payload.state, undefined);
}

async function loadSubCoreFactory(
	importModule: (specifier: string) => Promise<unknown>,
	logWarning: (message: string, error: unknown) => void
): Promise<((api: ExtensionAPI) => void | Promise<void>) | undefined> {
	const specifiers = [new URL("../node_modules/@eiei114/pi-sub-core/index.ts", import.meta.url).toString(), "@eiei114/pi-sub-core"];
	let failure: unknown = new Error("sub-core module did not export a default extension factory");

	for (const specifier of specifiers) {
		try {
			const module = await importModule(specifier);
			const createCore = getCreateCore(module);
			if (createCore) {
				return createCore;
			}
			failure = new Error(`${specifier} did not export a default extension factory`);
		} catch (error) {
			failure = error;
		}
	}

	logWarning("Failed to auto-load sub-core", failure);
	return undefined;
}

/**
 * Wire sub-status into the sub-core event flow for the current pi session.
 */
export function createStatusRuntime(pi: ExtensionAPI, dependencies: RuntimeDependencies = {}): void {
	let lastContext: ExtensionContext | undefined;
	let lastRenderedStatus: string | undefined;
	let subCoreBootstrapAttempted = false;
	let currentStateVersion = 0;

	const probeTimeoutMs = resolveTimeout(dependencies.probeTimeoutMs, DEFAULT_PROBE_TIMEOUT_MS);
	const requestTimeoutMs = resolveTimeout(dependencies.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
	const importModule = dependencies.importModule ?? ((specifier: string) => import(specifier));
	const logWarning = dependencies.logWarning ?? ((message: string, error: unknown) => console.warn(`${message}:`, error));

	function renderStatus(ctx: ExtensionContext, state: SubCoreState | undefined): void {
		const nextStatus = formatCompactStatus(state?.usage);
		if (nextStatus === lastRenderedStatus) {
			return;
		}
		ctx.ui.setStatus(STATUS_KEY, nextStatus);
		lastRenderedStatus = nextStatus;
	}

	async function ensureSubCoreLoaded(): Promise<void> {
		if (subCoreBootstrapAttempted) {
			return;
		}
		subCoreBootstrapAttempted = true;

		if (await probeSubCore(pi, probeTimeoutMs)) {
			return;
		}

		const createCore = await loadSubCoreFactory(importModule, logWarning);
		if (!createCore) {
			return;
		}
		await createCore(pi);
	}

	function renderCurrentState(state: SubCoreState | undefined): void {
		currentStateVersion += 1;
		if (!lastContext) {
			return;
		}
		renderStatus(lastContext, state);
	}

	pi.events.on("sub-core:ready", (payload) => {
		const event = payload as { state?: SubCoreState };
		renderCurrentState(event.state);
	});

	pi.events.on("sub-core:update-current", (payload) => {
		const event = payload as { state?: SubCoreState };
		renderCurrentState(event.state);
	});

	pi.on("session_start", (_event, ctx) => {
		lastContext = ctx;
		const requestStateVersion = currentStateVersion;

		void (async () => {
			await ensureSubCoreLoaded();
			if (lastContext !== ctx) {
				return;
			}
			const state = await requestCoreState(pi, requestTimeoutMs);
			if (lastContext !== ctx || currentStateVersion !== requestStateVersion) {
				return;
			}
			renderStatus(ctx, state);
		})();
	});

	pi.on("session_shutdown", () => {
		if (lastContext) {
			renderStatus(lastContext, undefined);
		}
		lastContext = undefined;
		lastRenderedStatus = undefined;
		subCoreBootstrapAttempted = false;
		currentStateVersion = 0;
	});
}

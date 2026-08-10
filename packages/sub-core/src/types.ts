/**
 * Core types for the sub-bar extension
 */

import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";

/** Result of running a command while capturing both streams. */
export interface CommandOutput {
	stdout: string;
	stderr: string;
}

export type {
	ProviderName,
	StatusIndicator,
	ProviderStatus,
	RateWindow,
	UsageSnapshot,
	UsageError,
	UsageErrorCode,
	ProviderUsageEntry,
	SubCoreState,
	SubCoreEvents,
} from "@eiei114/pi-sub-shared";

export { PROVIDERS } from "@eiei114/pi-sub-shared";

/**
 * Dependencies that can be injected for testing
 */
export interface Dependencies {
	fetch: typeof globalThis.fetch;
	readFile: (path: string) => string | undefined;
	fileExists: (path: string) => boolean;
	// Use static commands/args only (no user-controlled input).
	execFileSync: (file: string, args: string[], options?: ExecFileSyncOptionsWithStringEncoding) => string;
	/**
	 * Run a command and capture BOTH stdout and stderr, WITHOUT spawning a
	 * shell. Cross-platform by design (no `/bin/sh`, no `cmd.exe`): use this
	 * for CLIs that write usage data to stderr (e.g. `kiro-cli /usage`).
	 * Throws on spawn failure or non-zero exit, matching `execFileSync`.
	 */
	execFileSyncWithStderr: (
		file: string,
		args: string[],
		options?: ExecFileSyncOptionsWithStringEncoding,
	) => CommandOutput;
	homedir: () => string;
	env: NodeJS.ProcessEnv;
}

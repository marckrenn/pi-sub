/**
 * Core types for the sub-bar extension
 */

import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";

export type {
	ProviderName,
	StatusIndicator,
	ProviderStatus,
	RateWindow,
	CredentialSource,
	UsageSnapshot,
	UsageError,
	UsageErrorCode,
	ProviderUsageEntry,
	SubCoreState,
	SubCoreEvents,
} from "@marckrenn/pi-sub-shared";

export { PROVIDERS } from "@marckrenn/pi-sub-shared";

/**
 * Dependencies that can be injected for testing
 */
export interface Dependencies {
	fetch: typeof globalThis.fetch;
	readFile: (path: string) => string | undefined;
	fileExists: (path: string) => boolean;
	// Use static commands/args only (no user-controlled input).
	execFileSync: (file: string, args: string[], options?: ExecFileSyncOptionsWithStringEncoding) => string;
	homedir: () => string;
	env: NodeJS.ProcessEnv;
}

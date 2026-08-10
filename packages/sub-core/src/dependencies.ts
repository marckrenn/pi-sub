/**
 * Default dependencies using real implementations
 */

import * as fs from "node:fs";
import * as os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import type {
	ExecFileSyncOptionsWithStringEncoding,
	SpawnSyncOptions,
} from "node:child_process";
import type { Dependencies } from "./types.js";

/**
 * Create default dependencies using Node.js APIs
 */
export function createDefaultDependencies(): Dependencies {
	return {
		fetch: globalThis.fetch,
		readFile: (path: string) => {
			try {
				return fs.readFileSync(path, "utf-8");
			} catch {
				return undefined;
			}
		},
		fileExists: (path: string) => {
			try {
				return fs.existsSync(path);
			} catch {
				return false;
			}
		},
		execFileSync: (file: string, args: string[], options?: ExecFileSyncOptionsWithStringEncoding) => {
			return execFileSync(file, args, options) as string;
		},
		// Cross-platform stderr capture via spawnSync (no shell). Unlike a
		// `2>&1` shell redirect, this runs on Windows as well as Unix.
		execFileSyncWithStderr: (
			file: string,
			args: string[],
			options?: ExecFileSyncOptionsWithStringEncoding,
		) => {
			const spawnOptions: SpawnSyncOptions = {
				...options,
				encoding: options?.encoding ?? "utf-8",
			};
			const result = spawnSync(file, args, spawnOptions);
			// Mirror execFileSync: surface spawn errors and non-zero exits so
			// callers can fall back to their error path.
			if (result.error || result.status !== 0) {
				throw result.error ?? new Error(`${file} exited with status ${result.status}`);
			}
			return {
				stdout: typeof result.stdout === "string" ? result.stdout : "",
				stderr: typeof result.stderr === "string" ? result.stderr : "",
			};
		},
		homedir: () => os.homedir(),
		env: process.env,
	};
}

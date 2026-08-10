import path from "node:path";
import type { Dependencies } from "../src/types.js";

export type FetchResponse<T> = {
	ok: boolean;
	status: number;
	json: () => Promise<T>;
};

export function createJsonResponse<T>(data: T, init?: { ok?: boolean; status?: number }): FetchResponse<T> {
	return {
		ok: init?.ok ?? true,
		status: init?.status ?? 200,
		json: async () => data,
	};
}

export function createDeps(options?: {
	files?: Record<string, string>;
	fetch?: Dependencies["fetch"];
	execFileSync?: Dependencies["execFileSync"];
	execFileSyncWithStderr?: Dependencies["execFileSyncWithStderr"];
	env?: NodeJS.ProcessEnv;
	homedir?: string;
}): { deps: Dependencies; files: Map<string, string> } {
	const files = new Map<string, string>(Object.entries(options?.files ?? {}));
	const homedir = options?.homedir ?? "/home/test";

	const deps: Dependencies = {
		fetch: options?.fetch
			?? (async () => {
				throw new Error("fetch not mocked");
			}),
		readFile: (filePath: string) => files.get(filePath),
		fileExists: (filePath: string) => files.has(filePath),
		execFileSync: options?.execFileSync
			?? (() => {
				throw new Error("execFileSync not mocked");
			}),
		execFileSyncWithStderr: options?.execFileSyncWithStderr
			?? (() => {
				throw new Error("execFileSyncWithStderr not mocked");
			}),
		homedir: () => homedir,
		env: options?.env ?? {},
	};

	return { deps, files };
}

export function getAuthPath(home: string): string {
	return path.join(home, ".pi", "agent", "auth.json");
}

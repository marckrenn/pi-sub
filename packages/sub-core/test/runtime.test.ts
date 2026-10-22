import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');

test('cache updates preserve the original quota fetch timestamp', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'pi-sub-cache-runtime-'));
	const usage = {
		provider: 'codex',
		displayName: 'Codex Plan',
		windows: [{ label: 'Week', usedPercent: 42 }],
	};
	const statuses = [
		{ indicator: 'none', description: 'Operational' },
		{ indicator: 'minor', description: 'Degraded' },
		{ indicator: 'maintenance', description: 'Scheduled maintenance' },
	];

	try {
		const { stdout } = await run(
			process.execPath,
			[tsxCli, fileURLToPath(new URL('./fixtures/cache-runtime.ts', import.meta.url))],
			{
				env: { ...process.env, PI_CODING_AGENT_DIR: directory },
				timeout: 30_000,
			},
		);

		assert.deepEqual(JSON.parse(stdout), {
			updates: statuses.map((status) => ({
				provider: 'codex',
				usage: { ...usage, status, lastSuccessAt: 1_700_000_000_000 },
			})),
			storedStatus: statuses.at(-1),
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

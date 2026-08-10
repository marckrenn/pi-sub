import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ciWorkflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");

test("pull-request CI workflow gates feature branches on verify", () => {
	const workflow = fs.readFileSync(ciWorkflowPath, "utf8");
	const nvmrcMajor = Number.parseInt(
		fs.readFileSync(path.join(repoRoot, ".nvmrc"), "utf8").trim(),
		10,
	);

	assert.match(
		workflow,
		/on:\s*\n\s+pull_request:\s*\n\s+push:\s*\n\s+branches-ignore:\s*\n\s+- main/,
	);
	assert.match(workflow, /ubuntu-latest/);
	assert.match(workflow, /windows-latest/);
	assert.match(workflow, /node-version-file:\s*\.nvmrc/);
	assert.match(workflow, /npm run verify/);
	assert.ok(nvmrcMajor >= 24, ".nvmrc must match the Node version required by pi-coding-agent/undici");
});

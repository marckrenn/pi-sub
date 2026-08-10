import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packagesDir = path.join(repoRoot, "packages");

test("CHANGELOG titles match published package names", () => {
	for (const pkgDir of fs.readdirSync(packagesDir)) {
		const pkgRoot = path.join(packagesDir, pkgDir);
		const changelogPath = path.join(pkgRoot, "CHANGELOG.md");
		const pkgJsonPath = path.join(pkgRoot, "package.json");
		if (!fs.existsSync(changelogPath) || !fs.existsSync(pkgJsonPath)) {
			continue;
		}

		const pkgName = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")).name as string;
		const firstLine = fs.readFileSync(changelogPath, "utf8").split(/\r?\n/)[0] ?? "";

		assert.equal(firstLine, `# ${pkgName}`);
		assert.doesNotMatch(firstLine, /@marckrenn/);
	}
});

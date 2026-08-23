import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Each published package extends its own tsconfig.base.json, because the
// monorepo root is not present once the package is installed from npm.
// A plain run rewrites the copies from the root config; --check fails instead
// of writing, and additionally asserts the copies reach the npm tarballs.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const base = readFileSync(join(root, "tsconfig.base.json"), "utf8");
const packagesDir = join(root, "packages");
const errors = [];

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;

	const dir = join(packagesDir, entry.name);
	const tsconfig = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8"));
	if (tsconfig.extends !== "./tsconfig.base.json") {
		errors.push(`${entry.name}/tsconfig.json must extend "./tsconfig.base.json"`);
		continue;
	}

	const copy = join(dir, "tsconfig.base.json");
	if (existsSync(copy) && readFileSync(copy, "utf8") === base) continue;
	if (checkOnly) {
		errors.push(
			`${entry.name}/tsconfig.base.json differs from the root tsconfig.base.json — edit the root file, then run \`npm run sync:tsconfig\``,
		);
	} else {
		writeFileSync(copy, base);
	}
}

// Being present in the working tree is not enough: a `files` array or an
// .npmignore entry can still keep the config out of the tarball.
if (checkOnly && errors.length === 0) {
	const packed = JSON.parse(
		execFileSync("npm", ["pack", "--dry-run", "--json", "--workspaces"], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}),
	);
	for (const pkg of packed) {
		if (pkg.files.some((file) => file.path === "tsconfig.base.json")) continue;
		errors.push(`${pkg.name} does not publish tsconfig.base.json — check its \`files\` and .npmignore`);
	}
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exit(1);
}

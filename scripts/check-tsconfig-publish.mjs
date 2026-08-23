import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["sub-core", "sub-bar", "sub-status", "sub-shared"];

for (const pkg of packages) {
	const dir = join(root, "packages", pkg);
	const tsconfigPath = join(dir, "tsconfig.json");
	const config = JSON.parse(readFileSync(tsconfigPath, "utf8"));
	const extendsPath = config.extends;

	if (!extendsPath || extendsPath.startsWith("../")) {
		throw new Error(`${pkg}/tsconfig.json must extend a local tsconfig.base.json`);
	}

	const resolved = resolve(dir, extendsPath);
	if (!existsSync(resolved)) {
		throw new Error(`${pkg}/tsconfig.json extends missing file: ${resolved}`);
	}
}

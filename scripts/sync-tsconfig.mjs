import { copyFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const base = join(root, "tsconfig.base.json");
const packages = ["sub-core", "sub-bar", "sub-status", "sub-shared"];

for (const pkg of packages) {
	copyFileSync(base, join(root, "packages", pkg, "tsconfig.base.json"));
}

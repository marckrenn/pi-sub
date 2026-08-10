import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createStatusRuntime, type RuntimeDependencies } from "./src/runtime.js";

/**
 * Create the compact status-line client.
 */
export default function createExtension(pi: ExtensionAPI, dependencies?: RuntimeDependencies): void {
	createStatusRuntime(pi, dependencies);
}

import * as PiTui from "@earendil-works/pi-tui";

export type SettingsListAction =
	| "selectUp"
	| "selectDown"
	| "cursorLeft"
	| "cursorRight"
	| "selectConfirm"
	| "selectCancel";

export interface SettingsKeybindings {
	matches(data: string, action: SettingsListAction): boolean;
}

interface CompatibleApi {
	getEditorKeybindings?: () => { matches(data: string, action: string): boolean };
	getKeybindings?: () => { matches(data: string, action: string): boolean };
	matchesKey?: (data: string, key: string) => boolean;
}

const LEGACY_ACTION_MAP: Record<SettingsListAction, string> = {
	selectUp: "tui.select.up",
	selectDown: "tui.select.down",
	cursorLeft: "tui.editor.cursorLeft",
	cursorRight: "tui.editor.cursorRight",
	selectConfirm: "tui.select.confirm",
	selectCancel: "tui.select.cancel",
};

const DEFAULT_ACTION_KEYS: Record<SettingsListAction, string | string[]> = {
	selectUp: "up",
	selectDown: "down",
	cursorLeft: ["left", "ctrl+b"],
	cursorRight: ["right", "ctrl+f"],
	selectConfirm: "enter",
	selectCancel: ["escape", "ctrl+c"],
};

function matchesKeyWithFallback(
	data: string,
	key: string,
	matchesKey?: (data: string, key: string) => boolean,
): boolean {
	if (matchesKey) {
		return matchesKey(data, key);
	}

	if (key === "enter") return data === "\r" || data === "\n";
	if (key === "escape") return data === "\u001b";
	if (key === "up") return data === "\u001b[A";
	if (key === "down") return data === "\u001b[B";
	if (key === "left") return data === "\u001b[D";
	if (key === "right") return data === "\u001b[C";
	return data === key;
}

function matchesDefaultAction(
	data: string,
	action: SettingsListAction,
	matchesKey?: (data: string, key: string) => boolean,
): boolean {
	const keys = DEFAULT_ACTION_KEYS[action];
	const list = Array.isArray(keys) ? keys : [keys];
	return list.some((key) => matchesKeyWithFallback(data, key, matchesKey));
}

export function createSettingsKeybindings(api: CompatibleApi): SettingsKeybindings {
	const editor = api.getEditorKeybindings?.();
	if (editor && typeof editor.matches === "function") {
		return {
			matches: (data, action) => editor.matches(data, action),
		};
	}

	const legacy = api.getKeybindings?.();
	if (legacy && typeof legacy.matches === "function") {
		return {
			matches: (data, action) => {
				const legacyAction = LEGACY_ACTION_MAP[action];
				return legacy.matches(data, legacyAction);
			},
		};
	}

	return {
		matches: (data, action) => matchesDefaultAction(data, action, api.matchesKey),
	};
}

export function getSettingsKeybindings(): SettingsKeybindings {
	return createSettingsKeybindings(PiTui as CompatibleApi);
}

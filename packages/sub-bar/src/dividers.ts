import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { DividerCharacter } from "./settings-types.js";

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const DIVIDER_JOIN_MAP: Partial<Record<DividerCharacter, { top: string; bottom: string; line: string }>> = {
	"|": { top: "┬", bottom: "┴", line: "─" },
	"│": { top: "┬", bottom: "┴", line: "─" },
	"┆": { top: "┬", bottom: "┴", line: "─" },
	"┃": { top: "┳", bottom: "┻", line: "━" },
	"┇": { top: "┳", bottom: "┻", line: "━" },
	"║": { top: "╦", bottom: "╩", line: "═" },
};

export function buildDividerLine(
	width: number,
	baseLine: string,
	dividerChar: DividerCharacter,
	joinEnabled: boolean,
	position: "top" | "bottom",
	dividerColor: ThemeColor,
	theme: Theme
): string {
	let lineChar = "─";
	let joinChar: string | undefined;
	if (joinEnabled) {
		const joinInfo = DIVIDER_JOIN_MAP[dividerChar];
		if (joinInfo) {
			lineChar = joinInfo.line;
			joinChar = position === "top" ? joinInfo.top : joinInfo.bottom;
		}
	}
	const lineChars = Array.from(lineChar.repeat(Math.max(1, width)));
	if (joinChar) {
		const stripped = baseLine.replace(ANSI_REGEX, "");
		let pos = 0;
		for (const { segment } of SEGMENTER.segment(stripped)) {
			if (pos >= lineChars.length) break;
			if (segment === dividerChar) {
				lineChars[pos] = joinChar;
			}
			pos += Math.max(1, visibleWidth(segment));
		}
	}
	return theme.fg(dividerColor, lineChars.join(""));
}

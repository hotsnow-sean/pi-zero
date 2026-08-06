/**
 * pi-zero: fixed-editor stub
 *
 * 用户不需要 fixed editor（认为 fix 后有小问题），因此这里提供一个空的
 * 占位实现，保持 claude-code-style.ts 所需的接口签名，但禁用全部功能。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type FixedEditorHitbox = { row: number; startCol: number; endCol: number };

export type FixedEditorViewportSnapshot = {
	tui: object;
	visibleRootStart: number;
	visibleScrollableRows: number;
	visibleLines: readonly string[];
	generation: number;
};

export type FixedEditorController = {
	setEnabled(enabled: boolean): void;
	/** Fires after compositor install/reinstall (session start, enable, footer rebuild). */
	onRebuild(listener: () => void): () => void;
};

/** Disabled: never returns a scroll-button hitbox. */
export function getFixedEditorScrollButtonHitbox(): FixedEditorHitbox | null {
	return null;
}

/** Disabled: never returns a viewport snapshot. */
export function getFixedEditorViewport(_tui: object): FixedEditorViewportSnapshot | null {
	return null;
}

/** Disabled: no-op pre-start hook. */
export function setBeforeFixedEditorStart(_listener: (() => void) | undefined): void {}

/** Disabled: returns a no-op controller. */
export function installFixedEditor(_pi: ExtensionAPI, _initiallyEnabled: boolean): FixedEditorController {
	return {
		setEnabled() {},
		onRebuild() {
			return () => {};
		},
	};
}

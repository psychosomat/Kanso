import { useEffect } from "react";
import { consumeTopEscapeLayer } from "./use-escape-layer";

type UsePlayerHotkeysOptions = {
	onVolumeDown: () => void | Promise<void>;
	onVolumeUp: () => void | Promise<void>;
	enabled?: boolean;
	/**
	 * A self-closing overlay (Radix dialog/sheet, command palette) is open
	 * and dismisses Escape natively. The player stays silent and lets it
	 * close first; leaving the player is always the last resort.
	 */
	overlayOpen?: boolean;
	onSeekBackward: () => void;
	onSeekForward: () => void;
	onSeekLongBackward?: () => void;
	onSeekLongForward?: () => void;
	onSeekToStart?: () => void;
	onSeekToEnd?: () => void;
	onSeekToFraction?: (fraction: number) => void;
	onToggleFullscreen: () => void | Promise<void>;
	onToggleLoop?: () => void | Promise<void>;
	onToggleMute: () => void | Promise<void>;
	onTogglePlay: () => void | Promise<void>;
	onCycleSpeed?: () => void;
	onSpeedDown?: () => void;
	onSpeedUp?: () => void;
	onToggleCategories?: () => void;
	onToggleDetails?: () => void;
	onExit?: () => void;
};

export type PlayerHotkeyAction =
	| "togglePlay"
	| "seekBackward"
	| "seekForward"
	| "seekLongBackward"
	| "seekLongForward"
	| "seekToStart"
	| "seekToEnd"
	| { kind: "seekToFraction"; fraction: number }
	| "volumeUp"
	| "volumeDown"
	| "toggleMute"
	| "toggleLoop"
	| "toggleFullscreen"
	| "cycleSpeed"
	| "speedDown"
	| "speedUp"
	| "toggleCategories"
	| "toggleDetails"
	| "exit";

type HotkeyEvent = {
	code: string;
	key: string;
	repeat: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
};

const REPEATABLE_CODES = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"KeyJ",
	"KeyL",
	"Minus",
	"Equal",
]);

function digitFraction(code: string): number | null {
	const match = /^(?:Digit|Numpad)(\d)$/.exec(code);
	if (!match) return null;
	return Number(match[1]) / 10;
}

export function getPlayerHotkeyAction(
	event: HotkeyEvent,
	options: { hasToggleLoop: boolean },
): PlayerHotkeyAction | null {
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	if (event.repeat && !REPEATABLE_CODES.has(event.code)) return null;

	switch (event.code) {
		case "Space":
		case "KeyK":
			return "togglePlay";
		case "ArrowLeft":
			return event.shiftKey ? "seekLongBackward" : "seekBackward";
		case "ArrowRight":
			return event.shiftKey ? "seekLongForward" : "seekForward";
		case "KeyJ":
			return event.shiftKey ? "seekLongBackward" : "seekBackward";
		case "KeyL":
			return event.shiftKey ? "seekLongForward" : "seekForward";
		case "ArrowUp":
			return "volumeUp";
		case "ArrowDown":
			return "volumeDown";
		case "Home":
			return "seekToStart";
		case "End":
			return "seekToEnd";
		case "Escape":
			return "exit";
		case "KeyM":
			return "toggleMute";
		case "KeyR":
			return options.hasToggleLoop ? "toggleLoop" : null;
		case "KeyF":
			return "toggleFullscreen";
		case "KeyS":
			return "cycleSpeed";
		case "Minus":
			return "speedDown";
		case "Equal":
			return "speedUp";
		case "KeyC":
			return "toggleCategories";
		case "KeyI":
			return "toggleDetails";
		default: {
			const fraction = digitFraction(event.code);
			if (fraction !== null) return { kind: "seekToFraction", fraction };
			return null;
		}
	}
}

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function usePlayerHotkeys({
	enabled = true,
	overlayOpen = false,
	onVolumeDown,
	onVolumeUp,
	onSeekBackward,
	onSeekForward,
	onSeekLongBackward,
	onSeekLongForward,
	onSeekToStart,
	onSeekToEnd,
	onSeekToFraction,
	onToggleFullscreen,
	onToggleLoop,
	onToggleMute,
	onTogglePlay,
	onCycleSpeed,
	onSpeedDown,
	onSpeedUp,
	onToggleCategories,
	onToggleDetails,
	onExit,
}: UsePlayerHotkeysOptions) {
	useEffect(() => {
		if (!enabled) return;

		const onKeyDown = (event: KeyboardEvent) => {
			// Escape belongs to the unwinder below, never to transport keys.
			if (event.code === "Escape") return;

			if (
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				isEditableTarget(event.target)
			) {
				return;
			}

			const action = getPlayerHotkeyAction(event, {
				hasToggleLoop: Boolean(onToggleLoop),
			});
			if (!action) return;
			if (typeof action !== "string") {
				event.preventDefault();
				onSeekToFraction?.(action.fraction);
				return;
			}

			switch (action) {
				case "togglePlay":
					event.preventDefault();
					void onTogglePlay();
					return;
				case "seekBackward":
					event.preventDefault();
					onSeekBackward();
					return;
				case "seekForward":
					event.preventDefault();
					onSeekForward();
					return;
				case "seekLongBackward":
					event.preventDefault();
					(onSeekLongBackward ?? onSeekBackward)();
					return;
				case "seekLongForward":
					event.preventDefault();
					(onSeekLongForward ?? onSeekForward)();
					return;
				case "seekToStart":
					event.preventDefault();
					onSeekToStart?.();
					return;
				case "seekToEnd":
					event.preventDefault();
					onSeekToEnd?.();
					return;
				case "volumeUp":
					event.preventDefault();
					void onVolumeUp();
					return;
				case "volumeDown":
					event.preventDefault();
					void onVolumeDown();
					return;
				case "toggleMute":
					event.preventDefault();
					void onToggleMute();
					return;
				case "toggleLoop":
					event.preventDefault();
					void onToggleLoop?.();
					return;
				case "toggleFullscreen":
					event.preventDefault();
					void onToggleFullscreen();
					return;
				case "cycleSpeed":
					event.preventDefault();
					onCycleSpeed?.();
					return;
				case "speedDown":
					event.preventDefault();
					onSpeedDown?.();
					return;
				case "speedUp":
					event.preventDefault();
					onSpeedUp?.();
					return;
				case "toggleCategories":
					event.preventDefault();
					onToggleCategories?.();
					return;
				case "toggleDetails":
					event.preventDefault();
					onToggleDetails?.();
					return;
				default:
					return;
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		enabled,
		onSeekBackward,
		onSeekForward,
		onSeekLongBackward,
		onSeekLongForward,
		onSeekToStart,
		onSeekToEnd,
		onSeekToFraction,
		onToggleFullscreen,
		onToggleMute,
		onTogglePlay,
		onToggleLoop,
		onVolumeDown,
		onVolumeUp,
		onCycleSpeed,
		onSpeedDown,
		onSpeedUp,
		onToggleCategories,
		onToggleDetails,
	]);

	useEffect(() => {
		// Escape unwinds top-first while the player is mounted: custom layers,
		// then self-closing overlays (handled natively), and only the player
		// itself when nothing above claimed the key.
		const onEscape = (event: KeyboardEvent) => {
			if (
				event.code !== "Escape" ||
				event.repeat ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey
			) {
				return;
			}
			if (consumeTopEscapeLayer()) {
				event.preventDefault();
				return;
			}
			if (overlayOpen) return;
			event.preventDefault();
			onExit?.();
		};

		window.addEventListener("keydown", onEscape);
		return () => window.removeEventListener("keydown", onEscape);
	}, [onExit, overlayOpen]);
}

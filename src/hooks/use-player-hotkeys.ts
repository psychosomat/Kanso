import { useEffect } from "react";

type UsePlayerHotkeysOptions = {
	onVolumeDown: () => void | Promise<void>;
	onVolumeUp: () => void | Promise<void>;
	enabled?: boolean;
	onSeekBackward: () => void;
	onSeekForward: () => void;
	onToggleFullscreen: () => void | Promise<void>;
	onToggleLoop?: () => void | Promise<void>;
	onToggleMute: () => void | Promise<void>;
	onTogglePlay: () => void | Promise<void>;
};

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function usePlayerHotkeys({
	enabled = true,
	onVolumeDown,
	onVolumeUp,
	onSeekBackward,
	onSeekForward,
	onToggleFullscreen,
	onToggleLoop,
	onToggleMute,
	onTogglePlay,
}: UsePlayerHotkeysOptions) {
	useEffect(() => {
		if (!enabled) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.repeat || isEditableTarget(event.target)) return;

			switch (event.code) {
				case "Space":
				case "KeyK":
					event.preventDefault();
					void onTogglePlay();
					return;
				case "ArrowLeft":
				case "KeyJ":
					event.preventDefault();
					onSeekBackward();
					return;
				case "ArrowRight":
				case "KeyL":
					event.preventDefault();
					onSeekForward();
					return;
				case "ArrowUp":
					event.preventDefault();
					void onVolumeUp();
					return;
				case "ArrowDown":
					event.preventDefault();
					void onVolumeDown();
					return;
				case "KeyM":
					event.preventDefault();
					void onToggleMute();
					return;
				case "KeyR":
					if (!onToggleLoop) return;
					event.preventDefault();
					void onToggleLoop();
					return;
				case "KeyF":
					event.preventDefault();
					void onToggleFullscreen();
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
		onToggleFullscreen,
		onToggleMute,
		onTogglePlay,
		onToggleLoop,
		onVolumeDown,
		onVolumeUp,
	]);
}

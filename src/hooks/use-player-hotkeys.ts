import { useHotkeys } from "@tanstack/react-hotkeys";
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
	useHotkeys(
		[
			{
				hotkey: "Space",
				callback: () => void onTogglePlay(),
				options: {
					meta: {
						name: "Toggle Play",
						description: "Play or pause the current video.",
					},
				},
			},
			{
				hotkey: "ArrowLeft",
				callback: onSeekBackward,
				options: {
					meta: {
						name: "Seek Backward",
						description: "Seek backward by the default step.",
					},
				},
			},
			{
				hotkey: "ArrowRight",
				callback: onSeekForward,
				options: {
					meta: {
						name: "Seek Forward",
						description: "Seek forward by the default step.",
					},
				},
			},
			{
				hotkey: "ArrowUp",
				callback: () => void onVolumeUp(),
				options: {
					meta: {
						name: "Volume Up",
						description: "Increase volume by 5 percent.",
					},
				},
			},
			{
				hotkey: "ArrowDown",
				callback: () => void onVolumeDown(),
				options: {
					meta: {
						name: "Volume Down",
						description: "Decrease volume by 5 percent.",
					},
				},
			},
		],
		{
			enabled,
			preventDefault: true,
			target: typeof window === "undefined" ? null : window,
		},
	);

	useEffect(() => {
		if (!enabled) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.repeat || isEditableTarget(event.target)) return;

			switch (event.code) {
				case "KeyK":
					event.preventDefault();
					void onTogglePlay();
					return;
				case "KeyJ":
					event.preventDefault();
					onSeekBackward();
					return;
				case "KeyL":
					event.preventDefault();
					onSeekForward();
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
	]);
}

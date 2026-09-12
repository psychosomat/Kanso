// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeTopEscapeLayer, pushEscapeLayer } from "./use-escape-layer";
import { getPlayerHotkeyAction, usePlayerHotkeys } from "./use-player-hotkeys";

afterEach(() => {
	while (consumeTopEscapeLayer()) {
		// Drain leaked layers; closers here are plain vi.fn() spies.
	}
});

function key(
	code: string,
	extra: Partial<{
		key: string;
		repeat: boolean;
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		shiftKey: boolean;
	}> = {},
) {
	return {
		code,
		key: extra.key ?? code,
		repeat: extra.repeat ?? false,
		ctrlKey: extra.ctrlKey ?? false,
		metaKey: extra.metaKey ?? false,
		altKey: extra.altKey ?? false,
		shiftKey: extra.shiftKey ?? false,
	};
}

describe("getPlayerHotkeyAction", () => {
	it("maps transport keys", () => {
		expect(getPlayerHotkeyAction(key("Space"), { hasToggleLoop: true })).toBe(
			"togglePlay",
		);
		expect(getPlayerHotkeyAction(key("KeyK"), { hasToggleLoop: true })).toBe(
			"togglePlay",
		);
		expect(
			getPlayerHotkeyAction(key("ArrowLeft"), { hasToggleLoop: true }),
		).toBe("seekBackward");
		expect(
			getPlayerHotkeyAction(key("ArrowRight"), { hasToggleLoop: true }),
		).toBe("seekForward");
		expect(getPlayerHotkeyAction(key("KeyJ"), { hasToggleLoop: true })).toBe(
			"seekBackward",
		);
		expect(getPlayerHotkeyAction(key("KeyL"), { hasToggleLoop: true })).toBe(
			"seekForward",
		);
	});

	it("maps Shift+seek to long seeks", () => {
		expect(
			getPlayerHotkeyAction(key("ArrowLeft", { shiftKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe("seekLongBackward");
		expect(
			getPlayerHotkeyAction(key("ArrowRight", { shiftKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe("seekLongForward");
		expect(
			getPlayerHotkeyAction(key("KeyJ", { shiftKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe("seekLongBackward");
		expect(
			getPlayerHotkeyAction(key("KeyL", { shiftKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe("seekLongForward");
	});

	it("maps edges, fractions and exit", () => {
		expect(getPlayerHotkeyAction(key("Home"), { hasToggleLoop: true })).toBe(
			"seekToStart",
		);
		expect(getPlayerHotkeyAction(key("End"), { hasToggleLoop: true })).toBe(
			"seekToEnd",
		);
		expect(getPlayerHotkeyAction(key("Escape"), { hasToggleLoop: true })).toBe(
			"exit",
		);
		expect(
			getPlayerHotkeyAction(key("Digit0"), { hasToggleLoop: true }),
		).toEqual({ kind: "seekToFraction", fraction: 0 });
		expect(
			getPlayerHotkeyAction(key("Digit5"), { hasToggleLoop: true }),
		).toEqual({ kind: "seekToFraction", fraction: 0.5 });
		expect(
			getPlayerHotkeyAction(key("Numpad9"), { hasToggleLoop: true }),
		).toEqual({ kind: "seekToFraction", fraction: 0.9 });
	});

	it("maps speed, dialogs and toggles", () => {
		expect(getPlayerHotkeyAction(key("KeyS"), { hasToggleLoop: true })).toBe(
			"cycleSpeed",
		);
		expect(getPlayerHotkeyAction(key("Minus"), { hasToggleLoop: true })).toBe(
			"speedDown",
		);
		expect(getPlayerHotkeyAction(key("Equal"), { hasToggleLoop: true })).toBe(
			"speedUp",
		);
		expect(getPlayerHotkeyAction(key("KeyC"), { hasToggleLoop: true })).toBe(
			"toggleCategories",
		);
		expect(getPlayerHotkeyAction(key("KeyI"), { hasToggleLoop: true })).toBe(
			"toggleDetails",
		);
		expect(getPlayerHotkeyAction(key("KeyM"), { hasToggleLoop: true })).toBe(
			"toggleMute",
		);
		expect(getPlayerHotkeyAction(key("KeyF"), { hasToggleLoop: true })).toBe(
			"toggleFullscreen",
		);
		expect(getPlayerHotkeyAction(key("ArrowUp"), { hasToggleLoop: true })).toBe(
			"volumeUp",
		);
		expect(
			getPlayerHotkeyAction(key("ArrowDown"), { hasToggleLoop: true }),
		).toBe("volumeDown");
	});

	it("gates loop on the callback presence", () => {
		expect(getPlayerHotkeyAction(key("KeyR"), { hasToggleLoop: true })).toBe(
			"toggleLoop",
		);
		expect(getPlayerHotkeyAction(key("KeyR"), { hasToggleLoop: false })).toBe(
			null,
		);
	});

	it("blocks toggles on repeat but allows continuous seeks", () => {
		expect(
			getPlayerHotkeyAction(key("Space", { repeat: true }), {
				hasToggleLoop: true,
			}),
		).toBe(null);
		expect(
			getPlayerHotkeyAction(key("KeyM", { repeat: true }), {
				hasToggleLoop: true,
			}),
		).toBe(null);
		expect(
			getPlayerHotkeyAction(key("ArrowLeft", { repeat: true }), {
				hasToggleLoop: true,
			}),
		).toBe("seekBackward");
		expect(
			getPlayerHotkeyAction(key("ArrowUp", { repeat: true }), {
				hasToggleLoop: true,
			}),
		).toBe("volumeUp");
	});

	it("reserves modified keys for the shell", () => {
		expect(
			getPlayerHotkeyAction(key("ArrowLeft", { altKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe(null);
		expect(
			getPlayerHotkeyAction(key("KeyK", { ctrlKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe(null);
		expect(
			getPlayerHotkeyAction(key("KeyK", { metaKey: true }), {
				hasToggleLoop: true,
			}),
		).toBe(null);
	});

	it("returns null for unbound keys", () => {
		expect(getPlayerHotkeyAction(key("KeyQ"), { hasToggleLoop: true })).toBe(
			null,
		);
		expect(getPlayerHotkeyAction(key("Tab"), { hasToggleLoop: true })).toBe(
			null,
		);
	});
});

describe("usePlayerHotkeys escape unwinder", () => {
	const baseOptions = {
		onVolumeDown: () => {},
		onVolumeUp: () => {},
		onSeekBackward: () => {},
		onSeekForward: () => {},
		onToggleFullscreen: () => {},
		onToggleMute: () => {},
		onTogglePlay: () => {},
	};

	function pressEscape() {
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));
	}

	it("exits when no layer and no overlay is open", () => {
		const onExit = vi.fn();
		const { unmount } = renderHook(() =>
			usePlayerHotkeys({ ...baseOptions, onExit }),
		);
		pressEscape();
		expect(onExit).toHaveBeenCalledTimes(1);
		unmount();
	});

	it("closes the top layer first and exits only afterwards", () => {
		const onExit = vi.fn();
		const layerCloser = vi.fn();
		const { unmount } = renderHook(() =>
			usePlayerHotkeys({ ...baseOptions, onExit }),
		);
		const removeLayer = pushEscapeLayer(layerCloser);

		pressEscape();
		expect(layerCloser).toHaveBeenCalledTimes(1);
		expect(onExit).not.toHaveBeenCalled();

		pressEscape();
		expect(onExit).toHaveBeenCalledTimes(1);

		removeLayer();
		unmount();
	});

	it("leaves Escape to a self-closing overlay", () => {
		const onExit = vi.fn();
		const { unmount } = renderHook(() =>
			usePlayerHotkeys({ ...baseOptions, overlayOpen: true, onExit }),
		);
		pressEscape();
		expect(onExit).not.toHaveBeenCalled();
		unmount();
	});
});

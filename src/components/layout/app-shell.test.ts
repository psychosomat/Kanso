// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSidebarHoverController,
	getAppShellShortcut,
	isPlayerPath,
	isTypingTarget,
	loadSidebarPinned,
	resolveSidebarLayout,
	SIDEBAR_CLOSE_DELAY_MS,
	shouldKeepOverlaySidebarOpen,
	storeSidebarPinned,
} from "./app-shell";

describe("isPlayerPath", () => {
	it("matches player routes only", () => {
		expect(isPlayerPath("/player/abc")).toBe(true);
		expect(isPlayerPath("/player/")).toBe(true);
		expect(isPlayerPath("/dump")).toBe(false);
		expect(isPlayerPath("/player")).toBe(false);
	});
});

describe("resolveSidebarLayout", () => {
	it("shows the overlay sidebar when unpinned outside the player", () => {
		expect(resolveSidebarLayout({ inPlayer: false, pinned: false })).toEqual({
			showOverlaySidebar: true,
			showPinnedSidebar: false,
		});
	});

	it("shows the pinned sidebar when pinned outside the player", () => {
		expect(resolveSidebarLayout({ inPlayer: false, pinned: true })).toEqual({
			showOverlaySidebar: false,
			showPinnedSidebar: true,
		});
	});

	it("hides both sidebars inside the player", () => {
		expect(resolveSidebarLayout({ inPlayer: true, pinned: false })).toEqual({
			showOverlaySidebar: false,
			showPinnedSidebar: false,
		});
		expect(resolveSidebarLayout({ inPlayer: true, pinned: true })).toEqual({
			showOverlaySidebar: false,
			showPinnedSidebar: false,
		});
	});
});

describe("getAppShellShortcut", () => {
	it("maps Ctrl/Cmd+P to the palette", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "p" }, false),
		).toBe("palette");
		expect(
			getAppShellShortcut({ metaKey: true, ctrlKey: false, key: "P" }, false),
		).toBe("palette");
	});

	it("maps Ctrl/Cmd+S to pin toggling", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "s" }, false),
		).toBe("pin");
	});

	it("maps Ctrl/Cmd+B to pin toggling", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "b" }, false),
		).toBe("pin");
		expect(
			getAppShellShortcut({ metaKey: true, ctrlKey: false, key: "B" }, false),
		).toBe("pin");
	});

	it("maps Ctrl/Cmd+K to the palette", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "k" }, false),
		).toBe("palette");
	});

	it("maps bare / and ? to the palette", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: false, key: "/" }, false),
		).toBe("palette");
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: false, key: "?" }, false),
		).toBe("palette");
	});

	it("maps Alt+Left/Right to history navigation", () => {
		expect(
			getAppShellShortcut(
				{ metaKey: false, ctrlKey: false, altKey: true, key: "ArrowLeft" },
				false,
			),
		).toBe("back");
		expect(
			getAppShellShortcut(
				{ metaKey: false, ctrlKey: false, altKey: true, key: "ArrowRight" },
				false,
			),
		).toBe("forward");
	});

	it("maps Ctrl/Cmd+[ and Ctrl/Cmd+] to history navigation", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "[" }, false),
		).toBe("back");
		expect(
			getAppShellShortcut({ metaKey: true, ctrlKey: false, key: "]" }, false),
		).toBe("forward");
	});

	it("ignores Alt with unrelated keys and mixed modifiers", () => {
		expect(
			getAppShellShortcut(
				{ metaKey: false, ctrlKey: false, altKey: true, key: "x" },
				false,
			),
		).toBe(null);
		expect(
			getAppShellShortcut(
				{ metaKey: false, ctrlKey: true, altKey: true, key: "p" },
				false,
			),
		).toBe(null);
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: false, key: "F1" }, false),
		).toBe(null);
	});

	it("ignores shortcuts while typing or without a modifier", () => {
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "p" }, true),
		).toBe(null);
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: false, key: "p" }, false),
		).toBe(null);
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: true, key: "x" }, false),
		).toBe(null);
		expect(
			getAppShellShortcut(
				{ metaKey: false, ctrlKey: false, altKey: true, key: "ArrowLeft" },
				true,
			),
		).toBe(null);
		expect(
			getAppShellShortcut({ metaKey: false, ctrlKey: false, key: "/" }, true),
		).toBe(null);
	});
});

describe("isTypingTarget", () => {
	it("detects editable targets", () => {
		expect(isTypingTarget(document.createElement("input"))).toBe(true);
		expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
		const editable = document.createElement("div");
		Object.defineProperty(editable, "isContentEditable", { value: true });
		expect(isTypingTarget(editable)).toBe(true);
	});

	it("ignores plain elements and null", () => {
		expect(isTypingTarget(document.createElement("div"))).toBe(false);
		expect(isTypingTarget(null)).toBe(false);
	});
});

describe("sidebar pinned storage", () => {
	it("round-trips through localStorage", () => {
		const store = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
		});
		try {
			storeSidebarPinned(true);
			expect(loadSidebarPinned()).toBe(true);
			storeSidebarPinned(false);
			expect(loadSidebarPinned()).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("shouldKeepOverlaySidebarOpen", () => {
	it("returns false only when pointer, focus, and interaction lock are all inactive", () => {
		expect(
			shouldKeepOverlaySidebarOpen({
				pointerInside: false,
				focusInside: false,
				interactionLocked: false,
			}),
		).toBe(false);
	});

	it("returns true when any keeper condition is active", () => {
		expect(
			shouldKeepOverlaySidebarOpen({
				pointerInside: true,
				focusInside: false,
				interactionLocked: false,
			}),
		).toBe(true);
		expect(
			shouldKeepOverlaySidebarOpen({
				pointerInside: false,
				focusInside: true,
				interactionLocked: false,
			}),
		).toBe(true);
		expect(
			shouldKeepOverlaySidebarOpen({
				pointerInside: false,
				focusInside: false,
				interactionLocked: true,
			}),
		).toBe(true);
	});
});

describe("createSidebarHoverController", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("uses a balanced 180ms grace delay before auto-closing", () => {
		expect(SIDEBAR_CLOSE_DELAY_MS).toBe(180);

		const onOpenChange = vi.fn();
		const controller = createSidebarHoverController({ onOpenChange });

		controller.pointerEnter();
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		controller.pointerLeave();
		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS - 1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1);
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("cancels pending auto-close when pointer re-enters before the delay", () => {
		const onOpenChange = vi.fn();
		const controller = createSidebarHoverController({ onOpenChange });

		controller.pointerEnter();
		controller.pointerLeave();
		vi.advanceTimersByTime(Math.floor(SIDEBAR_CLOSE_DELAY_MS / 2));
		controller.pointerEnter();

		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS * 2);
		expect(onOpenChange).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
	});

	it("keeps sidebar open while focus is inside and closes after blur + delay", () => {
		const onOpenChange = vi.fn();
		const controller = createSidebarHoverController({ onOpenChange });

		controller.pointerEnter();
		controller.setFocusInside(true);
		controller.pointerLeave();

		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS * 2);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		controller.setFocusInside(false);
		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS - 1);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1);
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("keeps sidebar open while interaction is locked and handles menu-to-dialog handoff", () => {
		const onOpenChange = vi.fn();
		const controller = createSidebarHoverController({ onOpenChange });

		controller.pointerEnter();
		controller.setInteractionLocked(true);
		controller.pointerLeave();

		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS * 2);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// Simulate context menu closing right before a dialog opens within the grace period
		controller.setInteractionLocked(false);
		vi.advanceTimersByTime(50);
		controller.setInteractionLocked(true);

		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS * 2);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		// Closing the dialog finally allows auto-close after the grace delay
		controller.setInteractionLocked(false);
		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS);
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("opens via drag/click without dropping pending locks and cancels on closeNow or dispose", () => {
		const onOpenChange = vi.fn();
		const controller = createSidebarHoverController({ onOpenChange });

		controller.open();
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		controller.pointerEnter();
		controller.pointerLeave();
		controller.open();
		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS);
		expect(onOpenChange).toHaveBeenCalledTimes(1);

		controller.closeNow();
		expect(onOpenChange).toHaveBeenCalledTimes(2);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);

		controller.pointerEnter();
		controller.pointerLeave();
		controller.dispose();
		vi.advanceTimersByTime(SIDEBAR_CLOSE_DELAY_MS * 2);
		expect(onOpenChange).toHaveBeenCalledTimes(3);
	});
});

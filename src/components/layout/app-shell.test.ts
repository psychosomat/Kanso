// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	getAppShellShortcut,
	isPlayerPath,
	isTypingTarget,
	loadSidebarPinned,
	resolveSidebarLayout,
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
		storeSidebarPinned(true);
		expect(loadSidebarPinned()).toBe(true);
		storeSidebarPinned(false);
		expect(loadSidebarPinned()).toBe(false);
	});
});

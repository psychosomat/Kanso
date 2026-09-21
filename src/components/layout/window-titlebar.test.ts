// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	closeWindow,
	getTitlebarRevealClass,
	getTitlebarShellClass,
	minimizeWindow,
	shouldHideTitlebar,
	shouldRevealTitlebar,
	toggleMaximizeWindow,
} from "./window-titlebar";

describe("shouldRevealTitlebar", () => {
	it("reveals at and above the top edge zone", () => {
		expect(shouldRevealTitlebar(0)).toBe(true);
		expect(shouldRevealTitlebar(56)).toBe(true);
		expect(shouldRevealTitlebar(57)).toBe(false);
	});
});

describe("shouldHideTitlebar", () => {
	it("hides only past the release zone with a dead band between", () => {
		expect(shouldHideTitlebar(132)).toBe(false);
		expect(shouldHideTitlebar(133)).toBe(true);
		expect(shouldHideTitlebar(100)).toBe(false);
	});
});

describe("getTitlebarShellClass", () => {
	it("applies pointer-events-none only in non-blocking mode", () => {
		expect(getTitlebarShellClass(true)).toContain("pointer-events-none");
		expect(getTitlebarShellClass(false)).not.toContain("pointer-events-none");
		expect(getTitlebarShellClass(undefined)).not.toContain(
			"pointer-events-none",
		);
	});
});

describe("getTitlebarRevealClass", () => {
	it("toggles between visible and hidden states", () => {
		expect(getTitlebarRevealClass(true)).toContain("opacity-100");
		expect(getTitlebarRevealClass(true)).not.toContain("opacity-0");
		expect(getTitlebarRevealClass(false)).toContain("opacity-0");
		expect(getTitlebarRevealClass(false)).toContain("focus-within:opacity-100");
	});
});

describe("window actions", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		// @ts-expect-error jsdom has no playerApi by default
		delete window.playerApi;
	});

	it("does nothing outside electron", () => {
		expect(() => {
			closeWindow();
			minimizeWindow();
			toggleMaximizeWindow();
		}).not.toThrow();
	});

	it("forwards to the electron window api", () => {
		const close = vi.fn();
		const minimize = vi.fn();
		const toggleMaximize = vi.fn();
		// @ts-expect-error stubbed preload bridge
		window.playerApi = {
			app: { isElectron: true },
			window: { close, minimize, toggleMaximize },
		};

		closeWindow();
		minimizeWindow();
		toggleMaximizeWindow();

		expect(close).toHaveBeenCalledOnce();
		expect(minimize).toHaveBeenCalledOnce();
		expect(toggleMaximize).toHaveBeenCalledOnce();
	});
});

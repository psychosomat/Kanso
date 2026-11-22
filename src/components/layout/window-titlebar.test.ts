// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerApi } from "@/lib/contracts";
import {
	closeWindow,
	getTitlebarRevealClass,
	getTitlebarShellClass,
	minimizeWindow,
	shouldHideTitlebar,
	shouldRevealTitlebar,
	toggleMaximizeWindow,
	WindowTitlebar,
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
	it("uses z-50 non-blocking in player and z-30 full-width in desktop modes", () => {
		expect(getTitlebarShellClass(true)).toContain("pointer-events-none");
		expect(getTitlebarShellClass(true)).toContain("z-50");
		expect(getTitlebarShellClass(true, "start")).toContain("left-0");
		expect(getTitlebarShellClass(true, "end")).toContain("right-0");
		expect(getTitlebarShellClass(false)).not.toContain("pointer-events-none");
		expect(getTitlebarShellClass(false)).toContain("z-30");
		expect(getTitlebarShellClass(false)).not.toContain("z-50");
		expect(getTitlebarShellClass(false, "start")).toContain("justify-start");
		expect(getTitlebarShellClass(false, "end")).toContain("justify-end");
		expect(getTitlebarShellClass(undefined)).not.toContain(
			"pointer-events-none",
		);
		expect(getTitlebarShellClass(undefined)).toContain("z-30");
	});
});

describe("WindowTitlebar nonBlocking HUD sync", () => {
	afterEach(() => {
		cleanup();
	});

	it("syncs caption button visibility with kanso:player-hud in nonBlocking mode", () => {
		render(
			createElement(WindowTitlebar, { mode: "windows", nonBlocking: true }),
		);
		const closeButton = screen.getByRole("button", { name: "Close window" });
		const controls = closeButton.parentElement;
		expect(controls?.className).toContain("opacity-0");

		act(() => {
			window.dispatchEvent(
				new CustomEvent("kanso:player-hud", { detail: { visible: true } }),
			);
		});
		expect(controls?.className).toContain("opacity-100");
		expect(controls?.className).toContain("pointer-events-auto");

		act(() => {
			window.dispatchEvent(
				new CustomEvent("kanso:player-hud", { detail: { visible: false } }),
			);
		});
		expect(controls?.className).toContain("opacity-0");
	});

	it("keeps a compact pointer-events-auto corner hover zone when nonBlocking", () => {
		render(createElement(WindowTitlebar, { mode: "macos", nonBlocking: true }));
		const hoverZone = screen.getByTestId("titlebar-hover-zone");
		const closeButton = screen.getByRole("button", { name: "Close window" });
		const controls = closeButton.parentElement;

		expect(hoverZone.className).toContain("pointer-events-auto");
		expect(hoverZone.className).toContain("window-no-drag");
		expect(hoverZone.className).toContain("w-32");
		expect(hoverZone.className).toContain("h-11");
		expect(hoverZone.className).toContain("left-0");
		expect(controls?.className).toContain("opacity-0");

		fireEvent.mouseEnter(hoverZone);
		expect(controls?.className).toContain("opacity-100");

		fireEvent.mouseLeave(hoverZone);
		expect(controls?.className).toContain("opacity-0");
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
		window.playerApi = {
			app: { isElectron: true },
			window: { close, minimize, toggleMaximize },
		} as unknown as PlayerApi;

		closeWindow();
		minimizeWindow();
		toggleMaximizeWindow();

		expect(close).toHaveBeenCalledOnce();
		expect(minimize).toHaveBeenCalledOnce();
		expect(toggleMaximize).toHaveBeenCalledOnce();
	});
});

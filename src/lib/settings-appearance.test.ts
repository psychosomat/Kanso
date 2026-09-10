import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ACCENT_STORAGE_KEY,
	applyAccentColor,
	applyNoiseOpacity,
	DEFAULT_ACCENT,
	getAccentColor,
	getNoiseOpacity,
	LEGACY_ACCENTS,
	NOISE_OPACITY_DEFAULT,
} from "./settings-appearance";

describe("settings-appearance defaults without DOM", () => {
	it("returns built-in defaults when window is missing", () => {
		expect(getNoiseOpacity()).toBe(NOISE_OPACITY_DEFAULT);
		expect(getAccentColor()).toBe(DEFAULT_ACCENT);
	});

	it("apply helpers are no-ops without DOM", () => {
		expect(() => applyNoiseOpacity(0.1)).not.toThrow();
		expect(() => applyAccentColor(DEFAULT_ACCENT)).not.toThrow();
	});

	it("treats known legacy accents as default", () => {
		expect(LEGACY_ACCENTS.has("#2f9bff")).toBe(true);
		expect(LEGACY_ACCENTS.has(DEFAULT_ACCENT.toLowerCase())).toBe(false);
	});
});

describe("settings-appearance with stubbed DOM", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubBrowser(initial: Record<string, string> = {}) {
		const store = new Map(Object.entries(initial));
		const setProperty = vi.fn();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, value: string) => {
					store.set(key, value);
				},
			},
		});
		vi.stubGlobal("document", {
			documentElement: { style: { setProperty } },
		});
		return { store, setProperty };
	}

	it("round-trips noise opacity through localStorage", () => {
		const { store, setProperty } = stubBrowser();
		applyNoiseOpacity(0.12);
		expect(store.get("player:noiseOpacity")).toBe("0.12");
		expect(setProperty).toHaveBeenCalledWith("--noise-opacity", "0.12");
		expect(getNoiseOpacity()).toBe(0.12);
	});

	it("migrates legacy accent colors to the default", () => {
		const { store } = stubBrowser({ [ACCENT_STORAGE_KEY]: "#2F9BFF" });
		expect(getAccentColor()).toBe(DEFAULT_ACCENT);
		expect(store.get(ACCENT_STORAGE_KEY)).toBe(DEFAULT_ACCENT);
	});

	it("keeps a custom accent color untouched", () => {
		const { store, setProperty } = stubBrowser();
		applyAccentColor("#123456");
		expect(store.get(ACCENT_STORAGE_KEY)).toBe("#123456");
		expect(setProperty).toHaveBeenCalledWith("--accent", "#123456");
		expect(getAccentColor()).toBe("#123456");
	});
});

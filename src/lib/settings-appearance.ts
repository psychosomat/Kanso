import { DEFAULT_PLAYER_PREFERENCES } from "./constants";

export const NOISE_STORAGE_KEY = "player:noiseOpacity";
export const ACCENT_STORAGE_KEY = "player:accentColor";
export const DEFAULT_ACCENT = DEFAULT_PLAYER_PREFERENCES.accentColor;
export const NOISE_OPACITY_DEFAULT = 0.09;
export const LEGACY_ACCENTS = new Set([
	"#c8883a",
	"#d6be8c",
	"#2f9bff",
	"#ff5a36",
]);

export function getNoiseOpacity(): number {
	if (typeof window === "undefined") {
		return NOISE_OPACITY_DEFAULT;
	}

	const stored = window.localStorage.getItem(NOISE_STORAGE_KEY);
	return stored !== null ? Number(stored) : NOISE_OPACITY_DEFAULT;
}

export function applyNoiseOpacity(value: number): void {
	if (typeof window === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--noise-opacity", String(value));
	window.localStorage.setItem(NOISE_STORAGE_KEY, String(value));
}

export function getAccentColor(): string {
	if (typeof window === "undefined") {
		return DEFAULT_ACCENT;
	}

	const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
	if (stored === null || LEGACY_ACCENTS.has(stored.toLowerCase())) {
		window.localStorage.setItem(ACCENT_STORAGE_KEY, DEFAULT_ACCENT);
		return DEFAULT_ACCENT;
	}
	return stored;
}

export function applyAccentColor(value: string): void {
	if (typeof window === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--accent", value);
	window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
}

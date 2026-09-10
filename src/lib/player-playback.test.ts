import { describe, expect, it } from "vitest";
import type { PlayableVideoDto } from "./contracts";
import {
	clampSeekTarget,
	clampVolume,
	isLibraryVideo,
	nextSpeedPreset,
	normalizePlaybackRate,
	resolveCurrentVolume,
} from "./player-playback";

describe("isLibraryVideo", () => {
	it("narrows library videos and rejects external ones", () => {
		expect(isLibraryVideo({ origin: "library" } as PlayableVideoDto)).toBe(
			true,
		);
		expect(isLibraryVideo({ origin: "external" } as PlayableVideoDto)).toBe(
			false,
		);
		expect(isLibraryVideo(null)).toBe(false);
	});
});

describe("normalizePlaybackRate", () => {
	it("rounds to one decimal", () => {
		expect(normalizePlaybackRate(1.234)).toBe(1.2);
		expect(normalizePlaybackRate(2.25)).toBe(2.3);
	});

	it("clamps to the 0.2–4 range", () => {
		expect(normalizePlaybackRate(0.05)).toBe(0.2);
		expect(normalizePlaybackRate(10)).toBe(4);
	});
});

describe("clampSeekTarget", () => {
	it("clamps into the duration window", () => {
		expect(clampSeekTarget(30, 120)).toBe(30);
		expect(clampSeekTarget(-5, 120)).toBe(0);
		expect(clampSeekTarget(200, 120)).toBe(120);
	});

	it("treats missing duration as zero", () => {
		expect(clampSeekTarget(10, 0)).toBe(0);
	});
});

describe("nextSpeedPreset", () => {
	it("cycles between primary and secondary presets", () => {
		expect(nextSpeedPreset(1, 1, 2.2)).toBe(2.2);
		expect(nextSpeedPreset(2.2, 1, 2.2)).toBe(1);
	});

	it("falls back to defaults when presets are missing", () => {
		expect(nextSpeedPreset(9, undefined, undefined)).toBe(1);
		expect(nextSpeedPreset(1, undefined, undefined)).toBe(2.2);
	});

	it("matches within epsilon before cycling", () => {
		expect(nextSpeedPreset(1.005, 1, 2.2)).toBe(2.2);
	});
});

describe("clampVolume", () => {
	it("clamps into the 0–1 range", () => {
		expect(clampVolume(0.5)).toBe(0.5);
		expect(clampVolume(-1)).toBe(0);
		expect(clampVolume(2)).toBe(1);
	});
});

describe("resolveCurrentVolume", () => {
	it("prefers the live element volume", () => {
		expect(
			resolveCurrentVolume({
				elementVolume: 0.7,
				elementMuted: false,
				prefMuted: false,
				prefVolume: 1,
			}),
		).toBe(0.7);
	});

	it("reports zero when the element is muted", () => {
		expect(
			resolveCurrentVolume({
				elementVolume: 0.7,
				elementMuted: true,
				prefMuted: false,
				prefVolume: 1,
			}),
		).toBe(0);
	});

	it("falls back to preferences without an element", () => {
		expect(
			resolveCurrentVolume({
				elementVolume: null,
				elementMuted: false,
				prefMuted: false,
				prefVolume: 0.4,
			}),
		).toBe(0.4);
		expect(
			resolveCurrentVolume({
				elementVolume: null,
				elementMuted: false,
				prefMuted: true,
				prefVolume: 0.4,
			}),
		).toBe(0);
	});
});

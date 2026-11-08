import { describe, expect, it } from "vitest";
import { getScanProgress, parseSpeedPreset } from "./settings";

describe("parseSpeedPreset", () => {
	it("parses and rounds to one decimal", () => {
		expect(parseSpeedPreset("1.5")).toBe(1.5);
		expect(parseSpeedPreset("2.25")).toBe(2.3);
	});

	it("clamps into the playback-rate range", () => {
		expect(parseSpeedPreset("0.05")).toBe(0.2);
		expect(parseSpeedPreset("10")).toBe(4);
	});

	it("rejects non-numeric input", () => {
		expect(parseSpeedPreset("abc")).toBeNull();
		expect(parseSpeedPreset("")).toBe(0.2);
	});
});

describe("getScanProgress", () => {
	it("rounds the scanned fraction to a percentage", () => {
		expect(getScanProgress({ scannedFiles: 1, totalFiles: 3 })).toBe(33);
		expect(getScanProgress({ scannedFiles: 25, totalFiles: 100 })).toBe(25);
	});

	it("returns null without a positive total", () => {
		expect(getScanProgress(null)).toBeNull();
		expect(getScanProgress(undefined)).toBeNull();
		expect(getScanProgress({ scannedFiles: 0, totalFiles: 0 })).toBeNull();
	});
});

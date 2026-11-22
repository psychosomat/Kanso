import { describe, expect, it } from "vitest";
import {
	folderDisplayName,
	formatDuration,
	shouldResume,
	slugify,
} from "./utils";

describe("utils", () => {
	it("slugifies names for categories", () => {
		expect(slugify("Sci Fi / Archive")).toBe("sci-fi-archive");
	});

	it("formats durations in player-friendly notation", () => {
		expect(formatDuration(0)).toBe("0:00");
		expect(formatDuration(0.8)).toBe("0:00");
		expect(formatDuration(65)).toBe("1:05");
		expect(formatDuration(3665)).toBe("1:01:05");
		expect(formatDuration(null)).toBe("Unknown");
		expect(formatDuration(undefined)).toBe("Unknown");
		expect(formatDuration(Number.NaN)).toBe("Unknown");
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("Unknown");
		expect(formatDuration(Number.NEGATIVE_INFINITY)).toBe("Unknown");
		expect(formatDuration(-1)).toBe("Unknown");
	});

	it("applies resume threshold rules", () => {
		expect(shouldResume(10, 500)).toBe(false);
		expect(shouldResume(120, 130)).toBe(false);
		expect(shouldResume(120, 500)).toBe(true);
	});

	it("takes the last segment as the folder display name", () => {
		expect(folderDisplayName("/media/trips")).toBe("trips");
		expect(folderDisplayName("C:\\media\\trips\\")).toBe("trips");
		expect(folderDisplayName("/")).toBe("/");
	});
});

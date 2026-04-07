import { describe, expect, it } from "vitest";
import { formatDuration, shouldResume, slugify } from "./utils";

describe("utils", () => {
	it("slugifies names for categories", () => {
		expect(slugify("Sci Fi / Archive")).toBe("sci-fi-archive");
	});

	it("formats durations in player-friendly notation", () => {
		expect(formatDuration(65)).toBe("1:05");
		expect(formatDuration(3665)).toBe("1:01:05");
	});

	it("applies resume threshold rules", () => {
		expect(shouldResume(10, 500)).toBe(false);
		expect(shouldResume(120, 130)).toBe(false);
		expect(shouldResume(120, 500)).toBe(true);
	});
});

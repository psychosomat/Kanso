import { describe, expect, it } from "vitest";
import { getDumpEmptyMessage, getDumpGridClassName } from "./dump";

describe("getDumpEmptyMessage", () => {
	it("explains an empty result caused by active filters", () => {
		expect(getDumpEmptyMessage(true)).toBe(
			"No videos match these filters. Try widening the search.",
		);
	});

	it("explains a fully organized library without filters", () => {
		expect(getDumpEmptyMessage(false)).toBe(
			"No unsorted videos. All videos have been organized into categories.",
		);
	});
});

describe("getDumpGridClassName", () => {
	it("uses a multi-column grid for the comfortable view", () => {
		expect(getDumpGridClassName("comfortable")).toBe(
			"grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
		);
	});

	it("uses a dense list grid for the compact view", () => {
		expect(getDumpGridClassName("compact")).toBe("grid gap-1 lg:grid-cols-2");
	});
});

import { describe, expect, it } from "vitest";
import {
	buildHomeDumpQuery,
	getDumpEmptyMessage,
	getDumpGridClassName,
	getDumpRefreshKey,
} from "./dump";

describe("buildHomeDumpQuery", () => {
	it("always excludes hidden-from-home content and keeps unsortedOnly enabled", () => {
		expect(
			buildHomeDumpQuery({
				search: "clip",
				sort: "recent",
				order: "desc",
				pageSize: 24,
				watched: "unwatched",
				resolution: "1080p",
				durationBucket: "short",
				codec: "h264",
			}),
		).toEqual({
			search: "clip",
			sort: "recent",
			order: "desc",
			page: 1,
			pageSize: 24,
			unsortedOnly: true,
			excludeHiddenFromHome: true,
			watched: "unwatched",
			resolutions: ["1080p"],
			codecVideo: "h264",
			durationBuckets: ["short"],
		});
	});
});

describe("getDumpRefreshKey", () => {
	it("changes when folder privacy changes or when scan reaches idle", () => {
		const base = getDumpRefreshKey([{ id: "s1", hiddenFromHome: false }], {
			status: "scanning",
			updatedAt: "2026-01-01T00:00:01Z",
		});
		const stillScanning = getDumpRefreshKey(
			[{ id: "s1", hiddenFromHome: false }],
			{ status: "scanning", updatedAt: "2026-01-01T00:00:02Z" },
		);
		const finishedIdle = getDumpRefreshKey(
			[{ id: "s1", hiddenFromHome: false }],
			{ status: "idle", updatedAt: "2026-01-01T00:00:03Z" },
		);
		const privacyToggled = getDumpRefreshKey(
			[{ id: "s1", hiddenFromHome: true }],
			{ status: "idle", updatedAt: "2026-01-01T00:00:03Z" },
		);
		expect(stillScanning).toBe(base);
		expect(finishedIdle).not.toBe(base);
		expect(privacyToggled).not.toBe(finishedIdle);
	});
});

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

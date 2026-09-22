import { describe, expect, it } from "vitest";
import { DEFAULT_DUMP_QUERY } from "./constants";
import {
	buildDumpQuery,
	hasActiveDumpFilters,
	toDuplicateIdSet,
} from "./dump-query";

describe("buildDumpQuery", () => {
	it("builds the default unsorted-only page query", () => {
		expect(
			buildDumpQuery({
				search: "",
				sort: DEFAULT_DUMP_QUERY.sort,
				order: DEFAULT_DUMP_QUERY.order,
				pageSize: DEFAULT_DUMP_QUERY.pageSize,
				watched: "all",
				resolution: "all",
				durationBucket: "all",
				codec: "",
			}),
		).toEqual({
			search: "",
			sort: "recent",
			order: "desc",
			page: 1,
			pageSize: 24,
			unsortedOnly: true,
			watched: "all",
			resolutions: undefined,
			codecVideo: undefined,
			durationBuckets: undefined,
		});
	});

	it("maps filter selections to query buckets", () => {
		expect(
			buildDumpQuery({
				search: "trips",
				sort: "name",
				order: "desc",
				pageSize: 24,
				watched: "unwatched",
				resolution: "1080p",
				durationBucket: "long",
				codec: " h264 ",
			}),
		).toEqual({
			search: "trips",
			sort: "name",
			order: "desc",
			page: 1,
			pageSize: 24,
			unsortedOnly: true,
			watched: "unwatched",
			resolutions: ["1080p"],
			codecVideo: "h264",
			durationBuckets: ["long"],
		});
	});
});

describe("hasActiveDumpFilters", () => {
	it("is inactive when every filter is at its default", () => {
		expect(
			hasActiveDumpFilters({
				search: "",
				watched: "all",
				resolution: "all",
				durationBucket: "all",
				codec: "",
			}),
		).toBe(false);
	});

	it("ignores whitespace-only input", () => {
		expect(
			hasActiveDumpFilters({
				search: "   ",
				watched: "all",
				resolution: "all",
				durationBucket: "all",
				codec: "  ",
			}),
		).toBe(false);
	});

	it("detects each active filter", () => {
		const base = {
			search: "",
			watched: "all" as const,
			resolution: "all" as const,
			durationBucket: "all" as const,
			codec: "",
		};
		expect(hasActiveDumpFilters({ ...base, search: "trips" })).toBe(true);
		expect(hasActiveDumpFilters({ ...base, watched: "watched" })).toBe(true);
		expect(hasActiveDumpFilters({ ...base, resolution: "4k" })).toBe(true);
		expect(hasActiveDumpFilters({ ...base, durationBucket: "short" })).toBe(
			true,
		);
		expect(hasActiveDumpFilters({ ...base, codec: "hevc" })).toBe(true);
	});
});

describe("toDuplicateIdSet", () => {
	it("collects member ids across groups", () => {
		expect(
			toDuplicateIdSet([
				{
					fileSize: 10,
					durationBucket: 1,
					memberCount: 2,
					memberIds: ["a", "b"],
				},
				{
					fileSize: 10,
					durationBucket: 1,
					memberCount: 2,
					memberIds: ["b", "c"],
				},
			]),
		).toEqual(new Set(["a", "b", "c"]));
	});

	it("returns an empty set without groups", () => {
		expect(toDuplicateIdSet([])).toEqual(new Set());
	});
});

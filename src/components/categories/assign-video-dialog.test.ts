import { describe, expect, it } from "vitest";
import type { VideoDetailDto } from "@/lib/contracts";
import { buildAssignPayload, buildInitialSelected } from "./assign-video-dialog";

function video(categories: Array<{ id: string; assigned: boolean }>): VideoDetailDto {
	return { categories } as unknown as VideoDetailDto;
}

describe("buildInitialSelected", () => {
	it("maps assigned category ids from the video", () => {
		expect(
			buildInitialSelected(
				video([
					{ id: "a", assigned: true },
					{ id: "b", assigned: false },
				]),
			),
		).toEqual({ a: true, b: false });
	});

	it("returns an empty map without a video", () => {
		expect(buildInitialSelected(null)).toEqual({});
	});
});

describe("buildAssignPayload", () => {
	const categories = [{ id: "a" }, { id: "b" }, { id: "c" }];

	it("keeps only selected categories in order", () => {
		expect(buildAssignPayload(categories, { a: true, c: true }, {})).toEqual([
			{ categoryId: "a", caption: undefined },
			{ categoryId: "c", caption: undefined },
		]);
	});

	it("trims captions and drops blank ones", () => {
		expect(
			buildAssignPayload(categories, { a: true, b: true }, { a: "  hello  ", b: "   " }),
		).toEqual([
			{ categoryId: "a", caption: "hello" },
			{ categoryId: "b", caption: undefined },
		]);
	});

	it("returns an empty payload when nothing is selected", () => {
		expect(buildAssignPayload(categories, {}, { a: "x" })).toEqual([]);
	});
});

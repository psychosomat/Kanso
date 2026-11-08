import { describe, expect, it } from "vitest";
import type { CategoryDto, VideoCardDto } from "@/lib/contracts";
import { buildPaletteEntries, nextActiveIndex } from "./command-palette";

function category(id: string, name: string): CategoryDto {
	return {
		id,
		name,
		slug: id,
		description: null,
		parentCategoryId: null,
		icon: "folder",
		postCount: 0,
		createdAt: "",
		updatedAt: "",
	};
}

function video(id: string, fileName: string): VideoCardDto {
	return {
		origin: "library",
		id,
		fileName,
		sourcePath: "",
		folderPath: "",
		durationSec: 12,
		width: null,
		height: null,
		modifiedAt: "",
		posterUrl: null,
		streamUrl: "",
		resumeSec: 0,
		lastPlayedAt: null,
		playCount: 0,
		exists: true,
		categoryCount: 0,
	};
}

describe("buildPaletteEntries", () => {
	it("keeps boards, videos and default actions in order with an empty query", () => {
		const entries = buildPaletteEntries([category("b1", "Travel")], [video("v1", "trip.mp4")], "");
		expect(entries.map((e) => e.kind)).toEqual(["board", "video", "action", "action", "action"]);
		expect(entries[0]).toMatchObject({ kind: "board", id: "b1", slug: "b1", name: "Travel" });
		expect(entries[1]).toMatchObject({ kind: "video", id: "v1", name: "trip.mp4", duration: 12 });
	});

	it("filters boards and actions case-insensitively but always keeps videos", () => {
		const entries = buildPaletteEntries(
			[category("b1", "Travel"), category("b2", "Cooking")],
			[video("v1", "trip.mp4")],
			"  OPEN  ",
		);
		expect(entries.filter((e) => e.kind === "board")).toEqual([]);
		expect(entries.filter((e) => e.kind === "video")).toHaveLength(1);
		expect(entries.filter((e) => e.kind === "action").map((e) => e.id)).toEqual(["settings"]);
	});

	it("caps boards at five", () => {
		const categories = Array.from({ length: 8 }, (_, i) => category(`b${i}`, `Board ${i}`));
		const entries = buildPaletteEntries(categories, [], "");
		expect(entries.filter((e) => e.kind === "board")).toHaveLength(5);
	});
});

describe("nextActiveIndex", () => {
	it("clamps downward navigation to the last entry", () => {
		expect(nextActiveIndex(0, 1, 3)).toBe(1);
		expect(nextActiveIndex(2, 1, 3)).toBe(2);
	});

	it("clamps upward navigation to the first entry", () => {
		expect(nextActiveIndex(2, -1, 3)).toBe(1);
		expect(nextActiveIndex(0, -1, 3)).toBe(0);
	});
});

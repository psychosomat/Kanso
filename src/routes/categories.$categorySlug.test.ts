// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	computeDropEdge,
	computeReorderedIds,
	feedSortStorageKey,
	readStoredSort,
} from "./categories.$categorySlug";

function stubStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
		clear: () => store.clear(),
	});
}

afterEach(() => vi.unstubAllGlobals());

describe("feedSortStorageKey", () => {
	it("scopes the key to the category slug", () => {
		expect(feedSortStorageKey("travel")).toBe("kanso:feed-sort:travel");
	});
});

describe("readStoredSort", () => {
	it("returns a supported stored sort", () => {
		stubStorage({ "kanso:feed-sort:travel": "manual" });
		expect(readStoredSort("travel")).toBe("manual");
	});

	it("falls back to newestPost for unknown or missing values", () => {
		stubStorage({ "kanso:feed-sort:travel": "bogus" });
		expect(readStoredSort("travel")).toBe("newestPost");
		expect(readStoredSort("other")).toBe("newestPost");
	});

	it("falls back when storage access throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("blocked");
			},
		});
		expect(readStoredSort("travel")).toBe("newestPost");
	});
});

describe("computeDropEdge", () => {
	it("uses the pointer position within the target", () => {
		const rect = { top: 100, height: 40 };
		expect(computeDropEdge(105, rect)).toBe("before");
		expect(computeDropEdge(135, rect)).toBe("after");
		expect(computeDropEdge(100, rect)).toBe("before");
	});
});

describe("computeReorderedIds", () => {
	const ids = ["a", "b", "c", "d"];

	it("moves the source before a later target", () => {
		expect(computeReorderedIds(ids, "a", "c", "before")).toEqual(["b", "a", "c", "d"]);
	});

	it("moves the source after a later target", () => {
		expect(computeReorderedIds(ids, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
	});

	it("moves the source after an earlier target", () => {
		expect(computeReorderedIds(ids, "d", "b", "after")).toEqual(["a", "b", "d", "c"]);
	});

	it("appends the source when the target is absent", () => {
		expect(computeReorderedIds(ids, "b", "missing", "after")).toEqual(["a", "c", "d", "b"]);
	});

	it("returns null for an absent source or a no-op move", () => {
		expect(computeReorderedIds(ids, "missing", "c", "after")).toBeNull();
		expect(computeReorderedIds(ids, "a", "b", "before")).toBeNull();
	});

	it("does not mutate the input", () => {
		computeReorderedIds(ids, "a", "d", "after");
		expect(ids).toEqual(["a", "b", "c", "d"]);
	});
});

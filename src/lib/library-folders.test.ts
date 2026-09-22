import { describe, expect, it } from "vitest";
import { findNewFolders } from "./library-folders";

describe("findNewFolders", () => {
	it("returns only folders absent from the previous paths", () => {
		expect(
			findNewFolders(["/media/a"], {
				sourcePaths: [{ path: "/media/a" }, { path: "/media/b" }],
			}),
		).toEqual(["/media/b"]);
	});

	it("returns an empty list when nothing was added", () => {
		expect(
			findNewFolders(["/media/a"], { sourcePaths: [{ path: "/media/a" }] }),
		).toEqual([]);
	});

	it("handles a cancelled folder dialog", () => {
		expect(findNewFolders(["/media/a"], null)).toEqual([]);
		expect(findNewFolders([], null)).toEqual([]);
	});
});

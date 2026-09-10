import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	getMimeType,
	isPathInsideRoot,
	isReadableAssetMethod,
	isValidByteRange,
	parseRangeHeader,
	shouldServeStaticAsset,
} from "./http-utils";

describe("getMimeType", () => {
	it("maps document and media extensions", () => {
		expect(getMimeType("index.html")).toBe("text/html; charset=utf-8");
		expect(getMimeType("bundle.js")).toBe("text/javascript; charset=utf-8");
		expect(getMimeType("style.css")).toBe("text/css; charset=utf-8");
		expect(getMimeType("clip.mp4")).toBe("video/mp4");
		expect(getMimeType("clip.TS")).toBe("video/mp2t");
	});

	it("falls back to octet-stream for unknown extensions", () => {
		expect(getMimeType("archive.xyz")).toBe("application/octet-stream");
		expect(getMimeType("no-extension")).toBe("application/octet-stream");
	});
});

describe("parseRangeHeader", () => {
	it("parses an explicit byte range", () => {
		expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
	});

	it("treats an open-ended range as lasting to the end of the file", () => {
		expect(parseRangeHeader("bytes=100-", 1000)).toEqual({
			start: 100,
			end: 999,
		});
	});

	it("rejects missing, foreign-unit, and unsatisfiable ranges", () => {
		expect(parseRangeHeader(null, 1000)).toBeNull();
		expect(parseRangeHeader("items=0-99", 1000)).toBeNull();
		expect(parseRangeHeader("bytes=200-100", 1000)).toBeNull();
		expect(parseRangeHeader("bytes=0-1000", 1000)).toBeNull();
		expect(parseRangeHeader("bytes=-", 1000)).toBeNull();
	});
});

describe("isValidByteRange", () => {
	it("accepts ranges fully inside the file", () => {
		expect(isValidByteRange(0, 0, 1)).toBe(true);
		expect(isValidByteRange(0, 999, 1000)).toBe(true);
	});

	it("rejects inverted, negative, and out-of-bounds ranges", () => {
		expect(isValidByteRange(5, 4, 1000)).toBe(false);
		expect(isValidByteRange(-1, 10, 1000)).toBe(false);
		expect(isValidByteRange(0, 1000, 1000)).toBe(false);
		expect(isValidByteRange(Number.NaN, 10, 1000)).toBe(false);
		expect(isValidByteRange(0, Number.NaN, 1000)).toBe(false);
	});
});

describe("isReadableAssetMethod", () => {
	it("allows only GET and HEAD", () => {
		expect(isReadableAssetMethod("GET")).toBe(true);
		expect(isReadableAssetMethod("HEAD")).toBe(true);
		expect(isReadableAssetMethod("POST")).toBe(false);
		expect(isReadableAssetMethod(undefined)).toBe(false);
	});
});

describe("isPathInsideRoot", () => {
	const root = path.join(path.sep, "app", "dist");

	it("accepts files directly under the root", () => {
		expect(isPathInsideRoot(root, path.join(root, "assets", "app.js"))).toBe(
			true,
		);
	});

	it("rejects traversal outside the root and sibling-prefix lookalikes", () => {
		expect(isPathInsideRoot(root, path.join(root, "..", "secret"))).toBe(false);
		expect(isPathInsideRoot(root, `${root}-other`)).toBe(false);
		expect(isPathInsideRoot(root, root)).toBe(false);
	});
});

describe("shouldServeStaticAsset", () => {
	const root = path.join(path.sep, "app", "dist");
	const asset = path.join(root, "assets", "app.js");

	it("serves an existing in-root file for GET", () => {
		expect(
			shouldServeStaticAsset("GET", "assets/app.js", asset, root, true),
		).toBe(true);
	});

	it("refuses directory roots, missing files, and escaping paths", () => {
		expect(shouldServeStaticAsset("GET", "", root, root, true)).toBe(false);
		expect(
			shouldServeStaticAsset("GET", "assets/app.js", asset, root, false),
		).toBe(false);
		expect(
			shouldServeStaticAsset(
				"GET",
				"../secret",
				path.join(root, "..", "secret"),
				root,
				true,
			),
		).toBe(false);
		expect(
			shouldServeStaticAsset("POST", "assets/app.js", asset, root, true),
		).toBe(false);
	});
});

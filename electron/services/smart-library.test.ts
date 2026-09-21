import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	allowExternalMediaPath,
	buildDumpFilter,
	escapeLike,
	isAllowedExternalMediaPath,
	resolveMediaPath,
	sha1Name,
} from "./smart-library";

describe("escapeLike", () => {
	it("escapes LIKE metacharacters and quotes", () => {
		expect(escapeLike("100%_x")).toBe("100\\%\\_x");
		expect(escapeLike('say "hi"')).toBe('say \\"hi\\"');
		expect(escapeLike("a/b\\c")).toBe("a\\/b\\\\c");
		expect(escapeLike("plain")).toBe("plain");
	});
});

describe("buildDumpFilter", () => {
	it("binds user input as parameters instead of interpolating it", () => {
		const filter = buildDumpFilter({
			search: '100%; DROP TABLE videos; -- "x"',
			sort: "recent",
			order: "desc",
			page: 1,
			pageSize: 24,
			unsortedOnly: true,
			watched: "unwatched",
			resolutions: ["1080p"],
			codecVideo: "hevc",
			durationBuckets: ["long"],
			minDurationSec: 60,
		});
		expect(filter.where).not.toContain("DROP TABLE");
		expect(filter.where).toContain("@search");
		expect(filter.where).toContain("NOT EXISTS");
		expect(filter.where).toContain("last_played_at IS NULL");
		expect(filter.where).toContain("@codecVideo");
		expect(filter.where).toContain("@minDurationSec");
		expect(filter.params.search).toBe(
			`%100\\%; DROP TABLE videos; -- \\"x\\"%`,
		);
	});

	it("returns an empty filter for a bare query", () => {
		const filter = buildDumpFilter({
			search: "   ",
			sort: "recent",
			order: "desc",
			page: 1,
			pageSize: 24,
		});
		expect(filter.where).toBe("");
		expect(filter.params).toEqual({});
	});
});

describe("sha1Name", () => {
	it("is a stable hex digest without raw path fragments", () => {
		const first = sha1Name("a;rm -rf ~.mkv");
		expect(first).toMatch(/^[0-9a-f]{40}$/);
		expect(first).toBe(sha1Name("a;rm -rf ~.mkv"));
		expect(sha1Name("other.mkv")).not.toBe(first);
		expect(sha1Name("/media/a.mkv", "-mtime.jpg")).toContain("-mtime.jpg");
	});
});

describe("resolveMediaPath", () => {
	let libraryRoot: string;
	let outsideRoot: string;
	let transmuxDir: string;

	beforeEach(() => {
		const base = fs.mkdtempSync(path.join(os.tmpdir(), "kanso-gate-"));
		libraryRoot = path.join(base, "library");
		outsideRoot = path.join(base, "outside");
		transmuxDir = path.join(base, "transmux");
		fs.mkdirSync(libraryRoot, { recursive: true });
		fs.mkdirSync(outsideRoot, { recursive: true });
		fs.mkdirSync(transmuxDir, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(path.dirname(libraryRoot), { recursive: true, force: true });
	});

	function gate(extra: Record<string, unknown> = {}) {
		return {
			libraryRoots: [libraryRoot],
			transmuxDir,
			isKnownSourcePath: () => false,
			isAllowedExternalPath: isAllowedExternalMediaPath,
			...extra,
		};
	}

	it("serves a hostile-but-valid name inside the library without executing it", () => {
		const hostile = path.join(libraryRoot, "a;rm -rf ~.mkv");
		fs.writeFileSync(hostile, "fake-video");
		expect(resolveMediaPath(hostile, gate())).toBe(fs.realpathSync(hostile));
	});

	it("rejects directory traversal outside the library", () => {
		const outside = path.join(outsideRoot, "secret.mkv");
		fs.writeFileSync(outside, "fake-video");
		const traversal = path.join(libraryRoot, "..", "outside", "secret.mkv");
		expect(() => resolveMediaPath(traversal, gate())).toThrow(
			/outside the library/,
		);
	});

	it("rejects symlinks that escape the library", () => {
		const outside = path.join(outsideRoot, "real.mkv");
		fs.writeFileSync(outside, "fake-video");
		const link = path.join(libraryRoot, "link.mkv");
		fs.symlinkSync(outside, link);
		expect(() => resolveMediaPath(link, gate())).toThrow(/outside the library/);
	});

	it("rejects unsupported types and missing files", () => {
		const text = path.join(libraryRoot, "notes.txt");
		fs.writeFileSync(text, "hello");
		expect(() => resolveMediaPath(text, gate())).toThrow(/Unsupported/);
		expect(() =>
			resolveMediaPath(path.join(libraryRoot, "ghost.mkv"), gate()),
		).toThrow(/not found/);
	});

	it("allows explicitly opened external files and transmuxed cache hits", () => {
		const outside = path.join(outsideRoot, "external.mkv");
		fs.writeFileSync(outside, "fake-video");
		expect(() => resolveMediaPath(outside, gate())).toThrow();
		allowExternalMediaPath(outside);
		expect(resolveMediaPath(outside, gate())).toBe(fs.realpathSync(outside));

		const cached = path.join(transmuxDir, "cached.mp4");
		fs.writeFileSync(cached, "fake-video");
		expect(resolveMediaPath(cached, gate())).toBe(fs.realpathSync(cached));
	});

	it("allows DB-indexed paths even when roots change", () => {
		const outside = path.join(outsideRoot, "indexed.mkv");
		fs.writeFileSync(outside, "fake-video");
		const withKnown = gate({ isKnownSourcePath: () => true });
		expect(resolveMediaPath(outside, withKnown)).toBe(fs.realpathSync(outside));
	});
});

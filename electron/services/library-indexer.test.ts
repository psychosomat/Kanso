import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./media-metadata", () => ({
	probeMedia: vi.fn(),
	EMPTY_METADATA: {
		durationSec: null,
		width: null,
		height: null,
		fps: null,
		codecVideo: null,
		codecAudio: null,
		bitrate: null,
	},
}));

import { DatabaseService } from "./db";
import { isSupportedVideo, LibraryIndexerService } from "./library-indexer";
import { probeMedia } from "./media-metadata";
import type { PosterCacheService } from "./poster-cache";

const stubPosterCache = {
	ensurePoster: async () => null,
} as unknown as PosterCacheService;

function makeServices(tempDir: string) {
	const db = new DatabaseService(path.join(tempDir, "player.db"));
	const indexer = new LibraryIndexerService(db, stubPosterCache);
	return { db, indexer };
}

describe("isSupportedVideo", () => {
	it("accepts every claimed extension, case-insensitively", async () => {
		const { SUPPORTED_VIDEO_EXTENSIONS } = await import(
			"../../src/lib/constants"
		);
		for (const ext of SUPPORTED_VIDEO_EXTENSIONS) {
			expect(isSupportedVideo(`clip${ext}`)).toBe(true);
			expect(isSupportedVideo(`clip${ext.toUpperCase()}`)).toBe(true);
		}
	});

	it("rejects non-video files", () => {
		expect(isSupportedVideo("clip.txt")).toBe(false);
		expect(isSupportedVideo("clip.mp3")).toBe(false);
		expect(isSupportedVideo("clip.srt")).toBe(false);
		expect(isSupportedVideo("no-extension")).toBe(false);
	});
});

describe("LibraryIndexerService.fullScanAll", () => {
	let tempDir: string;
	let root: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kanso-scan-"));
		root = path.join(tempDir, "videos");
		fs.mkdirSync(root, { recursive: true });
		vi.mocked(probeMedia).mockResolvedValue({
			durationSec: 10,
			width: 1920,
			height: 1080,
			fps: 30,
			codecVideo: "h264",
			codecAudio: "aac",
			bitrate: 1000,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("indexes mkv files found in folders", async () => {
		fs.writeFileSync(path.join(root, "movie.mkv"), "fake-video");
		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root]);
			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.items.map((item) => item.fileName)).toContain("movie.mkv");
		} finally {
			db.close();
		}
	});

	it("keeps scanning remaining files when probing one file fails", async () => {
		fs.writeFileSync(path.join(root, "a.mkv"), "fake-video");
		fs.writeFileSync(path.join(root, "b.mp4"), "fake-video");
		fs.writeFileSync(path.join(root, "c.webm"), "fake-video");
		vi.mocked(probeMedia).mockRejectedValue(new Error("ffprobe boom"));

		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root]);
			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.total).toBe(3);
			expect(db.getLibrarySettings().scanStatus).toBe("idle");
		} finally {
			db.close();
		}
	});

	it("does not fail the whole scan when a source folder is missing", async () => {
		fs.writeFileSync(path.join(root, "movie.mkv"), "fake-video");
		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root, path.join(tempDir, "gone")]);
			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.items.map((item) => item.fileName)).toContain("movie.mkv");
		} finally {
			db.close();
		}
	});
});

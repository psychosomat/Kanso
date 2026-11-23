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
import { FileWatchService } from "./file-watch";
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

	it("deletes videos removed from an existing folder during rescan while preserving unplugged folders", async () => {
		const disconnectedRoot = path.join(tempDir, "usb-drive");
		fs.mkdirSync(disconnectedRoot, { recursive: true });
		const localFile = path.join(root, "local.mkv");
		const goneFile = path.join(root, "deleted.mkv");
		const usbFile = path.join(disconnectedRoot, "usb.mkv");
		fs.writeFileSync(localFile, "fake-video");
		fs.writeFileSync(goneFile, "fake-video");
		fs.writeFileSync(usbFile, "fake-video");

		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root, disconnectedRoot]);
			expect(
				db.getDumpPage({
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 24,
				}).total,
			).toBe(3);

			// Delete one file from present root, and unplug the entire USB root.
			fs.rmSync(goneFile);
			fs.rmSync(disconnectedRoot, { recursive: true, force: true });

			await indexer.fullScanAll([root, disconnectedRoot]);
			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.total).toBe(2);
			expect(page.items.map((item) => item.fileName).sort()).toEqual([
				"local.mkv",
				"usb.mkv",
			]);
		} finally {
			db.close();
		}
	});

	it("removes unlinked files via removeVideoByPath and publishes library change events", async () => {
		const file = path.join(root, "watched.mkv");
		fs.writeFileSync(file, "fake-video");

		let capturedOnUnlink: ((filePath: string) => void) | undefined;
		const startSpy = vi
			.spyOn(FileWatchService.prototype, "start")
			.mockImplementation(async (_sourcePath, callbacks) => {
				capturedOnUnlink = callbacks.onUnlink;
			});
		const stopSpy = vi
			.spyOn(FileWatchService.prototype, "stop")
			.mockResolvedValue(undefined);

		const { db, indexer } = makeServices(tempDir);
		const statuses: Array<{ status: string; stage: string; message: string }> =
			[];
		const unsubscribe = indexer.subscribe((status) => {
			statuses.push({
				status: status.status,
				stage: status.stage,
				message: status.message,
			});
		});

		try {
			await indexer.fullScanAll([root]);
			await indexer.configureWatches([root]);
			expect(capturedOnUnlink).toBeTypeOf("function");

			capturedOnUnlink?.(file);
			await vi.waitFor(() => {
				expect(
					db.getDumpPage({
						sort: "recent",
						order: "desc",
						page: 1,
						pageSize: 24,
					}).total,
				).toBe(0);
			});

			indexer.publishLibraryChanged("Folder visibility updated");
			expect(statuses[statuses.length - 1]).toEqual({
				status: "idle",
				stage: "watch",
				message: "Folder visibility updated",
			});
		} finally {
			unsubscribe();
			startSpy.mockRestore();
			stopSpy.mockRestore();
			db.close();
		}
	});

	it("removes videos from folders no longer in sourcePaths during rescan while preserving disconnected active roots", async () => {
		const removedRoot = path.join(tempDir, "old-removed");
		const unpluggedRoot = path.join(tempDir, "usb-active");
		fs.mkdirSync(removedRoot, { recursive: true });
		fs.mkdirSync(unpluggedRoot, { recursive: true });
		fs.writeFileSync(path.join(root, "keep.mkv"), "fake-video");
		fs.writeFileSync(path.join(removedRoot, "stale.mkv"), "fake-video");
		fs.writeFileSync(path.join(unpluggedRoot, "usb.mkv"), "fake-video");

		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root, removedRoot, unpluggedRoot]);
			expect(
				db.getDumpPage({
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 24,
				}).total,
			).toBe(3);

			// Unplug one active root and drop removedRoot from the scan list.
			fs.rmSync(unpluggedRoot, { recursive: true, force: true });
			await indexer.fullScanAll([root, unpluggedRoot]);

			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.items.map((item) => item.fileName).sort()).toEqual([
				"keep.mkv",
				"usb.mkv",
			]);

			// Rescanning with no configured scan folders clears all remaining videos.
			await indexer.fullScanAll([]);
			expect(
				db.getDumpPage({
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 24,
				}).total,
			).toBe(0);
		} finally {
			db.close();
		}
	});

	it("preserves videos in other folders when scanning a single newly added folder", async () => {
		const secondRoot = path.join(tempDir, "second");
		fs.mkdirSync(secondRoot, { recursive: true });
		fs.writeFileSync(path.join(root, "first.mkv"), "fake-video");
		fs.writeFileSync(path.join(secondRoot, "second.mkv"), "fake-video");

		const { db, indexer } = makeServices(tempDir);
		try {
			await indexer.fullScanAll([root]);
			await indexer.fullScan(secondRoot);

			const page = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 24,
			});
			expect(page.items.map((item) => item.fileName).sort()).toEqual([
				"first.mkv",
				"second.mkv",
			]);
		} finally {
			db.close();
		}
	});
});

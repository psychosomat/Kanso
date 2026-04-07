import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "./db";

describe("DatabaseService", () => {
	let tempDir: string;
	let db: DatabaseService;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "player-db-"));
		db = new DatabaseService(path.join(tempDir, "player.db"));
	});

	afterEach(() => {
		db.close();
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it("upserts videos by path and updates metadata", () => {
		const videoId = db.upsertVideo({
			sourcePath: "C:\\library\\clip.mp4",
			fileName: "clip.mp4",
			folderPath: "C:\\library",
			fileSize: 100,
			modifiedAt: "2026-04-05T00:00:00.000Z",
			durationSec: 10,
			width: 1920,
			height: 1080,
			fps: 30,
			codecVideo: "h264",
			codecAudio: "aac",
			bitrate: 1000,
			posterPath: null,
		});

		const sameVideoId = db.upsertVideo({
			sourcePath: "C:\\library\\clip.mp4",
			fileName: "clip.mp4",
			folderPath: "C:\\library",
			fileSize: 200,
			modifiedAt: "2026-04-06T00:00:00.000Z",
			durationSec: 20,
			width: 1280,
			height: 720,
			fps: 24,
			codecVideo: "hevc",
			codecAudio: "aac",
			bitrate: 2000,
			posterPath: "C:\\cache\\poster.jpg",
		});

		expect(sameVideoId).toBe(videoId);
		const video = db.getVideoById(videoId);
		expect(video?.durationSec).toBe(20);
		expect(video?.width).toBe(1280);
		expect(video?.posterUrl).toBe(`player-media://poster/${videoId}`);
	});

	it("creates unique category slugs", () => {
		const first = db.createCategory({ name: "Highlights" });
		const second = db.createCategory({ name: "Highlights#" });

		expect(first.slug).toBe("highlights");
		expect(second.slug).toBe("highlights-2");
	});

	it("returns the existing source path row when adding a duplicate library folder", () => {
		const first = db.addLibrarySourcePath("C:\\library");
		const second = db.addLibrarySourcePath("C:\\library");

		expect(second.id).toBe(first.id);
		expect(second.path).toBe(first.path);
	});

	it("returns category feeds ordered by newest post", () => {
		const videoOne = db.upsertVideo({
			sourcePath: "C:\\library\\a.mp4",
			fileName: "a.mp4",
			folderPath: "C:\\library",
			fileSize: 100,
			modifiedAt: "2026-04-05T00:00:00.000Z",
			durationSec: 10,
			width: 1920,
			height: 1080,
			fps: 30,
			codecVideo: "h264",
			codecAudio: "aac",
			bitrate: 1000,
			posterPath: null,
		});
		const videoTwo = db.upsertVideo({
			sourcePath: "C:\\library\\b.mp4",
			fileName: "b.mp4",
			folderPath: "C:\\library",
			fileSize: 100,
			modifiedAt: "2026-04-06T00:00:00.000Z",
			durationSec: 10,
			width: 1920,
			height: 1080,
			fps: 30,
			codecVideo: "h264",
			codecAudio: "aac",
			bitrate: 1000,
			posterPath: null,
		});
		const category = db.createCategory({ name: "Archive" });
		db.addVideoToCategories({
			videoId: videoOne,
			categories: [{ categoryId: category.id, caption: "older" }],
		});
		db.addVideoToCategories({
			videoId: videoTwo,
			categories: [{ categoryId: category.id, caption: "newer" }],
		});

		const feed = db.getCategoryFeed({
			categoryId: category.id,
			page: 1,
			pageSize: 10,
			sort: "newestPost",
		});

		expect(feed.items[0]?.video.id).toBe(videoTwo);
		expect(feed.items[1]?.video.id).toBe(videoOne);
	});

	it("filters unsorted videos before pagination", () => {
		const categorizedCategory = db.createCategory({ name: "Sorted" });

		for (let index = 0; index < 30; index += 1) {
			const videoId = db.upsertVideo({
				sourcePath: `C:\\library\\video-${index}.mp4`,
				fileName: `video-${index}.mp4`,
				folderPath: "C:\\library",
				fileSize: 100,
				modifiedAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
				durationSec: 10,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});

			if (index >= 6) {
				db.addVideoToCategories({
					videoId,
					categories: [{ categoryId: categorizedCategory.id }],
				});
			}
		}

		const page = db.getDumpPage({
			search: "",
			sort: "recent",
			order: "desc",
			page: 1,
			pageSize: 24,
			unsortedOnly: true,
		});

		expect(page.total).toBe(6);
		expect(page.items).toHaveLength(6);
		expect(page.items.every((video) => video.categoryCount === 0)).toBe(true);
	});
});

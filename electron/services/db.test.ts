import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseService } from "./db";

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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
		expect(video?.posterUrl).toBe(`file://C:\\cache\\poster.jpg`);
	});

	it("creates unique category slugs", () => {
		const first = db.createCategory({ name: "Highlights" });
		const second = db.createCategory({ name: "Highlights#" });

		expect(first.slug).toBe("highlights");
		expect(second.slug).toBe("highlights-2");
	});

	it("removes a category and its posts while promoting children and keeping videos", () => {
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
		const parent = db.createCategory({ name: "Parent" });
		const child = db.createCategory({
			name: "Child",
			parentCategoryId: parent.id,
		});
		const survivor = db.createCategory({ name: "Survivor" });
		db.addVideoToCategories({
			videoId,
			categories: [{ categoryId: parent.id }, { categoryId: survivor.id }],
		});

		db.removeCategory(parent.id);

		const remaining = db.listCategories();
		expect(remaining.map((category) => category.id)).toEqual([
			child.id,
			survivor.id,
		]);
		expect(
			remaining.find((category) => category.id === child.id)?.parentCategoryId,
		).toBeNull();
		expect(
			remaining.find((category) => category.id === survivor.id)?.postCount,
		).toBe(1);
		expect(db.getVideoById(videoId)?.assignedCategoryCount).toBe(1);
		expect(
			db
				.getDumpPage({
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 10,
				})
				.items.find((item) => item.id === videoId)?.categoryCount,
		).toBe(1);
		expect(() =>
			db.getCategoryFeed({
				categoryId: parent.id,
				page: 1,
				pageSize: 10,
				sort: "newestPost",
			}),
		).toThrow("Category not found.");
	});

	it("returns the existing source path row when adding a duplicate library folder", () => {
		const first = db.addLibrarySourcePath("C:\\library");
		const second = db.addLibrarySourcePath("C:\\library");

		expect(second.id).toBe(first.id);
		expect(second.path).toBe(first.path);
	});

	it("returns category feeds ordered by newest post", async () => {
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
		await sleep(5);
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

	it("appends new posts to the end and respects manual reorder", async () => {
		const category = db.createCategory({ name: "Manual" });
		const videoA = db.upsertVideo({
			sourcePath: "C:\\library\\a.mp4",
			fileName: "a.mp4",
			folderPath: "C:\\library",
			fileSize: 1,
			modifiedAt: "2026-04-01T00:00:00.000Z",
			durationSec: 1,
			width: 1,
			height: 1,
			fps: 1,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
			posterPath: null,
		});
		const videoB = db.upsertVideo({
			sourcePath: "C:\\library\\b.mp4",
			fileName: "b.mp4",
			folderPath: "C:\\library",
			fileSize: 1,
			modifiedAt: "2026-04-02T00:00:00.000Z",
			durationSec: 1,
			width: 1,
			height: 1,
			fps: 1,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
			posterPath: null,
		});
		const videoC = db.upsertVideo({
			sourcePath: "C:\\library\\c.mp4",
			fileName: "c.mp4",
			folderPath: "C:\\library",
			fileSize: 1,
			modifiedAt: "2026-04-03T00:00:00.000Z",
			durationSec: 1,
			width: 1,
			height: 1,
			fps: 1,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
			posterPath: null,
		});

		db.addVideoToCategories({
			videoId: videoA,
			categories: [{ categoryId: category.id }],
		});
		db.addVideoToCategories({
			videoId: videoB,
			categories: [{ categoryId: category.id }],
		});
		db.addVideoToCategories({
			videoId: videoC,
			categories: [{ categoryId: category.id }],
		});

		const initial = db.getCategoryFeed({
			categoryId: category.id,
			page: 1,
			pageSize: 100,
			sort: "manual",
		});
		const ids = initial.items.map((p) => p.id);
		expect(initial.items.map((p) => p.video.id)).toEqual([
			videoA,
			videoB,
			videoC,
		]);

		// Reverse the order manually.
		db.reorderCategoryPosts({
			categoryId: category.id,
			postIds: ids.slice().reverse(),
		});
		const reversed = db.getCategoryFeed({
			categoryId: category.id,
			page: 1,
			pageSize: 100,
			sort: "manual",
		});
		expect(reversed.items.map((p) => p.video.id)).toEqual([
			videoC,
			videoB,
			videoA,
		]);
	});

	it("creates a playlist from a folder with its videos", () => {
		const seed = (sourcePath: string, fileName: string, folderPath: string) =>
			db.upsertVideo({
				sourcePath,
				fileName,
				folderPath,
				fileSize: 1,
				modifiedAt: "2026-04-03T00:00:00.000Z",
				durationSec: 1,
				width: 1,
				height: 1,
				fps: 1,
				codecVideo: null,
				codecAudio: null,
				bitrate: null,
				posterPath: null,
			});
		const one = seed("/media/trips/b.mp4", "b.mp4", "/media/trips");
		const two = seed("/media/trips/a.mp4", "a.mp4", "/media/trips");
		const nested = seed(
			"/media/trips/2024/c.mp4",
			"c.mp4",
			"/media/trips/2024",
		);
		const sibling = seed("/media/trips2/d.mp4", "d.mp4", "/media/trips2");
		const missing = seed("/media/trips/gone.mp4", "gone.mp4", "/media/trips");
		db.markVideoMissingByPath("/media/trips/gone.mp4");

		const playlist = db.createCategoryFromFolder({
			name: "Trips",
			folderPath: "/media/trips",
		});

		expect(playlist.name).toBe("Trips");
		expect(playlist.postCount).toBe(3);
		const feed = db.getCategoryFeed({
			categoryId: playlist.id,
			page: 1,
			pageSize: 100,
			sort: "manual",
		});
		expect(feed.items.map((item) => item.video.id)).toEqual([two, one, nested]);
		expect(feed.items.map((item) => item.video.id)).not.toContain(sibling);
		expect(feed.items.map((item) => item.video.id)).not.toContain(missing);
	});

	it("creates a folder playlist as a sub-playlist", () => {
		db.upsertVideo({
			sourcePath: "/media/music/a.mp4",
			fileName: "a.mp4",
			folderPath: "/media/music",
			fileSize: 1,
			modifiedAt: "2026-04-03T00:00:00.000Z",
			durationSec: 1,
			width: 1,
			height: 1,
			fps: 1,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
			posterPath: null,
		});
		const parent = db.createCategory({ name: "Media" });
		const child = db.createCategoryFromFolder({
			name: "Music",
			parentCategoryId: parent.id,
			folderPath: "/media/music",
		});

		expect(child.parentCategoryId).toBe(parent.id);
		expect(child.postCount).toBe(1);
	});

	describe("continue watching", () => {
		function seedProgress(
			fileName: string,
			durationSec: number | null,
			fileSize = 100,
		) {
			return db.upsertVideo({
				sourcePath: `C:\\library\\${fileName}`,
				fileName,
				folderPath: "C:\\library",
				fileSize,
				modifiedAt: "2026-04-05T00:00:00.000Z",
				durationSec,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});
		}

		it("excludes never-played videos and zero resume", () => {
			const fresh = seedProgress("fresh.mp4", 1000);
			expect(db.getContinueWatching()).toHaveLength(0);
			db.saveProgress(fresh, 0);
			expect(db.getContinueWatching()).toHaveLength(0);
		});

		it("includes half-watched videos newest first", async () => {
			const first = seedProgress("first.mp4", 1000);
			const second = seedProgress("second.mp4", 1000);
			db.saveProgress(first, 500);
			await sleep(5);
			db.saveProgress(second, 600);
			expect(db.getContinueWatching().map((video) => video.id)).toEqual([
				second,
				first,
			]);
		});

		it("excludes credits, near-complete and finished videos", () => {
			const credits = seedProgress("credits.mp4", 100);
			db.saveProgress(credits, 90);
			const almostDone = seedProgress("almost.mp4", 1000);
			db.saveProgress(almostDone, 960);
			const finished = seedProgress("finished.mp4", 100);
			db.markPlayed(finished, true);
			expect(db.getContinueWatching()).toHaveLength(0);
		});

		it("keeps videos with unknown duration once started", () => {
			const unknown = seedProgress("unknown.mp4", null);
			db.saveProgress(unknown, 30);
			expect(db.getContinueWatching().map((video) => video.id)).toEqual([
				unknown,
			]);
		});

		it("does not bump play_count on progress ticks", () => {
			const video = seedProgress("ticks.mp4", 1000);
			db.saveProgress(video, 100);
			db.saveProgress(video, 200);
			db.saveProgress(video, 300);
			expect(db.getVideoById(video)?.playCount).toBe(0);
			db.markPlayed(video, false);
			expect(db.getVideoById(video)?.playCount).toBe(1);
		});

		it("resets resume when marked completed", () => {
			const video = seedProgress("reset.mp4", 1000);
			db.saveProgress(video, 500);
			db.markPlayed(video, true);
			const detail = db.getVideoById(video);
			expect(detail?.resumeSec).toBe(0);
			expect(db.getContinueWatching()).toHaveLength(0);
		});
	});

	describe("recently added", () => {
		it("returns newest indexed videos first and respects the limit", async () => {
			const first = db.upsertVideo({
				sourcePath: "C:\\library\\old.mp4",
				fileName: "old.mp4",
				folderPath: "C:\\library",
				fileSize: 100,
				modifiedAt: "2026-04-01T00:00:00.000Z",
				durationSec: 10,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});
			await sleep(5);
			const second = db.upsertVideo({
				sourcePath: "C:\\library\\new.mp4",
				fileName: "new.mp4",
				folderPath: "C:\\library",
				fileSize: 100,
				modifiedAt: "2026-04-02T00:00:00.000Z",
				durationSec: 10,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});

			expect(db.getRecentlyAdded().map((video) => video.id)).toEqual([
				second,
				first,
			]);
			expect(db.getRecentlyAdded(1).map((video) => video.id)).toEqual([second]);
		});
	});

	describe("dump search and filters", () => {
		function seedSearch(
			fileName: string,
			overrides: {
				width?: number | null;
				height?: number | null;
				codecVideo?: string | null;
				durationSec?: number | null;
			} = {},
		) {
			return db.upsertVideo({
				sourcePath: `C:\\library\\${fileName}`,
				fileName,
				folderPath: "C:\\library",
				fileSize: 100,
				modifiedAt: "2026-04-05T00:00:00.000Z",
				durationSec: overrides.durationSec ?? 60,
				width: overrides.width ?? 1920,
				height: overrides.height ?? 1080,
				fps: 30,
				codecVideo: overrides.codecVideo ?? "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});
		}

		function searchIds(search: string) {
			return db
				.getDumpPage({
					search,
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 100,
				})
				.items.map((video) => video.id);
		}

		it("treats LIKE metacharacters literally", () => {
			const tricky = seedSearch("100%_hits.mp4");
			seedSearch("1000.mp4");
			const quoted = seedSearch('say "hi".mp4');

			expect(searchIds("100%")).toEqual([tricky]);
			expect(searchIds("%")).toEqual([tricky]);
			expect(searchIds("100%_hits")).toEqual([tricky]);
			expect(searchIds('"hi"')).toEqual([quoted]);
		});

		it("keeps COUNT consistent across pages", () => {
			for (let index = 0; index < 25; index += 1) {
				seedSearch(`paged-${index}.mp4`);
			}
			const base = {
				search: "",
				sort: "recent" as const,
				order: "desc" as const,
				pageSize: 10,
			};
			const first = db.getDumpPage({ ...base, page: 1 });
			const second = db.getDumpPage({ ...base, page: 2 });
			const third = db.getDumpPage({ ...base, page: 3 });
			expect(first.total).toBe(25);
			expect(first.items).toHaveLength(10);
			expect(second.items).toHaveLength(10);
			expect(third.items).toHaveLength(5);
			const seen = new Set(
				[...first.items, ...second.items, ...third.items].map(
					(video) => video.id,
				),
			);
			expect(seen.size).toBe(25);
		});

		it("filters unwatched 1080p videos by codec and duration", () => {
			const target = seedSearch("target.mp4", {
				width: 1920,
				height: 1080,
				codecVideo: "hevc",
				durationSec: 3600,
			});
			const watched = seedSearch("watched.mp4", {
				width: 1920,
				height: 1080,
				codecVideo: "hevc",
				durationSec: 3600,
			});
			db.saveProgress(watched, 100);
			seedSearch("small.mp4", {
				width: 1280,
				height: 720,
				codecVideo: "h264",
				durationSec: 60,
			});

			const page = db.getDumpPage({
				search: "",
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 100,
				watched: "unwatched",
				resolutions: ["1080p"],
				codecVideo: "HEVC",
				durationBuckets: ["long"],
			});
			expect(page.items.map((video) => video.id)).toEqual([target]);
			expect(page.total).toBe(1);
		});
	});

	describe("duplicate candidates", () => {
		function seedDuplicate(
			fileName: string,
			fileSize: number,
			durationSec: number | null,
		) {
			return db.upsertVideo({
				sourcePath: `C:\\library\\${fileName}`,
				fileName,
				folderPath: "C:\\library",
				fileSize,
				modifiedAt: "2026-04-05T00:00:00.000Z",
				durationSec,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});
		}

		it("groups by file size and ±2s duration buckets", () => {
			const first = seedDuplicate("dup-a.mp4", 1000, 100);
			const second = seedDuplicate("dup-b.mp4", 1000, 101.5);
			seedDuplicate("other-size.mp4", 2000, 100);
			seedDuplicate("other-duration.mp4", 1000, 200);

			const groups = db.getDuplicateGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0]?.memberCount).toBe(2);
			expect(new Set(groups[0]?.memberIds)).toEqual(new Set([first, second]));
		});

		it("ignores missing videos", () => {
			const first = seedDuplicate("gone-a.mp4", 5000, 50);
			seedDuplicate("gone-b.mp4", 5000, 50);
			db.markVideoMissingByPath(`C:\\library\\gone-a.mp4`);
			expect(first).toBeTruthy();
			expect(db.getDuplicateGroups()).toHaveLength(0);
		});
	});

	describe("cleanup, folder removal, and missing video filtering", () => {
		function seedVideo(
			sourcePath: string,
			options: {
				posterPath?: string | null;
				durationSec?: number | null;
				width?: number | null;
				height?: number | null;
				modifiedAt?: string;
			} = {},
		) {
			return db.upsertVideo({
				sourcePath,
				fileName: path.basename(sourcePath),
				folderPath: path.dirname(sourcePath),
				fileSize: 100,
				modifiedAt: options.modifiedAt ?? "2026-04-05T00:00:00.000Z",
				durationSec:
					options.durationSec === undefined ? 60 : options.durationSec,
				width: options.width === undefined ? 1920 : options.width,
				height: options.height === undefined ? 1080 : options.height,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: options.posterPath ?? null,
			});
		}

		it("purges pre-existing is_missing = 1 rows and their posters on startup", () => {
			const legacyDbPath = path.join(tempDir, "legacy.db");
			const stalePoster = path.join(tempDir, "stale-poster.jpg");
			const livePoster = path.join(tempDir, "live-poster.jpg");
			fs.writeFileSync(stalePoster, "stale");
			fs.writeFileSync(livePoster, "live");

			const { DatabaseSync } = process.getBuiltinModule(
				"node:sqlite",
			) as typeof import("node:sqlite");
			const raw = new DatabaseSync(legacyDbPath);
			raw.exec(`
				CREATE TABLE videos (
					id TEXT PRIMARY KEY,
					source_path TEXT NOT NULL UNIQUE,
					file_name TEXT NOT NULL,
					folder_path TEXT NOT NULL,
					file_size INTEGER NOT NULL,
					modified_at TEXT NOT NULL,
					duration_sec REAL,
					width INTEGER,
					height INTEGER,
					fps REAL,
					codec_video TEXT,
					codec_audio TEXT,
					bitrate INTEGER,
					poster_path TEXT,
					resume_sec REAL NOT NULL DEFAULT 0,
					last_played_at TEXT,
					play_count INTEGER NOT NULL DEFAULT 0,
					is_missing INTEGER NOT NULL DEFAULT 0,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				INSERT INTO videos VALUES ('stale', 'C:\\\\gone.mp4', 'gone.mp4', 'C:\\\\', 1, '2026-01-01', 10, 100, 100, 30, 'h264', 'aac', 100, '${stalePoster.replace(/\\/g, "\\\\")}', 0, NULL, 0, 1, '2026-01-01', '2026-01-01');
				INSERT INTO videos VALUES ('live', 'C:\\\\live.mp4', 'live.mp4', 'C:\\\\', 1, '2026-01-01', 10, 100, 100, 30, 'h264', 'aac', 100, '${livePoster.replace(/\\/g, "\\\\")}', 0, NULL, 0, 0, '2026-01-01', '2026-01-01');
			`);
			raw.close();

			const migrated = new DatabaseService(legacyDbPath);
			try {
				expect(migrated.getVideoById("stale")).toBeNull();
				expect(migrated.getVideoById("live")).not.toBeNull();
				expect(fs.existsSync(stalePoster)).toBe(false);
				expect(fs.existsSync(livePoster)).toBe(true);
				const prefs = migrated.getPlayerPreferences();
				expect(prefs.showContinueWatching).toBe(true);
				expect(prefs.showRecentlyAdded).toBe(true);
			} finally {
				migrated.close();
			}
		});

		it("removes videos and posters on folder removal while respecting boundaries and overlapping roots", () => {
			const rootA = path.join(tempDir, "trips");
			const nestedA = path.join(rootA, "sub");
			const sibling = path.join(tempDir, "trips2");
			fs.mkdirSync(nestedA, { recursive: true });
			fs.mkdirSync(sibling, { recursive: true });

			const posterA = path.join(tempDir, "poster-a.jpg");
			const posterNested = path.join(tempDir, "poster-nested.jpg");
			const posterSibling = path.join(tempDir, "poster-sibling.jpg");
			fs.writeFileSync(posterA, "a");
			fs.writeFileSync(posterNested, "nested");
			fs.writeFileSync(posterSibling, "sibling");

			const folderA = db.addLibrarySourcePath(rootA);
			db.addLibrarySourcePath(nestedA);
			db.addLibrarySourcePath(sibling);

			const idA = seedVideo(path.join(rootA, "a.mp4"), {
				posterPath: posterA,
			});
			const idNested = seedVideo(path.join(nestedA, "nested.mp4"), {
				posterPath: posterNested,
			});
			const idSibling = seedVideo(path.join(sibling, "b.mp4"), {
				posterPath: posterSibling,
			});

			const cat = db.createCategory({ name: "Clips" });
			db.addVideoToCategories({
				videoId: idA,
				categories: [{ categoryId: cat.id }],
			});

			db.removeLibrarySourcePath(folderA.id);

			expect(db.getVideoById(idA)).toBeNull();
			expect(fs.existsSync(posterA)).toBe(false);
			expect(db.getVideoById(idNested)).not.toBeNull();
			expect(fs.existsSync(posterNested)).toBe(true);
			expect(db.getVideoById(idSibling)).not.toBeNull();
			expect(fs.existsSync(posterSibling)).toBe(true);
			expect(db.getCategoryBySlug(cat.slug)?.postCount).toBe(0);
		});

		it("removes missing videos by path and under root while respecting boundaries", () => {
			const root = path.join(tempDir, "media");
			const sibling = path.join(tempDir, "media2");
			const posterGone = path.join(tempDir, "gone.jpg");
			const posterKeep = path.join(tempDir, "keep.jpg");
			const posterSibling = path.join(tempDir, "sibling.jpg");
			fs.writeFileSync(posterGone, "1");
			fs.writeFileSync(posterKeep, "2");
			fs.writeFileSync(posterSibling, "3");

			const gone = seedVideo(path.join(root, "gone.mp4"), {
				posterPath: posterGone,
			});
			const keep = seedVideo(path.join(root, "keep.mp4"), {
				posterPath: posterKeep,
			});
			const sib = seedVideo(path.join(sibling, "sib.mp4"), {
				posterPath: posterSibling,
			});

			db.removeMissingUnderRoot(root, new Set([path.join(root, "keep.mp4")]));
			expect(db.getVideoById(gone)).toBeNull();
			expect(fs.existsSync(posterGone)).toBe(false);
			expect(db.getVideoById(keep)).not.toBeNull();
			expect(db.getVideoById(sib)).not.toBeNull();

			db.removeVideoByPath(path.join(root, "keep.mp4"));
			expect(db.getVideoById(keep)).toBeNull();
			expect(fs.existsSync(posterKeep)).toBe(false);
		});

		it("excludes missing videos from category feeds and category post counts", () => {
			const keepId = seedVideo(path.join(tempDir, "keep.mp4"));
			const missingId = seedVideo(path.join(tempDir, "missing.mp4"));
			const cat = db.createCategory({ name: "FeedCheck" });
			db.addVideoToCategories({
				videoId: keepId,
				categories: [{ categoryId: cat.id }],
			});
			db.addVideoToCategories({
				videoId: missingId,
				categories: [{ categoryId: cat.id }],
			});

			db.markVideoMissingByPath(path.join(tempDir, "missing.mp4"));

			expect(db.getCategoryBySlug(cat.slug)?.postCount).toBe(1);
			expect(
				db.listCategories().find((item) => item.id === cat.id)?.postCount,
			).toBe(1);
			const feed = db.getCategoryFeed({
				categoryId: cat.id,
				page: 1,
				pageSize: 20,
				sort: "newestPost",
			});
			expect(feed.total).toBe(1);
			expect(feed.items.map((post) => post.video.id)).toEqual([keepId]);
		});

		it("updates missing metadata via updateVideoMetadata without overwriting existing values", () => {
			const id = seedVideo(path.join(tempDir, "partial.mp4"), {
				durationSec: null,
				width: 1280,
				height: null,
			});

			db.updateVideoMetadata({
				videoId: id,
				durationSec: 0,
				width: Number.NaN,
				height: -10,
			});
			expect(db.getVideoById(id)?.durationSec).toBeNull();
			expect(db.getVideoById(id)?.height).toBeNull();

			db.updateVideoMetadata({
				videoId: id,
				durationSec: 142.5,
				width: 1920,
				height: 720,
			});
			const updated = db.getVideoById(id);
			expect(updated?.durationSec).toBe(142.5);
			expect(updated?.width).toBe(1280);
			expect(updated?.height).toBe(720);
		});
	});

	describe("hidden from home, dismiss continue watching, and preferences", () => {
		function seedTimed(sourcePath: string, modifiedAt: string) {
			return db.upsertVideo({
				sourcePath,
				fileName: path.basename(sourcePath),
				folderPath: path.dirname(sourcePath),
				fileSize: 100,
				modifiedAt,
				durationSec: 300,
				width: 1920,
				height: 1080,
				fps: 30,
				codecVideo: "h264",
				codecAudio: "aac",
				bitrate: 1000,
				posterPath: null,
			});
		}

		it("excludes videos in hidden categories and descendants from home rails and dump when excludeHiddenFromHome is true", () => {
			const hiddenParent = db.createCategory({
				name: "Private",
				hiddenFromHome: true,
			});
			const hiddenChild = db.createCategory({
				name: "Private Sub",
				parentCategoryId: hiddenParent.id,
			});
			const visibleCat = db.createCategory({ name: "Public" });

			const hiddenId = seedTimed(
				path.join(tempDir, "secret.mp4"),
				"2026-04-01T00:00:00.000Z",
			);
			const visibleId = seedTimed(
				path.join(tempDir, "public.mp4"),
				"2026-04-02T00:00:00.000Z",
			);

			db.addVideoToCategories({
				videoId: hiddenId,
				categories: [{ categoryId: hiddenChild.id }],
			});
			db.addVideoToCategories({
				videoId: visibleId,
				categories: [{ categoryId: visibleCat.id }],
			});
			db.saveProgress(hiddenId, 60);
			db.saveProgress(visibleId, 60);

			expect(db.getContinueWatching().map((v) => v.id)).toEqual([visibleId]);
			expect(db.getRecentlyAdded().map((v) => v.id)).toEqual([visibleId]);
			expect(
				db
					.getDumpPage({
						sort: "recent",
						order: "desc",
						page: 1,
						pageSize: 20,
						excludeHiddenFromHome: true,
					})
					.items.map((v) => v.id),
			).toEqual([visibleId]);
			expect(
				db.getDumpPage({
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 20,
				}).total,
			).toBe(2);

			// Preserves hiddenFromHome when omitted in updateCategory
			const renamed = db.updateCategory({
				id: hiddenParent.id,
				name: "Private Renamed",
			});
			expect(renamed.hiddenFromHome).toBe(true);
		});

		it("excludes hidden source folders with exact pagination totals and boundary matching", () => {
			const secretRoot = path.join(tempDir, "vault");
			const publicRoot = path.join(tempDir, "vault2");
			const secretFolder = db.addLibrarySourcePath(secretRoot);
			db.addLibrarySourcePath(publicRoot);
			const toggled = db.toggleLibrarySourcePathHiddenFromHome(secretFolder.id);
			expect(toggled.hiddenFromHome).toBe(true);

			const hiddenIds: string[] = [];
			const visibleIds: string[] = [];
			for (let i = 0; i < 4; i += 1) {
				hiddenIds.push(
					seedTimed(
						path.join(secretRoot, `s-${i}.mp4`),
						`2026-04-0${i + 1}T00:00:00.000Z`,
					),
				);
				visibleIds.push(
					seedTimed(
						path.join(publicRoot, `p-${i}.mp4`),
						`2026-04-1${i + 1}T00:00:00.000Z`,
					),
				);
			}
			db.saveProgress(hiddenIds[0], 50);
			db.saveProgress(visibleIds[0], 50);

			expect(db.getContinueWatching().map((v) => v.id)).toEqual([
				visibleIds[0],
			]);
			expect(db.getRecentlyAdded(10).map((v) => v.id)).toEqual(
				[...visibleIds].reverse(),
			);

			const page1 = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 1,
				pageSize: 3,
				excludeHiddenFromHome: true,
			});
			const page2 = db.getDumpPage({
				sort: "recent",
				order: "desc",
				page: 2,
				pageSize: 3,
				excludeHiddenFromHome: true,
			});
			expect(page1.total).toBe(4);
			expect(page1.items).toHaveLength(3);
			expect(page2.total).toBe(4);
			expect(page2.items).toHaveLength(1);
			expect(
				[...page1.items, ...page2.items].every((v) =>
					visibleIds.includes(v.id),
				),
			).toBe(true);
		});

		it("dismisses continue watching without incrementing playCount", () => {
			const id = seedTimed(
				path.join(tempDir, "dismiss.mp4"),
				"2026-04-05T00:00:00.000Z",
			);
			db.saveProgress(id, 120);
			expect(db.getContinueWatching().map((v) => v.id)).toEqual([id]);

			db.dismissContinueWatching(id);
			expect(db.getContinueWatching()).toHaveLength(0);
			const detail = db.getVideoById(id);
			expect(detail?.resumeSec).toBe(0);
			expect(detail?.playCount).toBe(0);
		});

		it("persists showContinueWatching and showRecentlyAdded preferences", () => {
			expect(db.getPlayerPreferences()).toMatchObject({
				showContinueWatching: true,
				showRecentlyAdded: true,
			});
			db.savePlayerPreferences({
				showContinueWatching: false,
				showRecentlyAdded: false,
			});
			expect(db.getPlayerPreferences()).toMatchObject({
				showContinueWatching: false,
				showRecentlyAdded: false,
			});
		});
	});
});

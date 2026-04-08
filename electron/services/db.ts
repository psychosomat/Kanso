import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Database as DatabaseType } from "better-sqlite3";
import Database from "better-sqlite3";
import { DEFAULT_PLAYER_PREFERENCES } from "../../src/lib/constants";
import { normalizeEqGains } from "../../src/lib/equalizer";
import type {
	AddVideoToCategoriesDto,
	CategoryDto,
	CategoryFeedSort,
	CategoryIconName,
	DumpQueryDto,
	LibrarySettingsDto,
	PaginatedCategoryPostsDto,
	PaginatedVideosDto,
	PlayerPreferencesDto,
	SavePlayerPreferencesDto,
	SourcePathDto,
	TitlebarMode,
	VideoCardDto,
	VideoDetailDto,
} from "../../src/lib/contracts";
import { slugify } from "../../src/lib/utils";

// Simple timing helper for performance debugging
function timeQuery<T>(name: string, fn: () => T): T {
	const start = performance.now();
	try {
		return fn();
	} finally {
		const duration = performance.now() - start;
		if (duration > 10) {
			console.log(`[DB PERF] ${name}: ${duration.toFixed(2)}ms`);
		}
	}
}

type UpsertVideoInput = {
	sourcePath: string;
	fileName: string;
	folderPath: string;
	fileSize: number;
	modifiedAt: string;
	durationSec: number | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	codecVideo: string | null;
	codecAudio: string | null;
	bitrate: number | null;
	posterPath: string | null;
};

type ScanStatePatch = {
	lastScanAt?: string | null;
	scanStatus: "idle" | "scanning" | "error";
	scanError?: string | null;
};

type VideoRow = {
	id: string;
	source_path: string;
	file_name: string;
	folder_path: string;
	file_size: number;
	modified_at: string;
	duration_sec: number | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	codec_video: string | null;
	codec_audio: string | null;
	bitrate: number | null;
	poster_path: string | null;
	resume_sec: number;
	last_played_at: string | null;
	play_count: number;
	is_missing: number;
	category_count?: number;
};

function getDefaultTitlebarMode(): TitlebarMode {
	return process.platform === "darwin" ? "macos" : "windows";
}

export class DatabaseService {
	private db: DatabaseType;

	constructor(dbPath: string) {
		fs.mkdirSync(path.dirname(dbPath), { recursive: true });
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.migrate();
		this.ensureSingletons();
	}

	private migrate() {
		const defaultEqBands = JSON.stringify(
			DEFAULT_PLAYER_PREFERENCES.playerEqGains,
		);
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS library_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        watch_enabled INTEGER NOT NULL DEFAULT 1,
        last_scan_at TEXT,
        scan_status TEXT NOT NULL DEFAULT 'idle',
        scan_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS library_source_paths (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        watch_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS videos (
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

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        icon TEXT NOT NULL DEFAULT 'folder',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS category_posts (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        caption TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(category_id, video_id)
      );

      CREATE INDEX IF NOT EXISTS idx_videos_source_path ON videos(source_path);
      CREATE INDEX IF NOT EXISTS idx_videos_folder_path ON videos(folder_path);
      CREATE INDEX IF NOT EXISTS idx_videos_is_missing ON videos(is_missing);
      CREATE INDEX IF NOT EXISTS idx_videos_modified_at ON videos(modified_at);
      CREATE INDEX IF NOT EXISTS idx_category_posts_category_id ON category_posts(category_id);
      CREATE INDEX IF NOT EXISTS idx_category_posts_video_id ON category_posts(video_id);
      CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

      CREATE TABLE IF NOT EXISTS ui_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        dump_sort TEXT NOT NULL,
        dump_view TEXT NOT NULL,
        sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
        titlebar_mode TEXT,
        player_volume REAL NOT NULL,
        player_muted INTEGER NOT NULL DEFAULT 0,
        player_fit_mode TEXT NOT NULL,
        speed_preset_primary REAL NOT NULL DEFAULT 1,
        speed_preset_secondary REAL NOT NULL DEFAULT 2.2,
        accent_color TEXT NOT NULL DEFAULT '#c8883a',
        player_loop INTEGER NOT NULL DEFAULT 0,
        eq_enabled INTEGER NOT NULL DEFAULT 0,
        eq_bands TEXT NOT NULL DEFAULT '${defaultEqBands}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
		this.ensureColumn(
			"ui_preferences",
			"speed_preset_primary",
			"REAL NOT NULL DEFAULT 1",
		);
		this.ensureColumn(
			"ui_preferences",
			"speed_preset_secondary",
			"REAL NOT NULL DEFAULT 2.2",
		);
		this.ensureColumn(
			"ui_preferences",
			"accent_color",
			"TEXT NOT NULL DEFAULT '#c8883a'",
		);
		this.ensureColumn(
			"ui_preferences",
			"player_loop",
			"INTEGER NOT NULL DEFAULT 0",
		);
		this.ensureColumn(
			"ui_preferences",
			"eq_enabled",
			"INTEGER NOT NULL DEFAULT 0",
		);
		this.ensureColumn(
			"ui_preferences",
			"eq_bands",
			`TEXT NOT NULL DEFAULT '${defaultEqBands}'`,
		);
		this.ensureColumn("ui_preferences", "titlebar_mode", "TEXT");
		this.ensureColumn("categories", "parent_id", "TEXT");
		this.ensureColumn("categories", "icon", "TEXT NOT NULL DEFAULT 'folder'");
	}

	private ensureColumn(
		tableName: string,
		columnName: string,
		definition: string,
	) {
		const columns = this.db
			.prepare(`PRAGMA table_info(${tableName})`)
			.all() as Array<{ name: string }>;
		if (!columns.some((column) => column.name === columnName)) {
			this.db.exec(
				`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
			);
		}
	}

	private ensureSingletons() {
		const now = new Date().toISOString();
		this.db
			.prepare(
				`INSERT OR IGNORE INTO library_settings
         (id, watch_enabled, last_scan_at, scan_status, scan_error, created_at, updated_at)
         VALUES (1, 1, NULL, 'idle', NULL, ?, ?)`,
			)
			.run(now, now);

		this.db
			.prepare(
				`INSERT OR IGNORE INTO ui_preferences
         (id, dump_sort, dump_view, sidebar_collapsed, titlebar_mode, player_volume, player_muted, player_fit_mode, speed_preset_primary, speed_preset_secondary, accent_color, player_loop, eq_enabled, eq_bands, created_at, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				DEFAULT_PLAYER_PREFERENCES.dumpSort,
				DEFAULT_PLAYER_PREFERENCES.dumpView,
				Number(DEFAULT_PLAYER_PREFERENCES.sidebarCollapsed),
				getDefaultTitlebarMode(),
				DEFAULT_PLAYER_PREFERENCES.playerVolume,
				Number(DEFAULT_PLAYER_PREFERENCES.playerMuted),
				DEFAULT_PLAYER_PREFERENCES.playerFitMode,
				DEFAULT_PLAYER_PREFERENCES.speedPresetPrimary,
				DEFAULT_PLAYER_PREFERENCES.speedPresetSecondary,
				DEFAULT_PLAYER_PREFERENCES.accentColor,
				Number(DEFAULT_PLAYER_PREFERENCES.playerLoop),
				Number(DEFAULT_PLAYER_PREFERENCES.playerEqEnabled),
				JSON.stringify(DEFAULT_PLAYER_PREFERENCES.playerEqGains),
				now,
				now,
			);

		this.db
			.prepare(
				"UPDATE ui_preferences SET titlebar_mode = ? WHERE id = 1 AND titlebar_mode IS NULL",
			)
			.run(getDefaultTitlebarMode());
	}

	close() {
		this.db.close();
	}

	getLibrarySettings(): LibrarySettingsDto {
		return timeQuery("getLibrarySettings", () => {
			const row = this.db
				.prepare("SELECT * FROM library_settings WHERE id = 1")
				.get() as {
				watch_enabled: number;
				last_scan_at: string | null;
				scan_status: LibrarySettingsDto["scanStatus"];
				scan_error: string | null;
			};
			const sourcePaths = this.db
				.prepare("SELECT * FROM library_source_paths ORDER BY created_at ASC")
				.all() as Array<{
				id: string;
				path: string;
				watch_enabled: number;
				created_at: string;
				updated_at: string;
			}>;
			return {
				sourcePaths: sourcePaths.map((sp) => ({
					id: sp.id,
					path: sp.path,
					watchEnabled: Boolean(sp.watch_enabled),
					createdAt: sp.created_at,
					updatedAt: sp.updated_at,
				})),
				watchEnabled: Boolean(row.watch_enabled),
				lastScanAt: row.last_scan_at,
				scanStatus: row.scan_status,
				scanError: row.scan_error,
			};
		});
	}

	addLibrarySourcePath(path: string): SourcePathDto {
		const now = new Date().toISOString();
		const id = randomUUID();
		this.db
			.prepare(
				`INSERT INTO library_source_paths (id, path, watch_enabled, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(path) DO UPDATE SET updated_at = excluded.updated_at`,
			)
			.run(id, path, now, now);
		const row = this.db
			.prepare("SELECT * FROM library_source_paths WHERE path = ?")
			.get(path) as {
			id: string;
			path: string;
			watch_enabled: number;
			created_at: string;
			updated_at: string;
		};
		return {
			id: row.id,
			path: row.path,
			watchEnabled: Boolean(row.watch_enabled),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	removeLibrarySourcePath(id: string): void {
		this.db.prepare("DELETE FROM library_source_paths WHERE id = ?").run(id);
	}

	toggleLibrarySourcePathWatch(id: string): SourcePathDto {
		const row = this.db
			.prepare("SELECT * FROM library_source_paths WHERE id = ?")
			.get(id) as {
			id: string;
			path: string;
			watch_enabled: number;
			created_at: string;
			updated_at: string;
		};
		const newWatchEnabled = row.watch_enabled ? 0 : 1;
		this.db
			.prepare(
				"UPDATE library_source_paths SET watch_enabled = ?, updated_at = ? WHERE id = ?",
			)
			.run(newWatchEnabled, new Date().toISOString(), id);
		return {
			id: row.id,
			path: row.path,
			watchEnabled: Boolean(newWatchEnabled),
			createdAt: row.created_at,
			updatedAt: new Date().toISOString(),
		};
	}

	listLibrarySourcePaths(): SourcePathDto[] {
		const rows = this.db
			.prepare("SELECT * FROM library_source_paths ORDER BY created_at ASC")
			.all() as Array<{
			id: string;
			path: string;
			watch_enabled: number;
			created_at: string;
			updated_at: string;
		}>;
		return rows.map((row) => ({
			id: row.id,
			path: row.path,
			watchEnabled: Boolean(row.watch_enabled),
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
	}

	setLibrarySourcePath(sourcePath: string) {
		this.addLibrarySourcePath(sourcePath);
		return this.getLibrarySettings();
	}

	updateScanState(input: ScanStatePatch) {
		this.db
			.prepare(
				`UPDATE library_settings
         SET last_scan_at = COALESCE(?, last_scan_at),
             scan_status = ?,
             scan_error = ?,
             updated_at = ?
         WHERE id = 1`,
			)
			.run(
				input.lastScanAt ?? null,
				input.scanStatus,
				input.scanError ?? null,
				new Date().toISOString(),
			);
	}

	getPlayerPreferences(): PlayerPreferencesDto {
		return timeQuery("getPlayerPreferences", () => {
			const row = this.db
				.prepare("SELECT * FROM ui_preferences WHERE id = 1")
				.get() as {
				dump_sort: PlayerPreferencesDto["dumpSort"];
				dump_view: PlayerPreferencesDto["dumpView"];
				sidebar_collapsed: number;
				titlebar_mode: string | null;
				player_volume: number;
				player_muted: number;
				player_fit_mode: PlayerPreferencesDto["playerFitMode"];
				speed_preset_primary: number;
				speed_preset_secondary: number;
				accent_color: PlayerPreferencesDto["accentColor"];
				player_loop: number;
				eq_enabled: number;
				eq_bands: string | null;
			};
			return {
				dumpSort: row.dump_sort,
				dumpView: row.dump_view,
				sidebarCollapsed: Boolean(row.sidebar_collapsed),
				titlebarMode: this.normalizeTitlebarMode(row.titlebar_mode),
				playerVolume: row.player_volume,
				playerMuted: Boolean(row.player_muted),
				playerFitMode: row.player_fit_mode,
				speedPresetPrimary: row.speed_preset_primary,
				speedPresetSecondary: row.speed_preset_secondary,
				accentColor: row.accent_color,
				playerLoop: Boolean(row.player_loop),
				playerEqEnabled: Boolean(row.eq_enabled),
				playerEqGains: this.parseEqGains(row.eq_bands),
			};
		});
	}

	savePlayerPreferences(input: SavePlayerPreferencesDto) {
		const next = { ...this.getPlayerPreferences(), ...input };
		const normalizedGains = normalizeEqGains(next.playerEqGains);
		const eqEnabled = Boolean(next.playerEqEnabled);
		this.db
			.prepare(
				`UPDATE ui_preferences
         SET dump_sort = ?, dump_view = ?, sidebar_collapsed = ?, titlebar_mode = ?, player_volume = ?, player_muted = ?, player_fit_mode = ?, speed_preset_primary = ?, speed_preset_secondary = ?, accent_color = ?, player_loop = ?, eq_enabled = ?, eq_bands = ?, updated_at = ?
         WHERE id = 1`,
			)
			.run(
				next.dumpSort,
				next.dumpView,
				Number(next.sidebarCollapsed),
				next.titlebarMode,
				next.playerVolume,
				Number(next.playerMuted),
				next.playerFitMode,
				next.speedPresetPrimary,
				next.speedPresetSecondary,
				next.accentColor,
				Number(next.playerLoop),
				Number(eqEnabled),
				JSON.stringify(normalizedGains),
				new Date().toISOString(),
			);
	}

	private normalizeTitlebarMode(mode: string | null | undefined): TitlebarMode {
		switch (mode) {
			case "windows":
			case "macos":
			case "hidden":
			case "auto":
				return mode;
			default:
				return getDefaultTitlebarMode();
		}
	}

	private parseEqGains(raw: string | null | undefined): number[] {
		if (typeof raw !== "string") {
			return [...DEFAULT_PLAYER_PREFERENCES.playerEqGains];
		}

		try {
			const parsed = JSON.parse(raw);
			const numeric = Array.isArray(parsed)
				? parsed.map((value) => Number(value))
				: [];
			return normalizeEqGains(numeric);
		} catch (error) {
			console.warn(
				"[DB] Failed to parse EQ gains, falling back to defaults",
				error,
			);
			return [...DEFAULT_PLAYER_PREFERENCES.playerEqGains];
		}
	}

	upsertVideo(input: UpsertVideoInput) {
		const existing = this.db
			.prepare("SELECT id FROM videos WHERE source_path = ?")
			.get(input.sourcePath) as { id: string } | undefined;
		const id = existing?.id ?? randomUUID();
		const now = new Date().toISOString();
		this.db
			.prepare(
				`INSERT INTO videos
         (id, source_path, file_name, folder_path, file_size, modified_at, duration_sec, width, height, fps, codec_video, codec_audio, bitrate, poster_path, resume_sec, last_played_at, play_count, is_missing, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, 0, ?, ?)
         ON CONFLICT(source_path) DO UPDATE SET
           file_name = excluded.file_name,
           folder_path = excluded.folder_path,
           file_size = excluded.file_size,
           modified_at = excluded.modified_at,
           duration_sec = excluded.duration_sec,
           width = excluded.width,
           height = excluded.height,
           fps = excluded.fps,
           codec_video = excluded.codec_video,
           codec_audio = excluded.codec_audio,
           bitrate = excluded.bitrate,
           poster_path = excluded.poster_path,
           is_missing = 0,
           updated_at = excluded.updated_at`,
			)
			.run(
				id,
				input.sourcePath,
				input.fileName,
				input.folderPath,
				input.fileSize,
				input.modifiedAt,
				input.durationSec,
				input.width,
				input.height,
				input.fps,
				input.codecVideo,
				input.codecAudio,
				input.bitrate,
				input.posterPath,
				now,
				now,
			);
		return id;
	}

	markMissingUnderRoot(rootPath: string, existingPaths: Set<string>) {
		const rows = this.db
			.prepare("SELECT source_path FROM videos WHERE source_path LIKE ?")
			.all(`${rootPath}%`) as Array<{ source_path: string }>;
		const markMissing = this.db.prepare(
			"UPDATE videos SET is_missing = 1, updated_at = ? WHERE source_path = ?",
		);
		const now = new Date().toISOString();
		const transaction = this.db.transaction(() => {
			for (const row of rows) {
				if (!existingPaths.has(row.source_path)) {
					markMissing.run(now, row.source_path);
				}
			}
		});
		transaction();
	}

	markVideoMissingByPath(sourcePath: string) {
		this.db
			.prepare(
				"UPDATE videos SET is_missing = 1, updated_at = ? WHERE source_path = ?",
			)
			.run(new Date().toISOString(), sourcePath);
	}

	getVideoSourcePath(videoId: string) {
		const row = this.db
			.prepare("SELECT source_path FROM videos WHERE id = ?")
			.get(videoId) as { source_path: string } | undefined;
		return row?.source_path ?? null;
	}

	getPosterPath(videoId: string) {
		const row = this.db
			.prepare("SELECT poster_path FROM videos WHERE id = ?")
			.get(videoId) as { poster_path: string | null } | undefined;
		return row?.poster_path ?? null;
	}

	removeVideo(videoId: string) {
		const row = this.db
			.prepare("SELECT poster_path FROM videos WHERE id = ?")
			.get(videoId) as { poster_path: string | null } | undefined;
		if (!row) {
			return;
		}

		this.db.prepare("DELETE FROM videos WHERE id = ?").run(videoId);
		if (row.poster_path) {
			fs.rmSync(row.poster_path, { force: true });
		}
	}

	getVideoById(videoId: string): VideoDetailDto | null {
		const row = this.db
			.prepare("SELECT * FROM videos WHERE id = ?")
			.get(videoId) as VideoRow | undefined;
		if (!row) return null;

		const categoryCount = this.db
			.prepare(
				"SELECT COUNT(*) as count FROM category_posts WHERE video_id = ?",
			)
			.get(videoId) as { count: number };

		const assignedIds = new Set(
			(
				this.db
					.prepare("SELECT category_id FROM category_posts WHERE video_id = ?")
					.all(videoId) as Array<{ category_id: string }>
			).map((r) => r.category_id),
		);

		const categories = this.db
			.prepare("SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC")
			.all() as Array<{
			id: string;
			slug: string;
			name: string;
			parent_id: string | null;
			icon: string;
		}>;

		return {
			...this.toVideoCard(row),
			codecVideo: row.codec_video,
			codecAudio: row.codec_audio,
			bitrate: row.bitrate,
			fps: row.fps,
			fileSize: row.file_size,
			categories: categories.map((item) => ({
				id: item.id,
				slug: item.slug,
				name: item.name,
				parentCategoryId: item.parent_id,
				icon: this.normalizeCategoryIcon(item.icon),
				assigned: assignedIds.has(item.id),
			})),
			assignedCategoryCount: categoryCount.count,
		};
	}

	getDumpPage(input: DumpQueryDto): PaginatedVideosDto {
		return timeQuery("getDumpPage", () => {
			const page = Math.max(1, input.page);
			const pageSize = Math.max(1, Math.min(input.pageSize, 100));
			const offset = (page - 1) * pageSize;
			const search = input.search?.trim();

			const conditions: string[] = [];
			if (search) {
				conditions.push("(file_name LIKE @search OR folder_path LIKE @search)");
			}
			if (input.unsortedOnly) {
				conditions.push(
					"NOT EXISTS (SELECT 1 FROM category_posts cp WHERE cp.video_id = videos.id)",
				);
			}
			const where =
				conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

			const params = search
				? { search: `%${search}%`, limit: pageSize, offset }
				: { limit: pageSize, offset };

			const rows = this.db
				.prepare(
					`SELECT * FROM videos ${where}
					ORDER BY ${this.getDumpSort(input.sort, input.order)}
					LIMIT @limit OFFSET @offset`,
				)
				.all(params) as VideoRow[];

			const countRow = this.db
				.prepare(`SELECT COUNT(*) as total FROM videos ${where}`)
				.get(search ? { search: `%${search}%` } : {}) as { total: number };

			// Get category counts for all videos at once
			const videoIds = rows.map((r) => r.id);
			const categoryCounts =
				videoIds.length > 0
					? (this.db
							.prepare(
								`SELECT video_id, COUNT(*) as count FROM category_posts WHERE video_id IN (${videoIds.map(() => "?").join(",")}) GROUP BY video_id`,
							)
							.all(...videoIds) as Array<{ video_id: string; count: number }>)
					: [];
			const countMap = new Map(
				categoryCounts.map((cc) => [cc.video_id, cc.count]),
			);

			return {
				items: rows.map((row) =>
					this.toVideoCard(row, countMap.get(row.id) ?? 0),
				),
				total: countRow.total,
				page,
				pageSize,
			};
		});
	}

	listCategories(): CategoryDto[] {
		return timeQuery("listCategories", () => {
			const rows = this.db
				.prepare(`SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC`)
				.all() as Array<{
				id: string;
				slug: string;
				name: string;
				description: string | null;
				parent_id: string | null;
				icon: string;
				created_at: string;
				updated_at: string;
			}>;

			const postCounts = this.db
				.prepare(
					`SELECT category_id, COUNT(*) as count FROM category_posts GROUP BY category_id`,
				)
				.all() as Array<{ category_id: string; count: number }>;
			const countMap = new Map(
				postCounts.map((pc) => [pc.category_id, pc.count]),
			);

			return rows.map((row) => ({
				id: row.id,
				slug: row.slug,
				name: row.name,
				description: row.description,
				parentCategoryId: row.parent_id,
				icon: this.normalizeCategoryIcon(row.icon),
				postCount: countMap.get(row.id) ?? 0,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			}));
		});
	}

	private getCategoryById(categoryId: string): CategoryDto | null {
		const row = this.db
			.prepare("SELECT * FROM categories WHERE id = ?")
			.get(categoryId) as
			| {
					id: string;
					slug: string;
					name: string;
					description: string | null;
					parent_id: string | null;
					icon: string;
					created_at: string;
					updated_at: string;
			  }
			| undefined;
		if (!row) return null;

		const postCount = this.db
			.prepare(
				"SELECT COUNT(*) as count FROM category_posts WHERE category_id = ?",
			)
			.get(categoryId) as { count: number };

		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			parentCategoryId: row.parent_id,
			icon: this.normalizeCategoryIcon(row.icon),
			postCount: postCount.count,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	getCategoryBySlug(slug: string): CategoryDto | null {
		const row = this.db
			.prepare("SELECT * FROM categories WHERE slug = ?")
			.get(slug) as
			| {
					id: string;
					slug: string;
					name: string;
					description: string | null;
					parent_id: string | null;
					icon: string;
					created_at: string;
					updated_at: string;
			  }
			| undefined;
		if (!row) return null;

		const postCount = this.db
			.prepare(
				"SELECT COUNT(*) as count FROM category_posts WHERE category_id = ?",
			)
			.get(row.id) as { count: number };

		return {
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			parentCategoryId: row.parent_id,
			icon: this.normalizeCategoryIcon(row.icon),
			postCount: postCount.count,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	createCategory(input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryIconName;
	}) {
		const now = new Date().toISOString();
		const id = randomUUID();
		const slug = this.ensureUniqueSlug(slugify(input.name));
		const parentCategoryId = this.validateParentCategoryId(
			input.parentCategoryId ?? null,
			id,
		);
		this.db
			.prepare(
				`INSERT INTO categories (id, slug, name, description, parent_id, icon, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				id,
				slug,
				input.name.trim(),
				input.description?.trim() || null,
				parentCategoryId,
				this.normalizeCategoryIcon(input.icon),
				now,
				now,
			);
		// biome-ignore lint/style/noNonNullAssertion: category just created, must exist
		return this.getCategoryById(id)!;
	}

	updateCategory(input: {
		id: string;
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryIconName;
	}) {
		const slug = this.ensureUniqueSlug(slugify(input.name), input.id);
		const parentCategoryId = this.validateParentCategoryId(
			input.parentCategoryId ?? null,
			input.id,
		);
		this.db
			.prepare(
				`UPDATE categories
         SET slug = ?, name = ?, description = ?, parent_id = ?, icon = ?, updated_at = ?
         WHERE id = ?`,
			)
			.run(
				slug,
				input.name.trim(),
				input.description?.trim() || null,
				parentCategoryId,
				this.normalizeCategoryIcon(input.icon),
				new Date().toISOString(),
				input.id,
			);
		// biome-ignore lint/style/noNonNullAssertion: category just updated, must exist
		return this.getCategoryById(input.id)!;
	}

	removeCategory(categoryId: string) {
		this.db
			.prepare("UPDATE categories SET parent_id = NULL WHERE parent_id = ?")
			.run(categoryId);
		this.db.prepare("DELETE FROM categories WHERE id = ?").run(categoryId);
	}

	addVideoToCategories(input: AddVideoToCategoriesDto) {
		const insert = this.db.prepare(
			`INSERT INTO category_posts (id, category_id, video_id, caption, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(category_id, video_id) DO UPDATE SET caption = excluded.caption`,
		);
		const now = new Date().toISOString();
		const transaction = this.db.transaction(() => {
			for (const item of input.categories) {
				insert.run(
					randomUUID(),
					item.categoryId,
					input.videoId,
					item.caption?.trim() || null,
					now,
				);
			}
		});
		transaction();
	}

	removeVideoFromCategory(videoId: string, categoryId: string) {
		this.db
			.prepare(
				"DELETE FROM category_posts WHERE video_id = ? AND category_id = ?",
			)
			.run(videoId, categoryId);
	}

	getCategoryFeed(input: {
		categoryId: string;
		page: number;
		pageSize: number;
		sort: CategoryFeedSort;
	}): PaginatedCategoryPostsDto {
		const category = this.getCategoryById(input.categoryId);
		if (!category) {
			throw new Error("Category not found.");
		}

		const page = Math.max(1, input.page);
		const pageSize = Math.max(1, Math.min(input.pageSize, 100));
		const offset = (page - 1) * pageSize;
		const orderBy =
			input.sort === "name"
				? "v.file_name COLLATE NOCASE ASC"
				: input.sort === "lastPlayed"
					? "COALESCE(v.last_played_at, v.modified_at) DESC"
					: "cp.created_at DESC";

		const rows = this.db
			.prepare(
				`SELECT
					cp.id as post_id,
					cp.caption,
					cp.created_at as post_created_at,
					v.*
				FROM category_posts cp
				INNER JOIN videos v ON v.id = cp.video_id
				WHERE cp.category_id = ?
				ORDER BY ${orderBy}
				LIMIT ? OFFSET ?`,
			)
			.all(input.categoryId, pageSize, offset) as Array<
			VideoRow & {
				post_id: string;
				caption: string | null;
				post_created_at: string;
			}
		>;
		const count = this.db
			.prepare(
				"SELECT COUNT(*) as total FROM category_posts WHERE category_id = ?",
			)
			.get(input.categoryId) as { total: number };

		// Get category counts for all videos at once
		const videoIds = rows.map((r) => r.id);
		const categoryCounts =
			videoIds.length > 0
				? (this.db
						.prepare(
							`SELECT video_id, COUNT(*) as count FROM category_posts WHERE video_id IN (${videoIds.map(() => "?").join(",")}) GROUP BY video_id`,
						)
						.all(...videoIds) as Array<{ video_id: string; count: number }>)
				: [];
		const countMap = new Map(
			categoryCounts.map((cc) => [cc.video_id, cc.count]),
		);

		return {
			category,
			items: rows.map((row) => ({
				id: row.post_id,
				caption: row.caption,
				createdAt: row.post_created_at,
				category: {
					id: category.id,
					slug: category.slug,
					name: category.name,
					icon: category.icon,
				},
				video: this.toVideoCard(row, countMap.get(row.id) ?? 0),
			})),
			total: count.total,
			page,
			pageSize,
		};
	}

	saveProgress(videoId: string, resumeSec: number) {
		this.db
			.prepare(
				"UPDATE videos SET resume_sec = ?, last_played_at = ?, updated_at = ? WHERE id = ?",
			)
			.run(
				Math.max(0, resumeSec),
				new Date().toISOString(),
				new Date().toISOString(),
				videoId,
			);
	}

	markPlayed(videoId: string, completed: boolean) {
		this.db
			.prepare(
				`UPDATE videos
         SET play_count = play_count + 1,
             resume_sec = CASE WHEN ? THEN 0 ELSE resume_sec END,
             last_played_at = ?,
             updated_at = ?
         WHERE id = ?`,
			)
			.run(
				Number(completed),
				new Date().toISOString(),
				new Date().toISOString(),
				videoId,
			);
	}

	private validateParentCategoryId(
		parentCategoryId: string | null,
		categoryId: string,
	) {
		if (!parentCategoryId || parentCategoryId === categoryId) {
			return null;
		}

		const parent = this.getCategoryById(parentCategoryId);
		if (!parent) {
			return null;
		}

		let cursor: string | null = parent.parentCategoryId;
		while (cursor) {
			if (cursor === categoryId) {
				throw new Error("A category cannot become a child of itself.");
			}

			const row = this.db
				.prepare("SELECT parent_id FROM categories WHERE id = ?")
				.get(cursor) as { parent_id: string | null } | undefined;
			cursor = row?.parent_id ?? null;
		}

		return parentCategoryId;
	}

	private normalizeCategoryIcon(icon?: string | null): CategoryIconName {
		switch (icon) {
			case "folders":
			case "star":
			case "heart":
			case "flame":
			case "bolt":
			case "sparkles":
			case "bookmark":
			case "music":
			case "photo":
			case "video":
			case "deviceTv":
			case "rocket":
			case "brain":
			case "ghost":
			case "skull":
			case "sun":
			case "moon":
			case "cloud":
			case "droplet":
			case "leaf":
			case "paw":
			case "diamond":
			case "crown":
			case "folder":
				return icon;
			default:
				return "folder";
		}
	}

	private ensureUniqueSlug(base: string, currentId?: string) {
		const fallback = base || "category";
		let slug = fallback;
		let counter = 2;
		while (true) {
			const row = this.db
				.prepare("SELECT id FROM categories WHERE slug = ?")
				.get(slug) as { id: string } | undefined;
			if (!row || row.id === currentId) {
				return slug;
			}
			slug = `${fallback}-${counter}`;
			counter += 1;
		}
	}

	private getDumpSort(
		sort: DumpQueryDto["sort"],
		order: DumpQueryDto["order"],
	) {
		const direction = order === "asc" ? "ASC" : "DESC";
		switch (sort) {
			case "name":
				return `file_name COLLATE NOCASE ${direction}`;
			case "duration":
				return `COALESCE(duration_sec, 0) ${direction}, modified_at DESC`;
			case "lastPlayed":
				return `COALESCE(last_played_at, modified_at) ${direction}`;
			default:
				return `modified_at ${direction}`;
		}
	}

	private toVideoCard(row: VideoRow, categoryCount = 0): VideoCardDto {
		return {
			origin: "library",
			id: row.id,
			fileName: row.file_name,
			sourcePath: row.source_path,
			folderPath: row.folder_path,
			durationSec: row.duration_sec,
			width: row.width,
			height: row.height,
			modifiedAt: row.modified_at,
			posterUrl: row.poster_path
				? `video://local/${encodeURIComponent(row.poster_path)}`
				: null,
			streamUrl: `video://local/${encodeURIComponent(row.source_path)}`,
			resumeSec: row.resume_sec,
			lastPlayedAt: row.last_played_at,
			playCount: row.play_count,
			exists: !row.is_missing,
			categoryCount,
		};
	}
}

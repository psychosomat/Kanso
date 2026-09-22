import { createHash } from "node:crypto";
import fs, { realpathSync } from "node:fs";
import path from "node:path";
import { SUPPORTED_VIDEO_EXTENSIONS } from "../../src/lib/constants";
import type {
	DumpQueryDto,
	DurationBucketName,
	ResolutionBucketName,
} from "../../src/lib/contracts";

// Shared Smart Library helpers (plan B-v1).
// Kept free of sqlite imports so the pure parts stay unit-testable and
// DatabaseService stays a thin wrapper instead of growing into a god-file.

export const IN_PROGRESS_SECONDS_START = 5;
export const IN_PROGRESS_SECONDS_FROM_END = 15;
export const IN_PROGRESS_WATCHED_FRACTION = 0.95;
export const DUPLICATE_DURATION_BUCKET_SEC = 4;
export const CONTINUE_WATCHING_DEFAULT_LIMIT = 20;
export const RECENTLY_ADDED_DEFAULT_LIMIT = 20;

// A video counts as "in progress" when playback started (> 5s in), did not
// reach the credits (< duration - 15s and <= 95% watched) and was played
// at least once. Unknown durations stay visible once started.
export const IN_PROGRESS_WHERE = `(
  resume_sec > ${IN_PROGRESS_SECONDS_START}
  AND last_played_at IS NOT NULL
  AND (
    duration_sec IS NULL
    OR (
      resume_sec < duration_sec - ${IN_PROGRESS_SECONDS_FROM_END}
      AND resume_sec <= duration_sec * ${IN_PROGRESS_WATCHED_FRACTION}
    )
  )
)`;

export function escapeLike(value: string): string {
	return value.replace(/[\\%_"/]/g, (char) => `\\${char}`);
}

export function toLikePattern(search: string): string {
	return `%${escapeLike(search)}%`;
}

export type DumpFilter = {
	where: string;
	params: Record<string, string | number>;
};

const VIDEO_RESOLUTION_BUCKETS = {
	sd: "(height < 700 OR (height IS NULL AND width IS NOT NULL AND width < 1200))",
	"720p":
		"((height >= 700 AND height < 1000) OR (height IS NULL AND width >= 1200 AND width < 1800))",
	"1080p":
		"((height >= 1000 AND height < 1500) OR (height IS NULL AND width >= 1800 AND width < 2600))",
	"4k": "(height >= 2000 OR width >= 3600)",
} as const;

export type ResolutionBucket = ResolutionBucketName;

const VIDEO_DURATION_BUCKETS = {
	short: "duration_sec < 300",
	medium: "duration_sec >= 300 AND duration_sec <= 1200",
	long: "duration_sec > 1200",
} as const;

export type DurationBucket = DurationBucketName;

export function buildDumpFilter(input: DumpQueryDto): DumpFilter {
	const conditions: string[] = [];
	const params: Record<string, string | number> = {};

	const search = input.search?.trim();
	if (search) {
		conditions.push(
			"(file_name COLLATE NOCASE LIKE @search ESCAPE '\\' OR folder_path COLLATE NOCASE LIKE @search ESCAPE '\\')",
		);
		params.search = toLikePattern(search);
	}

	if (input.unsortedOnly) {
		conditions.push(
			"NOT EXISTS (SELECT 1 FROM category_posts cp WHERE cp.video_id = videos.id)",
		);
	}

	if (input.watched === "unwatched") {
		conditions.push("last_played_at IS NULL");
	} else if (input.watched === "watched") {
		conditions.push("last_played_at IS NOT NULL");
	}

	if (input.resolutions && input.resolutions.length > 0) {
		const buckets = input.resolutions
			.map((name) => VIDEO_RESOLUTION_BUCKETS[name])
			.filter(Boolean);
		if (buckets.length > 0) {
			conditions.push(`(${buckets.join(" OR ")})`);
		}
	}

	if (input.codecVideo?.trim()) {
		conditions.push("codec_video COLLATE NOCASE = @codecVideo");
		params.codecVideo = input.codecVideo.trim();
	}

	const durationBuckets = input.durationBuckets
		?.map((name) => VIDEO_DURATION_BUCKETS[name])
		.filter(Boolean);
	const durationParts: string[] = [];
	if (durationBuckets && durationBuckets.length > 0) {
		durationParts.push(`(${durationBuckets.join(" OR ")})`);
	}
	if (typeof input.minDurationSec === "number") {
		durationParts.push("duration_sec >= @minDurationSec");
		params.minDurationSec = input.minDurationSec;
	}
	if (typeof input.maxDurationSec === "number") {
		durationParts.push("duration_sec <= @maxDurationSec");
		params.maxDurationSec = input.maxDurationSec;
	}
	if (durationParts.length > 0) {
		conditions.push(`(${durationParts.join(" AND ")})`);
	}

	return {
		where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
		params,
	};
}

// Duration bucket of ±2s: videos whose durations fall into the same 4s
// window are duplicate candidates. Grouping key is (file_size, bucket).
// No auto-merge, no deletion, no full-file hashing during scan.
export const DUPLICATE_GROUPS_SQL = `
	SELECT file_size AS fileSize,
		CAST(duration_sec / ${DUPLICATE_DURATION_BUCKET_SEC} AS INTEGER) AS durationBucket,
		COUNT(*) AS memberCount,
		GROUP_CONCAT(id) AS memberIds
	FROM videos
	WHERE is_missing = 0
		AND file_size IS NOT NULL
		AND duration_sec IS NOT NULL
	GROUP BY file_size, CAST(duration_sec / ${DUPLICATE_DURATION_BUCKET_SEC} AS INTEGER)
	HAVING COUNT(*) > 1
	ORDER BY memberCount DESC
`;

export function sha1Name(sourcePath: string, suffix = ""): string {
	return `${createHash("sha1").update(sourcePath).digest("hex")}${suffix}`;
}

export type { DuplicateGroupDto } from "../../src/lib/contracts";

// Explicitly opened files (open-with, drag onto the app, file dialogs) are
// allowed to play even when they live outside every library root. The main
// process registers them here; the video:// gate consults this set.
const allowedExternalPaths = new Set<string>();

function canonicalizeLoose(targetPath: string): string | null {
	try {
		return realpathSync(path.resolve(targetPath));
	} catch {
		return null;
	}
}

export function allowExternalMediaPath(sourcePath: string): void {
	const canonical = canonicalizeLoose(sourcePath) ?? path.resolve(sourcePath);
	allowedExternalPaths.add(canonical);
}

export function isAllowedExternalMediaPath(candidate: string): boolean {
	if (allowedExternalPaths.has(candidate)) {
		return true;
	}
	const canonical = canonicalizeLoose(candidate);
	return canonical !== null && allowedExternalPaths.has(canonical);
}

export type MediaAccessGate = {
	libraryRoots: string[];
	transmuxDir: string | null;
	isKnownSourcePath: (candidate: string) => boolean;
	isAllowedExternalPath: (candidate: string) => boolean;
};

function isWithinDir(candidate: string, dir: string): boolean {
	const relative = path.relative(dir, candidate);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function canonicalizeDir(dir: string): string | null {
	try {
		return realpathSync(path.resolve(dir));
	} catch {
		return null;
	}
}

function canonicalizeFile(targetPath: string): string | null {
	const resolved = path.resolve(targetPath);
	let real = resolved;
	try {
		real = realpathSync(resolved);
	} catch {
		return null;
	}
	try {
		if (!fs.statSync(real).isFile()) {
			return null;
		}
	} catch {
		return null;
	}
	return real;
}

// Security gate for every video:// resolve: resolve -> realpath ->
// must live under a library root, the transmux cache, the DB index, or an
// explicitly opened external path. Weird-but-valid names
// ("a;rm -rf ~.mkv") pass through untouched: the value is never executed,
// only compared as data, and every child process is spawned with argv.
export function resolveMediaPath(
	requestedPath: string,
	gate: MediaAccessGate,
): string {
	if (!requestedPath || requestedPath.length > 4096) {
		throw new Error("Invalid media path.");
	}
	const real = canonicalizeFile(requestedPath);
	if (!real) {
		throw new Error("Media file not found.");
	}
	const ext = path.extname(real).toLowerCase();
	if (
		!SUPPORTED_VIDEO_EXTENSIONS.includes(
			ext as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
		)
	) {
		throw new Error("Unsupported media type.");
	}

	if (gate.transmuxDir) {
		const cacheDir = canonicalizeDir(gate.transmuxDir);
		if (cacheDir && isWithinDir(real, cacheDir)) {
			return real;
		}
	}
	for (const root of gate.libraryRoots) {
		const canonicalRoot = canonicalizeDir(root);
		if (canonicalRoot && isWithinDir(real, canonicalRoot)) {
			return real;
		}
	}
	if (gate.isKnownSourcePath(real) || gate.isKnownSourcePath(requestedPath)) {
		return real;
	}
	if (gate.isAllowedExternalPath(real)) {
		return real;
	}
	throw new Error("Media path is outside the library.");
}

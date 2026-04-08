import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ExternalVideoDto } from "../../src/lib/contracts";
import { probeMedia } from "./media-metadata";
import type { PosterCacheService } from "./poster-cache";

export async function getExternalVideoDetails(
	sourcePath: string,
	posterCache: PosterCacheService,
): Promise<ExternalVideoDto | null> {
	try {
		const resolvedPath = path.resolve(sourcePath);
		const stats = fs.statSync(resolvedPath);
		if (!stats.isFile()) {
			return null;
		}

		const metadata = await probeMedia(resolvedPath);
		const modifiedAt = stats.mtime.toISOString();

		// Generate a temporary ID for poster caching based on file path hash
		const tempVideoId = crypto
			.createHash("md5")
			.update(resolvedPath)
			.digest("hex");

		const posterPath = await posterCache.ensurePoster(
			tempVideoId,
			resolvedPath,
			metadata.durationSec,
			modifiedAt,
		);

		return {
			origin: "external",
			id: null,
			fileName: path.basename(resolvedPath),
			sourcePath: resolvedPath,
			folderPath: path.dirname(resolvedPath),
			durationSec: metadata.durationSec,
			width: metadata.width,
			height: metadata.height,
			modifiedAt,
			posterUrl: posterPath ? `file://${posterPath}` : null,
			streamUrl: `video://local/${encodeURIComponent(resolvedPath)}`,
			resumeSec: 0,
			lastPlayedAt: null,
			playCount: 0,
			exists: true,
			categoryCount: 0,
			codecVideo: metadata.codecVideo,
			codecAudio: metadata.codecAudio,
			bitrate: metadata.bitrate,
			fps: metadata.fps,
			fileSize: stats.size,
			categories: [],
			assignedCategoryCount: 0,
		};
	} catch {
		return null;
	}
}

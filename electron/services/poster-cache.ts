import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

function sanitizeMtime(modifiedAt: string) {
	return modifiedAt.replace(/[^0-9]/g, "").slice(0, 14);
}

export class PosterCacheService {
	constructor(private readonly cacheDir: string) {}

	async ensurePoster(
		videoId: string,
		sourcePath: string,
		durationSec: number | null,
		modifiedAt: string,
	) {
		const binaryPath = ffmpegPath as string | null;
		if (!binaryPath) return null;

		// Ensure cache directory exists
		await fs.mkdir(this.cacheDir, { recursive: true });

		// Normalize source path for macOS compatibility
		const normalizedSourcePath = path.resolve(sourcePath);
		const outputPath = path.join(
			this.cacheDir,
			`${videoId}-${sanitizeMtime(modifiedAt)}.jpg`,
		);

		try {
			await fs.access(outputPath);
			return outputPath;
		} catch {}

		const seekPoint =
			durationSec && durationSec > 10
				? Math.max(1, Math.floor(durationSec * 0.15))
				: 1;

		// Enhanced logging for macOS debugging
		if (process.platform === "darwin") {
			console.log("[POSTER CACHE] macOS generating poster:", {
				videoId,
				sourcePath: normalizedSourcePath,
				outputPath,
				seekPoint,
			});
		}

		const generated = await new Promise<boolean>((resolve) => {
			const child = spawn(binaryPath, [
				"-y",
				"-ss",
				String(seekPoint),
				"-i",
				normalizedSourcePath,
				"-frames:v",
				"1",
				"-vf",
				"scale=640:-1",
				outputPath,
			]);

			child.on("close", (code: number | null) => {
				const success = code === 0;
				if (process.platform === "darwin") {
					console.log("[POSTER CACHE] macOS ffmpeg result:", { code, success });
				}
				resolve(success);
			});

			child.on("error", (error) => {
				if (process.platform === "darwin") {
					console.error("[POSTER CACHE] macOS ffmpeg error:", error);
				}
				resolve(false);
			});
		});

		return generated ? outputPath : null;
	}
}

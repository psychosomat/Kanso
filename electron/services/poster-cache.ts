import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { resolveNativeBinaryPath } from "./binary-resolver";

export class PosterCacheService {
	constructor(private readonly cacheDir: string) {}

	async ensurePoster(
		videoId: string,
		sourcePath: string,
		_durationSec: number | null,
		modifiedAt: string,
	): Promise<string | null> {
		const binaryPath = resolveNativeBinaryPath(ffmpegPath);
		if (!binaryPath) {
			console.error(
				"[FFMPEG] ffmpeg binary not found (tried:",
				ffmpegPath,
				")",
			);
			return null;
		}

		// Ensure cache directory exists
		await fs.mkdir(this.cacheDir, { recursive: true });

		const normalizedSourcePath = path.resolve(sourcePath);
		const sanitizedMtime = modifiedAt.replace(/[^0-9]/g, "").slice(0, 14);
		const cacheKey = `${videoId}-${sanitizedMtime}`;
		const outputPath = path.join(this.cacheDir, `${cacheKey}.jpg`);

		try {
			await fs.access(outputPath);
			return outputPath;
		} catch {
			// File doesn't exist, generate it
		}

		const seekPoint = 0;
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
				resolve(code === 0);
			});

			child.on("error", () => {
				resolve(false);
			});
		});

		return generated ? outputPath : null;
	}
}

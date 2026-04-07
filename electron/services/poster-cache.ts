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
		await fs.mkdir(this.cacheDir, { recursive: true });
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

		const generated = await new Promise<boolean>((resolve) => {
			const child = spawn(binaryPath, [
				"-y",
				"-ss",
				String(seekPoint),
				"-i",
				sourcePath,
				"-frames:v",
				"1",
				"-vf",
				"scale=640:-1",
				outputPath,
			]);
			child.on("close", (code: number | null) => resolve(code === 0));
			child.on("error", () => resolve(false));
		});

		return generated ? outputPath : null;
	}
}

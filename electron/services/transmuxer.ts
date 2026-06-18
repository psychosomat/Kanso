import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { resolveNativeBinaryPath } from "./binary-resolver";

function getCacheDir() {
	const appData =
		process.env.APPDATA ||
		(process.platform === "darwin"
			? `${process.env.HOME}/Library/Application Support`
			: `${process.env.XDG_DATA_HOME || `${process.env.HOME}/.local/share`}`);
	return path.join(appData, "kanso", "cache", "transmux");
}

export class TransmuxerService {
	private cacheDir: string;
	private pending = new Map<string, Promise<string>>();

	constructor(cacheDir?: string) {
		this.cacheDir = cacheDir ?? getCacheDir();
	}

	private cachePath(sourcePath: string): string {
		const parsed = path.parse(sourcePath);
		const name = `${parsed.name}.mp4`;
		return path.join(this.cacheDir, name);
	}

	async ensureTransmuxed(sourcePath: string): Promise<string> {
		const ext = path.extname(sourcePath).toLowerCase();
		if (ext !== ".ts") {
			return sourcePath;
		}

		const outputPath = this.cachePath(sourcePath);

		if (existsSync(outputPath)) {
			return outputPath;
		}

		const existing = this.pending.get(sourcePath);
		if (existing) {
			return existing;
		}

		const promise = this.transmux(sourcePath, outputPath);
		this.pending.set(sourcePath, promise);
		try {
			return await promise;
		} finally {
			this.pending.delete(sourcePath);
		}
	}

	private async transmux(
		sourcePath: string,
		outputPath: string,
	): Promise<string> {
		const binaryPath = resolveNativeBinaryPath(ffmpegPath);
		if (!binaryPath) {
			console.error(
				"[TRANSMUXER] ffmpeg binary not found (tried:",
				ffmpegPath,
				")",
			);
			return sourcePath;
		}

		await fs.mkdir(path.dirname(outputPath), { recursive: true });

		const result = await new Promise<boolean>((resolve) => {
			const child = spawn(binaryPath, [
				"-y",
				"-i",
				path.resolve(sourcePath),
				"-c",
				"copy",
				"-movflags",
				"+faststart",
				outputPath,
			]);

			let stderr = "";
			child.stderr.on("data", (chunk) => {
				stderr += chunk.toString();
			});

			child.on("close", (code) => {
				if (code === 0) {
					resolve(true);
				} else {
					console.error(
						"[TRANSMUXER] ffmpeg exited with code",
						code,
						"for",
						sourcePath,
						stderr,
					);
					resolve(false);
				}
			});

			child.on("error", (error) => {
				console.error("[TRANSMUXER] ffmpeg spawn error:", error);
				resolve(false);
			});
		});

		if (result && existsSync(outputPath)) {
			return outputPath;
		}

		return sourcePath;
	}
}

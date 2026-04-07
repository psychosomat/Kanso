import fs from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_VIDEO_EXTENSIONS } from "../../src/lib/constants";
import type { ScanStatusDto } from "../../src/lib/contracts";
import { DatabaseService } from "./db";
import { FileWatchService } from "./file-watch";
import { probeMedia } from "./media-metadata";
import { PosterCacheService } from "./poster-cache";

function isSupportedVideo(filePath: string) {
	return SUPPORTED_VIDEO_EXTENSIONS.includes(
		path
			.extname(filePath)
			.toLowerCase() as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
	);
}

async function listFilesRecursive(rootPath: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await fs.readdir(rootPath, { withFileTypes: true });
	for (const entry of entries) {
		const entryPath = path.join(rootPath, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await listFilesRecursive(entryPath)));
		} else if (entry.isFile() && isSupportedVideo(entryPath)) {
			results.push(entryPath);
		}
	}
	return results;
}

export class LibraryIndexerService {
	private watchService = new FileWatchService();
	private queue = Promise.resolve();
	private scanListeners = new Set<(status: ScanStatusDto) => void>();
	private latestStatus: ScanStatusDto = {
		status: "idle",
		stage: "idle",
		scannedFiles: 0,
		totalFiles: 0,
		currentPath: null,
		message: "Ready",
		error: null,
		updatedAt: new Date().toISOString(),
	};
	private lastPublishTime = 0;
	private readonly PUBLISH_THROTTLE_MS = 100;

	constructor(
		private readonly db: DatabaseService,
		private readonly posterCache: PosterCacheService,
	) {}

	subscribe(listener: (status: ScanStatusDto) => void) {
		this.scanListeners.add(listener);
		listener(this.latestStatus);
		return () => {
			this.scanListeners.delete(listener);
		};
	}

	async configureWatches(sourcePaths: string[]) {
		await this.watchService.stop();
		for (const sourcePath of sourcePaths) {
			await this.watchService.start(sourcePath, {
				onAdd: (filePath) => void this.enqueueUpsert(filePath),
				onChange: (filePath) => void this.enqueueUpsert(filePath),
				onUnlink: (filePath) => void this.enqueueMissing(filePath),
			});
		}
	}

	async stopWatch() {
		await this.watchService.stop();
	}

	async fullScanAll(sourcePaths: string[]) {
		if (sourcePaths.length === 0) return;
		console.log(
			"[LIBRARY SCAN] Starting scan of",
			sourcePaths.length,
			"folders",
		);
		console.time("[LIBRARY SCAN] Total scan time");
		this.db.updateScanState({ scanStatus: "scanning", scanError: null });
		try {
			const allFiles: string[] = [];
			for (const sourcePath of sourcePaths) {
				const files = await listFilesRecursive(sourcePath);
				allFiles.push(...files);
			}
			console.log("[LIBRARY SCAN] Found", allFiles.length, "video files");
			const seen = new Set<string>();
			this.lastPublishTime = 0;
			this.publish({
				status: "scanning",
				stage: "scan",
				scannedFiles: 0,
				totalFiles: allFiles.length,
				currentPath: null,
				message: "Indexing library",
				error: null,
			});

			// Process files in batches to avoid blocking event loop
			const BATCH_SIZE = 10;
			for (let index = 0; index < allFiles.length; index += 1) {
				const filePath = allFiles[index];
				seen.add(filePath);
				await this.processFile(filePath);

				// Publish progress (throttled to avoid IPC spam)
				const now = Date.now();
				const shouldPublish =
					now - this.lastPublishTime >= this.PUBLISH_THROTTLE_MS ||
					index + 1 === allFiles.length;
				if (shouldPublish) {
					this.publish({
						status: "scanning",
						stage: "scan",
						scannedFiles: index + 1,
						totalFiles: allFiles.length,
						currentPath: filePath,
						message: "Indexing library",
						error: null,
					});
					this.lastPublishTime = now;
				}

				// Yield to event loop every BATCH_SIZE files
				if ((index + 1) % BATCH_SIZE === 0) {
					await new Promise((resolve) => setImmediate(resolve));
				}
			}

			const finishedAt = new Date().toISOString();
			for (const sourcePath of sourcePaths) {
				this.db.markMissingUnderRoot(sourcePath, seen);
			}
			this.db.updateScanState({
				scanStatus: "idle",
				scanError: null,
				lastScanAt: finishedAt,
			});
			console.timeEnd("[LIBRARY SCAN] Total scan time");
			console.log(
				"[LIBRARY SCAN] Scan complete:",
				allFiles.length,
				"files processed",
			);
			this.publish({
				status: "idle",
				stage: "scan",
				scannedFiles: allFiles.length,
				totalFiles: allFiles.length,
				currentPath: null,
				message:
					allFiles.length > 0
						? "Library scan complete"
						: "No supported videos found",
				error: null,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown scan error";
			this.db.updateScanState({
				scanStatus: "error",
				scanError: message,
				lastScanAt: new Date().toISOString(),
			});
			this.publish({
				status: "error",
				stage: "scan",
				scannedFiles: 0,
				totalFiles: 0,
				currentPath: null,
				message: "Scan failed",
				error: message,
			});
			throw error;
		}
	}

	async fullScan(sourcePath: string) {
		await this.fullScanAll([sourcePath]);
	}

	private publish(status: Omit<ScanStatusDto, "updatedAt">) {
		this.latestStatus = { ...status, updatedAt: new Date().toISOString() };
		for (const listener of this.scanListeners) {
			listener(this.latestStatus);
		}
	}

	private enqueue(task: () => Promise<void>) {
		this.queue = this.queue
			.catch((error) => {
				const message =
					error instanceof Error ? error.message : "Unknown watch error";
				this.publish({
					status: "error",
					stage: "watch",
					scannedFiles: 0,
					totalFiles: 0,
					currentPath: null,
					message: "Watch update failed",
					error: message,
				});
			})
			.then(task);
	}

	private enqueueUpsert(filePath: string) {
		if (!isSupportedVideo(filePath)) return;
		this.enqueue(async () => {
			const updated = await this.processFile(filePath);
			if (!updated) return;
			this.publish({
				status: "idle",
				stage: "watch",
				scannedFiles: 1,
				totalFiles: 1,
				currentPath: filePath,
				message: "Library updated",
				error: null,
			});
		});
	}

	private enqueueMissing(filePath: string) {
		if (!isSupportedVideo(filePath)) return;
		this.enqueue(async () => {
			this.db.markVideoMissingByPath(filePath);
			this.publish({
				status: "idle",
				stage: "watch",
				scannedFiles: 0,
				totalFiles: 0,
				currentPath: filePath,
				message: "Removed file detected",
				error: null,
			});
		});
	}

	private async processFile(filePath: string) {
		if (!isSupportedVideo(filePath)) return;
		let stats: Awaited<ReturnType<typeof fs.stat>>;
		try {
			stats = await fs.stat(filePath);
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				this.db.markVideoMissingByPath(filePath);
				this.publish({
					status: "idle",
					stage: "watch",
					scannedFiles: 0,
					totalFiles: 0,
					currentPath: filePath,
					message: "File moved or removed",
					error: null,
				});
				return false;
			}
			throw error;
		}
		const metadata = await probeMedia(filePath);
		const modifiedAt = stats.mtime.toISOString();
		const videoId = this.db.upsertVideo({
			sourcePath: filePath,
			fileName: path.basename(filePath),
			folderPath: path.dirname(filePath),
			fileSize: stats.size,
			modifiedAt,
			durationSec: metadata.durationSec,
			width: metadata.width,
			height: metadata.height,
			fps: metadata.fps,
			codecVideo: metadata.codecVideo,
			codecAudio: metadata.codecAudio,
			bitrate: metadata.bitrate,
			posterPath: null,
		});

		const posterPath = await this.posterCache.ensurePoster(
			videoId,
			filePath,
			metadata.durationSec,
			modifiedAt,
		);

		this.db.upsertVideo({
			sourcePath: filePath,
			fileName: path.basename(filePath),
			folderPath: path.dirname(filePath),
			fileSize: stats.size,
			modifiedAt,
			durationSec: metadata.durationSec,
			width: metadata.width,
			height: metadata.height,
			fps: metadata.fps,
			codecVideo: metadata.codecVideo,
			codecAudio: metadata.codecAudio,
			bitrate: metadata.bitrate,
			posterPath,
		});
		return true;
	}
}

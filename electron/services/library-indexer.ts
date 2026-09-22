import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { SUPPORTED_VIDEO_EXTENSIONS } from "../../src/lib/constants";
import type { ScanStatusDto } from "../../src/lib/contracts";
import { DatabaseService } from "./db";
import { FileWatchService } from "./file-watch";
import { EMPTY_METADATA, probeMedia } from "./media-metadata";
import { PosterCacheService } from "./poster-cache";
import { TransmuxerService } from "./transmuxer";

export function isSupportedVideo(filePath: string) {
	return SUPPORTED_VIDEO_EXTENSIONS.includes(
		path
			.extname(filePath)
			.toLowerCase() as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
	);
}

export function selectWatchPaths(
	sourcePaths: Array<{ watchEnabled: boolean; path: string }>,
): string[] {
	const out: string[] = [];
	for (const sp of sourcePaths) {
		if (sp.watchEnabled) out.push(sp.path);
	}
	return out;
}

async function listFilesRecursive(rootPath: string): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await fs.readdir(rootPath, { withFileTypes: true });
	} catch (error) {
		console.error(
			"[INDEXER] Cannot read directory, skipping:",
			rootPath,
			error,
		);
		return [];
	}
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(rootPath, entry.name);
			try {
				if (entry.isDirectory()) {
					return listFilesRecursive(entryPath);
				}
				if (entry.isFile() && isSupportedVideo(entryPath)) {
					return [entryPath];
				}
			} catch (error) {
				console.error(
					"[INDEXER] Cannot inspect path, skipping:",
					entryPath,
					error,
				);
			}
			return [];
		}),
	);
	return nested.flat();
}

const SCAN_BATCH_SIZE = 50;

function isFileNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

function toScanErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown scan error";
}

async function yieldToEventLoop(): Promise<void> {
	await new Promise((resolve) => setImmediate(resolve));
}

async function listFilesSafe(sourcePath: string): Promise<string[]> {
	try {
		return await listFilesRecursive(sourcePath);
	} catch (error) {
		console.error(
			"[INDEXER] Failed to list files under source, skipping:",
			sourcePath,
			error,
		);
		return [];
	}
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
		private readonly transmuxer?: TransmuxerService,
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
		await Promise.all(
			sourcePaths.map((sourcePath) =>
				this.watchService.start(sourcePath, {
					onAdd: (filePath) => void this.enqueueUpsert(filePath),
					onChange: (filePath) => void this.enqueueUpsert(filePath),
					onUnlink: (filePath) => void this.enqueueMissing(filePath),
				}),
			),
		);
	}

	async stopWatch() {
		await this.watchService.stop();
	}

	async fullScanAll(sourcePaths: string[]) {
		if (sourcePaths.length === 0) return;
		this.db.updateScanState({ scanStatus: "scanning", scanError: null });
		try {
			const allFiles = await this.collectFiles(sourcePaths);
			const seen = new Set<string>();
			this.lastPublishTime = 0;
			this.publishScanStart(allFiles.length);
			await this.indexFilesSequentially(allFiles, seen);
			this.finalizeScan(sourcePaths, allFiles, seen);
		} catch (error) {
			const message = toScanErrorMessage(error);
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

	private async collectFiles(sourcePaths: string[]): Promise<string[]> {
		const grouped = await Promise.all(sourcePaths.map(listFilesSafe));
		return grouped.flat();
	}

	private publishScanStart(totalFiles: number) {
		this.publish({
			status: "scanning",
			stage: "scan",
			scannedFiles: 0,
			totalFiles,
			currentPath: null,
			message: "Indexing library",
			error: null,
		});
	}

	private async indexFilesSequentially(allFiles: string[], seen: Set<string>) {
		for (let index = 0; index < allFiles.length; index += 1) {
			const filePath = allFiles[index];
			seen.add(filePath);
			await this.indexSingleFile(filePath);
			this.publishScanProgress(allFiles, filePath, index);
			if ((index + 1) % SCAN_BATCH_SIZE === 0) {
				await yieldToEventLoop();
			}
		}
	}

	private async indexSingleFile(filePath: string) {
		try {
			await this.processFile(filePath);
		} catch (error) {
			console.error(
				"[INDEXER] Failed to index file, skipping:",
				filePath,
				error,
			);
		}
	}

	private publishScanProgress(
		allFiles: string[],
		filePath: string,
		index: number,
	) {
		const now = Date.now();
		const shouldPublish =
			now - this.lastPublishTime >= this.PUBLISH_THROTTLE_MS ||
			index + 1 === allFiles.length;
		if (!shouldPublish) return;
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

	private finalizeScan(
		sourcePaths: string[],
		allFiles: string[],
		seen: Set<string>,
	) {
		const finishedAt = new Date().toISOString();
		for (const sourcePath of sourcePaths) {
			this.db.markMissingUnderRoot(sourcePath, seen);
		}
		this.db.updateScanState({
			scanStatus: "idle",
			scanError: null,
			lastScanAt: finishedAt,
		});
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

	private publishIdle(currentPath: string, message: string, scannedFiles = 0) {
		this.publish({
			status: "idle",
			stage: "watch",
			scannedFiles,
			totalFiles: scannedFiles,
			currentPath,
			message,
			error: null,
		});
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
			this.publishIdle(filePath, "Library updated", 1);
		});
	}

	private enqueueMissing(filePath: string) {
		if (!isSupportedVideo(filePath)) return;
		this.enqueue(async () => {
			this.db.markVideoMissingByPath(filePath);
			this.publishIdle(filePath, "Removed file detected");
		});
	}

	private async processFile(filePath: string): Promise<boolean> {
		console.log("[INDEXER] Processing file:", filePath);
		if (!isSupportedVideo(filePath)) {
			console.log("[INDEXER] File not supported, skipping");
			return false;
		}
		const stats = await this.statFile(filePath);
		if (!stats) return false;
		const metadata = await this.resolveMetadata(filePath);
		const modifiedAt = stats.mtime.toISOString();
		const videoId = this.persistVideo(filePath, stats, metadata, null);
		const posterPath = await this.posterCache.ensurePoster(
			videoId,
			filePath,
			metadata.durationSec,
			modifiedAt,
		);
		this.persistVideo(filePath, stats, metadata, posterPath);
		this.maybeScheduleTransmux(filePath);
		return true;
	}

	private persistVideo(
		filePath: string,
		stats: { size: number; mtime: Date },
		metadata: typeof EMPTY_METADATA,
		posterPath: string | null,
	) {
		return this.db.upsertVideo(
			this.buildVideoRecord(filePath, stats, metadata, posterPath),
		);
	}

	private async statFile(
		filePath: string,
	): Promise<{ size: number; mtime: Date } | null> {
		try {
			return await fs.stat(filePath);
		} catch (error) {
			console.log("[INDEXER] Error stating file:", error);
			if (isFileNotFoundError(error)) {
				this.markFileMissing(filePath);
				return null;
			}
			throw error;
		}
	}

	private markFileMissing(filePath: string) {
		this.db.markVideoMissingByPath(filePath);
		this.publishIdle(filePath, "File moved or removed");
	}

	private async resolveMetadata(filePath: string) {
		return probeMedia(filePath).catch((error) => {
			console.error(
				"[INDEXER] Probe failed, indexing without metadata:",
				filePath,
				error,
			);
			return EMPTY_METADATA;
		});
	}

	private buildVideoRecord(
		filePath: string,
		stats: { size: number; mtime: Date },
		metadata: typeof EMPTY_METADATA,
		posterPath: string | null,
	) {
		return {
			sourcePath: filePath,
			fileName: path.basename(filePath),
			folderPath: path.dirname(filePath),
			fileSize: stats.size,
			modifiedAt: stats.mtime.toISOString(),
			durationSec: metadata.durationSec,
			width: metadata.width,
			height: metadata.height,
			fps: metadata.fps,
			codecVideo: metadata.codecVideo,
			codecAudio: metadata.codecAudio,
			bitrate: metadata.bitrate,
			posterPath,
		};
	}

	private maybeScheduleTransmux(filePath: string) {
		if (!this.transmuxer) return;
		if (path.extname(filePath).toLowerCase() !== ".ts") return;
		this.transmuxer.ensureTransmuxed(filePath).catch((error) => {
			console.error("[INDEXER] Background transmux failed:", filePath, error);
		});
	}
}

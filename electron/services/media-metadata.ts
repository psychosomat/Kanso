import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { resolveNativeBinaryPath } from "./binary-resolver";

export type MediaMetadata = {
	durationSec: number | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	codecVideo: string | null;
	codecAudio: string | null;
	bitrate: number | null;
};

export const EMPTY_METADATA: MediaMetadata = {
	durationSec: null,
	width: null,
	height: null,
	fps: null,
	codecVideo: null,
	codecAudio: null,
	bitrate: null,
};

export type FfprobeStream = {
	codec_type?: string;
	codec_name?: string;
	width?: number;
	height?: number;
	avg_frame_rate?: string;
	duration?: string | number;
	bit_rate?: string | number;
	tags?: Record<string, string | undefined>;
};

export type FfprobeFormat = {
	duration?: string | number;
	bit_rate?: string | number;
	tags?: Record<string, string | undefined>;
};

export type FfprobePayload = {
	streams?: FfprobeStream[];
	format?: FfprobeFormat;
};

const CLOCK_DURATION_RE = /^(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/;
const FFMPEG_DURATION_RE = /Duration:\s*([^,\r\n]+)/i;
const FFMPEG_VIDEO_LINE_RE = /Stream\s+#[^\r\n]*?\bVideo:([^\r\n]+)/i;
const FFMPEG_DIMENSIONS_RE = /(?:^|[,\s])(\d{2,5})x(\d{2,5})(?=$|[,\s[(])/;

function parsePositiveNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) && value > 0 ? value : null;
	}
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.toUpperCase() === "N/A") return null;
	const numeric = Number(trimmed);
	return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parsePositiveInt(value: unknown): number | null {
	const numeric = parsePositiveNumber(value);
	return numeric !== null ? Math.round(numeric) : null;
}

/**
 * Parses numeric durations (in seconds) as well as `HH:MM:SS(.mmm)` clock
 * strings emitted by Matroska tags and ffmpeg stderr.
 */
export function parseDurationValue(value: unknown): number | null {
	const direct = parsePositiveNumber(value);
	if (direct !== null) {
		return direct;
	}
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed || trimmed.toUpperCase() === "N/A") {
		return null;
	}

	const match = CLOCK_DURATION_RE.exec(trimmed);
	if (!match) {
		return null;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	const total = hours * 3600 + minutes * 60 + seconds;
	return Number.isFinite(total) && total > 0 ? total : null;
}

function readDurationTag(
	tags: Record<string, string | undefined> | undefined,
): number | null {
	if (!tags) return null;

	const directCandidates = [tags.DURATION, tags.duration];
	for (const candidate of directCandidates) {
		const parsed = parseDurationValue(candidate);
		if (parsed !== null) return parsed;
	}

	for (const [key, value] of Object.entries(tags)) {
		if (/^duration(?:-[a-z]{2,3})?$/i.test(key)) {
			const parsed = parseDurationValue(value);
			if (parsed !== null) return parsed;
		}
	}

	return null;
}

function parseFps(value: string | undefined): number | null {
	if (!value?.includes("/")) return null;
	const [numerator, denominator] = value.split("/").map(Number);
	if (
		!Number.isFinite(numerator) ||
		!Number.isFinite(denominator) ||
		numerator <= 0 ||
		denominator <= 0
	) {
		return null;
	}
	return numerator / denominator;
}

/**
 * Extracts normalized media metadata from a parsed ffprobe JSON payload.
 */
export function parseFfprobeMetadata(payload: FfprobePayload): MediaMetadata {
	const videoStream = payload.streams?.find(
		(stream) => stream.codec_type === "video",
	);
	const audioStream = payload.streams?.find(
		(stream) => stream.codec_type === "audio",
	);

	const durationSec =
		parseDurationValue(payload.format?.duration) ??
		parseDurationValue(videoStream?.duration) ??
		parseDurationValue(audioStream?.duration) ??
		readDurationTag(videoStream?.tags) ??
		readDurationTag(payload.format?.tags) ??
		readDurationTag(audioStream?.tags);

	return {
		durationSec,
		width: parsePositiveInt(videoStream?.width),
		height: parsePositiveInt(videoStream?.height),
		fps: parseFps(videoStream?.avg_frame_rate),
		codecVideo: videoStream?.codec_name ?? null,
		codecAudio: audioStream?.codec_name ?? null,
		bitrate:
			parsePositiveNumber(payload.format?.bit_rate) ??
			parsePositiveNumber(videoStream?.bit_rate),
	};
}

/**
 * Parses raw ffprobe JSON stdout into `MediaMetadata`, returning `null` if
 * stdout is empty or invalid JSON.
 */
export function parseFfprobeJson(stdout: string): MediaMetadata | null {
	if (!stdout.trim()) return null;
	try {
		const parsed = JSON.parse(stdout) as FfprobePayload;
		return parseFfprobeMetadata(parsed);
	} catch {
		return null;
	}
}

/**
 * Parses `Duration: HH:MM:SS.xx` and video stream `WxH` dimensions from
 * `ffmpeg -nostdin -i <path>` stderr output.
 */
export function parseFfmpegStderr(
	stderr: string,
): Pick<MediaMetadata, "durationSec" | "width" | "height"> {
	const durationMatch = FFMPEG_DURATION_RE.exec(stderr);
	const durationSec = durationMatch
		? parseDurationValue(durationMatch[1])
		: null;

	let width: number | null = null;
	let height: number | null = null;
	const videoLineMatch = FFMPEG_VIDEO_LINE_RE.exec(stderr);
	if (videoLineMatch) {
		const dimsMatch = FFMPEG_DIMENSIONS_RE.exec(videoLineMatch[1]);
		if (dimsMatch) {
			const parsedW = parsePositiveInt(dimsMatch[1]);
			const parsedH = parsePositiveInt(dimsMatch[2]);
			if (parsedW !== null && parsedH !== null) {
				width = parsedW;
				height = parsedH;
			}
		}
	}

	return { durationSec, width, height };
}

async function runFfprobe(
	ffprobeBinary: string,
	sourcePath: string,
): Promise<MediaMetadata | null> {
	const stdout = await new Promise<string>((resolve, reject) => {
		const child = spawn(ffprobeBinary, [
			"-v",
			"error",
			"-print_format",
			"json",
			"-show_streams",
			"-show_format",
			sourcePath,
		]);

		let output = "";
		let error = "";

		child.stdout.on("data", (chunk) => {
			output += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			error += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(error || `ffprobe exited with code ${code}`));
			}
		});
	}).catch((error) => {
		console.error("[FFPROBE] probe failed for", sourcePath, error);
		return "";
	});

	if (!stdout) return null;
	const parsed = parseFfprobeJson(stdout);
	if (!parsed) {
		console.error("[FFPROBE] unparsable output for", sourcePath);
	}
	return parsed;
}

async function runFfmpegFallback(
	sourcePath: string,
): Promise<Pick<MediaMetadata, "durationSec" | "width" | "height">> {
	const ffmpegBinary = resolveNativeBinaryPath(ffmpegPath);
	if (!ffmpegBinary) {
		console.error(
			"[FFMPEG] ffmpeg binary not found for metadata fallback (tried:",
			ffmpegPath,
			")",
		);
		return { durationSec: null, width: null, height: null };
	}

	const stderr = await new Promise<string>((resolve) => {
		const child = spawn(ffmpegBinary, ["-nostdin", "-i", sourcePath]);
		let errorOutput = "";

		child.stderr.on("data", (chunk) => {
			errorOutput += chunk.toString();
		});
		child.on("error", (error) => {
			console.error("[FFMPEG] metadata fallback spawn failed:", error);
			resolve("");
		});
		// `ffmpeg -i` without an output exits non-zero after printing headers.
		child.on("close", () => {
			resolve(errorOutput);
		});
	});

	return parseFfmpegStderr(stderr);
}

export async function probeMedia(sourcePath: string): Promise<MediaMetadata> {
	const ffprobeBinary = resolveNativeBinaryPath(ffprobeStatic.path);
	let metadata: MediaMetadata | null = null;

	if (!ffprobeBinary) {
		console.error(
			"[FFPROBE] ffprobe binary not found (tried:",
			ffprobeStatic.path,
			")",
		);
	} else {
		metadata = await runFfprobe(ffprobeBinary, sourcePath);
	}

	const resolved: MediaMetadata = metadata ?? { ...EMPTY_METADATA };
	if (resolved.durationSec === null) {
		const fallback = await runFfmpegFallback(sourcePath);
		return {
			...resolved,
			durationSec: fallback.durationSec ?? resolved.durationSec,
			width: resolved.width ?? fallback.width,
			height: resolved.height ?? fallback.height,
		};
	}

	return resolved;
}

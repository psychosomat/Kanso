import { spawn } from "node:child_process";
import ffprobeStatic from "ffprobe-static";

export type MediaMetadata = {
	durationSec: number | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	codecVideo: string | null;
	codecAudio: string | null;
	bitrate: number | null;
};

function parseFps(value: string | undefined) {
	if (!value?.includes("/")) return null;
	const [numerator, denominator] = value.split("/").map(Number);
	if (!numerator || !denominator) return null;
	return numerator / denominator;
}

export async function probeMedia(sourcePath: string): Promise<MediaMetadata> {
	const ffprobePath = ffprobeStatic.path;
	if (!ffprobePath) {
		return {
			durationSec: null,
			width: null,
			height: null,
			fps: null,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
		};
	}

	const stdout = await new Promise<string>((resolve, reject) => {
		const child = spawn(ffprobePath, [
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
	}).catch(() => "");

	if (!stdout) {
		return {
			durationSec: null,
			width: null,
			height: null,
			fps: null,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
		};
	}

	const parsed = JSON.parse(stdout) as {
		streams?: Array<{
			codec_type?: string;
			codec_name?: string;
			width?: number;
			height?: number;
			avg_frame_rate?: string;
		}>;
		format?: {
			duration?: string;
			bit_rate?: string;
		};
	};

	const videoStream = parsed.streams?.find(
		(stream) => stream.codec_type === "video",
	);
	const audioStream = parsed.streams?.find(
		(stream) => stream.codec_type === "audio",
	);

	return {
		durationSec: parsed.format?.duration
			? Number(parsed.format.duration)
			: null,
		width: videoStream?.width ?? null,
		height: videoStream?.height ?? null,
		fps: parseFps(videoStream?.avg_frame_rate),
		codecVideo: videoStream?.codec_name ?? null,
		codecAudio: audioStream?.codec_name ?? null,
		bitrate: parsed.format?.bit_rate ? Number(parsed.format.bit_rate) : null,
	};
}

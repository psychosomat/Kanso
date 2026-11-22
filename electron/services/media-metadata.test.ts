import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMocks = vi.hoisted(() => ({
	spawn: vi.fn(),
	resolveNativeBinaryPath: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawn: spawnMocks.spawn,
}));

vi.mock("./binary-resolver", () => ({
	resolveNativeBinaryPath: spawnMocks.resolveNativeBinaryPath,
}));

import {
	parseDurationValue,
	parseFfmpegStderr,
	parseFfprobeJson,
	parseFfprobeMetadata,
	probeMedia,
} from "./media-metadata";

function createFakeChild(options: {
	stdout?: string;
	stderr?: string;
	code?: number;
}) {
	const child = new EventEmitter() as EventEmitter & {
		stdout: EventEmitter;
		stderr: EventEmitter;
	};
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();

	queueMicrotask(() => {
		if (options.stdout) {
			child.stdout.emit("data", Buffer.from(options.stdout));
		}
		if (options.stderr) {
			child.stderr.emit("data", Buffer.from(options.stderr));
		}
		child.emit("close", options.code ?? 0);
	});

	return child;
}

describe("parseDurationValue", () => {
	it("parses positive numbers and clock-format durations", () => {
		expect(parseDurationValue(125.4)).toBe(125.4);
		expect(parseDurationValue("42.5")).toBe(42.5);
		expect(parseDurationValue("00:02:03.450000000")).toBeCloseTo(123.45, 5);
		expect(parseDurationValue("01:02:03.5")).toBeCloseTo(3723.5, 5);
	});

	it("rejects N/A, zero, negative, and non-finite durations", () => {
		expect(parseDurationValue("N/A")).toBeNull();
		expect(parseDurationValue("n/a")).toBeNull();
		expect(parseDurationValue("")).toBeNull();
		expect(parseDurationValue(0)).toBeNull();
		expect(parseDurationValue("0")).toBeNull();
		expect(parseDurationValue("00:00:00.000")).toBeNull();
		expect(parseDurationValue(-10)).toBeNull();
		expect(parseDurationValue(Number.NaN)).toBeNull();
		expect(parseDurationValue(Number.POSITIVE_INFINITY)).toBeNull();
		expect(parseDurationValue(null)).toBeNull();
	});
});

describe("parseFfprobeMetadata", () => {
	it("prefers format.duration when valid", () => {
		const meta = parseFfprobeMetadata({
			format: { duration: "98.76", bit_rate: "2400000" },
			streams: [
				{
					codec_type: "video",
					codec_name: "h264",
					width: 1920,
					height: 1080,
					avg_frame_rate: "30000/1001",
					duration: "99.0",
				},
				{
					codec_type: "audio",
					codec_name: "aac",
					duration: "98.5",
				},
			],
		});

		expect(meta).toEqual({
			durationSec: 98.76,
			width: 1920,
			height: 1080,
			fps: 30000 / 1001,
			codecVideo: "h264",
			codecAudio: "aac",
			bitrate: 2400000,
		});
	});

	it("falls back from format.duration to videoStream.duration then audioStream.duration", () => {
		expect(
			parseFfprobeMetadata({
				format: { duration: "N/A" },
				streams: [
					{ codec_type: "video", duration: "64.2" },
					{ codec_type: "audio", duration: "63.9" },
				],
			}).durationSec,
		).toBe(64.2);

		expect(
			parseFfprobeMetadata({
				format: { duration: "N/A" },
				streams: [
					{ codec_type: "video", duration: "N/A" },
					{ codec_type: "audio", duration: "55.5" },
				],
			}).durationSec,
		).toBe(55.5);
	});

	it("parses Matroska DURATION tags on video stream or format", () => {
		expect(
			parseFfprobeMetadata({
				format: { duration: "N/A", bit_rate: "N/A" },
				streams: [
					{
						codec_type: "video",
						codec_name: "hevc",
						tags: { DURATION: "00:05:12.345000000" },
					},
				],
			}),
		).toMatchObject({
			durationSec: 312.345,
			codecVideo: "hevc",
			bitrate: null,
		});

		expect(
			parseFfprobeMetadata({
				format: { tags: { DURATION: "00:01:30.000" } },
				streams: [{ codec_type: "video", codec_name: "vp9" }],
			}).durationSec,
		).toBe(90);
	});

	it("handles invalid JSON gracefully", () => {
		expect(parseFfprobeJson("{broken")).toBeNull();
	});
});

describe("parseFfmpegStderr", () => {
	it("extracts duration and video dimensions from ffmpeg stderr", () => {
		const stderr = [
			"Input #0, matroska,webm, from 'clip.mkv':",
			"  Duration: 00:03:15.42, start: 0.000000, bitrate: 1500 kb/s",
			"  Stream #0:0: Video: h264 (High), yuv420p(tv, bt709), 1920x1080 [SAR 1:1 DAR 16:9], 24 fps",
			"  Stream #0:1(eng): Audio: aac, 48000 Hz, stereo",
		].join("\n");

		expect(parseFfmpegStderr(stderr)).toEqual({
			durationSec: 195.42,
			width: 1920,
			height: 1080,
		});
	});

	it("returns null duration when ffmpeg reports N/A and ignores 0x0", () => {
		const stderr = [
			"  Duration: N/A, start: 0.000000",
			"  Stream #0:0: Video: h264, yuv420p, 0x0",
		].join("\n");

		expect(parseFfmpegStderr(stderr)).toEqual({
			durationSec: null,
			width: null,
			height: null,
		});
	});
});

describe("probeMedia fallback", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("falls back to ffmpeg-static when ffprobe binary is missing", async () => {
		spawnMocks.resolveNativeBinaryPath
			.mockReturnValueOnce(null)
			.mockReturnValueOnce("/usr/bin/ffmpeg");
		spawnMocks.spawn.mockImplementationOnce(() =>
			createFakeChild({
				stderr:
					"  Duration: 00:00:45.50, start: 0.000\n  Stream #0:0: Video: h264, yuv420p, 1280x720, 30 fps\n",
				code: 1,
			}),
		);

		const result = await probeMedia("/tmp/sample.mkv");
		expect(spawnMocks.spawn).toHaveBeenCalledWith("/usr/bin/ffmpeg", [
			"-nostdin",
			"-i",
			"/tmp/sample.mkv",
		]);
		expect(result).toEqual({
			durationSec: 45.5,
			width: 1280,
			height: 720,
			fps: null,
			codecVideo: null,
			codecAudio: null,
			bitrate: null,
		});
	});

	it("falls back to ffmpeg-static when ffprobe returns durationSec === null and keeps ffprobe stream fields", async () => {
		spawnMocks.resolveNativeBinaryPath
			.mockReturnValueOnce("/usr/bin/ffprobe")
			.mockReturnValueOnce("/usr/bin/ffmpeg");
		spawnMocks.spawn
			.mockImplementationOnce(() =>
				createFakeChild({
					stdout: JSON.stringify({
						format: { duration: "N/A" },
						streams: [
							{
								codec_type: "video",
								codec_name: "vp9",
								width: 1920,
								height: 1080,
							},
						],
					}),
					code: 0,
				}),
			)
			.mockImplementationOnce(() =>
				createFakeChild({
					stderr:
						"  Duration: 00:01:02.25, start: 0.000\n  Stream #0:0: Video: vp9, yuv420p, 640x360\n",
					code: 1,
				}),
			);

		const result = await probeMedia("/tmp/stream.webm");
		expect(result).toEqual({
			durationSec: 62.25,
			width: 1920,
			height: 1080,
			fps: null,
			codecVideo: "vp9",
			codecAudio: null,
			bitrate: null,
		});
	});
});

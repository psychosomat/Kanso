import { describe, expect, it } from "vitest";
import {
	decodeVideoRequestPath,
	extractVideoErrorMessage,
	resolveVideoErrorStatus,
} from "./video-protocol";

describe("decodeVideoRequestPath", () => {
	it("round-trips a db streamUrl back to the source path", () => {
		const sourcePath = "/media/clip one.mp4";
		const requestUrl = `video://local/${encodeURIComponent(sourcePath)}`;
		expect(decodeVideoRequestPath(requestUrl)).toBe(sourcePath);
	});

	it("strips redundant leading slashes and decodes escapes", () => {
		expect(decodeVideoRequestPath("video://local///media%2Fclip.mp4")).toBe(
			"media/clip.mp4",
		);
		expect(
			decodeVideoRequestPath(
				"video://local/C%3A%5C%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE.mp4",
			),
		).toBe("C:\\видео.mp4");
	});
});

describe("extractVideoErrorMessage", () => {
	it("uses the Error message when available", () => {
		expect(extractVideoErrorMessage(new Error("not found"))).toBe("not found");
	});

	it("falls back to a default message for non-errors", () => {
		expect(extractVideoErrorMessage("boom")).toBe("Failed to read local media");
		expect(extractVideoErrorMessage(null)).toBe("Failed to read local media");
	});
});

describe("resolveVideoErrorStatus", () => {
	it("maps security violations to 403 and missing files to 404", () => {
		expect(resolveVideoErrorStatus("path is outside the library")).toBe(403);
		expect(resolveVideoErrorStatus("media file not found on disk")).toBe(404);
	});

	it("prefers 403 when a message matches both rules", () => {
		expect(resolveVideoErrorStatus("outside the library, not found")).toBe(403);
	});

	it("falls back to 500 for unexpected failures", () => {
		expect(resolveVideoErrorStatus("Failed to read local media")).toBe(500);
		expect(resolveVideoErrorStatus("")).toBe(500);
	});
});

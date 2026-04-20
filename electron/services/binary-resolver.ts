import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves a packaged Electron native binary path to a location that can
 * actually be executed.
 *
 * Modules such as `ffmpeg-static` and `ffprobe-static` compute their binary
 * paths relative to `__dirname`, which lands inside `app.asar` in packaged
 * builds. Binaries cannot be executed from within an asar archive, but
 * `electron-builder`'s `asarUnpack` extracts them to `app.asar.unpacked` at
 * install time, so we rewrite the path accordingly.
 *
 * In development (non-packaged) builds the path is returned unchanged.
 * Returns `null` if the file cannot be found on disk.
 */
export function resolveNativeBinaryPath(
	binaryPath: string | null | undefined,
): string | null {
	if (!binaryPath) return null;

	const asarSegment = `app.asar${path.sep}`;
	const unpackedSegment = `app.asar.unpacked${path.sep}`;

	if (
		binaryPath.includes(asarSegment) &&
		!binaryPath.includes(unpackedSegment)
	) {
		const unpacked = binaryPath.replace(asarSegment, unpackedSegment);
		if (existsSync(unpacked)) {
			return unpacked;
		}
	}

	return existsSync(binaryPath) ? binaryPath : null;
}

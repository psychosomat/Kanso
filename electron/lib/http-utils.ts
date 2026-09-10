import path from "node:path";

export interface ByteRange {
	start: number;
	end: number;
}

export function getMimeType(targetPath: string) {
	const extension = path.extname(targetPath).toLowerCase();
	switch (extension) {
		case ".html":
			return "text/html; charset=utf-8";
		case ".js":
		case ".mjs":
		case ".cjs":
			return "text/javascript; charset=utf-8";
		case ".css":
			return "text/css; charset=utf-8";
		case ".json":
			return "application/json; charset=utf-8";
		case ".svg":
			return "image/svg+xml";
		case ".ico":
			return "image/x-icon";
		case ".mp4":
			return "video/mp4";
		case ".webm":
			return "video/webm";
		case ".mov":
			return "video/quicktime";
		case ".mkv":
			return "video/x-matroska";
		case ".avi":
			return "video/x-msvideo";
		case ".m4v":
			return "video/x-m4v";
		case ".ts":
			return "video/mp2t";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".png":
			return "image/png";
		default:
			return "application/octet-stream";
	}
}

export function isValidByteRange(start: number, end: number, fileSize: number) {
	const boundsAreNumbers = !Number.isNaN(start) && !Number.isNaN(end);
	const boundsAreOrdered = start >= 0 && start <= end;
	return boundsAreNumbers && boundsAreOrdered && end < fileSize;
}

export function parseRangeHeader(
	rangeHeader: string | null,
	fileSize: number,
): ByteRange | null {
	if (!rangeHeader?.startsWith("bytes=")) {
		return null;
	}

	const [startText, endText] = rangeHeader.replace("bytes=", "").split("-");
	const start = Number.parseInt(startText, 10);
	const end = endText ? Number.parseInt(endText, 10) : fileSize - 1;

	if (!isValidByteRange(start, end, fileSize)) {
		return null;
	}

	return { start, end };
}

export function isReadableAssetMethod(method: string | undefined) {
	return method === "GET" || method === "HEAD";
}

export function isPathInsideRoot(rootDir: string, targetPath: string) {
	const relative = path.relative(rootDir, targetPath);
	return (
		relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
	);
}

export function shouldServeStaticAsset(
	method: string | undefined,
	relativePath: string,
	staticPath: string,
	clientRoot: string,
	fileExists: boolean,
) {
	const requestTargetsFile = relativePath.length > 0;
	return (
		isReadableAssetMethod(method) &&
		requestTargetsFile &&
		isPathInsideRoot(clientRoot, staticPath) &&
		fileExists
	);
}

export function decodeVideoRequestPath(requestUrl: string) {
	const url = new URL(requestUrl);
	return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
}

export function extractVideoErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Failed to read local media";
}

export function resolveVideoErrorStatus(message: string) {
	if (message.includes("outside the library")) {
		return 403;
	}

	if (message.includes("not found")) {
		return 404;
	}

	return 500;
}

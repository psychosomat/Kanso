export function findNewFolders(
	previousPaths: string[],
	next: { sourcePaths: Array<{ path: string }> } | null,
): string[] {
	const previous = new Set(previousPaths);
	return (next?.sourcePaths ?? [])
		.map((source) => source.path)
		.filter((sourcePath) => !previous.has(sourcePath));
}

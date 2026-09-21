import { useCallback, useState } from "react";

export function useFolderPlaylistPrompt() {
	const [folders, setFolders] = useState<string[]>([]);

	const promptForFolders = useCallback((folderPaths: string[]) => {
		if (folderPaths.length === 0) return;
		setFolders((current) => [...current, ...folderPaths]);
	}, []);

	const dismissCurrent = useCallback(() => {
		setFolders((current) => current.slice(1));
	}, []);

	return {
		promptFolder: folders[0] ?? null,
		promptForFolders,
		dismissCurrent,
	};
}

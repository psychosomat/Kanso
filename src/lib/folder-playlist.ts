import type {
	CategoryIconName,
	LibrarySettingsDto,
	SourcePathDto,
} from "./contracts";
import { findNewFolders } from "./library-folders";

export type FolderPlaylistInput = {
	name: string;
	description?: string;
	parentCategoryId?: string | null;
	icon?: CategoryIconName;
};

export function collectPreviousFolderPaths(
	sourcePaths?: SourcePathDto[] | null,
): string[] {
	return sourcePaths?.map((source) => source.path) ?? [];
}

export async function chooseFoldersAndPromptNew(options: {
	previousPaths: string[];
	choose: () => Promise<LibrarySettingsDto | null>;
	refreshAll: () => Promise<unknown>;
	promptForFolders: (folderPaths: string[]) => void;
	setPending: (pending: boolean) => void;
}): Promise<void> {
	const { previousPaths, choose, refreshAll, promptForFolders, setPending } =
		options;
	setPending(true);
	try {
		const next = await choose();
		await refreshAll();
		promptForFolders(findNewFolders(previousPaths, next));
	} finally {
		setPending(false);
	}
}

export async function submitFolderPlaylistRequest(options: {
	promptFolder: string | null;
	input: FolderPlaylistInput;
	createFromFolder: (
		input: FolderPlaylistInput & { folderPath: string },
	) => Promise<unknown>;
	refreshAll: () => Promise<unknown>;
}): Promise<void> {
	const { promptFolder, input, createFromFolder, refreshAll } = options;
	if (!promptFolder) return;
	await createFromFolder({ ...input, folderPath: promptFolder });
	await refreshAll();
}

import type { CategoryDto } from "@/lib/contracts";
import { folderDisplayName } from "@/lib/utils";
import { CategoryFormDialog } from "./category-form-dialog";
import type { FolderPlaylistInput } from "@/lib/folder-playlist";

export function FolderPlaylistDialog({
	promptFolder,
	categories,
	onDismiss,
	onSubmit,
}: {
	promptFolder: string | null;
	categories: CategoryDto[];
	onDismiss: () => void;
	onSubmit: (input: FolderPlaylistInput) => Promise<void>;
}) {
	if (!promptFolder) return null;
	return (
		<CategoryFormDialog
			key={promptFolder}
			open
			onOpenChange={(value) => {
				if (!value) onDismiss();
			}}
			categories={categories}
			initialName={folderDisplayName(promptFolder)}
			initialDescription={promptFolder}
			onSubmit={onSubmit}
		/>
	);
}

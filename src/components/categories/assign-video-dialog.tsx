import { IconFolderPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryIcon } from "@/lib/category-icons";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/category-tree";
import type { CategoryDto, VideoDetailDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { Button } from "../ui/button";
import { CategoryFormDialog } from "./category-form-dialog";

export function AssignVideoDialog({
	open,
	onOpenChange,
	categories,
	video,
	onSubmit,
	onCategoryCreated,
}: {
	open: boolean;
	onOpenChange: (value: boolean) => void;
	categories: CategoryDto[];
	video: VideoDetailDto | null;
	onSubmit: (
		payload: Array<{ categoryId: string; caption?: string }>,
	) => Promise<void>;
	onCategoryCreated?: () => Promise<void>;
}) {
	const [selected, setSelected] = useState<Record<string, boolean>>({});
	const [captions, setCaptions] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [createParentCategoryId, setCreateParentCategoryId] = useState<
		string | null
	>(null);
	const flatCategories = flattenCategoryTree(buildCategoryTree(categories));

	useEffect(() => {
		if (!video) return;
		const nextSelected: Record<string, boolean> = {};
		for (const category of video.categories) {
			nextSelected[category.id] = category.assigned;
		}
		setSelected(nextSelected);
		setCaptions({});
	}, [video]);

	async function handleSave() {
		setSaving(true);
		try {
			const payload = categories
				.filter((category) => selected[category.id])
				.map((category) => ({
					categoryId: category.id,
					caption: captions[category.id]?.trim() || undefined,
				}));
			await onSubmit(payload);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[min(94vw,42rem)]">
				<DialogHeader>
					<DialogTitle>Assign video to categories</DialogTitle>
					<DialogDescription>
						One source video can be published in multiple board feeds.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[55vh] pr-3">
					<ContextMenu>
						<ContextMenuTrigger asChild>
							<div className="space-y-3">
								{flatCategories.map((category) => (
									<div
										key={category.id}
										className="rounded-xl border border-(--border) bg-(--panel) p-3"
									>
										<label className="flex items-center gap-3">
											<input
												type="checkbox"
												checked={Boolean(selected[category.id])}
												onChange={(event) =>
													setSelected((current) => ({
														...current,
														[category.id]: event.target.checked,
													}))
												}
											/>
											<div>
												<p className="flex items-center gap-2 text-sm text-(--foreground)">
													<span
														className="inline-flex"
														style={{ paddingLeft: `${category.depth * 14}px` }}
													>
														<CategoryIcon name={category.icon} size={16} />
													</span>
													{category.name}
												</p>
												{category.description ? (
													<p className="text-xs text-(--muted-foreground)">
														{category.description}
													</p>
												) : null}
											</div>
										</label>
										{selected[category.id] ? (
											<Input
												className="mt-3"
												placeholder="Optional post caption"
												value={captions[category.id] ?? ""}
												onChange={(event) =>
													setCaptions((current) => ({
														...current,
														[category.id]: event.target.value,
													}))
												}
											/>
										) : null}
									</div>
								))}
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem
								onClick={() => {
									setCreateParentCategoryId(null);
									setCreateDialogOpen(true);
								}}
							>
								<IconFolderPlus size={16} />
								Create category
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				</ScrollArea>
				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Save assignments"}
					</Button>
				</DialogFooter>
				<CategoryFormDialog
					open={createDialogOpen}
					onOpenChange={setCreateDialogOpen}
					category={null}
					categories={categories}
					initialParentCategoryId={createParentCategoryId}
					onSubmit={async (input) => {
						await getPlayerApi().categories.create(input);
						await onCategoryCreated?.();
						setCreateDialogOpen(false);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

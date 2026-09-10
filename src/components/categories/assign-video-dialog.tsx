import { useState } from "react";
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
import IconFolderPlus from "~icons/tabler/folder-plus";
import { Button } from "../ui/button";
import { CategoryFormDialog } from "./category-form-dialog";

type AssignPayload = Array<{ categoryId: string; caption?: string }>;

type AssignDialogProps = {
	open: boolean;
	onOpenChange: (value: boolean) => void;
	categories: CategoryDto[];
	video: VideoDetailDto | null;
	onSubmit: (payload: AssignPayload) => Promise<void>;
	onCategoryCreated?: () => Promise<void>;
};

function buildInitialSelected(
	video: VideoDetailDto | null,
): Record<string, boolean> {
	const next: Record<string, boolean> = {};
	if (!video) return next;
	for (const category of video.categories) {
		next[category.id] = category.assigned;
	}
	return next;
}

export function AssignVideoDialog(props: AssignDialogProps) {
	const { open, onOpenChange } = props;
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[min(94vw,42rem)]">
				<DialogHeader>
					<DialogTitle>Assign video to categories</DialogTitle>
					<DialogDescription>
						One source video can be published in multiple board feeds.
					</DialogDescription>
				</DialogHeader>
				<AssignVideoBody key={props.video?.id ?? "no-video"} {...props} />
			</DialogContent>
		</Dialog>
	);
}

function AssignVideoBody({
	onOpenChange,
	categories,
	video,
	onSubmit,
	onCategoryCreated,
}: AssignDialogProps) {
	const [selected, setSelected] = useState<Record<string, boolean>>(() =>
		buildInitialSelected(video),
	);
	const [captions, setCaptions] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [createParentCategoryId, setCreateParentCategoryId] = useState<
		string | null
	>(null);
	const flatCategories = flattenCategoryTree(buildCategoryTree(categories));

	async function handleSave() {
		setSaving(true);
		try {
			const payload: AssignPayload = [];
			for (const category of categories) {
				if (!selected[category.id]) continue;
				payload.push({
					categoryId: category.id,
					caption: captions[category.id]?.trim() || undefined,
				});
			}
			await onSubmit(payload);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<ScrollArea className="max-h-[55vh] pr-3">
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<div className="space-y-3">
							{flatCategories.map((category) => (
								<div
									key={category.id}
									className="rounded-(--radius-lg) border border-(--border) bg-white/4 p-3"
								>
									<label className="flex items-center gap-3">
										<input
											type="checkbox"
											className="h-4 w-4 shrink-0 accent-(--accent)"
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
											aria-label={`Caption for ${category.name}`}
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
		</>
	);
}

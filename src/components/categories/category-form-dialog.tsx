import { useEffect, useState } from "react";
import { CATEGORY_ICONS, CategoryIcon } from "@/lib/category-icons";
import {
	buildCategoryTree,
	flattenCategoryTree,
	getCategoryDescendantIds,
} from "@/lib/category-tree";
import type { CategoryDto, CategoryIconName } from "@/lib/contracts";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

export function CategoryFormDialog({
	open,
	onOpenChange,
	category,
	categories,
	initialParentCategoryId,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (value: boolean) => void;
	category?: CategoryDto | null;
	categories: CategoryDto[];
	initialParentCategoryId?: string | null;
	onSubmit: (input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryIconName;
	}) => Promise<void>;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [parentCategoryId, setParentCategoryId] = useState<string>("root");
	const [icon, setIcon] = useState<CategoryIconName>("folder");
	const [saving, setSaving] = useState(false);
	const categoryTree = buildCategoryTree(categories);
	const blockedIds = category
		? getCategoryDescendantIds(category.id, categories)
		: null;
	const parentOptions = flattenCategoryTree(categoryTree).filter((item) => {
		if (!category) return true;
		return item.id !== category.id && !blockedIds?.has(item.id);
	});

	useEffect(() => {
		setName(category?.name ?? "");
		setDescription(category?.description ?? "");
		setParentCategoryId(
			category?.parentCategoryId ?? initialParentCategoryId ?? "root",
		);
		setIcon(category?.icon ?? "folder");
	}, [category, initialParentCategoryId]);

	async function handleSubmit() {
		setSaving(true);
		try {
			await onSubmit({
				name,
				description,
				parentCategoryId: parentCategoryId === "root" ? null : parentCategoryId,
				icon,
			});
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{category ? "Edit category" : "Create category"}
					</DialogTitle>
					<DialogDescription>
						Create a category or subcategory for your library feed.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<span className="text-sm text-(--muted-foreground)">Name</span>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<span className="text-sm text-(--muted-foreground)">
							Description
						</span>
						<Textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<span className="text-sm text-(--muted-foreground)">
							Parent category
						</span>
						<Select
							value={parentCategoryId}
							onValueChange={setParentCategoryId}
						>
							<SelectTrigger>
								<SelectValue placeholder="No parent" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="root">No parent</SelectItem>
								{parentOptions.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{"  ".repeat(item.depth)}
										{item.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<span className="text-sm text-(--muted-foreground)">Icon</span>
						<Select
							value={icon}
							onValueChange={(value) => setIcon(value as CategoryIconName)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Choose icon" />
							</SelectTrigger>
							<SelectContent>
								{CATEGORY_ICONS.map((item) => (
									<SelectItem key={item.name} value={item.name}>
										<span className="flex items-center gap-2">
											<CategoryIcon name={item.name} size={16} />
											{item.label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant="secondary" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={saving || name.trim().length === 0}
					>
						{saving ? "Saving…" : category ? "Save changes" : "Create category"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

import { useLocation, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAppState } from "@/components/layout/app-state";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog-impl";
import type { CategoryDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { Button } from "../ui/button";

export function DeleteCategoryDialog({
	open,
	onOpenChange,
	category,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category: CategoryDto | null;
}) {
	const { refreshAll } = useAppState();
	const router = useRouter();
	const location = useLocation();
	const [removing, setRemoving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleRemove() {
		if (!category) return;
		setRemoving(true);
		setError(null);
		try {
			await getPlayerApi().categories.remove(category.id);
			await refreshAll();
			if (location.pathname === `/categories/${category.slug}`) {
				await router.navigate({ to: "/dump" });
			}
			onOpenChange(false);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Failed to delete the board.",
			);
		} finally {
			setRemoving(false);
		}
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (!removing) onOpenChange(next);
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{category ? `Delete "${category.name}"?` : "Delete board?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						The board and its posts will be removed. Videos stay in your
						library, and sub-boards become top-level boards.
					</AlertDialogDescription>
				</AlertDialogHeader>
				{error ? (
					<p role="alert" className="mt-3 text-xs text-(--destructive)">
						{error}
					</p>
				) : null}
				<AlertDialogFooter>
					<AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={() => void handleRemove()}
						disabled={removing}
					>
						{removing ? "Deleting…" : "Delete board"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

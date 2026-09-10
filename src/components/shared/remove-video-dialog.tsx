import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog-impl";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	removing: boolean;
	onConfirm: () => void;
	description: string;
};

export function RemoveVideoDialog({
	open,
	onOpenChange,
	removing,
	onConfirm,
	description,
}: Props) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Remove this video from the library?
					</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm} disabled={removing}>
						{removing ? "Removing…" : "Remove"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

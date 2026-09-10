import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogOverlay = AlertDialogPrimitive.Overlay;

export function AlertDialogContent({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
	return (
		<AlertDialogPortal>
			<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md" />
			<AlertDialogPrimitive.Content
				className={cn(
					"island-strong fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-(--radius-xl) p-6",
					className,
				)}
				{...props}
			/>
		</AlertDialogPortal>
	);
}

export const AlertDialogHeader = (props: React.ComponentProps<"div">) => (
	<div className="flex flex-col gap-2" {...props} />
);
export const AlertDialogFooter = (props: React.ComponentProps<"div">) => (
	<div className="mt-6 flex items-center justify-end gap-2" {...props} />
);
export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;
export const AlertDialogCancel = (
	props: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>,
) => (
	<AlertDialogPrimitive.Cancel
		className={buttonVariants({ variant: "secondary" })}
		{...props}
	/>
);
export const AlertDialogAction = (
	props: React.ComponentProps<typeof AlertDialogPrimitive.Action>,
) => (
	<AlertDialogPrimitive.Action
		className={buttonVariants({ variant: "destructive" })}
		{...props}
	/>
);

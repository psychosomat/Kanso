import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			className={cn(
				"fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
				className,
			)}
			{...props}
		/>
	);
}

export function DialogContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				className={cn(
					"fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-(--border-strong) bg-(--panel-elevated) p-6 shadow-xl",
					"data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out transition-all duration-200",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1.5 text-(--muted-foreground) transition-all duration-150 hover:bg-(--panel-strong) hover:text-(--foreground) hover:scale-105 active:scale-95">
					<IconX size={16} />
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

export function DialogHeader({
	className,
	...props
}: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function DialogFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex items-center justify-end gap-2", className)}
			{...props}
		/>
	);
}

export function DialogTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			className={cn(
				"text-lg font-semibold tracking-tight text-(--foreground)",
				className,
			)}
			{...props}
		/>
	);
}

export function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			className={cn("text-sm text-(--muted-foreground)", className)}
			{...props}
		/>
	);
}

export function SheetContent({
	className,
	children,
	side = "right",
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	side?: "left" | "right";
}) {
	const sideClasses = {
		left: "left-0 data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left",
		right:
			"right-0 data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
	};

	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				className={cn(
					"fixed top-0 z-50 h-full w-[min(92vw,24rem)] gap-4 border border-(--border-strong) bg-(--panel-elevated) p-6 shadow-xl",
					sideClasses[side],
					"transition-all duration-200",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1.5 text-(--muted-foreground) transition-all duration-150 hover:bg-(--panel-strong) hover:text-(--foreground) hover:scale-105 active:scale-95">
					<IconX size={16} />
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

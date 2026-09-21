import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export function ContextMenuContent({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				className={cn(
					"island-strong z-50 min-w-40 overflow-hidden rounded-(--radius-md) p-1 text-(--foreground) data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
					className,
				)}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
}

export function ContextMenuItem({
	className,
	...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
	return (
		<ContextMenuPrimitive.Item
			className={cn(
				"flex cursor-default select-none items-center gap-2 rounded-(--radius-sm) px-2 py-2 text-[13px] text-(--foreground) outline-none data-highlighted:bg-white/8",
				className,
			)}
			{...props}
		/>
	);
}

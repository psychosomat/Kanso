import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				sideOffset={8}
				className={cn(
					"z-50 min-w-44 rounded-lg border border-(--border) bg-(--panel-elevated) p-1 text-(--foreground) shadow-2xl",
					className,
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

export function DropdownMenuItem({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	inset?: boolean;
}) {
	return (
		<DropdownMenuPrimitive.Item
			className={cn(
				"relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-(--panel)",
				inset && "pl-8",
				className,
			)}
			{...props}
		/>
	);
}

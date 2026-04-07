import * as SelectPrimitive from "@radix-ui/react-select";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
	return (
		<SelectPrimitive.Trigger
			className={cn(
				"flex h-10 w-full items-center justify-between rounded-(--radius) border border-(--border) bg-(--panel) px-3 py-2 text-sm text-(--foreground) transition-all duration-200 hover:border-(--border-strong) focus:outline-none focus:border-(--accent) focus:ring-2 focus:ring-(--ring)",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon>
				<IconChevronDown size={16} className="text-(--muted-foreground)" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

export function SelectContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Content
				className={cn(
					"z-50 min-w-32 rounded-lg border border-(--border-strong) bg-(--panel-elevated) text-(--foreground) shadow-xl",
					className,
				)}
				{...props}
			>
				<SelectPrimitive.Viewport className="p-1">
					{children}
				</SelectPrimitive.Viewport>
			</SelectPrimitive.Content>
		</SelectPrimitive.Portal>
	);
}

export function SelectItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			className={cn(
				"relative flex cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none transition-colors data-highlighted:bg-(--accent-subtle) data-highlighted:text-(--accent-strong)",
				className,
			)}
			{...props}
		>
			<span className="absolute left-2 flex h-4 w-4 items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<IconCheck size={16} />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import IconCheck from "~icons/tabler/check";
import IconChevronDown from "~icons/tabler/chevron-down";

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
				"flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-(--radius) border border-(--border) bg-white/5 px-3 py-2 text-[13px] text-(--foreground) transition-colors duration-200 hover:border-(--border-strong) focus:border-(--border-focus) focus:bg-white/7 focus:outline-none focus:ring-2 focus:ring-(--ring) [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate [&>span:first-child]:text-left",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon className="flex shrink-0 items-center">
				<IconChevronDown
					size={16}
					className="shrink-0 text-(--muted-foreground)"
				/>
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
					"island-strong z-50 min-w-32 overflow-hidden rounded-(--radius-md) text-(--foreground) data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
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
				"relative flex cursor-default select-none items-center rounded-(--radius-sm) py-2 pl-8 pr-2 text-[13px] outline-none transition-colors data-highlighted:bg-white/8 data-highlighted:text-(--foreground)",
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

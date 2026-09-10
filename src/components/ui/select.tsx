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
				"flex h-9 w-full items-center justify-between gap-2 rounded-(--radius) border border-(--border) bg-white/5 px-3 py-2 text-[13px] text-(--foreground) transition-colors duration-200 hover:border-(--border-strong) focus:border-(--border-focus) focus:bg-white/7 focus:outline-none focus:ring-2 focus:ring-(--ring)",
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
					"island-strong z-50 min-w-32 overflow-hidden rounded-(--radius-md) text-(--foreground)",
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

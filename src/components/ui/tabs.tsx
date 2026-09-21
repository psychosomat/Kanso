import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			className={cn(
				"inline-flex h-9 items-center rounded-full border border-(--border) bg-white/5 p-1",
				className,
			)}
			{...props}
		/>
	);
}

export function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			className={cn(
				"flex min-h-7 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-center text-[13px] text-(--muted-foreground) transition-colors data-[state=active]:bg-white/10 data-[state=active]:text-(--foreground)",
				className,
			)}
			{...props}
		/>
	);
}

export const TabsContent = TabsPrimitive.Content;

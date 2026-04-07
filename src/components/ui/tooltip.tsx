import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
	className,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				sideOffset={8}
				className={cn(
					"z-50 rounded-md border border-(--border) bg-(--panel-elevated) px-2 py-1 text-xs text-(--foreground) shadow-xl",
					className,
				)}
				{...props}
			/>
		</TooltipPrimitive.Portal>
	);
}

import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
	<textarea
		ref={ref}
		className={cn(
			"flex min-h-24 w-full rounded-md border border-(--border) bg-(--panel) px-3 py-2 text-sm text-(--foreground) outline-none placeholder:text-(--muted-foreground) focus:border-(--border-strong) focus:ring-2 focus:ring-(--ring)",
			className,
		)}
		{...props}
	/>
));
Textarea.displayName = "Textarea";

export { Textarea };

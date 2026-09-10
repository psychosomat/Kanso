import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
	HTMLTextAreaElement,
	React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
	<textarea
		ref={ref}
		className={cn(
			"flex min-h-24 w-full rounded-(--radius) border border-(--border) bg-white/5 px-3 py-2 text-[13px] text-(--foreground) outline-none transition-colors placeholder:text-(--muted-foreground)/60 focus:border-(--border-focus) focus:bg-white/7 focus:ring-2 focus:ring-(--ring)",
			className,
		)}
		{...props}
	/>
));
Textarea.displayName = "Textarea";

export { Textarea };

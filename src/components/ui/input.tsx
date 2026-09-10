import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, ...props }, ref) => (
		<input
			ref={ref}
			className={cn(
				"flex h-9 w-full items-center justify-between rounded-(--radius) border border-(--border) bg-white/5 px-3 py-2 text-[13px] text-(--foreground) transition-colors duration-200 placeholder:text-(--muted-foreground)/60 hover:border-(--border-strong) focus:border-(--border-focus) focus:bg-white/7 focus:outline-none focus:ring-2 focus:ring-(--ring)",
				className,
			)}
			{...props}
		/>
	),
);
Input.displayName = "Input";

export { Input };

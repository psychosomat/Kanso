import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, ...props }, ref) => (
		<input
			ref={ref}
			className={cn(
				"flex h-10 w-full items-center justify-between rounded-(--radius) border border-(--border) bg-(--panel) px-3 py-2 text-sm text-(--foreground) transition-all duration-200 hover:border-(--border-strong) focus:outline-none focus:border-(--accent) focus:ring-2 focus:ring-(--ring)",
				className,
			)}
			{...props}
		/>
	),
);
Input.displayName = "Input";

export { Input };

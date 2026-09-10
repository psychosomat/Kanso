import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded-(--radius) bg-white/6", className)}
			{...props}
		/>
	);
}

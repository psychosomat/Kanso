import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-md bg-(--panel-strong)/80",
				className,
			)}
			{...props}
		/>
	);
}

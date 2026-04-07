import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				default:
					"bg-(--panel-strong) text-(--muted-foreground) border border-(--border)",
				accent:
					"bg-(--accent-subtle) text-(--accent-strong) border border-(--accent)/30",
				destructive:
					"bg-(--destructive-subtle) text-(--destructive) border border-(--destructive)/30",
				success:
					"bg-(--success-subtle) text-(--success) border border-(--success)/30",
				outline: "border border-(--border-strong) text-(--foreground)",
				ghost: "text-(--muted-foreground)",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

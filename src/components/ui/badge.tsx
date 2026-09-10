import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
	{
		variants: {
			variant: {
				default:
					"border border-(--border) bg-white/5 text-(--muted-foreground)",
				accent:
					"border border-(--accent)/25 bg-(--accent-subtle) text-(--accent-strong)",
				destructive:
					"border border-(--destructive)/25 bg-(--destructive-subtle) text-(--destructive)",
				success:
					"border border-(--success)/25 bg-(--success-subtle) text-(--success)",
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

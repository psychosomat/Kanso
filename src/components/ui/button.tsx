import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) hover:scale-[1.02] active:scale-[0.96]",
	{
		variants: {
			variant: {
				default:
					"bg-(--accent) text-white hover:bg-(--accent-hover) shadow-lg shadow-(--accent-subtle) rounded-(--radius)",
				secondary:
					"bg-(--panel-strong) text-(--foreground) hover:bg-(--panel-hover) border border-(--border) rounded-(--radius)",
				ghost:
					"text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--panel-strong) rounded-(--radius)",
				outline:
					"border border-(--border-strong) text-(--foreground) hover:bg-(--panel-strong) hover:border-(--border-focus) rounded-(--radius)",
				destructive:
					"bg-(--destructive-subtle) text-(--destructive) hover:bg-(--destructive)/20 border border-(--destructive)/30 rounded-(--radius)",
				subtle:
					"bg-(--panel) text-(--foreground) hover:bg-(--panel-strong) rounded-(--radius)",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-11 px-5",
				icon: "h-10 w-10",
				"icon-sm": "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

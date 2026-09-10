import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius) text-[13px] font-medium tracking-[-0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) active:scale-[0.98]",
	{
		variants: {
			variant: {
				default:
					"bg-(--accent) text-white shadow-[0_10px_28px_-12px_var(--accent)] hover:bg-(--accent-hover)",
				secondary:
					"border border-(--border) bg-white/6 text-(--foreground) backdrop-blur-xl hover:bg-white/10",
				ghost:
					"text-(--muted-foreground) hover:bg-white/6 hover:text-(--foreground)",
				outline:
					"border border-(--border-strong) text-(--foreground) hover:border-(--border-focus) hover:bg-white/6",
				destructive:
					"border border-(--destructive)/25 bg-(--destructive-subtle) text-(--destructive) hover:bg-(--destructive)/18",
				subtle: "bg-white/5 text-(--foreground) hover:bg-white/9",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-7 px-3 text-xs",
				lg: "h-11 px-6",
				icon: "h-9 w-9 rounded-full",
				"icon-sm": "h-7 w-7 rounded-full",
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

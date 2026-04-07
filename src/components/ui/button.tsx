import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import gsap from "gsap";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
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
	(
		{
			className,
			variant,
			size,
			asChild = false,
			onPointerEnter,
			onPointerLeave,
			onPointerDown,
			onPointerUp,
			...props
		},
		ref,
	) => {
		const localRef = React.useRef<HTMLButtonElement>(null);
		const buttonRef = (ref as React.RefObject<HTMLButtonElement>) || localRef;

		const handlePointerEnter = React.useCallback(
			(e: React.PointerEvent<HTMLButtonElement>) => {
				if (buttonRef.current && !props.disabled) {
					gsap.to(buttonRef.current, {
						scale: 1.02,
						duration: 0.15,
						ease: "power2.out",
					});
				}
				onPointerEnter?.(e);
			},
			[onPointerEnter, props.disabled, buttonRef],
		);

		const handlePointerLeave = React.useCallback(
			(e: React.PointerEvent<HTMLButtonElement>) => {
				if (buttonRef.current) {
					gsap.to(buttonRef.current, {
						scale: 1,
						duration: 0.15,
						ease: "power2.out",
					});
				}
				onPointerLeave?.(e);
			},
			[onPointerLeave, buttonRef],
		);

		const handlePointerDown = React.useCallback(
			(e: React.PointerEvent<HTMLButtonElement>) => {
				if (buttonRef.current && !props.disabled) {
					gsap.to(buttonRef.current, {
						scale: 0.96,
						duration: 0.08,
						ease: "power2.out",
					});
				}
				onPointerDown?.(e);
			},
			[onPointerDown, props.disabled, buttonRef],
		);

		const handlePointerUp = React.useCallback(
			(e: React.PointerEvent<HTMLButtonElement>) => {
				if (buttonRef.current && !props.disabled) {
					gsap.to(buttonRef.current, {
						scale: 1.02,
						duration: 0.15,
						ease: "back.out(1.7)",
					});
				}
				onPointerUp?.(e);
			},
			[onPointerUp, props.disabled, buttonRef],
		);

		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={buttonRef}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={handlePointerLeave}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };

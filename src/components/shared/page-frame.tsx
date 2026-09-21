import type { ReactNode } from "react";
import { usePageTransition } from "@/hooks/use-animations";
import { cn } from "@/lib/utils";

export function PageFrame({
	title,
	description,
	actions,
	children,
	className,
	hero,
}: {
	title: string;
	description: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	hero?: ReactNode;
}) {
	const containerRef = usePageTransition();

	return (
		<section
			ref={containerRef}
			aria-labelledby="page-frame-title"
			className={cn(
				"relative min-h-full px-6 pb-16 pt-14 lg:px-10 lg:pt-16",
				className,
			)}
		>
			{hero ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden"
				>
					{hero}
					<div className="absolute inset-0 bg-linear-to-b from-transparent via-(--background)/50 to-transparent" />
				</div>
			) : null}
			<div className="relative mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="min-w-0">
					<h2
						id="page-frame-title"
						title={title}
						className="font-display truncate text-[28px] font-semibold leading-none text-(--foreground)"
					>
						{title}
					</h2>
					<p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-(--muted-foreground)">
						{description}
					</p>
				</div>
				{actions ? (
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{actions}
					</div>
				) : null}
			</div>
			<div className="relative">{children}</div>
		</section>
	);
}

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
			className={cn(
				"relative min-h-full bg-(--background) px-5 py-5 lg:px-7 lg:py-6",
				className,
			)}
		>
			{hero ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden"
				>
					{hero}
					<div className="absolute inset-0 bg-linear-to-b from-transparent via-(--background)/60 to-(--background)" />
				</div>
			) : null}
			<div className="relative mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div className="min-w-0">
					<h2 className="font-display truncate text-[26px] font-semibold leading-tight text-(--foreground)">
						{title}
					</h2>
					<p className="mt-1 max-w-xl text-[13px] leading-relaxed text-(--muted-foreground)">
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

import type { ReactNode } from "react";
import { usePageTransition } from "@/hooks/use-animations";
import { cn } from "@/lib/utils";

export function PageFrame({
	title,
	description,
	actions,
	children,
	className,
}: {
	title: string;
	description: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	const containerRef = usePageTransition();

	return (
		<section
			ref={containerRef}
			className={cn(
				"min-h-full bg-(--background) px-4 py-4 lg:px-6 lg:py-6",
				className,
			)}
		>
			<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="max-w-2xl">
					<h2 className="text-2xl font-semibold tracking-tight text-(--foreground)">
						{title}
					</h2>
					<p className="mt-1 text-(--muted-foreground)">{description}</p>
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</section>
	);
}

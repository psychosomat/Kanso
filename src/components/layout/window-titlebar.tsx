import { useEffect, useRef, useState } from "react";
import type { TitlebarMode } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import IconMinus from "~icons/tabler/minus";
import IconSquare from "~icons/tabler/square";
import IconX from "~icons/tabler/x";

type WindowTitlebarProps = {
	mode: TitlebarMode;
	nonBlocking?: boolean;
};

function getWindowApi() {
	if (typeof window === "undefined" || !window.playerApi?.app.isElectron) {
		return null;
	}

	return window.playerApi.window;
}

const REVEAL_ZONE = 56;
const RELEASE_ZONE = 132;

function useEdgeReveal() {
	const [revealed, setRevealed] = useState(false);
	const revealedRef = useRef(false);

	useEffect(() => {
		const set = (next: boolean) => {
			if (revealedRef.current === next) return;
			revealedRef.current = next;
			setRevealed(next);
		};

		const onMove = (event: MouseEvent) => {
			if (event.clientY <= REVEAL_ZONE) {
				set(true);
			} else if (event.clientY > RELEASE_ZONE) {
				set(false);
			}
		};

		window.addEventListener("mousemove", onMove);
		return () => window.removeEventListener("mousemove", onMove);
	}, []);

	return { revealed, reveal: () => setRevealed(true) };
}

function WindowButton({
	label,
	onClick,
	children,
	danger,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
	danger?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className={cn(
				"flex h-7 w-8 items-center justify-center rounded-(--radius-sm) text-(--muted-foreground) transition-colors duration-150",
				danger
					? "hover:bg-(--destructive) hover:text-white"
					: "hover:bg-white/8 hover:text-(--foreground)",
			)}
		>
			{children}
		</button>
	);
}

export function WindowTitlebar({ mode, nonBlocking }: WindowTitlebarProps) {
	const { revealed, reveal } = useEdgeReveal();

	if (mode === "hidden") {
		return null;
	}

	const shellClass = cn(
		"window-drag fixed inset-x-0 top-0 z-40 flex h-11 items-center justify-end px-3",
		nonBlocking && "pointer-events-none",
	);
	const revealClass = cn(
		"transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
		revealed
			? "pointer-events-auto translate-y-0 opacity-100"
			: "pointer-events-none -translate-y-2 opacity-0",
	);

	if (mode === "macos") {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: reveals the HUD on hover/focus
			<header
				className={cn(shellClass, "justify-start")}
				onMouseEnter={reveal}
				onFocus={reveal}
			>
				<div
					className={cn("window-no-drag flex items-center gap-2", revealClass)}
				>
					<button
						type="button"
						className="h-3 w-3 rounded-full bg-[#ff5f57] transition-opacity hover:opacity-85"
						onClick={() => void getWindowApi()?.close()}
						aria-label="Close window"
					/>
					<button
						type="button"
						className="h-3 w-3 rounded-full bg-[#febc2e] transition-opacity hover:opacity-85"
						onClick={() => void getWindowApi()?.minimize()}
						aria-label="Minimize window"
					/>
					<button
						type="button"
						className="h-3 w-3 rounded-full bg-[#28c840] transition-opacity hover:opacity-85"
						onClick={() => void getWindowApi()?.toggleMaximize()}
						aria-label="Toggle maximize"
					/>
				</div>
			</header>
		);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: reveals the HUD on hover/focus
		<header className={shellClass} onMouseEnter={reveal} onFocus={reveal}>
			<div
				className={cn("window-no-drag flex items-center gap-0.5", revealClass)}
			>
				<WindowButton
					label="Minimize window"
					onClick={() => void getWindowApi()?.minimize()}
				>
					<IconMinus size={14} />
				</WindowButton>
				<WindowButton
					label="Toggle maximize"
					onClick={() => void getWindowApi()?.toggleMaximize()}
				>
					<IconSquare size={11} />
				</WindowButton>
				<WindowButton
					label="Close window"
					danger
					onClick={() => void getWindowApi()?.close()}
				>
					<IconX size={14} />
				</WindowButton>
			</div>
		</header>
	);
}

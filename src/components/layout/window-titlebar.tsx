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

export const TITLEBAR_REVEAL_ZONE = 56;
export const TITLEBAR_RELEASE_ZONE = 132;

export function shouldRevealTitlebar(clientY: number): boolean {
	return clientY <= TITLEBAR_REVEAL_ZONE;
}

export function shouldHideTitlebar(clientY: number): boolean {
	return clientY > TITLEBAR_RELEASE_ZONE;
}

export function getTitlebarShellClass(nonBlocking?: boolean): string {
	return cn(
		"window-drag fixed inset-x-0 top-0 z-40 flex h-11 items-center justify-end px-3",
		nonBlocking && "pointer-events-none",
	);
}

export function getTitlebarRevealClass(revealed: boolean): string {
	return cn(
		"transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
		revealed
			? "pointer-events-auto translate-y-0 opacity-100"
			: "pointer-events-none -translate-y-2 opacity-0",
	);
}

export function closeWindow(): void {
	void getWindowApi()?.close();
}

export function minimizeWindow(): void {
	void getWindowApi()?.minimize();
}

export function toggleMaximizeWindow(): void {
	void getWindowApi()?.toggleMaximize();
}

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
			if (shouldRevealTitlebar(event.clientY)) {
				set(true);
			} else if (shouldHideTitlebar(event.clientY)) {
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

function TitlebarShell({
	reveal,
	nonBlocking,
	align,
	children,
}: {
	reveal: () => void;
	nonBlocking?: boolean;
	align: "start" | "end";
	children: React.ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: reveals the HUD on hover/focus
		<header
			className={cn(
				getTitlebarShellClass(nonBlocking),
				align === "start" && "justify-start",
			)}
			onMouseEnter={reveal}
			onFocus={reveal}
		>
			{children}
		</header>
	);
}

function MacOSTrafficLights({ revealed }: { revealed: boolean }) {
	return (
		<div
			className={cn(
				"window-no-drag flex items-center gap-2",
				getTitlebarRevealClass(revealed),
			)}
		>
			<button
				type="button"
				className="h-3 w-3 rounded-full bg-[#ff5f57] transition-opacity hover:opacity-85"
				onClick={closeWindow}
				aria-label="Close window"
			/>
			<button
				type="button"
				className="h-3 w-3 rounded-full bg-[#febc2e] transition-opacity hover:opacity-85"
				onClick={minimizeWindow}
				aria-label="Minimize window"
			/>
			<button
				type="button"
				className="h-3 w-3 rounded-full bg-[#28c840] transition-opacity hover:opacity-85"
				onClick={toggleMaximizeWindow}
				aria-label="Toggle maximize"
			/>
		</div>
	);
}

function WindowsCaptionButtons({ revealed }: { revealed: boolean }) {
	return (
		<div
			className={cn(
				"window-no-drag flex items-center gap-0.5",
				getTitlebarRevealClass(revealed),
			)}
		>
			<WindowButton label="Minimize window" onClick={minimizeWindow}>
				<IconMinus size={14} />
			</WindowButton>
			<WindowButton label="Toggle maximize" onClick={toggleMaximizeWindow}>
				<IconSquare size={11} />
			</WindowButton>
			<WindowButton label="Close window" danger onClick={closeWindow}>
				<IconX size={14} />
			</WindowButton>
		</div>
	);
}

export function WindowTitlebar({ mode, nonBlocking }: WindowTitlebarProps) {
	const { revealed, reveal } = useEdgeReveal();

	if (mode === "hidden") {
		return null;
	}

	if (mode === "macos") {
		return (
			<TitlebarShell reveal={reveal} nonBlocking={nonBlocking} align="start">
				<MacOSTrafficLights revealed={revealed} />
			</TitlebarShell>
		);
	}

	return (
		<TitlebarShell reveal={reveal} nonBlocking={nonBlocking} align="end">
			<WindowsCaptionButtons revealed={revealed} />
		</TitlebarShell>
	);
}

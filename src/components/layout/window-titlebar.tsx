import { APP_NAME } from "@/lib/constants";
import type { TitlebarMode } from "@/lib/contracts";
import IconMinus from "~icons/tabler/minus";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconSquare from "~icons/tabler/square";
import IconX from "~icons/tabler/x";
import { Button } from "../ui/button";

type WindowTitlebarProps = {
	mode: TitlebarMode;
};

function getWindowApi() {
	if (typeof window === "undefined" || !window.playerApi?.app.isElectron) {
		return null;
	}

	return window.playerApi.window;
}

function BrandMark() {
	return (
		<span className="flex items-center gap-2">
			<span
				aria-hidden="true"
				className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-white/10 text-(--foreground)"
			>
				<IconPlayerPlayFilled size={11} />
			</span>
			<span className="text-xs font-medium text-(--foreground)">
				{APP_NAME}
			</span>
		</span>
	);
}

export function WindowTitlebar({ mode }: WindowTitlebarProps) {
	if (mode === "hidden") {
		return null;
	}

	if (mode === "macos") {
		return (
			<header className="window-drag relative flex h-10 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel-elevated) px-4">
				<div className="window-no-drag flex items-center gap-2">
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
				<p className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-[13px] font-semibold text-(--muted-foreground)">
					{APP_NAME}
				</p>
				<div className="w-13" aria-hidden="true" />
			</header>
		);
	}

	return (
		<header className="window-drag flex h-10 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel-elevated) pl-3">
			<BrandMark />
			<div className="window-no-drag flex h-full items-stretch">
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0 hover:bg-white/6"
					onClick={() => void getWindowApi()?.minimize()}
					aria-label="Minimize window"
				>
					<IconMinus size={15} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0 hover:bg-white/6"
					onClick={() => void getWindowApi()?.toggleMaximize()}
					aria-label="Toggle maximize"
				>
					<IconSquare size={12} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0 hover:bg-[#e81123] hover:text-white"
					onClick={() => void getWindowApi()?.close()}
					aria-label="Close window"
				>
					<IconX size={15} />
				</Button>
			</div>
		</header>
	);
}

import { IconMinus, IconSquare, IconX } from "@tabler/icons-react";
import { APP_NAME } from "@/lib/constants";
import type { TitlebarMode } from "@/lib/contracts";
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

export function WindowTitlebar({ mode }: WindowTitlebarProps) {
	if (mode === "hidden") {
		return null;
	}

	if (mode === "macos") {
		return (
			<header className="window-drag relative flex h-8 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel-elevated) px-3">
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
				<p className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-[11px] font-medium tracking-[0.12em] text-(--muted-foreground)">
					{APP_NAME}
				</p>
				<div className="w-13" aria-hidden="true" />
			</header>
		);
	}

	return (
		<header className="window-drag flex h-8 shrink-0 items-center justify-between border-b border-(--border) bg-(--panel-elevated) pl-3">
			<p className="truncate text-sm tracking-[0.14em] text-(--muted-foreground)">
				{APP_NAME}
			</p>
			<div className="window-no-drag flex h-full items-stretch">
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0"
					onClick={() => void getWindowApi()?.minimize()}
					aria-label="Minimize window"
				>
					<IconMinus size={16} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0"
					onClick={() => void getWindowApi()?.toggleMaximize()}
					aria-label="Toggle maximize"
				>
					<IconSquare size={14} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-full w-12 rounded-none border-0 hover:bg-(--destructive)/90 hover:text-white"
					onClick={() => void getWindowApi()?.close()}
					aria-label="Close window"
				>
					<IconX size={16} />
				</Button>
			</div>
		</header>
	);
}

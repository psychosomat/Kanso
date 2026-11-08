import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppStateProvider } from "@/components/layout/app-state";
import type { PlayerPreferencesDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

export function shouldSuppressMiddleClick(
	button: number,
	target: { closest: (selector: string) => unknown } | null,
): boolean {
	return button === 1 && Boolean(target?.closest("a"));
}

export const Route = createRootRoute({
	component: RootDocument,
});

function RootDocument() {
	useEffect(() => {
		const handleAuxClick = (e: MouseEvent) => {
			if (!shouldSuppressMiddleClick(e.button, e.target as HTMLElement | null)) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
		};
		document.addEventListener("auxclick", handleAuxClick, true);
		return () => document.removeEventListener("auxclick", handleAuxClick, true);
	}, []);

	useEffect(() => {
		const rafId = window.requestAnimationFrame(() => {
			document.body.classList.add("ui-decor-ready");
		});
		return () => window.cancelAnimationFrame(rafId);
	}, []);

	useEffect(() => {
		if (!window.playerApi) return;
		// Load accent color immediately
		void getPlayerApi()
			.player.getPreferences()
			.then((prefs: PlayerPreferencesDto) => {
				if (prefs.accentColor) {
					document.documentElement.style.setProperty(
						"--accent",
						prefs.accentColor,
					);
				}
			});
	}, []);

	return (
		<AppStateProvider>
			<AppShell>
				<Outlet />
			</AppShell>
		</AppStateProvider>
	);
}

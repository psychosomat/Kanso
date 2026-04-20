import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppStateProvider } from "@/components/layout/app-state";
import type { PlayerPreferencesDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

export const Route = createRootRoute({
	component: RootDocument,
});

function RootDocument() {
	useEffect(() => {
		const handleAuxClick = (e: MouseEvent) => {
			if (e.button === 1) {
				const target = e.target as HTMLElement;
				const anchor = target.closest("a");
				if (anchor) {
					e.preventDefault();
					e.stopPropagation();
				}
			}
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
		<HotkeysProvider>
			<AppStateProvider>
				<AppShell>
					<Outlet />
				</AppShell>
			</AppStateProvider>
		</HotkeysProvider>
	);
}

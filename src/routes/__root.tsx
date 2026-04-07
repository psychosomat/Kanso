import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppStateProvider } from "@/components/layout/app-state";
import type { PlayerPreferencesDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Kanso",
			},
			{
				httpEquiv: "Content-Security-Policy",
				content:
					"default-src 'self' http://localhost:3000 ws://localhost:3000; script-src 'self' 'unsafe-inline' http://localhost:3000; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: video:; media-src 'self' blob: data: video:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' http://localhost:3000 ws://localhost:3000 video:; object-src 'none'; base-uri 'self';",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
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
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="antialiased wrap-anywhere">
				<HotkeysProvider>
					<AppStateProvider>
						<AppShell>{children}</AppShell>
					</AppStateProvider>
				</HotkeysProvider>
				<Scripts />
			</body>
		</html>
	);
}

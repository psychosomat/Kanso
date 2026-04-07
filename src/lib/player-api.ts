import type { PlayerApi } from "./contracts";

export function getPlayerApi(): PlayerApi {
	if (typeof window === "undefined" || !window.playerApi) {
		throw new Error("Player API is only available in the Electron renderer.");
	}
	return window.playerApi;
}

/// <reference types="vite/client" />

import type { PlayerApi } from "./lib/contracts";

declare global {
	interface Window {
		playerApi?: PlayerApi;
	}
}

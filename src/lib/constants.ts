import { DEFAULT_EQ_GAINS } from "./equalizer";

export const APP_NAME = "Kanso";

export const DEFAULT_DUMP_QUERY = {
	sort: "recent",
	order: "desc",
	page: 1,
	pageSize: 24,
} as const;

export const DEFAULT_PLAYER_PREFERENCES = {
	dumpSort: "recent",
	dumpView: "comfortable",
	sidebarCollapsed: false,
	titlebarMode: "auto",
	playerVolume: 0.9,
	playerMuted: false,
	playerFitMode: "contain",
	playerLoop: false,
	speedPresetPrimary: 1,
	speedPresetSecondary: 2.2,
	accentColor: "#c8883a",
	playerEqEnabled: false,
	playerEqGains: DEFAULT_EQ_GAINS,
} as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [
	".mp4",
	".mkv",
	".webm",
	".mov",
	".avi",
	".m4v",
	".ts",
] as const;

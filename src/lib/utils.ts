import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TitlebarMode } from "./contracts";

export function resolveTitlebarMode(
	mode: TitlebarMode,
): Exclude<TitlebarMode, "auto"> {
	if (mode !== "auto") return mode;

	const platform =
		typeof window !== "undefined" && window.playerApi?.app.isElectron
			? window.playerApi.app.getPlatform()
			: typeof process !== "undefined"
				? (process.platform as "win32" | "darwin" | "linux")
				: "win32";

	switch (platform) {
		case "darwin":
			// Use hidden on actual macOS to prevent duplication with system titlebar
			return "hidden";
		case "win32":
			return "windows";
		default:
			return "hidden";
	}
}

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function formatDateTime(value: string | null) {
	if (!value) return "Never";
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function formatDuration(seconds: number | null) {
	if (!seconds || Number.isNaN(seconds)) return "Unknown";
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const secs = total % 60;
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
		: `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatResolution(width: number | null, height: number | null) {
	if (!width || !height) return "Unknown";
	return `${width}x${height}`;
}

export function formatBytes(bytes: number | null) {
	if (!bytes) return "Unknown";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index += 1;
	}
	return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function shouldResume(resumeSec: number, durationSec: number | null) {
	if (resumeSec <= 15) return false;
	if (!durationSec || Number.isNaN(durationSec) || durationSec <= 0)
		return false;
	return durationSec - resumeSec > 15;
}

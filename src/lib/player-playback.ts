import type { PlayableVideoDto } from "./contracts";

export const PLAYBACK_RATE_MIN = 0.2;
export const PLAYBACK_RATE_MAX = 4;
export const SPEED_MATCH_EPSILON = 0.01;

export function isLibraryVideo(
	video: PlayableVideoDto | null,
): video is Extract<PlayableVideoDto, { origin: "library" }> {
	return video?.origin === "library";
}

export function normalizePlaybackRate(value: number): number {
	return Number(
		Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, value)).toFixed(1),
	);
}

export function clampSeekTarget(next: number, duration: number): number {
	return Math.max(0, Math.min(duration || 0, next));
}

export function nextSpeedPreset(
	playbackRate: number,
	primary: number | undefined,
	secondary: number | undefined,
): number {
	const presets = [primary ?? 1, secondary ?? 2.2];
	const currentIndex = presets.findIndex(
		(speed) => Math.abs(playbackRate - speed) < SPEED_MATCH_EPSILON,
	);
	return presets[(currentIndex + 1) % presets.length] ?? presets[0] ?? 1;
}

export function clampVolume(next: number): number {
	return Math.max(0, Math.min(1, next));
}

export function resolveCurrentVolume(options: {
	elementVolume: number | null;
	elementMuted: boolean;
	prefMuted: boolean;
	prefVolume: number;
}): number {
	if (options.elementVolume !== null) {
		return options.elementMuted ? 0 : options.elementVolume;
	}
	return options.prefMuted ? 0 : options.prefVolume;
}

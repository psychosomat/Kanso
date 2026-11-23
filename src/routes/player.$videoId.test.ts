// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	PlayerApi,
	PlayerPreferencesDto,
	ScanStatusDto,
	VideoDetailDto,
} from "@/lib/contracts";
import { savePlayerReturnTarget } from "@/lib/player-return";

const navigateMock = vi.fn().mockResolvedValue(undefined);
const historyBackMock = vi.fn();
const refreshAllMock = vi.fn().mockResolvedValue(undefined);
let currentScanStatus: ScanStatusDto | null = null;

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		useRouter: () => ({
			navigate: navigateMock,
			history: { back: historyBackMock },
		}),
	};
});

vi.mock("@/components/layout/app-state", () => ({
	useAppState: () => ({
		categories: [],
		refreshAll: refreshAllMock,
		scanStatus: currentScanStatus,
	}),
}));

vi.mock("@gsap/react", () => ({
	useGSAP: () => {},
}));

vi.mock("gsap", () => ({
	default: { to: vi.fn(), fromTo: vi.fn() },
}));

vi.mock("@/lib/poster-glow", () => ({
	averagePosterColor: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/categories/assign-video-dialog", () => ({
	AssignVideoDialog: () => null,
}));

vi.mock("@/components/shared/remove-video-dialog", () => ({
	RemoveVideoDialog: () => null,
}));

import {
	buildSpeedPresets,
	getVolumePercent,
	PlayerPage,
} from "./player.$videoId";

function prefs(
	overrides: Partial<PlayerPreferencesDto> = {},
): PlayerPreferencesDto {
	return {
		dumpSort: "recent",
		dumpView: "comfortable",
		sidebarCollapsed: false,
		titlebarMode: "windows",
		playerVolume: 1,
		playerMuted: false,
		playerFitMode: "contain",
		playerLoop: false,
		playerPlaybackRate: 1,
		speedPresetPrimary: 1,
		speedPresetSecondary: 2.2,
		accentColor: "#f76f53",
		playerEqEnabled: false,
		playerEqGains: [0, 0, 0, 0, 0, 0],
		showContinueWatching: true,
		showRecentlyAdded: true,
		...overrides,
	};
}

function makeVideo(overrides: Partial<VideoDetailDto> = {}): VideoDetailDto {
	return {
		origin: "library",
		id: "vid-1",
		fileName: "clip.mp4",
		sourcePath: "C:\\videos\\clip.mp4",
		folderPath: "C:\\videos",
		durationSec: 120,
		width: 1920,
		height: 1080,
		modifiedAt: "2026-04-03T00:00:00.000Z",
		posterUrl: null,
		streamUrl: "video://local/C%3A%5Cvideos%5Cclip.mp4",
		resumeSec: 0,
		lastPlayedAt: null,
		playCount: 0,
		exists: true,
		categoryCount: 0,
		codecVideo: "h264",
		codecAudio: "aac",
		bitrate: 5_000_000,
		fps: 60,
		fileSize: 1024,
		categories: [],
		assignedCategoryCount: 0,
		...overrides,
	};
}

describe("getVolumePercent", () => {
	it("rounds the stored volume to a percentage", () => {
		expect(getVolumePercent(prefs({ playerVolume: 0.7 }))).toBe(70);
	});

	it("defaults to full volume without preferences", () => {
		expect(getVolumePercent(null)).toBe(100);
		expect(getVolumePercent({} as PlayerPreferencesDto)).toBe(100);
	});

	it("reports zero when muted", () => {
		expect(
			getVolumePercent(prefs({ playerVolume: 0.8, playerMuted: true })),
		).toBe(0);
	});
});

describe("buildSpeedPresets", () => {
	it("returns sorted, unique, normalized presets including 1x", () => {
		expect(buildSpeedPresets(2.2, 1)).toEqual([1, 2.2]);
	});

	it("uses the default presets without preferences", () => {
		expect(buildSpeedPresets(undefined, undefined)).toEqual([1, 2.2]);
	});

	it("normalizes out-of-range values", () => {
		expect(buildSpeedPresets(9, 0.05)).toEqual([0.2, 1, 4]);
	});
});

describe("PlayerPage engine & navigation fixes", () => {
	let getVideoMock: ReturnType<typeof vi.fn>;
	let getExternalVideoMock: ReturnType<typeof vi.fn>;
	let updateVideoMetadataMock: ReturnType<typeof vi.fn>;
	let getPreferencesMock: ReturnType<typeof vi.fn>;
	let savePreferencesMock: ReturnType<typeof vi.fn>;
	let saveProgressMock: ReturnType<typeof vi.fn>;
	let audioContextCtor: ReturnType<typeof vi.fn>;
	let audioCloseMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		currentScanStatus = null;
		navigateMock.mockClear();
		historyBackMock.mockClear();
		refreshAllMock.mockClear();
		sessionStorage.clear();

		getVideoMock = vi.fn().mockResolvedValue(makeVideo());
		getExternalVideoMock = vi.fn().mockResolvedValue(null);
		updateVideoMetadataMock = vi.fn().mockResolvedValue(undefined);
		getPreferencesMock = vi.fn().mockResolvedValue(prefs());
		savePreferencesMock = vi.fn().mockResolvedValue(undefined);
		saveProgressMock = vi.fn().mockResolvedValue(undefined);

		audioCloseMock = vi.fn().mockResolvedValue(undefined);
		audioContextCtor = vi.fn(() => ({
			state: "running",
			destination: { connect: vi.fn(), disconnect: vi.fn() },
			resume: vi.fn().mockResolvedValue(undefined),
			close: audioCloseMock,
			createMediaElementSource: vi.fn(() => ({
				connect: vi.fn(),
				disconnect: vi.fn(),
			})),
			createBiquadFilter: vi.fn(() => ({
				type: "",
				frequency: { value: 0 },
				Q: { value: 0 },
				gain: { value: 0 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			})),
		}));
		vi.stubGlobal("AudioContext", audioContextCtor);

		vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

		window.playerApi = {
			app: {
				isElectron: true,
				getPlatform: () => "win32",
			},
			library: {
				getVideo: getVideoMock,
				getExternalVideo: getExternalVideoMock,
				updateVideoMetadata: updateVideoMetadataMock,
			},
			player: {
				getPreferences: getPreferencesMock,
				savePreferences: savePreferencesMock,
				saveProgress: saveProgressMock,
				markPlayed: vi.fn().mockResolvedValue(undefined),
			},
		} as unknown as PlayerApi;
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		delete window.playerApi;
		delete (document as { fullscreenElement?: Element | null })
			.fullscreenElement;
	});

	it("keeps AudioContext uncreated when EQ is disabled and lazy-loads preview video", async () => {
		const { container, unmount } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");
		expect(audioContextCtor).not.toHaveBeenCalled();

		// Volume change must not initialize WebAudio when EQ is disabled
		fireEvent.click(screen.getByRole("button", { name: "Toggle mute" }));
		expect(audioContextCtor).not.toHaveBeenCalled();

		// Preview video must use preload="metadata" and no initial src
		const videos = container.querySelectorAll("video");
		const mainVideo = videos[0];
		const previewVideo = videos[1];
		expect(mainVideo?.getAttribute("src")).toContain("clip.mp4");
		expect(previewVideo?.getAttribute("preload")).toBe("metadata");
		expect(previewVideo?.hasAttribute("src")).toBe(false);

		// Scrubbing assigns preview src lazily
		const seekInput = screen.getByRole("slider", { name: "Seek position" });
		const track = seekInput.parentElement as HTMLElement;
		vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
			left: 0,
			width: 200,
			top: 0,
			right: 200,
			bottom: 20,
			height: 20,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		});
		Object.defineProperty(track, "setPointerCapture", {
			value: vi.fn(),
			configurable: true,
		});
		Object.defineProperty(track, "hasPointerCapture", {
			value: () => false,
			configurable: true,
		});

		fireEvent.pointerDown(track, { clientX: 50, pointerId: 1 });
		expect(previewVideo?.getAttribute("src")).toContain("clip.mp4");

		unmount();
		expect(previewVideo?.hasAttribute("src")).toBe(false);
	});

	it("creates AudioContext with interactive latencyHint when EQ is enabled and closes on unmount", async () => {
		getPreferencesMock.mockResolvedValueOnce(
			prefs({ playerEqEnabled: true, playerEqGains: [3, 0, 0, 0, 0, 0] }),
		);

		const { unmount } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");
		await waitFor(() => {
			expect(audioContextCtor).toHaveBeenCalledWith({
				latencyHint: "interactive",
			});
		});

		unmount();
		expect(audioCloseMock).toHaveBeenCalledOnce();
	});

	it("renders 0:00 at start and backfills missing metadata on loadedmetadata", async () => {
		getVideoMock.mockResolvedValueOnce(
			makeVideo({ durationSec: null, width: null, height: null }),
		);

		const { container } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");
		expect(screen.getByText(/0:00/)).toBeTruthy();

		const mainVideo = container.querySelectorAll(
			"video",
		)[0] as HTMLVideoElement;
		Object.defineProperty(mainVideo, "duration", {
			value: 95,
			configurable: true,
		});
		Object.defineProperty(mainVideo, "videoWidth", {
			value: 1280,
			configurable: true,
		});
		Object.defineProperty(mainVideo, "videoHeight", {
			value: 720,
			configurable: true,
		});

		fireEvent(mainVideo, new Event("loadedmetadata"));

		await waitFor(() => {
			expect(updateVideoMetadataMock).toHaveBeenCalledWith({
				videoId: "vid-1",
				durationSec: 95,
				width: 1280,
				height: 720,
			});
		});
		expect(screen.getByText(/1:35/)).toBeTruthy();
	});

	it("places window-drag only on inner spacer when HUD is visible and syncs kanso:player-hud", async () => {
		const hudEvents: boolean[] = [];
		const onHud = (event: Event) => {
			hudEvents.push(
				Boolean((event as CustomEvent<{ visible: boolean }>).detail?.visible),
			);
		};
		window.addEventListener("kanso:player-hud", onHud);

		const { container, unmount } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");
		const backButton = screen.getByRole("button", { name: "Back to library" });
		const topBar = backButton.parentElement as HTMLElement;
		expect(topBar.className).not.toContain("window-drag");
		expect(topBar.className).toContain("pointer-events-auto");

		const dragSpacer = topBar.lastElementChild as HTMLElement;
		expect(dragSpacer.className).toContain("window-drag");
		expect(hudEvents.at(-1)).toBe(true);

		// Simulate playing -> HUD auto-hides after 3000ms
		vi.useFakeTimers();
		const mainVideo = container.querySelectorAll(
			"video",
		)[0] as HTMLVideoElement;
		act(() => {
			fireEvent(mainVideo, new Event("play"));
		});
		act(() => {
			vi.advanceTimersByTime(3000);
		});

		expect(topBar.className).toContain("pointer-events-none");
		expect(dragSpacer.className).not.toContain("window-drag");
		expect(hudEvents.at(-1)).toBe(false);

		// Window mousemove wakes HUD back up
		act(() => {
			window.dispatchEvent(new MouseEvent("mousemove"));
		});
		expect(topBar.className).toContain("pointer-events-auto");
		expect(hudEvents.at(-1)).toBe(true);

		window.removeEventListener("kanso:player-hud", onHud);
		unmount();
	});

	it("exits fullscreen, saves progress, and navigates to safe return path or /dump on Back", async () => {
		const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(document, "fullscreenElement", {
			value: document.body,
			configurable: true,
		});
		Object.defineProperty(document, "exitFullscreen", {
			value: exitFullscreenMock,
			configurable: true,
		});

		savePlayerReturnTarget({ pathname: "/categories/anime", scrollTop: 50 });

		const { rerender } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");
		fireEvent.click(screen.getByRole("button", { name: "Back to library" }));

		await waitFor(() => {
			expect(exitFullscreenMock).toHaveBeenCalledOnce();
			expect(saveProgressMock).toHaveBeenCalledWith({
				videoId: "vid-1",
				resumeSec: 0,
			});
			expect(navigateMock).toHaveBeenCalledWith({ to: "/categories/anime" });
		});

		// Unsafe player return target falls back to /dump instead of trapping
		navigateMock.mockClear();
		savePlayerReturnTarget({ pathname: "/player/other", scrollTop: 0 });
		rerender(createElement(PlayerPage, { mode: "library", videoId: "vid-1" }));
		fireEvent.click(screen.getByRole("button", { name: "Back to library" }));

		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/dump" });
		});
	});

	it("shows unavailable notice and working Back button if playing video is deleted", async () => {
		const { rerender } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");

		getVideoMock.mockResolvedValueOnce(null);
		currentScanStatus = {
			status: "idle",
			stage: "watch",
			scannedFiles: 0,
			totalFiles: 0,
			currentPath: "C:\\videos\\clip.mp4",
			message: "Removed clip.mp4",
			error: null,
			updatedAt: "2026-04-03T00:01:00.000Z",
		};
		rerender(createElement(PlayerPage, { mode: "library", videoId: "vid-1" }));

		await screen.findByText("File was moved or renamed");
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/dump" });
		});
	});

	it("skips timeupdate currentTime renders while HUD is hidden and syncs on wake", async () => {
		const { container, unmount } = render(
			createElement(PlayerPage, { mode: "library", videoId: "vid-1" }),
		);

		await screen.findAllByText("clip.mp4");

		vi.useFakeTimers();
		const mainVideo = container.querySelectorAll(
			"video",
		)[0] as HTMLVideoElement;
		Object.defineProperty(mainVideo, "duration", {
			value: 120,
			configurable: true,
		});
		let currentTimeValue = 0;
		Object.defineProperty(mainVideo, "currentTime", {
			get: () => currentTimeValue,
			set: (value: number) => {
				currentTimeValue = value;
			},
			configurable: true,
		});

		act(() => {
			fireEvent(mainVideo, new Event("play"));
		});
		act(() => {
			vi.advanceTimersByTime(3000);
		});

		// While HUD is hidden, timeupdate should not re-render currentTime
		currentTimeValue = 45;
		act(() => {
			fireEvent(mainVideo, new Event("timeupdate"));
		});
		expect(screen.queryByText(/^0:45/)).toBeNull();

		// Waking the HUD syncs currentTime immediately
		act(() => {
			window.dispatchEvent(new MouseEvent("mousemove"));
		});
		expect(screen.getByText(/0:45/)).toBeTruthy();

		unmount();
	});
});

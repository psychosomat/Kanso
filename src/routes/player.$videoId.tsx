import { useGSAP } from "@gsap/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import gsap from "gsap";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AssignVideoDialog } from "@/components/categories/assign-video-dialog";
import { useAppState } from "@/components/layout/app-state";
import { RemoveVideoDialog } from "@/components/shared/remove-video-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { useEscapeLayer } from "@/hooks/use-escape-layer";
import { usePlayerHotkeys } from "@/hooks/use-player-hotkeys";
import { usePlayerUiVisibility } from "@/hooks/use-player-ui-visibility";
import { CategoryIcon } from "@/lib/category-icons";
import type { PlayableVideoDto, PlayerPreferencesDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import {
	applyEqGains,
	connectEqGraph,
	ensureEqNodes,
} from "@/lib/player-eq-graph";
import {
	clampSeekTarget,
	clampVolume,
	isLibraryVideo,
	nextSpeedPreset,
	normalizePlaybackRate,
	PLAYBACK_RATE_MAX,
	PLAYBACK_RATE_MIN,
	resolveCurrentVolume,
} from "@/lib/player-playback";
import { getPlayerReturnTarget } from "@/lib/player-return";
import { averagePosterColor } from "@/lib/poster-glow";
import {
	cn,
	formatBytes,
	formatDateTime,
	formatDuration,
	formatResolution,
	resolveTitlebarMode,
	shouldResume,
} from "@/lib/utils";
import IconArrowLeft from "~icons/tabler/arrow-left";
import IconFolder from "~icons/tabler/folder";
import IconGauge from "~icons/tabler/gauge";
import IconLayoutSidebarRight from "~icons/tabler/layout-sidebar-right";
import IconMaximize from "~icons/tabler/maximize";
import IconPlayerPauseFilled from "~icons/tabler/player-pause-filled";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconPlayerSkipBack from "~icons/tabler/player-skip-back";
import IconPlayerSkipForward from "~icons/tabler/player-skip-forward";
import IconRepeat from "~icons/tabler/repeat";
import IconTrash from "~icons/tabler/trash";
import IconVolume from "~icons/tabler/volume";
import IconVolumeOff from "~icons/tabler/volume-off";

export const Route = createFileRoute("/player/$videoId")({
	component: LibraryPlayerRoute,
});

const SEEK_STEP = 5;
const LONG_SEEK_STEP = 10;
const SPEED_STEP = 0.2;
const VOLUME_STEP = 0.05;

type TimelinePreviewState = {
	visible: boolean;
	time: number;
	leftPercent: number;
	frameUrl: string | null;
};

function LibraryPlayerRoute() {
	const { videoId } = Route.useParams();
	return <PlayerPage mode="library" videoId={videoId} />;
}

export function PlayerPage({
	mode,
	sourcePath,
	videoId,
}: {
	mode: "library" | "external";
	sourcePath?: string;
	videoId?: string;
}) {
	const router = useRouter();
	const { categories, refreshAll, scanStatus } = useAppState();
	const [video, setVideo] = useState<PlayableVideoDto | null>(null);
	const [prefs, setPrefs] = useState<PlayerPreferencesDto | null>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [assignOpen, setAssignOpen] = useState(false);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [removing, setRemoving] = useState(false);
	const [completedMarked, setCompletedMarked] = useState(false);
	const [playbackRate, setPlaybackRate] = useState(1);
	const [isScrubbing, setIsScrubbing] = useState(false);
	const [isLooping, setIsLooping] = useState(false);
	const [timelinePreview, setTimelinePreview] = useState<TimelinePreviewState>({
		visible: false,
		time: 0,
		leftPercent: 0,
		frameUrl: null,
	});
	const [ambient, setAmbient] = useState<string | null>(null);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [speedOpen, setSpeedOpen] = useState(false);

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const previewVideoRef = useRef<HTMLVideoElement | null>(null);
	const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const playerContainerRef = useRef<HTMLDivElement | null>(null);
	const timelineTrackRef = useRef<HTMLDivElement | null>(null);
	const gaugeButtonRef = useRef<HTMLButtonElement | null>(null);
	const speedControlRef = useRef<HTMLDivElement | null>(null);
	const topBarRef = useRef<HTMLDivElement | null>(null);
	const bottomBarRef = useRef<HTMLDivElement | null>(null);
	const previewSeekBusyRef = useRef(false);
	const previewSeekQueuedRef = useRef<number | null>(null);
	const wasPlayingBeforeScrubRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
	const __sourceNodeMapRef = useRef<
		WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>
	>(new WeakMap());
	const eqNodesRef = useRef<BiquadFilterNode[]>([]);

	const { isVisible, resetTimer } = usePlayerUiVisibility({
		suspended: speedOpen,
	});

	const applyEq = useCallback(
		(enabled: boolean, gains: number[] | undefined) => {
			const videoElement = videoRef.current;
			if (!videoElement) return;

			if (!audioContextRef.current) {
				audioContextRef.current = new AudioContext();
			}
			const ctx = audioContextRef.current;

			if (ctx.state === "suspended") {
				void ctx.resume();
			}

			// Get or create source node for this video element (can only create once per element)
			let sourceNode = __sourceNodeMapRef.current.get(videoElement);
			if (!sourceNode) {
				sourceNode = ctx.createMediaElementSource(videoElement);
				__sourceNodeMapRef.current.set(videoElement, sourceNode);
			}
			sourceNodeRef.current = sourceNode;

			eqNodesRef.current = ensureEqNodes(ctx, eqNodesRef.current);
			applyEqGains(eqNodesRef.current, enabled, gains);
			connectEqGraph(sourceNode, eqNodesRef.current, ctx.destination, enabled);
		},
		[],
	);

	useEffect(() => {
		if (!window.playerApi) return;
		const api = getPlayerApi();
		const videoPromise =
			mode === "library" && videoId
				? api.library.getVideo(videoId)
				: sourcePath
					? api.library.getExternalVideo(sourcePath)
					: Promise.resolve(null);

		void Promise.all([videoPromise, api.player.getPreferences()]).then(
			([videoDetail, preferences]) => {
				setVideo(videoDetail);
				setPrefs(preferences);
				setPlaybackRate(
					normalizePlaybackRate(
						preferences.playerPlaybackRate ??
							preferences.speedPresetPrimary ??
							1,
					),
				);
				setIsLooping(preferences.playerLoop ?? false);
				applyEq(preferences.playerEqEnabled, preferences.playerEqGains);
			},
		);
	}, [applyEq, mode, sourcePath, videoId]);

	useEffect(() => {
		if (
			!isLibraryVideo(video) ||
			!scanStatus ||
			scanStatus.stage !== "watch" ||
			scanStatus.currentPath !== video.sourcePath
		) {
			return;
		}

		void getPlayerApi()
			.library.getVideo(video.id)
			.then((nextVideo) => {
				setVideo(nextVideo);
				if (nextVideo?.exists !== false) return;
				videoRef.current?.pause();
			});
	}, [scanStatus, video]);

	const setRate = useCallback((value: number) => {
		const normalized = normalizePlaybackRate(value);
		setPlaybackRate(normalized);
		if (videoRef.current) {
			videoRef.current.playbackRate = normalized;
		}
		setPrefs((current) =>
			current && current.playerPlaybackRate !== normalized
				? { ...current, playerPlaybackRate: normalized }
				: current,
		);
		void getPlayerApi().player.savePreferences({
			playerPlaybackRate: normalized,
		});
	}, []);

	const syncPreviewFrame = useCallback((time: number) => {
		const previewVideo = previewVideoRef.current;
		if (!previewVideo || Number.isNaN(time)) return;

		if (previewSeekBusyRef.current) {
			previewSeekQueuedRef.current = time;
			return;
		}

		previewSeekBusyRef.current = true;
		const onSeeked = () => {
			const canvas = previewCanvasRef.current;
			if (
				canvas &&
				previewVideo.videoWidth > 0 &&
				previewVideo.videoHeight > 0
			) {
				const context = canvas.getContext("2d");
				if (context) {
					canvas.width = 240;
					canvas.height = Math.max(
						135,
						Math.round(
							(previewVideo.videoHeight / previewVideo.videoWidth) * 240,
						),
					);
					context.drawImage(previewVideo, 0, 0, canvas.width, canvas.height);
					setTimelinePreview((current) => ({
						...current,
						frameUrl: canvas.toDataURL("image/jpeg", 0.72),
					}));
				}
			}

			previewSeekBusyRef.current = false;
			previewVideo.removeEventListener("seeked", onSeeked);

			const queued = previewSeekQueuedRef.current;
			previewSeekQueuedRef.current = null;
			if (
				queued !== null &&
				Math.abs(queued - previewVideo.currentTime) > 0.1
			) {
				syncPreviewFrame(queued);
			}
		};

		previewVideo.addEventListener("seeked", onSeeked, { once: true });
		previewVideo.currentTime = time;
	}, []);

	const togglePlay = useCallback(async () => {
		const element = videoRef.current;
		if (!element) return;
		if (!video?.streamUrl) {
			console.error("Cannot play: video has no valid stream URL");
			return;
		}
		if (element.paused) {
			try {
				await element.play();
			} catch (error) {
				console.error("Failed to play video:", error);
				// Reset playing state on error
				setPlaying(false);
			}
		} else {
			element.pause();
		}
	}, [video]);

	const seekTo = useCallback(
		(next: number) => {
			const element = videoRef.current;
			if (!element) return;
			const clamped = clampSeekTarget(next, element.duration || duration || 0);
			element.currentTime = clamped;
			setCurrentTime(clamped);
		},
		[duration],
	);

	const seekBy = useCallback(
		(delta: number) => {
			const element = videoRef.current;
			if (!element) return;
			seekTo(element.currentTime + delta);
		},
		[seekTo],
	);

	const toggleMute = useCallback(async () => {
		const element = videoRef.current;
		if (!element || !prefs) return;
		element.muted = !element.muted;
		setPrefs({ ...prefs, playerMuted: element.muted });
		await getPlayerApi().player.savePreferences({ playerMuted: element.muted });
	}, [prefs]);

	const toggleFullscreen = useCallback(async () => {
		const container = playerContainerRef.current;
		if (!container) return;
		if (!document.fullscreenElement) {
			await container.requestFullscreen();
		} else {
			await document.exitFullscreen();
		}
	}, []);

	const toggleLoop = useCallback(async () => {
		if (!prefs) return;
		const next = !isLooping;
		setIsLooping(next);
		await getPlayerApi().player.savePreferences({ playerLoop: next });
	}, [prefs, isLooping]);

	const updateVolume = useCallback(
		async (nextValue: number) => {
			const element = videoRef.current;
			if (!element || !prefs) return;
			const clamped = clampVolume(nextValue);
			element.volume = clamped;
			element.muted = clamped === 0;
			setPrefs({
				...prefs,
				playerVolume: clamped,
				playerMuted: clamped === 0,
			});
			await getPlayerApi().player.savePreferences({
				playerVolume: clamped,
				playerMuted: clamped === 0,
			});
		},
		[prefs],
	);

	const adjustVolumeBy = useCallback(
		(delta: number) => {
			const element = videoRef.current;
			const currentVolume = resolveCurrentVolume({
				elementVolume: element ? element.volume : null,
				elementMuted: element ? element.muted : false,
				prefMuted: prefs?.playerMuted ?? false,
				prefVolume: prefs?.playerVolume ?? 1,
			});

			void updateVolume(currentVolume + delta);
		},
		[prefs, updateVolume],
	);

	const adjustRateFromWheel = useCallback(
		(deltaY: number) => {
			setRate(
				deltaY < 0 ? playbackRate + SPEED_STEP : playbackRate - SPEED_STEP,
			);
		},
		[playbackRate, setRate],
	);

	const handleBack = useCallback(() => {
		const returnTarget = getPlayerReturnTarget();
		if (returnTarget?.pathname) {
			void router.navigate({ to: returnTarget.pathname as never });
			return;
		}

		if (window.history.length > 1) {
			router.history.back();
			return;
		}
		void router.navigate({ to: "/dump" });
	}, [router]);

	const cycleSpeed = useCallback(() => {
		const next = nextSpeedPreset(
			playbackRate,
			prefs?.speedPresetPrimary,
			prefs?.speedPresetSecondary,
		);
		setRate(next);
	}, [playbackRate, prefs, setRate]);

	const seekToFraction = useCallback(
		(fraction: number) => {
			const mediaDuration =
				videoRef.current?.duration || duration || video?.durationSec || 0;
			if (!mediaDuration) return;
			seekTo(fraction * mediaDuration);
		},
		[duration, seekTo, video?.durationSec],
	);

	useEscapeLayer(speedOpen, () => setSpeedOpen(false));
	useEscapeLayer(removeDialogOpen, () => {
		if (!removing) setRemoveDialogOpen(false);
	});

	usePlayerHotkeys({
		enabled:
			!paletteOpen &&
			!speedOpen &&
			!detailsOpen &&
			!assignOpen &&
			!removeDialogOpen,
		overlayOpen: detailsOpen || assignOpen || paletteOpen,
		onTogglePlay: togglePlay,
		onSeekBackward: () => seekBy(-SEEK_STEP),
		onSeekForward: () => seekBy(SEEK_STEP),
		onSeekLongBackward: () => seekBy(-LONG_SEEK_STEP),
		onSeekLongForward: () => seekBy(LONG_SEEK_STEP),
		onSeekToStart: () => seekTo(0),
		onSeekToEnd: () => {
			const mediaDuration =
				videoRef.current?.duration || duration || video?.durationSec || 0;
			if (mediaDuration) seekTo(mediaDuration);
		},
		onSeekToFraction: seekToFraction,
		onToggleMute: toggleMute,
		onToggleFullscreen: toggleFullscreen,
		onToggleLoop: toggleLoop,
		onCycleSpeed: cycleSpeed,
		onSpeedDown: () => setRate(playbackRate - SPEED_STEP),
		onSpeedUp: () => setRate(playbackRate + SPEED_STEP),
		onToggleCategories: () => {
			if (isLibraryVideo(video)) setAssignOpen((open) => !open);
		},
		onToggleDetails: () => setDetailsOpen((open) => !open),
		onExit: handleBack,
		onVolumeUp: () => adjustVolumeBy(VOLUME_STEP),
		onVolumeDown: () => adjustVolumeBy(-VOLUME_STEP),
	});

	const updateTimelinePreview = useCallback(
		(clientX: number) => {
			const track = timelineTrackRef.current;
			const mediaDuration = videoRef.current?.duration || duration;
			if (!track || !mediaDuration) return;

			const rect = track.getBoundingClientRect();
			const ratio = Math.max(
				0,
				Math.min(1, (clientX - rect.left) / rect.width),
			);
			const nextTime = ratio * mediaDuration;

			setTimelinePreview((current) => ({
				...current,
				visible: true,
				time: nextTime,
				leftPercent: ratio * 100,
			}));
			syncPreviewFrame(nextTime);
		},
		[duration, syncPreviewFrame],
	);

	const startScrub = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			const element = videoRef.current;
			if (!element) return;
			wasPlayingBeforeScrubRef.current = !element.paused;
			if (!element.paused) {
				element.pause();
			}
			setIsScrubbing(true);
			updateTimelinePreview(event.clientX);
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		[updateTimelinePreview],
	);

	const moveScrub = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!isScrubbing) return;
			updateTimelinePreview(event.clientX);
		},
		[isScrubbing, updateTimelinePreview],
	);

	const endScrub = useCallback(
		async (event: ReactPointerEvent<HTMLDivElement>) => {
			if (!isScrubbing) return;
			const track = timelineTrackRef.current;
			if (track?.hasPointerCapture(event.pointerId)) {
				track.releasePointerCapture(event.pointerId);
			}
			setIsScrubbing(false);
			seekTo(timelinePreview.time);
			setTimelinePreview((current) => ({ ...current, visible: false }));
			if (wasPlayingBeforeScrubRef.current) {
				try {
					await videoRef.current?.play();
				} catch (error) {
					// Ignore AbortError from rapid play/pause during scrubbing
					if ((error as Error).name !== "AbortError") {
						console.error("Failed to resume playback after scrubbing:", error);
					}
				}
			}
		},
		[isScrubbing, seekTo, timelinePreview.time],
	);

	useEffect(() => {
		const element = videoRef.current;
		if (!element || !video) return;

		const onLoadedMetadata = () => {
			setDuration(element.duration || video.durationSec || 0);
			if (shouldResume(video.resumeSec, video.durationSec)) {
				element.currentTime = video.resumeSec;
				setCurrentTime(video.resumeSec);
			}
			if (prefs) {
				element.volume = prefs.playerVolume;
				element.muted = prefs.playerMuted;
			}
			element.playbackRate = playbackRate;
			applyEq(prefs?.playerEqEnabled ?? false, prefs?.playerEqGains);
		};

		const onTimeUpdate = () => {
			if (!isScrubbing) {
				setCurrentTime(element.currentTime);
			}
			setDuration(element.duration || video.durationSec || 0);
			if (
				isLibraryVideo(video) &&
				!completedMarked &&
				element.duration &&
				element.currentTime / element.duration >= 0.9
			) {
				setCompletedMarked(true);
				void getPlayerApi().player.markPlayed({
					videoId: video.id,
					completed: true,
				});
			}
		};

		const onPlay = () => setPlaying(true);
		const onPause = () => {
			setPlaying(false);
			if (!isLibraryVideo(video)) return;
			void getPlayerApi().player.saveProgress({
				videoId: video.id,
				resumeSec: element.currentTime,
			});
		};

		const onEnded = () => {
			if (isLooping && videoRef.current) {
				videoRef.current.currentTime = 0;
				void videoRef.current.play();
				setCompletedMarked(false);
				return;
			}
			setPlaying(false);
			if (!isLibraryVideo(video)) return;
			void getPlayerApi().player.markPlayed({
				videoId: video.id,
				completed: true,
			});
		};

		element.addEventListener("loadedmetadata", onLoadedMetadata);
		element.addEventListener("timeupdate", onTimeUpdate);
		element.addEventListener("play", onPlay);
		element.addEventListener("pause", onPause);
		element.addEventListener("ended", onEnded);

		const interval = window.setInterval(() => {
			if (!element.paused && isLibraryVideo(video)) {
				void getPlayerApi().player.saveProgress({
					videoId: video.id,
					resumeSec: element.currentTime,
				});
			}
		}, 5000);

		return () => {
			window.clearInterval(interval);
			element.removeEventListener("loadedmetadata", onLoadedMetadata);
			element.removeEventListener("timeupdate", onTimeUpdate);
			element.removeEventListener("play", onPlay);
			element.removeEventListener("pause", onPause);
			element.removeEventListener("ended", onEnded);
		};
	}, [
		applyEq,
		completedMarked,
		isLooping,
		isScrubbing,
		playbackRate,
		prefs,
		video,
	]);

	useEffect(() => {
		const previewVideo = previewVideoRef.current;
		if (!previewVideo || !video?.streamUrl) return;
		previewVideo.src = video.streamUrl;
		previewVideo.load();
	}, [video?.streamUrl]);

	useEffect(() => {
		if (!video?.posterUrl) {
			setAmbient(null);
			return;
		}
		let cancelled = false;
		void averagePosterColor(video.posterUrl).then((color) => {
			if (!cancelled) setAmbient(color);
		});
		return () => {
			cancelled = true;
		};
	}, [video?.posterUrl]);

	useEffect(() => {
		const onPalette = (event: Event) => {
			setPaletteOpen(
				(event as CustomEvent<{ open: boolean }>).detail.open ?? false,
			);
		};
		window.addEventListener("kanso:palette", onPalette);
		return () => window.removeEventListener("kanso:palette", onPalette);
	}, []);

	useEffect(() => {
		document.body.classList.add("is-player");
		return () => document.body.classList.remove("is-player");
	}, []);

	useEffect(() => {
		const element = videoRef.current;
		if (!element) return;
		element.playbackRate = playbackRate;
	}, [playbackRate]);

	useEffect(() => {
		if (prefs) {
			applyEq(prefs.playerEqEnabled ?? false, prefs.playerEqGains);
		}
	}, [applyEq, prefs?.playerEqEnabled, prefs?.playerEqGains, prefs]);

	const adjustRateFromWheelRef = useRef(adjustRateFromWheel);
	useEffect(() => {
		adjustRateFromWheelRef.current = adjustRateFromWheel;
	}, [adjustRateFromWheel]);

	useEffect(() => {
		const button = gaugeButtonRef.current;
		if (!button) return;

		const handler = (event: WheelEvent) => {
			event.preventDefault();
			adjustRateFromWheelRef.current(event.deltaY);
		};

		button.addEventListener("wheel", handler, { passive: false });
		return () => button.removeEventListener("wheel", handler);
	}, []);

	useEffect(() => {
		if (!speedOpen) return;
		const onPointerDown = (event: PointerEvent) => {
			if (
				speedControlRef.current &&
				!speedControlRef.current.contains(event.target as Node)
			) {
				setSpeedOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [speedOpen]);

	// UI visibility animation with GSAP
	useGSAP(
		() => {
			const topBar = topBarRef.current;
			const bottomBar = bottomBarRef.current;
			if (!topBar || !bottomBar) return;

			if (isVisible) {
				gsap.to([topBar, bottomBar], {
					opacity: 1,
					y: 0,
					duration: 0.3,
					ease: "power2.out",
				});
			} else {
				gsap.to(topBar, {
					opacity: 0,
					y: -20,
					duration: 0.3,
					ease: "power2.in",
				});
				gsap.to(bottomBar, {
					opacity: 0,
					y: 20,
					duration: 0.3,
					ease: "power2.in",
				});
			}
		},
		{ dependencies: [isVisible] },
	);

	// Reset visibility timer on user interaction
	useEffect(() => {
		const container = playerContainerRef.current;
		if (!container) return;

		const handleInteraction = () => {
			resetTimer();
		};

		container.addEventListener("mousemove", handleInteraction);
		container.addEventListener("mousedown", handleInteraction);
		container.addEventListener("touchstart", handleInteraction, {
			passive: true,
		});

		return () => {
			container.removeEventListener("mousemove", handleInteraction);
			container.removeEventListener("mousedown", handleInteraction);
			container.removeEventListener("touchstart", handleInteraction);
		};
	}, [resetTimer]);

	// Reset timer on keyboard events
	useEffect(() => {
		const handleKeyDown = () => {
			resetTimer();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [resetTimer]);

	const fitClass = useMemo(() => {
		if (!prefs) return "object-contain";
		if (prefs.playerFitMode === "cover") return "object-cover";
		if (prefs.playerFitMode === "native") return "object-none";
		return "object-contain";
	}, [prefs]);

	const assignedCategories = useMemo(() => {
		if (!isLibraryVideo(video)) return [];
		const out: typeof video.categories = [];
		for (const category of video.categories) {
			if (category.assigned) out.push(category);
		}
		return out;
	}, [video]);

	const titlebarMode = resolveTitlebarMode(prefs?.titlebarMode ?? "auto");

	async function setFitMode(value: PlayerPreferencesDto["playerFitMode"]) {
		if (!prefs) return;
		const next = { ...prefs, playerFitMode: value };
		setPrefs(next);
		await getPlayerApi().player.savePreferences({ playerFitMode: value });
	}

	async function submitAssignments(
		payload: Array<{ categoryId: string; caption?: string }>,
	) {
		if (!isLibraryVideo(video)) return;
		await getPlayerApi().categories.addVideo({
			videoId: video.id,
			categories: payload,
		});
		await refreshAll();
		setVideo(await getPlayerApi().library.getVideo(video.id));
	}

	async function removeLibraryVideo() {
		if (!isLibraryVideo(video)) return;
		setRemoving(true);
		try {
			await getPlayerApi().library.removeVideo(video.id);
			setRemoveDialogOpen(false);
			handleBack();
		} finally {
			setRemoving(false);
		}
	}

	const volumePercent = Math.round(
		(prefs?.playerMuted ? 0 : (prefs?.playerVolume ?? 1)) * 100,
	);

	const speedPresets = useMemo(() => {
		const raw = [
			prefs?.speedPresetPrimary ?? 1,
			prefs?.speedPresetSecondary ?? 2.2,
			1,
		];
		return [...new Set(raw.map((value) => normalizePlaybackRate(value)))].sort(
			(a, b) => a - b,
		);
	}, [prefs?.speedPresetPrimary, prefs?.speedPresetSecondary]);

	// Page entrance animation
	useGSAP(
		() => {
			if (!playerContainerRef.current) return;

			gsap.fromTo(
				playerContainerRef.current,
				{ opacity: 0, scale: 0.98 },
				{
					opacity: 1,
					scale: 1,
					duration: 0.3,
					ease: "power2.out",
				},
			);
		},
		{ dependencies: [video] },
	);

	return (
		<div className="relative z-2 h-full bg-(--background-deep)">
			<div
				ref={playerContainerRef}
				className="ambient-stage relative h-full w-full overflow-hidden bg-black"
				style={{ "--ambient": ambient ?? undefined } as React.CSSProperties}
			>
				<div
					ref={topBarRef}
					className={cn(
						"window-drag absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-linear-to-b from-black/55 to-transparent px-4 pb-10 pt-3",
						titlebarMode === "macos" ? "pl-20" : "pr-28",
					)}
				>
					<Button
						variant="ghost"
						size="icon"
						className="glass window-no-drag h-9 w-9 rounded-full text-white/85 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
						onClick={handleBack}
						aria-label="Back to library"
						title="Back to library (Esc)"
					>
						<IconArrowLeft size={16} />
					</Button>

					<div className="flex min-w-0 items-center gap-2">
						{video ? (
							<div className="max-w-[44vw] truncate text-[13px] font-medium text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
								{video.fileName}
							</div>
						) : null}
						<Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
							<SheetTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="glass window-no-drag h-9 w-9 rounded-full text-white/85 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
									aria-label="Video details"
								>
									<IconLayoutSidebarRight size={16} />
								</Button>
							</SheetTrigger>
							<SheetContent className="h-full w-[24rem] border-0 p-0">
								<SheetHeader className="border-b border-(--border) px-4 py-4">
									<SheetTitle>{video?.fileName ?? "Player details"}</SheetTitle>
								</SheetHeader>
								<div className="app-scrollbar h-[calc(100%-4rem)] space-y-4 overflow-y-auto p-4">
									<section className="space-y-2 rounded-(--radius) border border-(--border) bg-(--panel) p-3">
										<div className="flex flex-wrap gap-2">
											<Badge variant="accent">
												{formatResolution(
													video?.width ?? null,
													video?.height ?? null,
												)}
											</Badge>
											<Badge>
												{formatDuration(video?.durationSec ?? null)}
											</Badge>
											{video?.codecVideo ? (
												<Badge>{video.codecVideo}</Badge>
											) : null}
										</div>
										<InfoRow label="Folder" value={video?.folderPath ?? "—"} />
										<InfoRow
											label="Size"
											value={formatBytes(video?.fileSize ?? null)}
										/>
										<InfoRow
											label="Modified"
											value={formatDateTime(video?.modifiedAt ?? null)}
										/>
										<InfoRow label="Audio" value={video?.codecAudio ?? "—"} />
										<InfoRow
											label="Bitrate"
											value={
												video?.bitrate
													? `${Math.round(video.bitrate / 1000)} kbps`
													: "—"
											}
										/>
									</section>

									{isLibraryVideo(video) ? (
										<section className="space-y-3 rounded-(--radius) border border-(--border) bg-(--panel) p-3">
											<div className="flex items-center justify-between">
												<h3 className="text-sm font-medium text-(--foreground)">
													Categories
												</h3>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setAssignOpen(true)}
												>
													Edit
												</Button>
											</div>
											<div className="flex flex-wrap gap-2">
												{assignedCategories.length ? (
													assignedCategories.map((category) => (
														<Badge key={category.id} variant="accent">
															<CategoryIcon name={category.icon} size={12} />
															{category.name}
														</Badge>
													))
												) : (
													<p className="text-sm text-(--muted-foreground)">
														Not assigned yet.
													</p>
												)}
											</div>
										</section>
									) : null}

									<section className="space-y-3 rounded-(--radius) border border-(--border) bg-(--panel) p-3">
										<h3 className="text-sm font-medium text-(--foreground)">
											Player
										</h3>
										<div>
											<span
												id="fit-mode-label"
												className="mb-1 block text-xs uppercase tracking-[0.18em] text-(--muted-foreground)"
											>
												Fit mode
											</span>
											<Select
												aria-labelledby="fit-mode-label"
												value={prefs?.playerFitMode ?? "contain"}
												onValueChange={(value) =>
													void setFitMode(
														value as PlayerPreferencesDto["playerFitMode"],
													)
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="contain">Contain</SelectItem>
													<SelectItem value="cover">Cover</SelectItem>
													<SelectItem value="native">Native</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<Separator />
										<div className="space-y-1 text-xs text-(--muted-foreground)">
											<p>Shortcuts</p>
											<p>
												`Space/K` play, `J/L` seek, `Shift+J/L` long seek, `0-9`
												jump, `Home/End` edges
											</p>
											<p>
												`F` fullscreen, `M` mute, `R` loop, `Up/Down` volume,
												`S` speed, `-`/`=` rate, `C` boards, `I` details, `Esc`
												back
											</p>
											<p>
												`Alt+Left/Right` history, click `Gauge` for speed
												slider, scroll for ±0.2×
											</p>
										</div>
									</section>

									<section className="space-y-3 rounded-(--radius) border border-(--border) bg-(--panel) p-3">
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-medium text-(--foreground)">
												Library entry
											</h3>
											{isLibraryVideo(video) ? (
												<Button
													variant="destructive"
													size="sm"
													onClick={() => setRemoveDialogOpen(true)}
												>
													<IconTrash size={14} />
													Remove
												</Button>
											) : null}
										</div>
										<p className="text-xs text-(--muted-foreground)">
											Removes the indexed entry and category posts. The source
											file on disk is not deleted.
										</p>
									</section>
								</div>
							</SheetContent>
						</Sheet>
					</div>
				</div>

				<button
					type="button"
					aria-label="Play/Pause video. Double click for fullscreen"
					className="relative h-full w-full cursor-pointer bg-transparent"
					onClick={() => void togglePlay()}
					onDoubleClick={() => void toggleFullscreen()}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							void togglePlay();
						}
					}}
				>
					{video?.streamUrl ? (
						<video
							ref={videoRef}
							src={video.streamUrl}
							crossOrigin="anonymous"
							poster={video.posterUrl ?? undefined}
							className={`h-full w-full ${fitClass}`}
							controls={false}
							preload="metadata"
							playsInline
						>
							<track kind="captions" />
						</video>
					) : null}

					<video
						ref={previewVideoRef}
						className="hidden"
						muted
						preload="auto"
						playsInline
						crossOrigin="anonymous"
					/>
					<canvas ref={previewCanvasRef} className="hidden" />

					{video && !video.exists ? (
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/72">
							<div className="max-w-md rounded-2xl border border-white/15 bg-black/75 px-5 py-4 text-center text-white">
								<p className="text-sm font-medium">File was moved or renamed</p>
								<p className="mt-2 text-sm text-white/65">
									Watcher marked this video as unavailable. Reopen it from the
									library after the new path is indexed.
								</p>
							</div>
						</div>
					) : null}

					{!playing && video?.exists !== false ? (
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
							<IconPlayerPlayFilled
								size={64}
								className="text-white opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
							/>
						</div>
					) : null}
				</button>

				<div
					ref={bottomBarRef}
					className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 select-none"
				>
					<div className="island-strong mx-auto w-full max-w-3xl rounded-(--radius-xl) px-4 pb-3 pt-3">
						<div className="mb-1.5 flex items-center gap-3">
							{video?.posterUrl ? (
								<img
									src={video.posterUrl}
									alt=""
									aria-hidden="true"
									className="h-10 w-[72px] shrink-0 rounded-md object-cover ring-1 ring-white/15"
								/>
							) : (
								<div className="flex h-10 w-[72px] shrink-0 items-center justify-center rounded-md bg-white/8 text-white/50">
									<IconPlayerPlayFilled size={14} />
								</div>
							)}
							<div className="min-w-0 flex-1">
								<p className="truncate text-[13px] font-semibold text-white">
									{video?.fileName ?? "Loading…"}
								</p>
								<p className="tnum mt-0.5 truncate text-[11px] text-white/50">
									{formatResolution(
										video?.width ?? null,
										video?.height ?? null,
									)}
									{video?.codecVideo ? ` · ${video.codecVideo}` : ""}
								</p>
							</div>
							<span className="tnum shrink-0 text-xs text-white/70">
								{formatDuration(
									isScrubbing ? timelinePreview.time : currentTime,
								)}{" "}
								<span className="text-white/35">
									/ {formatDuration(duration || 0)}
								</span>
							</span>
						</div>
						{/* Timeline */}
						<div
							ref={timelineTrackRef}
							className="relative"
							onPointerDown={startScrub}
							onPointerMove={moveScrub}
							onPointerUp={endScrub}
							onPointerCancel={endScrub}
						>
							{timelinePreview.visible ? (
								<div
									className="pointer-events-none absolute bottom-full z-10 mb-3 -translate-x-1/2 overflow-hidden rounded-md border border-white/15 shadow-2xl"
									style={{ left: `${timelinePreview.leftPercent}%` }}
								>
									<div className="h-27 w-48 bg-black">
										{timelinePreview.frameUrl ? (
											<img
												src={timelinePreview.frameUrl}
												alt="Preview"
												className="h-full w-full object-cover"
											/>
										) : video?.posterUrl ? (
											<img
												src={video.posterUrl}
												alt="Preview"
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex h-full items-center justify-center">
												<span className="font-data text-[11px] text-white/40">
													Loading…
												</span>
											</div>
										)}
									</div>
									<div className="font-data bg-black/90 px-2 py-1 text-center text-[11px] tabular-nums text-white/70">
										{formatDuration(timelinePreview.time)}
									</div>
								</div>
							) : null}

							<input
								type="range"
								aria-label="Seek position"
								min={0}
								max={duration || 0}
								step={0.1}
								value={isScrubbing ? timelinePreview.time : currentTime}
								onChange={(event) => {
									const next = Number(event.target.value);
									setCurrentTime(next);
									if (isScrubbing) {
										setTimelinePreview((current) => ({
											...current,
											time: next,
										}));
										syncPreviewFrame(next);
									} else {
										seekTo(next);
									}
								}}
								className="lamp-range block w-full"
								style={
									{
										"--lamp-fill": `${duration ? ((isScrubbing ? timelinePreview.time : currentTime) / duration) * 100 : 0}%`,
									} as React.CSSProperties
								}
							/>
						</div>

						{/* Transport */}
						<div className="mt-1 flex items-center gap-1">
							{/* Playback group */}
							<div className="flex items-center gap-0.5">
								<button
									type="button"
									onClick={() => seekBy(-10)}
									className="flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
									aria-label="Back 10 seconds"
								>
									<IconPlayerSkipBack size={17} />
								</button>
								<button
									type="button"
									onClick={() => void togglePlay()}
									className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-(--accent) text-white shadow-[0_0_20px_var(--accent-subtle)] transition-colors hover:bg-(--accent-hover)"
									aria-label={playing ? "Pause" : "Play"}
								>
									{playing ? (
										<IconPlayerPauseFilled size={18} />
									) : (
										<IconPlayerPlayFilled size={18} />
									)}
								</button>
								<button
									type="button"
									onClick={() => seekBy(10)}
									className="flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
									aria-label="Forward 10 seconds"
								>
									<IconPlayerSkipForward size={17} />
								</button>
								<button
									type="button"
									onClick={() => void toggleLoop()}
									className={
										isLooping
											? "flex h-8 w-8 items-center justify-center rounded-md bg-(--accent)/25 text-(--accent-strong) transition-colors"
											: "flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
									}
									aria-label={isLooping ? "Disable loop" : "Enable loop"}
								>
									<IconRepeat size={16} />
								</button>
							</div>

							{/* Volume group */}
							<div className="hidden items-center gap-2 sm:flex">
								<button
									type="button"
									onClick={() => void toggleMute()}
									className="flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
									aria-label="Toggle mute"
								>
									{prefs?.playerMuted ? (
										<IconVolumeOff size={15} />
									) : (
										<IconVolume size={15} />
									)}
								</button>
								<input
									type="range"
									aria-label="Volume"
									min={0}
									max={100}
									step={1}
									value={volumePercent}
									onChange={(event) =>
										void updateVolume(Number(event.target.value) / 100)
									}
									className="volume-range w-20"
								/>
							</div>

							<div className="flex-1" />

							{/* Speed */}
							<div ref={speedControlRef} className="relative flex items-center">
								{speedOpen ? (
									<div className="absolute right-0 bottom-full z-30 mb-2 w-60 rounded-xl border border-white/15 bg-black/90 p-3 shadow-2xl backdrop-blur-md">
										<div className="mb-2 flex items-center justify-between">
											<span className="text-[11px] font-medium tracking-[0.14em] text-white/50 uppercase">
												Speed
											</span>
											<span className="tnum text-xs font-semibold text-white/85">
												{playbackRate.toFixed(1)}×
											</span>
										</div>
										<Slider
											aria-label="Playback speed"
											min={PLAYBACK_RATE_MIN}
											max={PLAYBACK_RATE_MAX}
											step={0.1}
											value={[playbackRate]}
											onValueChange={(values) => {
												const next = values[0];
												if (next !== undefined) setRate(next);
											}}
										/>
										<div className="mt-1 flex items-center justify-between text-[11px] text-white/40">
											<span>{PLAYBACK_RATE_MIN.toFixed(1)}×</span>
											<span>{PLAYBACK_RATE_MAX.toFixed(1)}×</span>
										</div>
										<div className="mt-2 flex items-center gap-1">
											{speedPresets.map((preset) => (
												<button
													key={preset}
													type="button"
													onClick={() => setRate(preset)}
													className={
														preset === playbackRate
															? "tnum h-7 flex-1 rounded-md bg-(--accent)/30 text-[11px] font-semibold text-white transition-colors"
															: "tnum h-7 flex-1 rounded-md text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
													}
												>
													{preset.toFixed(1)}×
												</button>
											))}
										</div>
									</div>
								) : null}
								<button
									ref={gaugeButtonRef}
									type="button"
									onClick={() => setSpeedOpen((open) => !open)}
									className="hidden h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white sm:flex"
									aria-label="Adjust playback speed. Scroll to fine-tune"
									aria-expanded={speedOpen}
								>
									<IconGauge size={15} />
								</button>
								<button
									type="button"
									onClick={() => cycleSpeed()}
									className="tnum h-8 rounded-md px-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
									aria-label="Cycle speed presets"
								>
									{playbackRate.toFixed(1)}×
								</button>
							</div>

							<div className="h-4 w-px bg-white/12" />

							{/* Actions */}
							<div className="flex items-center gap-0.5">
								{isLibraryVideo(video) ? (
									<button
										type="button"
										onClick={() => setAssignOpen(true)}
										className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white md:flex"
									>
										<IconFolder size={14} />
										Categories
									</button>
								) : null}
								<button
									type="button"
									onClick={() => void toggleFullscreen()}
									className="flex h-8 w-8 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
									aria-label="Fullscreen"
								>
									<IconMaximize size={15} />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{isLibraryVideo(video) ? (
				<>
					<AssignVideoDialog
						open={assignOpen}
						onOpenChange={setAssignOpen}
						categories={categories}
						video={video}
						onSubmit={submitAssignments}
						onCategoryCreated={async () => {
							await refreshAll();
						}}
					/>
					<RemoveVideoDialog
						open={removeDialogOpen}
						onOpenChange={setRemoveDialogOpen}
						removing={removing}
						onConfirm={() => void removeLibraryVideo()}
						description="This removes the indexed entry and any category posts that still reference it. The original file stays on disk."
					/>
				</>
			) : null}
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-3">
			<span className="shrink-0 text-(--muted-foreground)">{label}</span>
			<span className="break-all text-right text-(--foreground)">{value}</span>
		</div>
	);
}

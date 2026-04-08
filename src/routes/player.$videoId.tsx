import { useGSAP } from "@gsap/react";
import {
	IconArrowLeft,
	IconFolder,
	IconGauge,
	IconLayoutSidebarRight,
	IconMaximize,
	IconPlayerPauseFilled,
	IconPlayerPlayFilled,
	IconPlayerSkipBack,
	IconPlayerSkipForward,
	IconRepeat,
	IconTrash,
	IconVolume,
	IconVolumeOff,
} from "@tabler/icons-react";
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
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { usePlayerHotkeys } from "@/hooks/use-player-hotkeys";
import { usePlayerUiVisibility } from "@/hooks/use-player-ui-visibility";
import { CategoryIcon } from "@/lib/category-icons";
import type { PlayableVideoDto, PlayerPreferencesDto } from "@/lib/contracts";
import { EQ_BANDS, clampEqGain, normalizeEqGains } from "@/lib/equalizer";
import type { EqBand } from "@/lib/equalizer";
import { getPlayerApi } from "@/lib/player-api";
import { getPlayerReturnTarget } from "@/lib/player-return";
import {
	formatBytes,
	formatDateTime,
	formatDuration,
	formatResolution,
	shouldResume,
} from "@/lib/utils";

export const Route = createFileRoute("/player/$videoId")({
	component: LibraryPlayerRoute,
});

const SEEK_STEP = 5;
const SPEED_STEP = 0.2;
const VOLUME_STEP = 0.05;

type TimelinePreviewState = {
	visible: boolean;
	time: number;
	leftPercent: number;
	frameUrl: string | null;
};

function isLibraryVideo(
	video: PlayableVideoDto | null,
): video is Extract<PlayableVideoDto, { origin: "library" }> {
	return video?.origin === "library";
}

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

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const previewVideoRef = useRef<HTMLVideoElement | null>(null);
	const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const playerContainerRef = useRef<HTMLDivElement | null>(null);
	const timelineTrackRef = useRef<HTMLDivElement | null>(null);
	const gaugeButtonRef = useRef<HTMLButtonElement | null>(null);
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

	const { isVisible, resetTimer } = usePlayerUiVisibility();

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

			if (eqNodesRef.current.length === 0) {
				eqNodesRef.current = EQ_BANDS.map((band: EqBand) => {
					const node = ctx.createBiquadFilter();
					node.type = band.type;
					node.frequency.value = band.frequency;
					if (band.q) {
						node.Q.value = band.q;
					}
					return node;
				});
			}

			const normalized = normalizeEqGains(gains);
			eqNodesRef.current.forEach((node, index) => {
				node.gain.value = enabled ? clampEqGain(normalized[index]) : 0;
			});

			sourceNode.disconnect();
			eqNodesRef.current.forEach((node) => {
				node.disconnect();
			});
			if (enabled) {
				let previous: AudioNode = sourceNode;
				for (const node of eqNodesRef.current) {
					previous.connect(node);
					previous = node;
				}
				previous.connect(ctx.destination);
			} else {
				sourceNode.connect(ctx.destination);
			}
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
				setPlaybackRate(preferences.speedPresetPrimary);
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
		const normalized = Number(Math.max(0.2, Math.min(4, value)).toFixed(1));
		setPlaybackRate(normalized);
		if (videoRef.current) {
			videoRef.current.playbackRate = normalized;
		}
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
		if (element.paused) {
			await element.play();
		} else {
			element.pause();
		}
	}, []);

	const seekTo = useCallback(
		(next: number) => {
			const element = videoRef.current;
			if (!element) return;
			const clamped = Math.max(
				0,
				Math.min(element.duration || duration || 0, next),
			);
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
			const clamped = Math.max(0, Math.min(1, nextValue));
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
			const currentVolume = element
				? element.muted
					? 0
					: element.volume
				: prefs?.playerMuted
					? 0
					: (prefs?.playerVolume ?? 1);

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

	usePlayerHotkeys({
		onTogglePlay: togglePlay,
		onSeekBackward: () => seekBy(-SEEK_STEP),
		onSeekForward: () => seekBy(SEEK_STEP),
		onToggleMute: toggleMute,
		onToggleFullscreen: toggleFullscreen,
		onToggleLoop: toggleLoop,
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
				await videoRef.current?.play();
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
		container.addEventListener("touchstart", handleInteraction);

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

	const handleBack = useCallback(() => {
		const returnTarget = getPlayerReturnTarget();
		if (returnTarget?.pathname) {
			void router.navigate({ to: returnTarget.pathname as never });
			return;
		}

		router.history.back();
	}, [router]);

	const volumePercent = Math.round(
		(prefs?.playerMuted ? 0 : (prefs?.playerVolume ?? 1)) * 100,
	);
	const speedPresets = [
		prefs?.speedPresetPrimary ?? 1,
		prefs?.speedPresetSecondary ?? 2.2,
	];

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
		<div className="relative z-2 h-[calc(100vh-3rem)] bg-black">
			<div
				ref={playerContainerRef}
				className="relative h-full w-full overflow-hidden bg-black"
			>
				<div
					ref={topBarRef}
					className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-linear-to-b from-black/85 to-transparent px-4 pb-10 pt-4"
				>
					<Button
						variant="ghost"
						size="sm"
						className="text-white hover:bg-white/14"
						onClick={handleBack}
					>
						<IconArrowLeft size={16} />
						Back
					</Button>

					<div className="flex items-center gap-2">
						{video ? (
							<div className="max-w-[40vw] truncate text-sm text-white/85">
								{video.fileName}
							</div>
						) : null}
						<Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
							<SheetTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="text-white hover:bg-white/14"
								>
									<IconLayoutSidebarRight size={16} />
									Details
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
												{video.categories.filter(
													(category) => category.assigned,
												).length ? (
													video.categories
														.filter((category) => category.assigned)
														.map((category) => (
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
												`Space/K` play, `J/L` seek, `F` fullscreen, `M` mute,
												`R` loop, `Up/Down` volume
											</p>
											<p>Scroll on `Gauge` to change speed by 0.2×</p>
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
					{video ? (
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
							<track kind="captions" src="" label="No captions available" />
						</video>
					) : null}

					<video
						ref={previewVideoRef}
						className="hidden"
						muted
						preload="auto"
						playsInline
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
						<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
							<div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white">
								<IconPlayerPlayFilled size={40} />
							</div>
						</div>
					) : null}
				</button>

				<div
					ref={bottomBarRef}
					className="absolute inset-x-0 bottom-0 z-20 select-none bg-linear-to-t from-black/95 via-black/60 to-transparent px-5 pb-5 pt-20"
				>
					{/* Timeline */}
					<div
						ref={timelineTrackRef}
						className="relative mb-1"
						onPointerDown={startScrub}
						onPointerMove={moveScrub}
						onPointerUp={endScrub}
						onPointerCancel={endScrub}
					>
						{timelinePreview.visible ? (
							<div
								className="pointer-events-none absolute bottom-full z-10 mb-3 -translate-x-1/2 overflow-hidden rounded-sm border border-white/15 shadow-2xl"
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
											<span className="text-[11px] text-white/40">
												Loading…
											</span>
										</div>
									)}
								</div>
								<div className="bg-black/90 px-2 py-1 text-center text-[11px] tabular-nums text-white/70">
									{formatDuration(timelinePreview.time)}
								</div>
							</div>
						) : null}

						<input
							type="range"
							min={0}
							max={duration || 0}
							step={0.1}
							value={isScrubbing ? timelinePreview.time : currentTime}
							onChange={(event) => {
								const next = Number(event.target.value);
								setCurrentTime(next);
								if (isScrubbing) {
									setTimelinePreview((current) => ({ ...current, time: next }));
									syncPreviewFrame(next);
								} else {
									seekTo(next);
								}
							}}
							className="h-1 w-full cursor-pointer accent-white"
						/>
					</div>

					{/* Timestamps */}
					<div className="mb-4 flex items-center justify-between">
						<span className="text-[11px] tabular-nums text-white/60">
							{formatDuration(isScrubbing ? timelinePreview.time : currentTime)}
						</span>
						<span className="text-[11px] tabular-nums text-white/35">
							{formatDuration(duration || 0)}
						</span>
					</div>

					{/* Controls row */}
					<div className="flex items-center gap-4">
						{/* Playback group */}
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => seekBy(-10)}
								className="flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								aria-label="Back 10 seconds"
							>
								<IconPlayerSkipBack size={18} />
							</button>
							<button
								type="button"
								onClick={() => void togglePlay()}
								className="mx-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-white/90"
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
								className="flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								aria-label="Forward 10 seconds"
							>
								<IconPlayerSkipForward size={18} />
							</button>
							<button
								type="button"
								onClick={() => void toggleLoop()}
								className={
									isLooping
										? "flex h-8 w-8 items-center justify-center rounded bg-white/20 text-white transition-colors hover:bg-white/30"
										: "flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								}
								aria-label={isLooping ? "Disable loop" : "Enable loop"}
							>
								<IconRepeat size={18} />
							</button>
						</div>

						{/* Volume group */}
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => void toggleMute()}
								className="flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								aria-label="Toggle mute"
							>
								{prefs?.playerMuted ? (
									<IconVolumeOff size={16} />
								) : (
									<IconVolume size={16} />
								)}
							</button>
							<input
								type="range"
								min={0}
								max={100}
								step={1}
								value={volumePercent}
								onChange={(event) =>
									void updateVolume(Number(event.target.value) / 100)
								}
								className="w-24 cursor-pointer accent-white"
							/>
							<span className="w-8 text-right text-[11px] tabular-nums text-white/40">
								{volumePercent}%
							</span>
						</div>

						<div className="flex-1" />

						{/* Speed group */}
						<div className="flex items-center gap-1.5">
							<button
								ref={gaugeButtonRef}
								type="button"
								className="flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								aria-label="Scroll to adjust speed"
							>
								<IconGauge size={16} />
							</button>
							<span className="w-10 text-right text-[11px] tabular-nums text-white/60">
								{playbackRate.toFixed(1)}×
							</span>
							{speedPresets.map((speed) => (
								<button
									key={speed}
									type="button"
									onClick={() => setRate(speed)}
									className={
										Math.abs(playbackRate - speed) < 0.01
											? "flex h-7 items-center rounded bg-white px-2 text-[11px] tabular-nums text-black"
											: "flex h-7 items-center rounded px-2 text-[11px] tabular-nums text-white/50 transition-colors hover:bg-white/10 hover:text-white"
									}
								>
									{speed}×
								</button>
							))}
						</div>

						<div className="h-4 w-px bg-white/15" />

						{/* Actions */}
						<div className="flex items-center gap-1">
							{isLibraryVideo(video) ? (
								<button
									type="button"
									onClick={() => setAssignOpen(true)}
									className="flex h-8 items-center gap-1.5 rounded px-2.5 text-[12px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								>
									<IconFolder size={14} />
									Categories
								</button>
							) : null}
							<button
								type="button"
								onClick={() => void toggleFullscreen()}
								className="flex h-8 w-8 items-center justify-center rounded text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								aria-label="Fullscreen"
							>
								<IconMaximize size={16} />
							</button>
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
					<AlertDialog
						open={removeDialogOpen}
						onOpenChange={setRemoveDialogOpen}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									Remove this video from the library?
								</AlertDialogTitle>
								<AlertDialogDescription>
									This removes the indexed entry and any category posts that
									still reference it. The original file stays on disk.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={removing}>
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => void removeLibraryVideo()}
									disabled={removing}
								>
									{removing ? "Removing…" : "Remove"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
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

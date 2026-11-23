import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlaylistDialog } from "@/components/categories/folder-playlist-dialog";
import { useAppState } from "@/components/layout/app-state";
import { PageFrame } from "@/components/shared/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useFolderPlaylistPrompt } from "@/hooks/use-folder-playlist-prompt";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { APP_NAME } from "@/lib/constants";
import { CategoryIcon } from "@/lib/category-icons";
import type {
	CategoryDto,
	PlayerPreferencesDto,
	TitlebarMode,
} from "@/lib/contracts";
import {
	bandX,
	buildEqAreaPath,
	buildEqPath,
	EQ_GRAPH_HEIGHT,
	EQ_GRAPH_MARGIN,
	EQ_GRAPH_WIDTH,
	gainToY as eqGainToY,
	yToGain as eqYToGain,
} from "@/lib/eq-graph";
import { clampEqGain, EQ_BANDS, normalizeEqGains } from "@/lib/equalizer";
import {
	chooseFoldersAndPromptNew,
	collectPreviousFolderPaths,
	type FolderPlaylistInput,
	submitFolderPlaylistRequest,
} from "@/lib/folder-playlist";
import { getPlayerApi } from "@/lib/player-api";
import { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN } from "@/lib/player-playback";
import {
	applyAccentColor,
	applyNoiseOpacity,
	DEFAULT_ACCENT,
	getAccentColor,
	getNoiseOpacity,
} from "@/lib/settings-appearance";
import { cn, formatDateTime } from "@/lib/utils";
import IconBrandGithub from "~icons/tabler/brand-github";
import IconDatabase from "~icons/tabler/database";
import IconEye from "~icons/tabler/eye";
import IconEyeOff from "~icons/tabler/eye-off";
import IconFolder from "~icons/tabler/folder";
import IconFolderOpen from "~icons/tabler/folder-open";
import IconFolderPlus from "~icons/tabler/folder-plus";
import IconHome from "~icons/tabler/home";
import IconHomeOff from "~icons/tabler/home-off";
import IconInfoCircle from "~icons/tabler/info-circle";
import IconPalette from "~icons/tabler/palette";
import IconPlayerPlay from "~icons/tabler/player-play";
import IconRefresh from "~icons/tabler/refresh";
import IconTrash from "~icons/tabler/trash";

const GITHUB_URL = "https://github.com/psychosomat/Kanso";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

export function parseSpeedPreset(value: string): number | null {
	const parsed = Number(value);
	if (Number.isNaN(parsed)) return null;
	return Math.max(
		PLAYBACK_RATE_MIN,
		Math.min(PLAYBACK_RATE_MAX, Number(parsed.toFixed(1))),
	);
}

export function getScanProgress(
	status: { scannedFiles: number; totalFiles: number } | null | undefined,
): number | null {
	if (!status || status.totalFiles <= 0) return null;
	return Math.round((status.scannedFiles / status.totalFiles) * 100);
}

export type HomeRailPreferenceKey =
	| "showContinueWatching"
	| "showRecentlyAdded";

export type HomeRailSettingItem = {
	key: HomeRailPreferenceKey;
	label: string;
	description: string;
	enabled: boolean;
};

export function buildHomeRailSettings(
	preferences:
		| Pick<PlayerPreferencesDto, "showContinueWatching" | "showRecentlyAdded">
		| null
		| undefined,
): HomeRailSettingItem[] {
	return [
		{
			key: "showContinueWatching",
			label: "Continue Watching rail",
			description:
				"Resume partially watched videos from the top of the home screen",
			enabled: preferences?.showContinueWatching ?? true,
		},
		{
			key: "showRecentlyAdded",
			label: "Recently Added rail",
			description: "Show newly indexed videos on the home screen",
			enabled: preferences?.showRecentlyAdded ?? true,
		},
	];
}

export function getHomeVisibilityButtonMeta(
	label: string,
	hiddenFromHome: boolean,
): { ariaLabel: string; title: string } {
	return hiddenFromHome
		? {
				ariaLabel: `Show ${label} on Home`,
				title: "Show on Home",
			}
		: {
				ariaLabel: `Hide ${label} from Home`,
				title: "Hide from Home",
			};
}

export function getFolderHideButtonMeta(folder: {
	path: string;
	hiddenFromHome: boolean;
}): { ariaLabel: string; title: string } {
	return getHomeVisibilityButtonMeta(folder.path, folder.hiddenFromHome);
}

export function getCategoryHideButtonMeta(category: {
	name: string;
	hiddenFromHome: boolean;
}): { ariaLabel: string; title: string } {
	return getHomeVisibilityButtonMeta(category.name, category.hiddenFromHome);
}

function SettingsPage() {
	useScrollRestore("/settings");
	const {
		library,
		scanStatus,
		categories,
		preferences,
		refreshAll,
		savePreferences,
	} = useAppState();
	const [busy, setBusy] = useState(false);
	const { promptFolder, promptForFolders, dismissCurrent } =
		useFolderPlaylistPrompt();
	const [noiseOpacity, setNoiseOpacity] = useState<number>(0.09);
	const [accentColor, setAccentColor] = useState<string>(DEFAULT_ACCENT);
	const [eqEnabled, setEqEnabled] = useState(false);
	const [eqGains, setEqGains] = useState<number[]>(() => normalizeEqGains());

	useEffect(() => {
		setNoiseOpacity(getNoiseOpacity());
		setAccentColor(getAccentColor());
	}, []);

	useEffect(() => {
		if (!preferences) {
			return;
		}

		setAccentColor(preferences.accentColor);
		applyAccentColor(preferences.accentColor);
		setEqEnabled(Boolean(preferences.playerEqEnabled));
		setEqGains(normalizeEqGains(preferences.playerEqGains));
	}, [preferences]);

	function handleNoiseChange(value: number) {
		setNoiseOpacity(value);
		applyNoiseOpacity(value);
	}

	function handleAccentChange(value: string) {
		setAccentColor(value);
		applyAccentColor(value);
		void savePreferences({ accentColor: value });
	}

	const handleEqToggle = useCallback(
		(enabled: boolean) => {
			setEqEnabled(enabled);
			void savePreferences({ playerEqEnabled: enabled });
		},
		[savePreferences],
	);

	const handleEqBandChange = useCallback(
		(index: number, value: number) => {
			const next = normalizeEqGains(eqGains);
			next[index] = clampEqGain(value);
			setEqGains([...next]);
			void savePreferences({ playerEqGains: next });
		},
		[eqGains, savePreferences],
	);

	const resetEq = useCallback(() => {
		const defaults = normalizeEqGains();
		setEqGains(defaults);
		void savePreferences({ playerEqGains: defaults, playerEqEnabled: false });
		setEqEnabled(false);
	}, [savePreferences]);

	const eqGraphWidth = EQ_GRAPH_WIDTH;
	const eqGraphHeight = EQ_GRAPH_HEIGHT;
	const eqMargin = EQ_GRAPH_MARGIN;
	const bandPoints = useMemo(
		() =>
			EQ_BANDS.map((band, index) => ({
				...band,
				x: bandX(index, EQ_BANDS.length, eqGraphWidth, eqMargin),
			})),
		[],
	);

	const gainToY = useCallback(
		(value: number) => eqGainToY(value, eqGraphHeight, eqMargin),
		[],
	);

	const yToGain = useCallback(
		(y: number) => eqYToGain(y, eqGraphHeight, eqMargin),
		[],
	);

	const eqPath = useMemo(() => {
		const points = bandPoints.map((band, index) => ({
			x: band.x,
			y: gainToY(eqGains[index] ?? 0),
		}));
		return buildEqPath(points);
	}, [bandPoints, eqGains, gainToY]);

	const eqAreaPath = useMemo(
		() => buildEqAreaPath(eqPath, bandPoints, EQ_GRAPH_HEIGHT, EQ_GRAPH_MARGIN),
		[bandPoints, eqPath],
	);

	const dragIndexRef = useRef<number | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const handleGraphPointerMove = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			const dragIndex = dragIndexRef.current;
			if (dragIndex === null || !eqEnabled || !svgRef.current) return;
			const rect = svgRef.current.getBoundingClientRect();
			const relativeY = event.clientY - rect.top;
			const nextGain = yToGain(relativeY);
			handleEqBandChange(dragIndex, nextGain);
		},
		[eqEnabled, handleEqBandChange, yToGain],
	);

	const handleHandleDown = useCallback(
		(index: number) => {
			if (!eqEnabled) return;
			dragIndexRef.current = index;
		},
		[eqEnabled],
	);

	const stopDrag = useCallback((_event: React.PointerEvent<SVGSVGElement>) => {
		dragIndexRef.current = null;
	}, []);

	function handleTitlebarModeChange(value: string) {
		const nextMode = value as TitlebarMode;
		void savePreferences({ titlebarMode: nextMode });
	}

	async function chooseFolders() {
		await chooseFoldersAndPromptNew({
			previousPaths: collectPreviousFolderPaths(library?.sourcePaths),
			choose: () => getPlayerApi().settings.chooseLibraryFolders(),
			refreshAll,
			promptForFolders,
			setPending: setBusy,
		});
	}

	async function addFolder() {
		await chooseFoldersAndPromptNew({
			previousPaths: collectPreviousFolderPaths(library?.sourcePaths),
			choose: () => getPlayerApi().settings.addLibraryFolder(),
			refreshAll,
			promptForFolders,
			setPending: setBusy,
		});
	}

	async function submitFolderPlaylist(input: FolderPlaylistInput) {
		await submitFolderPlaylistRequest({
			promptFolder,
			input,
			createFromFolder: (request) =>
				getPlayerApi().categories.createFromFolder(request),
			refreshAll,
		});
	}

	async function runLibrarySettingsAction(action: () => Promise<unknown>) {
		setBusy(true);
		try {
			await action();
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function removeFolder(folderId: string) {
		await runLibrarySettingsAction(() =>
			getPlayerApi().settings.removeLibraryFolder(folderId),
		);
	}

	async function toggleWatchFolder(folderId: string) {
		await runLibrarySettingsAction(() =>
			getPlayerApi().settings.toggleWatchFolder(folderId),
		);
	}

	async function toggleHideFolderFromHome(folderId: string) {
		await runLibrarySettingsAction(() =>
			getPlayerApi().settings.toggleHideFolderFromHome(folderId),
		);
	}

	async function toggleHideCategoryFromHome(category: CategoryDto) {
		await runLibrarySettingsAction(() =>
			getPlayerApi().categories.update({
				id: category.id,
				name: category.name,
				description: category.description ?? undefined,
				parentCategoryId: category.parentCategoryId,
				icon: category.icon,
				hiddenFromHome: !category.hiddenFromHome,
			}),
		);
	}

	async function rescan() {
		await runLibrarySettingsAction(() => getPlayerApi().library.rescanNow());
	}

	async function saveSpeedPreset(
		key: "speedPresetPrimary" | "speedPresetSecondary",
		value: string,
	) {
		const clamped = parseSpeedPreset(value);
		if (clamped === null) return;
		await savePreferences({ [key]: clamped });
	}

	const scanProgress = getScanProgress(scanStatus);
	const homeRailSettings = buildHomeRailSettings(preferences);

	const hasSourcePaths = library && library.sourcePaths.length > 0;
	const anyWatchEnabled =
		library?.sourcePaths.some((sp) => sp.watchEnabled) ?? false;

	return (
		<PageFrame
			title="Settings"
			description="Appearance, library, and playback preferences"
		>
			<div className="space-y-5">
				<SettingsSection icon={<IconDatabase size={16} />} title="Library">
					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-xs uppercase tracking-[0.18em] text-(--muted-foreground)">
								Source folders
							</p>

							{hasSourcePaths ? (
								<div className="space-y-2">
									{library?.sourcePaths.map((folder) => {
										const hideMeta = getFolderHideButtonMeta(folder);
										return (
											<div
												key={folder.id}
												className="flex items-center justify-between gap-3 rounded-(--radius) border border-(--border) bg-white/4 p-3"
											>
												<div className="flex min-w-0 items-center gap-2">
													<IconFolder
														size={16}
														className="shrink-0 text-(--accent)"
													/>
													<span className="truncate text-sm text-(--foreground)">
														{folder.path}
													</span>
													{folder.hiddenFromHome ? (
														<Badge variant="default" className="shrink-0">
															Hidden from Home
														</Badge>
													) : null}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() =>
															void toggleHideFolderFromHome(folder.id)
														}
														disabled={busy}
														aria-label={hideMeta.ariaLabel}
														title={hideMeta.title}
													>
														{folder.hiddenFromHome ? (
															<IconHomeOff
																size={16}
																className="text-(--accent)"
															/>
														) : (
															<IconHome
																size={16}
																className="text-(--muted-foreground)"
															/>
														)}
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() => void toggleWatchFolder(folder.id)}
														disabled={busy}
														title={
															folder.watchEnabled
																? "Disable watch"
																: "Enable watch"
														}
													>
														{folder.watchEnabled ? (
															<IconEye size={16} className="text-(--accent)" />
														) : (
															<IconEyeOff
																size={16}
																className="text-(--muted-foreground)"
															/>
														)}
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() => void removeFolder(folder.id)}
														disabled={busy}
														title="Remove folder"
													>
														<IconTrash
															size={16}
															className="text-(--muted-foreground)"
														/>
													</Button>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="text-sm text-(--muted-foreground)">
									No folders selected
								</p>
							)}
						</div>

						<div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
							<Button
								onClick={() => void chooseFolders()}
								disabled={busy}
								className="w-full justify-center sm:w-auto"
							>
								<IconFolderOpen size={16} />
								Choose folders
							</Button>
							<Button
								variant="secondary"
								onClick={() => void addFolder()}
								disabled={busy}
								className="w-full justify-center sm:w-auto"
							>
								<IconFolderPlus size={16} />
								Add folder
							</Button>
							<Button
								variant="secondary"
								onClick={() => void rescan()}
								disabled={busy || !hasSourcePaths}
								className="w-full justify-center sm:w-auto"
							>
								<IconRefresh size={16} />
								Rescan now
							</Button>
						</div>

						{hasSourcePaths && (
							<div className="flex items-center gap-2">
								<Badge variant={anyWatchEnabled ? "accent" : "default"}>
									{anyWatchEnabled ? "Watching enabled" : "All watches off"}
								</Badge>
							</div>
						)}

						{scanStatus?.status === "scanning" && scanProgress !== null && (
							<div>
								<div className="flex items-center justify-between text-xs text-(--muted-foreground)">
									<span>Scanning…</span>
									<span>
										{scanStatus.scannedFiles} / {scanStatus.totalFiles}
									</span>
								</div>
								<div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-(--panel-strong)">
									<div
										className="h-full rounded-full bg-(--accent) transition-[width] duration-300"
										style={{ width: `${scanProgress}%` }}
									/>
								</div>
							</div>
						)}

						<Separator />

						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<StatTile
								label="Folders"
								value={String(library?.sourcePaths.length ?? 0)}
							/>
							<StatTile label="Categories" value={String(categories.length)} />
							<StatTile
								label="Scanned files"
								value={String(scanStatus?.scannedFiles ?? 0)}
							/>
							<StatTile
								label="Last scan"
								value={formatDateTime(library?.lastScanAt ?? null)}
							/>
						</div>
					</div>
				</SettingsSection>

				<SettingsSection icon={<IconPalette size={16} />} title="Appearance">
					<div className="space-y-6">
						<div>
							<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="min-w-0">
									<p className="text-sm text-(--foreground)">Accent color</p>
									<p className="mt-0.5 text-xs text-(--muted-foreground)">
										Primary interface color for highlights and actions
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<input
										type="color"
										aria-label="Accent color"
										value={accentColor}
										onChange={(e) => handleAccentChange(e.target.value)}
										className="h-8 w-14 cursor-pointer rounded border border-(--border) bg-transparent"
									/>
									<span className="text-xs tabular-nums text-(--muted-foreground)">
										{accentColor.toUpperCase()}
									</span>
								</div>
							</div>
						</div>

						<Separator />

						<div>
							<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
								<div className="min-w-0">
									<p className="text-sm text-(--foreground)">Custom titlebar</p>
									<p className="mt-0.5 text-xs text-(--muted-foreground)">
										Windows layout, macOS traffic lights, or full hide for
										tiling WMs
									</p>
								</div>
								<Select
									value={preferences?.titlebarMode ?? "auto"}
									onValueChange={handleTitlebarModeChange}
								>
									<SelectTrigger className="w-full sm:w-44">
										<SelectValue placeholder="Choose mode" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="auto">Auto (by OS)</SelectItem>
										<SelectItem value="windows">Windows</SelectItem>
										<SelectItem value="macos">MacOS</SelectItem>
										<SelectItem value="hidden">Hidden</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<Separator />

						<div>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-(--foreground)">
										Noise texture intensity
									</p>
									<p className="mt-0.5 text-xs text-(--muted-foreground)">
										Subtle film grain over the background
									</p>
								</div>
								<span className="text-sm tabular-nums text-(--muted-foreground)">
									{Math.round(noiseOpacity * 100)}%
								</span>
							</div>
							<input
								type="range"
								aria-label="Noise texture intensity"
								min={0}
								max={0.25}
								step={0.005}
								value={noiseOpacity}
								onChange={(e) => handleNoiseChange(Number(e.target.value))}
								className="mt-3 w-full cursor-pointer accent-(--accent)"
							/>
							<div className="mt-1 flex justify-between text-[10px] text-(--muted-foreground)">
								<span>Off</span>
								<span>Subtle</span>
								<span>Strong</span>
							</div>
						</div>
					</div>
				</SettingsSection>

				<SettingsSection icon={<IconHome size={16} />} title="Home screen">
					<div className="space-y-4">
						<p className="text-xs text-(--muted-foreground)">
							Choose which rails show on the Unsorted home screen. Private
							boards and folders marked Hidden from Home never appear on the
							home screen or in quick search.
						</p>
						<Separator />
						{homeRailSettings.map((item, index) => (
							<div key={item.key}>
								{index > 0 ? <Separator className="mb-4" /> : null}
								<div className="flex items-center justify-between gap-4">
									<div className="min-w-0">
										<p className="text-sm text-(--foreground)">{item.label}</p>
										<p className="mt-0.5 text-xs text-(--muted-foreground)">
											{item.description}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2.5">
										<Badge variant={item.enabled ? "accent" : "default"}>
											{item.enabled ? "Shown" : "Hidden"}
										</Badge>
										<button
											type="button"
											role="switch"
											aria-checked={item.enabled}
											aria-label={item.label}
											onClick={() =>
												void savePreferences({ [item.key]: !item.enabled })
											}
											className={cn(
												"relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
												item.enabled
													? "border-(--accent)/40 bg-(--accent)"
													: "border-(--border) bg-white/10",
											)}
										>
											<span
												className={cn(
													"pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
													item.enabled ? "translate-x-5.5" : "translate-x-1",
												)}
											/>
										</button>
									</div>
								</div>
							</div>
						))}
						<Separator />
						<div className="space-y-2">
							<p className="text-xs uppercase tracking-[0.18em] text-(--muted-foreground)">
								Categories on Home
							</p>
							<p className="text-xs text-(--muted-foreground)">
								Hide specific categories from the Home screen without hiding
								their source folders.
							</p>
							{categories.length > 0 ? (
								<div className="space-y-2 pt-1">
									{categories.map((category) => {
										const hideMeta = getCategoryHideButtonMeta(category);
										return (
											<div
												key={category.id}
												className="flex items-center justify-between gap-3 rounded-(--radius) border border-(--border) bg-white/4 p-3"
											>
												<div className="flex min-w-0 items-center gap-2">
													<CategoryIcon
														name={category.icon}
														size={16}
														className="shrink-0 text-(--accent)"
													/>
													<span className="truncate text-sm text-(--foreground)">
														{category.name}
													</span>
													{category.hiddenFromHome ? (
														<Badge variant="default" className="shrink-0">
															Hidden from Home
														</Badge>
													) : null}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={() =>
															void toggleHideCategoryFromHome(category)
														}
														disabled={busy}
														aria-label={hideMeta.ariaLabel}
														title={hideMeta.title}
													>
														{category.hiddenFromHome ? (
															<IconHomeOff
																size={16}
																className="text-(--accent)"
															/>
														) : (
															<IconHome
																size={16}
																className="text-(--muted-foreground)"
															/>
														)}
													</Button>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<p className="text-sm text-(--muted-foreground)">
									No categories yet
								</p>
							)}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection icon={<IconPlayerPlay size={16} />} title="Playback">
					<p className="text-sm text-(--muted-foreground)">
						Speed presets shown as quick-access buttons in the player. Click the
						gauge icon for a speed slider, wheel adjusts in 0.2 increments.
					</p>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<div>
							<label
								htmlFor="primary-preset"
								className="mb-2 block text-xs uppercase tracking-[0.18em] text-(--muted-foreground)"
							>
								Primary preset
							</label>
							<Input
								id="primary-preset"
								type="number"
								min={0.2}
								max={4}
								step={0.1}
								defaultValue={preferences?.speedPresetPrimary ?? 1}
								onBlur={(e) =>
									void saveSpeedPreset("speedPresetPrimary", e.target.value)
								}
							/>
						</div>
						<div>
							<label
								htmlFor="secondary-preset"
								className="mb-2 block text-xs uppercase tracking-[0.18em] text-(--muted-foreground)"
							>
								Secondary preset
							</label>
							<Input
								id="secondary-preset"
								type="number"
								min={0.2}
								max={4}
								step={0.1}
								defaultValue={preferences?.speedPresetSecondary ?? 2.2}
								onBlur={(e) =>
									void saveSpeedPreset("speedPresetSecondary", e.target.value)
								}
							/>
						</div>
					</div>

					<Separator className="my-6" />

					<div className="space-y-4">
						<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<p className="text-sm text-(--foreground)">Equalizer</p>
								<p className="mt-0.5 text-xs text-(--muted-foreground)">
									6-band EQ applied to video audio. Gains are in dB.
								</p>
							</div>
							<div className="flex shrink-0 flex-wrap items-center gap-2">
								<Badge variant={eqEnabled ? "accent" : "default"}>
									{eqEnabled ? "Enabled" : "Disabled"}
								</Badge>
								<Button
									variant={eqEnabled ? "secondary" : "default"}
									size="sm"
									onClick={() => handleEqToggle(!eqEnabled)}
								>
									{eqEnabled ? "Turn off" : "Turn on"}
								</Button>
								<Button variant="ghost" size="sm" onClick={resetEq}>
									Reset
								</Button>
							</div>
						</div>

						<div className="relative w-full overflow-hidden rounded-(--radius-lg) border border-(--border) bg-black/20">
							<svg
								ref={svgRef}
								width="100%"
								viewBox={`0 0 ${eqGraphWidth} ${eqGraphHeight}`}
								className="block h-auto w-full"
								onPointerMove={handleGraphPointerMove}
								onPointerUp={stopDrag}
								onPointerLeave={stopDrag}
							>
								<title>Equalizer graph</title>
								<defs>
									<linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
										<stop
											offset="0%"
											stopColor="var(--accent)"
											stopOpacity="0.25"
										/>
										<stop
											offset="100%"
											stopColor="var(--accent)"
											stopOpacity="0"
										/>
									</linearGradient>
								</defs>

								<rect
									width={eqGraphWidth}
									height={eqGraphHeight}
									fill="transparent"
									className={
										eqEnabled ? "cursor-crosshair" : "cursor-not-allowed"
									}
								/>

								{eqEnabled && eqAreaPath && (
									<path
										d={eqAreaPath}
										fill="url(#eqGradient)"
										className="transition-opacity duration-100 ease-out"
									/>
								)}

								{eqEnabled && eqPath && (
									<path
										d={eqPath}
										fill="none"
										stroke="var(--accent)"
										strokeWidth={2.5}
										className="transition-opacity duration-100 ease-out"
									/>
								)}

								{bandPoints.map((band, index) => {
									const y = gainToY(eqGains[index] ?? 0);
									return (
										<g key={band.label}>
											<line
												x1={band.x}
												y1={eqMargin}
												x2={band.x}
												y2={eqGraphHeight - eqMargin}
												stroke="var(--border)"
												strokeDasharray="2 4"
												className="opacity-50"
											/>
											<text
												x={band.x}
												y={eqGraphHeight - 8}
												textAnchor="middle"
												className="text-[10px] fill-(--muted-foreground) font-medium tabular-nums"
											>
												{band.label}
											</text>
											<text
												x={band.x}
												y={y - 10}
												textAnchor="middle"
												className="text-[10px] fill-(--foreground) font-medium tabular-nums"
											>
												{eqGains[index]?.toFixed(1)} dB
											</text>
											{eqEnabled && (
												<circle
													cx={band.x}
													cy={y}
													r={20}
													fill="transparent"
													className="cursor-grab active:cursor-grabbing"
													onPointerDown={() => handleHandleDown(index)}
												/>
											)}
											<circle
												cx={band.x}
												cy={y}
												r={eqEnabled ? 10 : 8}
												fill={eqEnabled ? "var(--accent)" : "var(--border)"}
												className={
													eqEnabled
														? "pointer-events-none transition-colors duration-150"
														: "pointer-events-none"
												}
											/>
										</g>
									);
								})}

								<line
									x1={eqMargin}
									y1={gainToY(0)}
									x2={eqGraphWidth - eqMargin}
									y2={gainToY(0)}
									stroke="var(--border)"
									strokeDasharray="4 4"
									className="opacity-50"
								/>
							</svg>
						</div>
					</div>
				</SettingsSection>

				<SettingsSection icon={<IconInfoCircle size={16} />} title="About">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-(--foreground) ring-1 ring-white/8">
							<IconPlayerPlay size={18} />
						</div>
						<div>
							<p className="font-display text-sm font-semibold text-(--foreground)">
								{APP_NAME}
							</p>
							<p className="text-xs text-(--muted-foreground)">
								A player where there's nothing extra
							</p>
						</div>
					</div>
					<Separator className="my-4" />
					<div className="space-y-2 text-xs text-(--muted-foreground)">
						<p>All video files remain in their original location.</p>
						<p>
							Keyboard shortcuts: <kbd>Space/K</kbd> play · <kbd>J/L</kbd> seek
							· <kbd>Shift+J/L</kbd> long seek · <kbd>0-9</kbd> jump ·{" "}
							<kbd>F</kbd> fullscreen · <kbd>M</kbd> mute · <kbd>Up/Down</kbd>{" "}
							volume · <kbd>S</kbd> speed · <kbd>Esc</kbd> back ·{" "}
							<kbd>Alt+Left/Right</kbd> history
						</p>
					</div>
					<Separator className="my-4" />
					<Button
						variant="secondary"
						className="w-full"
						onClick={() => window.open(GITHUB_URL, "_blank")}
					>
						<IconBrandGithub size={16} />
						View source code
					</Button>
				</SettingsSection>
			</div>
			<FolderPlaylistDialog
				promptFolder={promptFolder}
				categories={categories}
				onDismiss={dismissCurrent}
				onSubmit={submitFolderPlaylist}
			/>
		</PageFrame>
	);
}

function SettingsSection({
	icon,
	title,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section>
			<div className="mb-2 flex items-center gap-2 px-1">
				<span className="text-(--accent)">{icon}</span>
				<h2 className="text-[13px] font-semibold tracking-[-0.01em] text-(--foreground)">
					{title}
				</h2>
			</div>
			<div className="island rounded-(--radius-lg) px-5 py-5">{children}</div>
		</section>
	);
}

function StatTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-(--radius) bg-white/4 px-3 py-3">
			<p className="eyebrow text-(--muted-foreground)">{label}</p>
			<p className="tnum font-data mt-1.5 text-sm text-(--foreground)">
				{value}
			</p>
		</div>
	);
}

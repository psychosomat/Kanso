import {
	IconDatabase,
	IconEye,
	IconEyeOff,
	IconFolder,
	IconFolderOpen,
	IconFolderPlus,
	IconInfoCircle,
	IconPalette,
	IconPlayerPlay,
	IconRefresh,
	IconTrash,
	IconBrandGithub,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { APP_NAME } from "@/lib/constants";
import type { TitlebarMode } from "@/lib/contracts";
import {
	EQ_BANDS,
	EQ_GAIN_MAX,
	EQ_GAIN_MIN,
	clampEqGain,
	normalizeEqGains,
} from "@/lib/equalizer";
import { getPlayerApi } from "@/lib/player-api";
import { formatDateTime } from "@/lib/utils";

const NOISE_STORAGE_KEY = "player:noiseOpacity";
const ACCENT_STORAGE_KEY = "player:accentColor";
const GITHUB_URL = "https://github.com/psychosomat/Kanso";

function getNoiseOpacity(): number {
	if (typeof window === "undefined") {
		return 0.035;
	}

	const stored = window.localStorage.getItem(NOISE_STORAGE_KEY);
	return stored !== null ? Number(stored) : 0.035;
}

function applyNoiseOpacity(value: number) {
	if (typeof window === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--noise-opacity", String(value));
	window.localStorage.setItem(NOISE_STORAGE_KEY, String(value));
}

function getAccentColor(): string {
	if (typeof window === "undefined") {
		return "#c8883a";
	}

	const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
	return stored ?? "#c8883a";
}

function applyAccentColor(value: string) {
	if (typeof window === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--accent", value);
	window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
}

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

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
	const [noiseOpacity, setNoiseOpacity] = useState<number>(0.035);
	const [accentColor, setAccentColor] = useState<string>("#c8883a");
	const [eqEnabled, setEqEnabled] = useState(false);
	const [eqGains, setEqGains] = useState<number[]>(normalizeEqGains());

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

	const eqGraphWidth = 720;
	const eqGraphHeight = 260;
	const eqMargin = 28;
	const bandPoints = useMemo(
		() =>
			EQ_BANDS.map((band, index) => {
				const x =
					eqMargin +
					(index / Math.max(1, EQ_BANDS.length - 1)) *
						(eqGraphWidth - eqMargin * 2);
				return { ...band, x };
			}),
		[],
	);

	const gainToY = useCallback((value: number) => {
		const clamped = clampEqGain(value);
		const ratio = (EQ_GAIN_MAX - clamped) / (EQ_GAIN_MAX - EQ_GAIN_MIN);
		return eqMargin + ratio * (eqGraphHeight - eqMargin * 2);
	}, []);

	const yToGain = useCallback((y: number) => {
		const ratio = Math.max(
			0,
			Math.min(1, (y - eqMargin) / (eqGraphHeight - eqMargin * 2)),
		);
		const gain = EQ_GAIN_MAX - ratio * (EQ_GAIN_MAX - EQ_GAIN_MIN);
		return clampEqGain(gain);
	}, []);

	const eqPath = useMemo(() => {
		const points = bandPoints.map((band, index) => ({
			x: band.x,
			y: gainToY(eqGains[index] ?? 0),
		}));
		if (!points.length) return "";
		let d = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
		for (let i = 1; i < points.length; i += 1) {
			const prev = points[i - 1];
			const current = points[i];
			const midX = (prev.x + current.x) / 2;
			const midY = (prev.y + current.y) / 2;
			d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
		}
		d += ` T ${points.at(-1)?.x ?? 0} ${points.at(-1)?.y ?? 0}`;
		return d;
	}, [bandPoints, eqGains, gainToY]);

	const eqAreaPath = useMemo(() => {
		if (!eqPath) return "";
		const bottomY = eqGraphHeight - eqMargin;
		const lastX = bandPoints.at(-1)?.x ?? eqMargin;
		return `${eqPath} L ${lastX} ${bottomY} L ${bandPoints[0]?.x ?? eqMargin} ${bottomY} Z`;
	}, [bandPoints, eqPath]);

	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const handleGraphPointerMove = useCallback(
		(event: React.PointerEvent<SVGSVGElement>) => {
			if (dragIndex === null || !eqEnabled || !svgRef.current) return;
			const rect = svgRef.current.getBoundingClientRect();
			const relativeY = event.clientY - rect.top;
			const nextGain = yToGain(relativeY);
			handleEqBandChange(dragIndex, nextGain);
		},
		[dragIndex, eqEnabled, handleEqBandChange, yToGain],
	);

	const handleHandleDown = useCallback(
		(index: number) => {
			if (!eqEnabled) return;
			setDragIndex(index);
		},
		[eqEnabled],
	);

	const stopDrag = useCallback((_event: React.PointerEvent<SVGSVGElement>) => {
		setDragIndex(null);
	}, []);

	function handleTitlebarModeChange(value: string) {
		const nextMode = value as TitlebarMode;
		void savePreferences({ titlebarMode: nextMode });
	}

	async function chooseFolders() {
		setBusy(true);
		try {
			await getPlayerApi().settings.chooseLibraryFolders();
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function addFolder() {
		setBusy(true);
		try {
			await getPlayerApi().settings.addLibraryFolder();
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function removeFolder(folderId: string) {
		setBusy(true);
		try {
			await getPlayerApi().settings.removeLibraryFolder(folderId);
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function toggleWatchFolder(folderId: string) {
		setBusy(true);
		try {
			await getPlayerApi().settings.toggleWatchFolder(folderId);
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function rescan() {
		setBusy(true);
		try {
			await getPlayerApi().library.rescanNow();
			await refreshAll();
		} finally {
			setBusy(false);
		}
	}

	async function saveSpeedPreset(
		key: "speedPresetPrimary" | "speedPresetSecondary",
		value: string,
	) {
		const parsed = Number(value);
		if (Number.isNaN(parsed)) return;
		const clamped = Math.max(0.2, Math.min(4, Number(parsed.toFixed(1))));
		await savePreferences({ [key]: clamped });
	}

	const scanProgress =
		scanStatus && scanStatus.totalFiles > 0
			? Math.round((scanStatus.scannedFiles / scanStatus.totalFiles) * 100)
			: null;

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
									{library?.sourcePaths.map((folder) => (
										<div
											key={folder.id}
											className="flex items-center justify-between gap-3 rounded-(--radius) border border-(--border) bg-(--panel-strong) p-3"
										>
											<div className="flex min-w-0 items-center gap-2">
												<IconFolder
													size={16}
													className="shrink-0 text-(--accent)"
												/>
												<span className="truncate text-sm text-(--foreground)">
													{folder.path}
												</span>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<Button
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
									))}
								</div>
							) : (
								<p className="text-sm text-(--muted-foreground)">
									No folders selected
								</p>
							)}
						</div>

						<div className="flex flex-wrap gap-2">
							<Button onClick={() => void chooseFolders()} disabled={busy}>
								<IconFolderOpen size={16} />
								Choose folders
							</Button>
							<Button
								variant="secondary"
								onClick={() => void addFolder()}
								disabled={busy}
							>
								<IconFolderPlus size={16} />
								Add folder
							</Button>
							<Button
								variant="secondary"
								onClick={() => void rescan()}
								disabled={busy || !hasSourcePaths}
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
										className="h-full rounded-full bg-(--accent) transition-all duration-300"
										style={{ width: `${scanProgress}%` }}
									/>
								</div>
							</div>
						)}

						<Separator />

						<div className="grid gap-3 sm:grid-cols-4">
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
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-(--foreground)">Accent color</p>
									<p className="mt-0.5 text-xs text-(--muted-foreground)">
										Primary interface color for highlights and actions
									</p>
								</div>
								<div className="flex items-center gap-2">
									<input
										type="color"
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
							<div className="flex items-center justify-between gap-4">
								<div>
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
									<SelectTrigger className="w-44">
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

				<SettingsSection icon={<IconPlayerPlay size={16} />} title="Playback">
					<p className="text-sm text-(--muted-foreground)">
						Speed presets shown as quick-access buttons in the player. Wheel on
						the gauge icon adjusts speed in 0.2 increments.
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
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-sm text-(--foreground)">Equalizer</p>
								<p className="mt-0.5 text-xs text-(--muted-foreground)">
									6-band EQ applied to video audio. Gains are in dB.
								</p>
							</div>
							<div className="flex items-center gap-2">
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

						<div className="relative w-full overflow-hidden rounded-(--radius) border border-(--border) bg-(--panel)">
							<svg
								ref={svgRef}
								width="100%"
								height="auto"
								viewBox={`0 0 ${eqGraphWidth} ${eqGraphHeight}`}
								className="block"
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
										className="transition-all duration-100 ease-out"
									/>
								)}

								{eqEnabled && eqPath && (
									<path
										d={eqPath}
										fill="none"
										stroke="var(--accent)"
										strokeWidth={2.5}
										className="transition-all duration-100 ease-out"
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
														? "pointer-events-none transition-all duration-150"
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
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius) bg-(--accent-subtle)">
							<IconPlayerPlay size={20} className="text-(--accent-strong)" />
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
							· <kbd>F</kbd> fullscreen · <kbd>M</kbd> mute · <kbd>Up/Down</kbd>
							volume
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
		<section className="rounded-xl border border-(--border) bg-(--panel) p-5">
			<div className="mb-4 flex items-center gap-2">
				<span className="text-(--accent)">{icon}</span>
				<h2 className="font-display text-sm font-semibold tracking-wide text-(--foreground)">
					{title}
				</h2>
			</div>
			{children}
		</section>
	);
}

function StatTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-(--radius) bg-(--panel-strong) px-3 py-2.5">
			<p className="text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)">
				{label}
			</p>
			<p className="mt-1 text-sm font-medium text-(--foreground)">{value}</p>
		</div>
	);
}

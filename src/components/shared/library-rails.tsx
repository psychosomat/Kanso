import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/layout/app-state";
import { VideoCard } from "@/components/shared/video-card";
import { Button } from "@/components/ui/button";
import type {
	CategoryDto,
	PlayerPreferencesDto,
	ScanStatusDto,
	SourcePathDto,
	VideoCardDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { formatDuration } from "@/lib/utils";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconChevronLeft from "~icons/tabler/chevron-left";
import IconChevronRight from "~icons/tabler/chevron-right";
import IconChevronUp from "~icons/tabler/chevron-up";
import IconEyeOff from "~icons/tabler/eye-off";

export type RailId = "continue-watching" | "recently-added";

export const RAIL_SCROLL_STEP = 480;
const RAIL_LIMIT = 20;

type RailAction = (
	videoId: string,
	action: "open-folder" | "reveal-file" | "copy-path",
) => void;

export function railCollapsedStorageKey(railId: RailId): string {
	return `kanso:rail-collapsed:${railId}`;
}

export function readRailCollapsed(railId: RailId): boolean {
	try {
		return sessionStorage.getItem(railCollapsedStorageKey(railId)) === "1";
	} catch {
		return false;
	}
}

export function writeRailCollapsed(railId: RailId, collapsed: boolean): void {
	try {
		if (collapsed) {
			sessionStorage.setItem(railCollapsedStorageKey(railId), "1");
		} else {
			sessionStorage.removeItem(railCollapsedStorageKey(railId));
		}
	} catch {
		// Ignore restricted storage environments
	}
}

export function resolveRailPreferences(
	preferences:
		| Pick<PlayerPreferencesDto, "showContinueWatching" | "showRecentlyAdded">
		| null
		| undefined,
) {
	return {
		showContinueWatching: preferences?.showContinueWatching ?? true,
		showRecentlyAdded: preferences?.showRecentlyAdded ?? true,
	};
}

/**
 * Serializes library source paths (including privacy flag) so edits, removals,
 * or "Hidden from Home" toggles reliably trigger home rail and feed refreshes.
 */
export function getSourcePathsFingerprint(
	sourcePaths:
		| readonly Pick<SourcePathDto, "id" | "hiddenFromHome">[]
		| null
		| undefined,
): string {
	if (!sourcePaths || sourcePaths.length === 0) return "";
	return sourcePaths
		.map((folder) => `${folder.id}:${folder.hiddenFromHome ? "1" : "0"}`)
		.join("|");
}

/**
 * Serializes categories so board additions/removals, privacy toggles,
 * hierarchy reparenting, or post count shifts refresh home rails.
 */
export function getCategoriesFingerprint(
	categories: readonly (Pick<CategoryDto, "id" | "hiddenFromHome"> &
		Partial<Pick<CategoryDto, "parentCategoryId" | "postCount">>)[],
): string {
	if (categories.length === 0) return "";
	return categories
		.map(
			(category) =>
				`${category.id}:${category.hiddenFromHome ? "1" : "0"}:${category.parentCategoryId ?? ""}:${category.postCount ?? ""}`,
		)
		.join("|");
}

export function getIdleScanRefreshKey(
	scanStatus: Pick<ScanStatusDto, "status" | "updatedAt"> | null | undefined,
): string | null {
	return scanStatus?.status === "idle" ? scanStatus.updatedAt : null;
}

export function removeVideoFromRailList(
	videos: VideoCardDto[],
	videoId: string,
): VideoCardDto[] {
	return videos.filter((video) => video.id !== videoId);
}

function Rail({
	railId,
	title,
	description,
	videos,
	duplicateIds,
	onAssign,
	onAction,
	onRemove,
	onDismiss,
	onHideSection,
}: {
	railId: RailId;
	title: string;
	description: string;
	videos: VideoCardDto[];
	duplicateIds: Set<string>;
	onAssign: (videoId: string) => void;
	onAction: RailAction;
	onRemove?: (videoId: string) => Promise<void>;
	onDismiss?: (videoId: string) => void;
	onHideSection: () => void;
}) {
	const [collapsed, setCollapsed] = useState(() => readRailCollapsed(railId));
	const scrollerRef = useRef<HTMLDivElement>(null);

	if (videos.length === 0) {
		return null;
	}

	function scrollRail(direction: -1 | 1) {
		scrollerRef.current?.scrollBy({
			left: direction * RAIL_SCROLL_STEP,
			behavior: "smooth",
		});
	}

	function toggleCollapsed() {
		setCollapsed((current) => {
			const next = !current;
			writeRailCollapsed(railId, next);
			return next;
		});
	}

	return (
		<section aria-label={title} className="mb-8">
			<div className="mb-3 flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<h2 className="text-[15px] font-semibold text-(--foreground)">
							{title}
						</h2>
						{collapsed ? (
							<span className="font-data text-[11px] text-(--muted-foreground)">
								({videos.length})
							</span>
						) : null}
					</div>
					{!collapsed ? (
						<p className="text-xs text-(--muted-foreground)">{description}</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{!collapsed ? (
						<>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={`Scroll ${title} left`}
								title={`Scroll ${title} left`}
								onClick={() => scrollRail(-1)}
							>
								<IconChevronLeft size={15} />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={`Scroll ${title} right`}
								title={`Scroll ${title} right`}
								onClick={() => scrollRail(1)}
							>
								<IconChevronRight size={15} />
							</Button>
						</>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-expanded={!collapsed}
						aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
						title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
						onClick={toggleCollapsed}
					>
						{collapsed ? (
							<IconChevronDown size={15} />
						) : (
							<IconChevronUp size={15} />
						)}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Hide ${title} section`}
						title={`Hide ${title} (re-enable in Settings)`}
						onClick={onHideSection}
					>
						<IconEyeOff size={15} />
					</Button>
				</div>
			</div>
			{!collapsed ? (
				<div
					ref={scrollerRef}
					className="app-scrollbar -mx-1 flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2"
				>
					{videos.map((video) => (
						<div key={video.id} className="w-60 shrink-0 sm:w-64">
							<VideoCard
								video={video}
								duplicate={duplicateIds.has(video.id)}
								showResumeProgress
								resumeLabel={
									video.resumeSec > 0 && video.durationSec
										? `Resumes at ${formatDuration(video.resumeSec)}`
										: undefined
								}
								onAssign={onAssign}
								onAction={onAction}
								onRemove={onRemove}
								onDismiss={onDismiss}
							/>
						</div>
					))}
				</div>
			) : null}
		</section>
	);
}

export function LibraryRails({
	duplicateIds,
	onAssign,
	onAction,
	onRemove,
	refreshKey = 0,
}: {
	duplicateIds: Set<string>;
	onAssign: (videoId: string) => void;
	onAction: RailAction;
	onRemove?: (videoId: string) => Promise<void>;
	refreshKey?: number;
}) {
	const { preferences, savePreferences, library, categories, scanStatus } =
		useAppState();
	const [continueWatching, setContinueWatching] = useState<VideoCardDto[]>([]);
	const [recentlyAdded, setRecentlyAdded] = useState<VideoCardDto[]>([]);

	const { showContinueWatching, showRecentlyAdded } =
		resolveRailPreferences(preferences);
	const sourcePathsKey = getSourcePathsFingerprint(library?.sourcePaths);
	const categoriesKey = getCategoriesFingerprint(categories);
	const idleScanKey = getIdleScanRefreshKey(scanStatus);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fingerprints, idle scan timestamp, and refreshKey drive rail reloads
	useEffect(() => {
		if (!sourcePathsKey || typeof window === "undefined" || !window.playerApi) {
			setContinueWatching([]);
			setRecentlyAdded([]);
			return;
		}
		const api = getPlayerApi();
		let cancelled = false;

		if (showContinueWatching) {
			void api.library.getContinueWatching(RAIL_LIMIT).then((watching) => {
				if (!cancelled) {
					setContinueWatching(watching);
				}
			});
		} else {
			setContinueWatching([]);
		}

		if (showRecentlyAdded) {
			void api.library.getRecentlyAdded(RAIL_LIMIT).then((added) => {
				if (!cancelled) {
					setRecentlyAdded(added);
				}
			});
		} else {
			setRecentlyAdded([]);
		}

		return () => {
			cancelled = true;
		};
	}, [
		sourcePathsKey,
		categoriesKey,
		showContinueWatching,
		showRecentlyAdded,
		idleScanKey,
		refreshKey,
	]);

	const handleDismissContinueWatching = useCallback((videoId: string) => {
		setContinueWatching((current) => removeVideoFromRailList(current, videoId));
		void getPlayerApi()
			.player.dismissContinueWatching(videoId)
			.catch(async (error) => {
				console.error("Failed to dismiss Continue Watching item", error);
				try {
					const watching =
						await getPlayerApi().library.getContinueWatching(RAIL_LIMIT);
					setContinueWatching(watching);
				} catch {
					// Ignore secondary fetch failures
				}
			});
	}, []);

	const handleRemove = useMemo(() => {
		if (!onRemove) return undefined;
		return async (videoId: string) => {
			await onRemove(videoId);
			setContinueWatching((current) =>
				removeVideoFromRailList(current, videoId),
			);
			setRecentlyAdded((current) => removeVideoFromRailList(current, videoId));
		};
	}, [onRemove]);

	const visibleContinueWatching = showContinueWatching ? continueWatching : [];
	const visibleRecentlyAdded = showRecentlyAdded ? recentlyAdded : [];

	if (
		visibleContinueWatching.length === 0 &&
		visibleRecentlyAdded.length === 0
	) {
		return null;
	}

	return (
		<div>
			<Rail
				railId="continue-watching"
				title="Continue Watching"
				description="Pick up where you left off"
				videos={visibleContinueWatching}
				duplicateIds={duplicateIds}
				onAssign={onAssign}
				onAction={onAction}
				onRemove={handleRemove}
				onDismiss={handleDismissContinueWatching}
				onHideSection={() => {
					void savePreferences({ showContinueWatching: false });
				}}
			/>
			<Rail
				railId="recently-added"
				title="Recently Added"
				description="Fresh in your library"
				videos={visibleRecentlyAdded}
				duplicateIds={duplicateIds}
				onAssign={onAssign}
				onAction={onAction}
				onRemove={handleRemove}
				onHideSection={() => {
					void savePreferences({ showRecentlyAdded: false });
				}}
			/>
		</div>
	);
}

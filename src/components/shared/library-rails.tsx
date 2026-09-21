import { useEffect, useState } from "react";
import { useAppState } from "@/components/layout/app-state";
import { VideoCard } from "@/components/shared/video-card";
import type { VideoCardDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { formatDuration } from "@/lib/utils";

type RailAction = (
	videoId: string,
	action: "open-folder" | "reveal-file" | "copy-path",
) => void;

function Rail({
	title,
	description,
	videos,
	duplicateIds,
	onAssign,
	onAction,
}: {
	title: string;
	description: string;
	videos: VideoCardDto[];
	duplicateIds: Set<string>;
	onAssign: (videoId: string) => void;
	onAction: RailAction;
}) {
	if (videos.length === 0) {
		return null;
	}
	return (
		<section aria-label={title} className="mb-8">
			<div className="mb-3 flex items-baseline justify-between gap-2">
				<div>
					<h2 className="text-[15px] font-semibold text-(--foreground)">
						{title}
					</h2>
					<p className="text-xs text-(--muted-foreground)">{description}</p>
				</div>
			</div>
			<div className="app-scrollbar -mx-1 flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2">
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
						/>
					</div>
				))}
			</div>
		</section>
	);
}

export function LibraryRails({
	duplicateIds,
	onAssign,
	onAction,
}: {
	duplicateIds: Set<string>;
	onAssign: (videoId: string) => void;
	onAction: RailAction;
}) {
	const { library, scanStatus } = useAppState();
	const [continueWatching, setContinueWatching] = useState<VideoCardDto[]>([]);
	const [recentlyAdded, setRecentlyAdded] = useState<VideoCardDto[]>([]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scanStatus.updatedAt is a refresh trigger
	useEffect(() => {
		if (!library?.sourcePaths.length || !window.playerApi) {
			setContinueWatching([]);
			setRecentlyAdded([]);
			return;
		}
		const api = getPlayerApi();
		let cancelled = false;
		void Promise.all([
			api.library.getContinueWatching(20),
			api.library.getRecentlyAdded(20),
		]).then(([watching, added]) => {
			if (cancelled) {
				return;
			}
			setContinueWatching(watching);
			setRecentlyAdded(added);
		});
		return () => {
			cancelled = true;
		};
	}, [library?.sourcePaths.length, scanStatus?.updatedAt]);

	if (continueWatching.length === 0 && recentlyAdded.length === 0) {
		return null;
	}

	return (
		<div>
			<Rail
				title="Continue Watching"
				description="Pick up where you left off"
				videos={continueWatching}
				duplicateIds={duplicateIds}
				onAssign={onAssign}
				onAction={onAction}
			/>
			<Rail
				title="Recently Added"
				description="Fresh in your library"
				videos={recentlyAdded}
				duplicateIds={duplicateIds}
				onAssign={onAssign}
				onAction={onAction}
			/>
		</div>
	);
}

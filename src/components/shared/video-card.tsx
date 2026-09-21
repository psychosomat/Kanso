import { Link, useLocation } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { RemoveVideoDialog } from "@/components/shared/remove-video-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VideoCardDto } from "@/lib/contracts";
import {
	getMainScrollElement,
	savePlayerReturnTarget,
} from "@/lib/player-return";
import {
	formatDateTime,
	formatDuration,
	formatResolution,
	preventMiddleClickAutoscroll,
} from "@/lib/utils";
import { setDraggedVideoId } from "@/lib/video-drag";
import IconCopy from "~icons/tabler/copy";
import IconDots from "~icons/tabler/dots";
import IconFolder from "~icons/tabler/folder";
import IconFolderPlus from "~icons/tabler/folder-plus";
import IconFolderSearch from "~icons/tabler/folder-search";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconTrash from "~icons/tabler/trash";

type Props = {
	video: VideoCardDto;
	onAssign: (videoId: string) => void;
	onAction: (
		videoId: string,
		action: "open-folder" | "reveal-file" | "copy-path",
	) => void;
	onRemove?: (videoId: string) => Promise<void>;
	caption?: string | null;
	draggable?: boolean;
	duplicate?: boolean;
	showResumeProgress?: boolean;
	resumeLabel?: string;
};

export function getRemoveDialogDescription(exists: boolean): string {
	return exists
		? "This only removes the indexed entry and category posts. The original file stays on disk."
		: "This removes the missing entry and any category posts that still reference it.";
}

export type VideoCardMenuSurface = "dropdown" | "context";

export type VideoCardMenuItemId =
	| "categorize"
	| "open-folder"
	| "reveal-file"
	| "copy-path"
	| "remove";

export type VideoCardMenuItem = {
	id: VideoCardMenuItemId;
	label: string;
	destructive?: boolean;
};

export function buildVideoCardMenuItems(
	surface: VideoCardMenuSurface,
	options: { canRemove: boolean },
): VideoCardMenuItem[] {
	const items: VideoCardMenuItem[] = [
		{ id: "categorize", label: "Categorize" },
	];
	if (surface === "context") {
		items.push({ id: "open-folder", label: "Open folder" });
	}
	items.push({
		id: "reveal-file",
		label: surface === "dropdown" ? "Reveal" : "Reveal file",
	});
	items.push({ id: "copy-path", label: "Copy path" });
	if (options.canRemove) {
		items.push({
			id: "remove",
			label: "Remove from library",
			destructive: true,
		});
	}
	return items;
}

function VideoThumbnail({
	video,
	duplicate,
	showResumeProgress,
}: {
	video: VideoCardDto;
	duplicate?: boolean;
	showResumeProgress?: boolean;
}) {
	const progressPercent =
		showResumeProgress &&
		video.resumeSec > 0 &&
		video.durationSec &&
		video.durationSec > 0
			? Math.min(100, (video.resumeSec / video.durationSec) * 100)
			: null;
	return (
		<div className="relative aspect-video overflow-hidden rounded-(--radius-lg) bg-black ring-1 ring-white/8 transition-[box-shadow,ring-color,transform] duration-300 ease-out group-hover:shadow-[0_24px_60px_-24px_var(--accent-subtle)] group-hover:ring-(--accent)/45">
			{video.posterUrl ? (
				<img
					src={video.posterUrl}
					alt={video.fileName}
					loading="lazy"
					decoding="async"
					draggable={false}
					className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center bg-white/5">
					<IconPlayerPlayFilled
						size={28}
						className="text-(--muted-foreground)/50"
					/>
				</div>
			)}

			{!video.exists && (
				<div className="absolute left-2 top-2">
					<Badge variant="destructive">Missing</Badge>
				</div>
			)}

			{duplicate && video.exists && (
				<div className="absolute left-2 top-2">
					<Badge>Possible duplicates</Badge>
				</div>
			)}

			<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

			<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
				<div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--accent) text-white shadow-[0_12px_36px_-8px_var(--accent)] transition-transform duration-300 group-hover:scale-100 scale-90">
					<IconPlayerPlayFilled size={18} />
				</div>
			</div>

			<div className="tnum font-data pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
				{formatDuration(video.durationSec)}
			</div>

			{progressPercent !== null && (
				<div
					className="absolute inset-x-0 bottom-0 h-1 bg-white/15"
					role="progressbar"
					aria-label="Resume progress"
					aria-valuenow={Math.round(progressPercent)}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					<div
						className="h-full bg-(--accent)"
						style={{ width: `${progressPercent}%` }}
					/>
				</div>
			)}
		</div>
	);
}

function VideoMeta({
	video,
	caption,
	resumeLabel,
}: {
	video: VideoCardDto;
	caption?: string | null;
	resumeLabel?: string;
}) {
	return (
		<div className="min-w-0 flex-1">
			<h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-(--foreground)/90 transition-colors group-hover:text-(--foreground)">
				{video.fileName}
			</h3>
			<p className="font-data mt-1 line-clamp-1 text-[10px] uppercase tracking-[0.08em] text-(--muted-foreground)">
				{formatResolution(video.width, video.height)}
				{" · "}
				{formatDateTime(video.modifiedAt)}
			</p>
			{resumeLabel && (
				<p className="tnum mt-1 line-clamp-1 text-[11px] text-(--accent-strong)">
					{resumeLabel}
				</p>
			)}
			{caption && (
				<p className="mt-1 line-clamp-2 text-xs text-(--muted-foreground)">
					{caption}
				</p>
			)}
		</div>
	);
}

const VIDEO_CARD_MENU_ICONS: Record<
	VideoCardMenuItemId,
	(props: { size: number }) => React.ReactNode
> = {
	categorize: (props) => <IconFolderPlus {...props} />,
	"open-folder": (props) => <IconFolder {...props} />,
	"reveal-file": (props) => <IconFolderSearch {...props} />,
	"copy-path": (props) => <IconCopy {...props} />,
	remove: (props) => <IconTrash {...props} />,
};

export function VideoCard({
	video,
	onAssign,
	onAction,
	onRemove,
	caption,
	draggable = true,
	duplicate = false,
	showResumeProgress = false,
	resumeLabel,
}: Props) {
	const location = useLocation();
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [removing, setRemoving] = useState(false);

	const onOpenPlayer = useCallback(() => {
		savePlayerReturnTarget({
			pathname: location.pathname,
			scrollTop: getMainScrollElement()?.scrollTop ?? 0,
		});
	}, [location.pathname]);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		preventMiddleClickAutoscroll(e);
	}, []);

	const handleDragStart = useCallback(
		(e: React.DragEvent<HTMLAnchorElement>) => {
			setDraggedVideoId(e.dataTransfer, video.id);
		},
		[video.id],
	);

	const dispatchMenuAction = useCallback(
		(id: VideoCardMenuItemId) => {
			if (id === "categorize") {
				onAssign(video.id);
			} else if (id === "remove") {
				setRemoveDialogOpen(true);
			} else {
				onAction(video.id, id);
			}
		},
		[onAction, onAssign, video.id],
	);

	const dropdownItems = buildVideoCardMenuItems("dropdown", {
		canRemove: onRemove !== undefined,
	});
	const contextMenuItems = buildVideoCardMenuItems("context", {
		canRemove: onRemove !== undefined,
	});

	async function handleRemove() {
		if (!onRemove) return;
		setRemoving(true);
		try {
			await onRemove(video.id);
			setRemoveDialogOpen(false);
		} finally {
			setRemoving(false);
		}
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<Link
						to="/player/$videoId"
						params={{ videoId: video.id }}
						onClickCapture={onOpenPlayer}
						onClick={onOpenPlayer}
						onMouseDown={handleMouseDown}
						onDragStart={draggable ? handleDragStart : undefined}
						draggable={draggable}
						className="group block cursor-grab active:cursor-grabbing"
					>
						<VideoThumbnail
							video={video}
							duplicate={duplicate}
							showResumeProgress={showResumeProgress}
						/>

						<div className="mt-2 flex items-start gap-2 px-0.5">
							<VideoMeta
								video={video}
								caption={caption}
								resumeLabel={resumeLabel}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="mt-0.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
										aria-label={`Video actions for ${video.fileName}`}
										onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
									>
										<IconDots size={16} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{dropdownItems.map((item) => {
										const MenuIcon = VIDEO_CARD_MENU_ICONS[item.id];
										return (
											<DropdownMenuItem
												key={item.id}
												onClick={(e) => {
													e.stopPropagation();
													dispatchMenuAction(item.id);
												}}
												className={
													item.destructive ? "text-(--destructive)" : undefined
												}
											>
												<MenuIcon size={16} />
												{item.label}
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</Link>
				</ContextMenuTrigger>
				<ContextMenuContent>
					{contextMenuItems.map((item) => {
						const MenuIcon = VIDEO_CARD_MENU_ICONS[item.id];
						return (
							<ContextMenuItem
								key={item.id}
								onSelect={() => dispatchMenuAction(item.id)}
								className={
									item.destructive ? "text-(--destructive)" : undefined
								}
							>
								<MenuIcon size={16} />
								{item.label}
							</ContextMenuItem>
						);
					})}
				</ContextMenuContent>
			</ContextMenu>

			<RemoveVideoDialog
				open={removeDialogOpen}
				onOpenChange={setRemoveDialogOpen}
				removing={removing}
				onConfirm={() => void handleRemove()}
				description={getRemoveDialogDescription(video.exists)}
			/>
		</>
	);
}

import { Link, useLocation } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog-impl";
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
import { formatDateTime, formatDuration, formatResolution } from "@/lib/utils";
import { setDraggedVideoId } from "@/lib/video-drag";
import IconCopy from "~icons/tabler/copy";
import IconDots from "~icons/tabler/dots";
import IconFolder from "~icons/tabler/folder";
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
};

export function VideoCard({
	video,
	onAssign,
	onAction,
	onRemove,
	caption,
	draggable = true,
}: Props) {
	const cardRef = useRef<HTMLAnchorElement>(null);
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
		if (e.button === 1) {
			e.preventDefault();
		}
	}, []);

	const handleDragStart = useCallback(
		(e: React.DragEvent<HTMLAnchorElement>) => {
			setDraggedVideoId(e.dataTransfer, video.id);
		},
		[video.id],
	);

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
						ref={cardRef}
						to="/player/$videoId"
						params={{ videoId: video.id }}
						onClickCapture={onOpenPlayer}
						onClick={onOpenPlayer}
						onMouseDown={handleMouseDown}
						onDragStart={draggable ? handleDragStart : undefined}
						draggable={draggable}
						className="group block cursor-grab active:cursor-grabbing"
					>
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

							<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

							<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--accent) text-white shadow-[0_12px_36px_-8px_var(--accent)] transition-transform duration-300 group-hover:scale-100 scale-90">
									<IconPlayerPlayFilled size={18} />
								</div>
							</div>

							<div className="tnum font-data pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
								{formatDuration(video.durationSec)}
							</div>
						</div>

						<div className="mt-2 flex items-start gap-2 px-0.5">
							<div className="min-w-0 flex-1">
								<h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-(--foreground)/90 transition-colors group-hover:text-(--foreground)">
									{video.fileName}
								</h3>
								<p className="font-data mt-1 line-clamp-1 text-[10px] uppercase tracking-[0.08em] text-(--muted-foreground)/80">
									{formatResolution(video.width, video.height)}
									{" · "}
									{formatDateTime(video.modifiedAt)}
								</p>
								{caption && (
									<p className="mt-1 line-clamp-2 text-xs text-(--muted-foreground)">
										{caption}
									</p>
								)}
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
										onClick={(e) => e.stopPropagation()}
									>
										<IconDots size={16} />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={(e) => {
											e.stopPropagation();
											onAssign(video.id);
										}}
									>
										<IconFolder size={16} />
										Categorize
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={(e) => {
											e.stopPropagation();
											onAction(video.id, "reveal-file");
										}}
									>
										<IconFolderSearch size={16} />
										Reveal
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={(e) => {
											e.stopPropagation();
											onAction(video.id, "copy-path");
										}}
									>
										<IconCopy size={16} />
										Copy path
									</DropdownMenuItem>
									{onRemove ? (
										<DropdownMenuItem
											onClick={(e) => {
												e.stopPropagation();
												setRemoveDialogOpen(true);
											}}
											className="text-(--destructive)"
										>
											<IconTrash size={16} />
											Remove from library
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</Link>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onSelect={() => onAssign(video.id)}>
						<IconFolder size={16} />
						Categorize
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onAction(video.id, "open-folder")}>
						<IconFolderSearch size={16} />
						Open folder
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onAction(video.id, "reveal-file")}>
						<IconFolderSearch size={16} />
						Reveal file
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onAction(video.id, "copy-path")}>
						<IconCopy size={16} />
						Copy path
					</ContextMenuItem>
					{onRemove ? (
						<ContextMenuItem
							onSelect={() => setRemoveDialogOpen(true)}
							className="text-(--destructive)"
						>
							<IconTrash size={16} />
							Remove from library
						</ContextMenuItem>
					) : null}
				</ContextMenuContent>
			</ContextMenu>

			<AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Remove this video from the library?
						</AlertDialogTitle>
						<AlertDialogDescription>
							{video.exists
								? "This only removes the indexed entry and category posts. The original file stays on disk."
								: "This removes the missing entry and any category posts that still reference it."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => void handleRemove()}
							disabled={removing}
						>
							{removing ? "Removing…" : "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

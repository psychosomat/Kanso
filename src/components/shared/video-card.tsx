import {
	IconCopy,
	IconDots,
	IconFolder,
	IconFolderSearch,
	IconPlayerPlayFilled,
	IconTrash,
} from "@tabler/icons-react";
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
} from "@/components/ui/alert-dialog";
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

type Props = {
	video: VideoCardDto;
	onAssign: (videoId: string) => void;
	onAction: (
		videoId: string,
		action: "open-folder" | "reveal-file" | "copy-path",
	) => void;
	onRemove?: (videoId: string) => Promise<void>;
	caption?: string | null;
};

export function VideoCard({
	video,
	onAssign,
	onAction,
	onRemove,
	caption,
}: Props) {
	const cardRef = useRef<HTMLAnchorElement>(null);
	const location = useLocation();
	const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
	const [removing, setRemoving] = useState(false);

	// Disabled hover animations for better LCP
	// const onPointerEnter = useCallback(() => {
	// 	if (!cardRef.current) return;
	// 	gsap.to(cardRef.current, {
	// 		scale: 1.02,
	// 		duration: 0.2,
	// 		ease: "power2.out",
	// 	});
	// }, []);
	// const onPointerLeave = useCallback(() => {
	// 	if (!cardRef.current) return;
	// 	gsap.to(cardRef.current, {
	// 		scale: 1,
	// 		duration: 0.2,
	// 		ease: "power2.out",
	// 	});
	// }, []);

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
						className="group relative block overflow-hidden rounded-lg border border-(--border) bg-(--panel) transition-[border-color,box-shadow] duration-300 hover:border-(--accent)/30 hover:shadow-lg"
					>
						<div className="relative aspect-video overflow-hidden bg-(--panel-strong)">
							{video.posterUrl ? (
								<img
									src={video.posterUrl}
									alt={video.fileName}
									loading="eager"
									decoding="async"
									className="h-full w-full object-cover"
								/>
							) : (
								<video
									src={video.streamUrl}
									preload="metadata"
									muted
									className="h-full w-full object-cover"
								/>
							)}

							<div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
							<div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

							<div className="absolute left-3 top-3 flex gap-2">
								{!video.exists && <Badge variant="destructive">Missing</Badge>}
								<Badge variant="accent">
									{formatDuration(video.durationSec)}
								</Badge>
							</div>

							<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
								<div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--accent)/90 text-white shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-100 scale-90">
									<IconPlayerPlayFilled size={24} />
								</div>
							</div>
						</div>

						<div className="p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<h3 className="line-clamp-2 text-sm font-medium text-(--foreground) leading-relaxed">
										{video.fileName}
									</h3>
									<p className="mt-1 text-xs text-(--muted-foreground)">
										{formatResolution(video.width, video.height)}
									</p>
								</div>
								<Badge variant="outline" className="shrink-0">
									{video.categoryCount}
								</Badge>
							</div>

							{caption && (
								<p className="mt-2 text-sm text-(--foreground)/80 line-clamp-2">
									{caption}
								</p>
							)}

							<p className="mt-2 line-clamp-1 text-xs text-(--muted-foreground)/70">
								{video.folderPath}
							</p>

							<div className="mt-3 flex items-center justify-between">
								<span className="text-xs text-(--muted-foreground)/60">
									{formatDateTime(video.modifiedAt)}
								</span>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
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

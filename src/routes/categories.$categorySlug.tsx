import { createFileRoute } from "@tanstack/react-router";
import { type DragEvent, useCallback, useEffect, useState } from "react";
import { AssignVideoDialog } from "@/components/categories/assign-video-dialog";
import { useAppState } from "@/components/layout/app-state";
import { PageFrame } from "@/components/shared/page-frame";
import { VideoCard } from "@/components/shared/video-card";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import type {
	CategoryFeedSort,
	CategoryPostDto,
	PaginatedCategoryPostsDto,
	VideoDetailDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { cn } from "@/lib/utils";
import {
	getDraggedPostId,
	hasDraggedPost,
	setDraggedPostId,
} from "@/lib/video-drag";

export const Route = createFileRoute("/categories/$categorySlug")({
	component: CategoryFeedPage,
});

const FEED_SORTS: CategoryFeedSort[] = [
	"newestPost",
	"name",
	"lastPlayed",
	"manual",
];

function feedSortStorageKey(slug: string) {
	return `kanso:feed-sort:${slug}`;
}

function readStoredSort(slug: string): CategoryFeedSort {
	try {
		const value = localStorage.getItem(feedSortStorageKey(slug));
		return FEED_SORTS.includes(value as CategoryFeedSort)
			? (value as CategoryFeedSort)
			: "newestPost";
	} catch {
		return "newestPost";
	}
}

function CategoryFeedPage() {
	const { categorySlug } = Route.useParams();
	const { categories, refreshAll } = useAppState();
	const [sort, setSort] = useState<CategoryFeedSort>(() =>
		readStoredSort(categorySlug),
	);
	const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
	const [data, setData] = useState<PaginatedCategoryPostsDto | null>(null);
	useScrollRestore(`/categories/${categorySlug}`, data !== null);
	const [selectedVideo, setSelectedVideo] = useState<VideoDetailDto | null>(
		null,
	);
	const [assignOpen, setAssignOpen] = useState(false);
	const [reorderError, setReorderError] = useState<string | null>(null);
	const [reordering, setReordering] = useState(false);

	useEffect(() => {
		setSort(readStoredSort(categorySlug));
	}, [categorySlug]);

	useEffect(() => {
		if (!window.playerApi) return;
		let cancelled = false;

		const api = getPlayerApi();
		void api.categories.getBySlug(categorySlug).then((category) => {
			if (cancelled) {
				return;
			}
			if (!category) {
				setData(null);
				return;
			}
			void api.categories
				.getFeed({
					categoryId: category.id,
					page: 1,
					pageSize: 100,
					sort,
				})
				.then((response) => {
					if (!cancelled) {
						setData(response);
					}
				});
		});

		return () => {
			cancelled = true;
		};
	}, [categorySlug, sort]);

	async function openAssign(videoId: string) {
		const detail = await getPlayerApi().library.getVideo(videoId);
		setSelectedVideo(detail);
		setAssignOpen(true);
	}

	async function submitAssignments(
		payload: Array<{ categoryId: string; caption?: string }>,
	) {
		if (!selectedVideo) return;
		await getPlayerApi().categories.addVideo({
			videoId: selectedVideo.id,
			categories: payload,
		});
		await refreshAll();
	}

	async function runAction(
		videoId: string,
		action: "open-folder" | "reveal-file" | "copy-path",
	) {
		await getPlayerApi().library.runVideoAction(videoId, action);
	}

	async function removeVideo(videoId: string) {
		await getPlayerApi().library.removeVideo(videoId);
		setAssignOpen(false);
		if (selectedVideo?.id === videoId) {
			setSelectedVideo(null);
		}
		await refreshAll();
		const api = getPlayerApi();
		const category = await api.categories.getBySlug(categorySlug);
		if (!category) {
			setData(null);
			return;
		}
		setData(
			await api.categories.getFeed({
				categoryId: category.id,
				page: 1,
				pageSize: 100,
				sort,
			}),
		);
	}

	async function refetchFeed() {
		const api = getPlayerApi();
		const category = await api.categories.getBySlug(categorySlug);
		if (!category) {
			setData(null);
			return;
		}
		setData(
			await api.categories.getFeed({
				categoryId: category.id,
				page: 1,
				pageSize: 100,
				sort,
			}),
		);
	}

	async function persistManualOrder(
		categoryId: string,
		orderedPostIds: string[],
	) {
		setReordering(true);
		try {
			await getPlayerApi().categories.reorderPosts({
				categoryId,
				postIds: orderedPostIds,
			});
			await refetchFeed();
			setReorderError(null);
		} catch (error) {
			console.error("Failed to persist manual order", error);
			setReorderError(
				error instanceof Error
					? error.message
					: "Failed to save the new order.",
			);
		} finally {
			setReordering(false);
		}
	}

	return (
		<>
			<PageFrame
				title={data?.category.name ?? categorySlug}
				description={
					data?.category.description ??
					"You can change category description whenever you want."
				}
				actions={
					<>
						<Badge variant="accent">{data?.total ?? 0} posts</Badge>
						<Select
							value={sort}
							onValueChange={(value) => {
								const next = value as CategoryFeedSort;
								setSort(next);
								try {
									localStorage.setItem(feedSortStorageKey(categorySlug), next);
								} catch {}
							}}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Feed sort" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="newestPost">Newest</SelectItem>
								<SelectItem value="name">Name</SelectItem>
								<SelectItem value="lastPlayed">Last Played</SelectItem>
								<SelectItem value="manual">Manual</SelectItem>
							</SelectContent>
						</Select>
					</>
				}
			>
				{reorderError ? (
					<p className="mb-3 rounded-(--radius) border border-(--destructive)/30 bg-(--destructive)/10 px-3 py-2 text-xs text-(--destructive)">
						{reorderError}
					</p>
				) : null}
				{data?.items.length ? (
					<div
						className={cn(
							"grid gap-4 xl:grid-cols-2 transition-opacity duration-150",
							reordering && "opacity-60",
						)}
					>
						{data.items.map((post) => (
							<DraggablePost
								key={post.id}
								post={post}
								enabled={sort === "manual"}
								draggingPostId={draggingPostId}
								onDragStateChange={setDraggingPostId}
								renderCard={() => (
									<VideoCard
										video={post.video}
										caption={post.caption}
										draggable={sort !== "manual"}
										onAssign={(videoId) => void openAssign(videoId)}
										onAction={(videoId, action) =>
											void runAction(videoId, action)
										}
										onRemove={(videoId) => removeVideo(videoId)}
									/>
								)}
								onDropPosition={(orderedPostIds) =>
									persistManualOrder(data.category.id, orderedPostIds)
								}
							/>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-(--border) p-8 text-sm text-(--muted-foreground)">
						This category has no posts yet. Add videos from the dump or player
						page.
					</div>
				)}
			</PageFrame>
			<AssignVideoDialog
				open={assignOpen}
				onOpenChange={setAssignOpen}
				categories={categories}
				video={selectedVideo}
				onSubmit={submitAssignments}
			/>
		</>
	);
}

type DropIndicator = { postId: string; edge: "before" | "after" } | null;

function DraggablePost({
	post,
	enabled,
	draggingPostId,
	onDragStateChange,
	renderCard,
	onDropPosition,
}: {
	post: CategoryPostDto;
	enabled: boolean;
	draggingPostId: string | null;
	onDragStateChange: (postId: string | null) => void;
	renderCard: () => React.ReactNode;
	onDropPosition: (orderedPostIds: string[]) => void;
}) {
	const [indicator, setIndicator] = useState<DropIndicator>(null);

	const handleDragStart = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!enabled) return;
			setDraggedPostId(e.dataTransfer, post.id);
			onDragStateChange(post.id);
			setIndicator(null);
		},
		[enabled, post.id, onDragStateChange],
	);

	const handleDragOver = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!enabled) return;
			if (!hasDraggedPost(e.dataTransfer)) return;
			if (!draggingPostId || draggingPostId === post.id) return;
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			const rect = e.currentTarget.getBoundingClientRect();
			const edge: "before" | "after" =
				e.clientY - rect.top < rect.height / 2 ? "before" : "after";
			setIndicator((current) =>
				current?.postId === post.id && current.edge === edge
					? current
					: { postId: post.id, edge },
			);
		},
		[draggingPostId, enabled, post.id],
	);

	const handleDragLeave = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (indicator?.postId !== post.id) return;
			const related = e.relatedTarget;
			if (related instanceof Node && e.currentTarget.contains(related)) return;
			setIndicator((current) => (current?.postId === post.id ? null : current));
		},
		[indicator, post.id],
	);

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (!enabled) return;
			if (!hasDraggedPost(e.dataTransfer)) return;
			e.preventDefault();
			const sourceId = getDraggedPostId(e.dataTransfer) || draggingPostId;
			const edge = indicator?.postId === post.id ? indicator.edge : "after";
			setIndicator(null);
			onDragStateChange(null);
			if (!sourceId || sourceId === post.id) return;

			// Find the grid container and read the current visual order from it.
			const grid = e.currentTarget.parentElement;
			if (!grid) return;
			const orderedIds = Array.from(
				grid.querySelectorAll<HTMLElement>("[data-post-id]"),
			).map((el) => el.dataset.postId ?? "");
			const fromIndex = orderedIds.indexOf(sourceId);
			if (fromIndex < 0) return;
			const reordered = orderedIds.slice();
			const [moved] = reordered.splice(fromIndex, 1);
			let toIndex = reordered.indexOf(post.id);
			if (toIndex < 0) {
				reordered.push(moved);
			} else if (edge === "after") {
				toIndex += 1;
				reordered.splice(toIndex, 0, moved);
			} else {
				reordered.splice(toIndex, 0, moved);
			}
			if (
				!moved ||
				(reordered.length === orderedIds.length &&
					reordered.every((id, i) => id === orderedIds[i]))
			) {
				return;
			}
			onDropPosition(reordered);
		},
		[
			indicator,
			enabled,
			post.id,
			onDropPosition,
			draggingPostId,
			onDragStateChange,
		],
	);

	const handleDragEnd = useCallback(() => {
		onDragStateChange(null);
		setIndicator(null);
	}, [onDragStateChange]);

	const isTarget = indicator?.postId === post.id;
	const isDragging = draggingPostId === post.id;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drop target for post drag-and-drop
		<div
			data-post-id={post.id}
			data-draggable={enabled ? "true" : "false"}
			draggable={enabled}
			className={cn(
				"relative rounded-(--radius) transition-[outline,opacity] duration-150",
				isDragging && "opacity-60",
				isTarget && "ring-2 ring-(--accent)/60",
			)}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onDragEnd={handleDragEnd}
		>
			{isTarget ? (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-(--accent)",
						indicator?.edge === "before" ? "-top-1.5" : "-bottom-1.5",
					)}
				/>
			) : null}
			{renderCard()}
		</div>
	);
}

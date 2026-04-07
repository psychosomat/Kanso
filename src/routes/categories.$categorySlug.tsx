import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
	PaginatedCategoryPostsDto,
	VideoDetailDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

export const Route = createFileRoute("/categories/$categorySlug")({
	component: CategoryFeedPage,
});

function CategoryFeedPage() {
	const { categorySlug } = Route.useParams();
	const { categories, refreshAll } = useAppState();
	const [sort, setSort] = useState<CategoryFeedSort>("newestPost");
	const [data, setData] = useState<PaginatedCategoryPostsDto | null>(null);
	useScrollRestore(`/categories/${categorySlug}`, data !== null);
	const [selectedVideo, setSelectedVideo] = useState<VideoDetailDto | null>(
		null,
	);
	const [assignOpen, setAssignOpen] = useState(false);

	useEffect(() => {
		if (!window.playerApi) return;
		let cancelled = false;

		// Load data immediately
		const api = getPlayerApi();
		void api.categories.getBySlug(categorySlug).then((category) => {
			if (cancelled) {
				return;
			}
			if (!category) {
				setData(null);
				return;
			}
			// Load only first page for fast rendering
			void api.categories
				.getFeed({
					categoryId: category.id,
					page: 1,
					pageSize: 100,
					sort,
				})
				.then((response) => {
					if (cancelled) {
						return;
					}
					setData(response);
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
							onValueChange={(value) => setSort(value as CategoryFeedSort)}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="Feed sort" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="newestPost">Newest</SelectItem>
								<SelectItem value="name">Name</SelectItem>
								<SelectItem value="lastPlayed">Last Played</SelectItem>
							</SelectContent>
						</Select>
					</>
				}
			>
				{data?.items.length ? (
					<div className="grid gap-4 xl:grid-cols-2">
						{data.items.map((post) => (
							<VideoCard
								key={post.id}
								video={post.video}
								caption={post.caption}
								onAssign={(videoId) => void openAssign(videoId)}
								onAction={(videoId, action) => void runAction(videoId, action)}
								onRemove={(videoId) => removeVideo(videoId)}
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

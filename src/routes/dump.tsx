import { createFileRoute } from "@tanstack/react-router";
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from "react";
import { AssignVideoDialog } from "@/components/categories/assign-video-dialog";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { useAppState } from "@/components/layout/app-state";
import { EmptyLibraryState } from "@/components/shared/empty-library-state";
import { PageFrame } from "@/components/shared/page-frame";
import { VideoCard } from "@/components/shared/video-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFolderPlaylistPrompt } from "@/hooks/use-folder-playlist-prompt";
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { DEFAULT_DUMP_QUERY } from "@/lib/constants";
import type {
	CategoryIconName,
	PaginatedVideosDto,
	PlayerPreferencesDto,
	VideoDetailDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { folderDisplayName } from "@/lib/utils";
import IconRefresh from "~icons/tabler/refresh";

export const Route = createFileRoute("/dump")({
	component: DumpPage,
});

async function runVideoAction(
	videoId: string,
	action: "open-folder" | "reveal-file" | "copy-path",
) {
	await getPlayerApi().library.runVideoAction(videoId, action);
}

function DumpPage() {
	const { library, categories, refreshAll } = useAppState();
	const [data, setData] = useState<PaginatedVideosDto | null>(null);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<PlayerPreferencesDto["dumpSort"]>(
		DEFAULT_DUMP_QUERY.sort,
	);
	const [order] = useState<"asc" | "desc">(DEFAULT_DUMP_QUERY.order);
	const [view, setView] =
		useState<PlayerPreferencesDto["dumpView"]>("comfortable");
	const [loading, setLoading] = useState(false);
	const [_currentPage, _setCurrentPage] = useState(1);
	useScrollRestore("/dump", !loading);
	const [folderPending, setFolderPending] = useState(false);
	const { promptFolder, promptForFolders, dismissCurrent } =
		useFolderPlaylistPrompt();
	const [assignOpen, setAssignOpen] = useState(false);
	const [selectedVideo, setSelectedVideo] = useState<VideoDetailDto | null>(
		null,
	);
	const [electronReady, setElectronReady] = useState(false);
	const deferredSearch = useDeferredValue(search);
	const gridRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!window.playerApi) return;
		setElectronReady(Boolean(window.playerApi.app.isElectron));

		void getPlayerApi()
			.player.getPreferences()
			.then((preferences) => {
				setSort(preferences.dumpSort);
				setView(preferences.dumpView);
			});
	}, []);

	useEffect(() => {
		if (!library?.sourcePaths.length || !window.playerApi) {
			setLoading(false);
			setData(null);
			return;
		}
		const api = getPlayerApi();
		let cancelled = false;
		setLoading(true);
		void api.library
			.getDumpPage({
				search: deferredSearch,
				sort,
				order,
				page: 1,
				pageSize: DEFAULT_DUMP_QUERY.pageSize,
				unsortedOnly: true,
			})
			.then((response) => {
				if (cancelled) {
					return;
				}
				setData(response);
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [deferredSearch, library?.sourcePaths, order, sort]);

	useEffect(() => {
		if (!window.playerApi) return;
		startTransition(() => {
			void getPlayerApi().player.savePreferences({
				dumpSort: sort,
				dumpView: view,
			});
		});
	}, [sort, view]);

	async function chooseFolder() {
		const previousPaths =
			library?.sourcePaths.map((source) => source.path) ?? [];
		const previous = new Set(previousPaths);
		setFolderPending(true);
		try {
			const next = await getPlayerApi().settings.chooseLibraryFolders();
			await refreshAll();
			promptForFolders(
				(next?.sourcePaths ?? [])
					.map((source) => source.path)
					.filter((sourcePath) => !previous.has(sourcePath)),
			);
		} finally {
			setFolderPending(false);
		}
	}

	async function submitFolderPlaylist(input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryIconName;
	}) {
		if (!promptFolder) return;
		await getPlayerApi().categories.createFromFolder({
			...input,
			folderPath: promptFolder,
		});
		await refreshAll();
	}

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
		const updated = await getPlayerApi().library.getVideo(selectedVideo.id);
		setSelectedVideo(updated);
	}

	async function removeVideo(videoId: string) {
		await getPlayerApi().library.removeVideo(videoId);
		setAssignOpen(false);
		if (selectedVideo?.id === videoId) {
			setSelectedVideo(null);
		}
		await refreshAll();
		const api = getPlayerApi();
		setData(
			await api.library.getDumpPage({
				search: deferredSearch,
				sort,
				order,
				page: 1,
				pageSize: DEFAULT_DUMP_QUERY.pageSize,
				unsortedOnly: true,
			}),
		);
	}

	// Show empty state only if library is loaded and has no paths
	if (library && !library.sourcePaths.length) {
		return (
			<EmptyLibraryState
				onChooseFolder={() => void chooseFolder()}
				pending={folderPending}
				electronReady={electronReady}
			/>
		);
	}

	return (
		<>
			<PageFrame
				title="Unsorted"
				description="Videos without categories - organize them into your boards"
				actions={
					<>
						<Badge variant="accent">{data?.total ?? 0} unsorted</Badge>
						<Button
							variant="secondary"
							onClick={() => void getPlayerApi().library.rescanNow()}
						>
							<IconRefresh size={16} />
							Rescan
						</Button>
					</>
				}
			>
				<div className="mb-4 flex flex-wrap items-center gap-2">
					<div className="flex-1 min-w-50">
						<Input
							placeholder="Search videos..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</div>
					<Select
						value={sort}
						onValueChange={(value) =>
							setSort(value as PlayerPreferencesDto["dumpSort"])
						}
					>
						<SelectTrigger className="w-36">
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="recent">Recent</SelectItem>
							<SelectItem value="name">Name</SelectItem>
							<SelectItem value="duration">Duration</SelectItem>
							<SelectItem value="lastPlayed">Last Played</SelectItem>
						</SelectContent>
					</Select>
					<Tabs
						value={view}
						onValueChange={(value) =>
							setView(value as PlayerPreferencesDto["dumpView"])
						}
					>
						<TabsList className="w-36">
							<TabsTrigger className="flex-1" value="comfortable">
								Grid
							</TabsTrigger>
							<TabsTrigger className="flex-1" value="compact">
								List
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{data && data.items.length > 0 ? (
					<div
						ref={gridRef}
						className={
							view === "comfortable"
								? "grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
								: "grid gap-1 lg:grid-cols-2"
						}
					>
						{data.items.map((video, index) => (
							<div key={video.id} data-video-card data-index={index}>
								<VideoCard
									video={video}
									onAssign={(videoId) => void openAssign(videoId)}
									onAction={(videoId, action) =>
										void runVideoAction(videoId, action)
									}
									onRemove={(videoId) => removeVideo(videoId)}
								/>
							</div>
						))}
					</div>
				) : !data || loading ? (
					<div className="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
						{["s1", "s2", "s3", "s4"].map((key) => (
							<div key={key}>
								<Skeleton className="aspect-video w-full rounded-(--radius-lg)" />
								<Skeleton className="mt-2 h-4 w-3/4 rounded-full" />
								<Skeleton className="mt-1.5 h-3 w-1/2 rounded-full" />
							</div>
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-(--radius-lg) border border-dashed border-(--border) p-12 text-center">
						<p className="text-(--muted-foreground)">
							No unsorted videos. All videos have been organized into
							categories.
						</p>
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
			{promptFolder ? (
				<CategoryFormDialog
					key={promptFolder}
					open
					onOpenChange={(value) => {
						if (!value) dismissCurrent();
					}}
					categories={categories}
					initialName={folderDisplayName(promptFolder)}
					initialDescription={promptFolder}
					onSubmit={submitFolderPlaylist}
				/>
			) : null}
		</>
	);
}

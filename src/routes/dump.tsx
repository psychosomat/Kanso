import { IconRefresh } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from "react";
import { AssignVideoDialog } from "@/components/categories/assign-video-dialog";
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
import { useScrollRestore } from "@/hooks/use-scroll-restore";
import { DEFAULT_DUMP_QUERY } from "@/lib/constants";
import type {
	PaginatedVideosDto,
	PlayerPreferencesDto,
	VideoDetailDto,
} from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";

export const Route = createFileRoute("/dump")({
	component: DumpPage,
});

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
	useScrollRestore("/dump", !loading);
	const [folderPending, setFolderPending] = useState(false);
	const [assignOpen, setAssignOpen] = useState(false);
	const [selectedVideo, setSelectedVideo] = useState<VideoDetailDto | null>(
		null,
	);
	const [electronReady, setElectronReady] = useState(false);
	const deferredSearch = useDeferredValue(search);
	const gridRef = useRef<HTMLDivElement>(null);

	// Stagger animation for video cards - disabled for better LCP
	// useGSAP(
	// 	() => {
	// 		if (!gridRef.current || loading || !data?.items.length) return;
	// 		const cards = gridRef.current.querySelectorAll("[data-video-card]");
	// 		if (cards.length === 0) return;
	// 		gsap.fromTo(
	// 			cards,
	// 			{ opacity: 0, y: 20, scale: 0.96 },
	// 			{
	// 				opacity: 1,
	// 				y: 0,
	// 				scale: 1,
	// 				duration: 0.35,
	// 				ease: "power2.out",
	// 				stagger: {
	// 					each: 0.05,
	// 					from: "start",
	// 				},
	// 			},
	// 		);
	// 	},
	// 	{ dependencies: [data, loading] },
	// );

	useEffect(() => {
		if (!window.playerApi) return;
		setElectronReady(Boolean(window.playerApi.app.isElectron));

		// Load preferences immediately
		console.time("[DUMP PERF] getPreferences");
		void getPlayerApi()
			.player.getPreferences()
			.then((preferences) => {
				console.timeEnd("[DUMP PERF] getPreferences");
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
		console.time("[DUMP PERF] getDumpPage");
		// Load only first page for fast initial render
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
				console.timeEnd("[DUMP PERF] getDumpPage");
				console.time("[DUMP PERF] setData + render");
				setData(response);
				// Measure when React actually renders
				setTimeout(() => {
					console.timeEnd("[DUMP PERF] setData + render");
					console.log("[DUMP PERF] Videos rendered:", response.items.length);
				}, 0);
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
		setFolderPending(true);
		try {
			await getPlayerApi().settings.chooseLibraryFolders();
			await refreshAll();
		} finally {
			setFolderPending(false);
		}
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
								? "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
								: "grid gap-3 lg:grid-cols-2"
						}
					>
						{data.items.map((video) => (
							<div key={video.id} data-video-card>
								<VideoCard
									video={video}
									onAssign={(videoId) => void openAssign(videoId)}
									onAction={(videoId, action) =>
										void runAction(videoId, action)
									}
									onRemove={(videoId) => removeVideo(videoId)}
								/>
							</div>
						))}
					</div>
				) : !data || loading ? (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{["s1", "s2", "s3"].map((key) => (
							<div
								key={key}
								className="rounded-lg border border-(--border) p-4 bg-(--panel)"
							>
								<Skeleton className="aspect-video w-full rounded-(--radius)" />
								<Skeleton className="mt-3 h-4 w-3/4 rounded" />
								<Skeleton className="mt-2 h-4 w-1/2 rounded" />
							</div>
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-(--border) p-12 text-center">
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
		</>
	);
}

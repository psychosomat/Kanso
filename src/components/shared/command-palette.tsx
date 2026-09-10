import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/layout/app-state";
import { CategoryIcon } from "@/lib/category-icons";
import type { CategoryDto, VideoCardDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { cn, formatDuration, paletteShortcutLabel } from "@/lib/utils";
import IconFolder from "~icons/tabler/folder";
import IconInbox from "~icons/tabler/inbox";
import IconPlayerPlayFilled from "~icons/tabler/player-play-filled";
import IconRefresh from "~icons/tabler/refresh";
import IconSearch from "~icons/tabler/search";
import IconSettings from "~icons/tabler/settings";

type ActionId = "unsorted" | "settings" | "rescan";

type Entry =
	| {
			kind: "board";
			id: string;
			slug: string;
			name: string;
			icon: CategoryDto["icon"];
	  }
	| { kind: "video"; id: string; name: string; duration: number | null }
	| { kind: "action"; id: ActionId; name: string };

const ACTIONS: Array<{ id: ActionId; name: string }> = [
	{ id: "unsorted", name: "Go to Unsorted" },
	{ id: "settings", name: "Open Settings" },
	{ id: "rescan", name: "Rescan library now" },
];

function Hint({ keys, label }: { keys: string[]; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className="flex gap-0.5">
				{keys.map((key) => (
					<kbd
						key={key}
						className="font-data rounded border border-white/10 bg-white/5 px-1 py-px text-[10px] text-(--muted-foreground)"
					>
						{key}
					</kbd>
				))}
			</span>
			<span className="text-[11px] text-(--muted-foreground)">{label}</span>
		</span>
	);
}

export function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const { categories } = useAppState();
	const [query, setQuery] = useState("");
	const [videos, setVideos] = useState<VideoCardDto[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setVideos([]);
		setActiveIndex(0);
		requestAnimationFrame(() => inputRef.current?.focus());
		window.dispatchEvent(
			new CustomEvent("kanso:palette", { detail: { open: true } }),
		);
		return () => {
			window.dispatchEvent(
				new CustomEvent("kanso:palette", { detail: { open: false } }),
			);
		};
	}, [open]);

	useEffect(() => {
		if (!open || !window.playerApi) return;
		if (!query.trim()) {
			setVideos([]);
			return;
		}
		let cancelled = false;
		const timer = window.setTimeout(() => {
			void getPlayerApi()
				.library.getDumpPage({
					search: query.trim(),
					sort: "recent",
					order: "desc",
					page: 1,
					pageSize: 7,
					unsortedOnly: false,
				})
				.then((page) => {
					if (!cancelled) setVideos(page.items);
				});
		}, 200);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [query, open]);

	const entries = useMemo<Entry[]>(() => {
		const q = query.trim().toLowerCase();
		const boards: Entry[] = categories
			.filter((c) => !q || c.name.toLowerCase().includes(q))
			.slice(0, 5)
			.map((c) => ({
				kind: "board" as const,
				id: c.id,
				slug: c.slug,
				name: c.name,
				icon: c.icon,
			}));
		const videoEntries: Entry[] = videos.map((v) => ({
			kind: "video" as const,
			id: v.id,
			name: v.fileName,
			duration: v.durationSec,
		}));
		const actions: Entry[] = ACTIONS.filter(
			(a) => !q || a.name.toLowerCase().includes(q),
		).map((a) => ({ kind: "action" as const, ...a }));
		return [...boards, ...videoEntries, ...actions];
	}, [categories, videos, query]);

	const entriesKey = entries.map((e) => `${e.kind}:${e.id}`).join("|");
	const prevEntriesKey = useRef(entriesKey);

	if (prevEntriesKey.current !== entriesKey) {
		prevEntriesKey.current = entriesKey;
		setActiveIndex(0);
	}

	const runEntry = useCallback(
		(entry: Entry) => {
			onOpenChange(false);
			if (entry.kind === "board") {
				void router.navigate({
					to: "/categories/$categorySlug",
					params: { categorySlug: entry.slug },
				});
			} else if (entry.kind === "video") {
				void router.navigate({
					to: "/player/$videoId",
					params: { videoId: entry.id },
				});
			} else if (entry.id === "unsorted") {
				void router.navigate({ to: "/dump" });
			} else if (entry.id === "settings") {
				void router.navigate({ to: "/settings" });
			} else {
				void getPlayerApi().library.rescanNow();
			}
		},
		[onOpenChange, router],
	);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onOpenChange(false);
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((i) => Math.min(i + 1, entries.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				const entry = entries[activeIndex];
				if (entry) runEntry(entry);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, entries, activeIndex, runEntry, onOpenChange]);

	useEffect(() => {
		listRef.current
			?.querySelector(`[data-index="${activeIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	if (!open) return null;

	let lastKind: Entry["kind"] | null = null;

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: overlay click closes the palette, Escape is handled globally */}
			<div
				className="animate-fade-in fixed inset-0 z-100 flex justify-center bg-black/60 p-4 backdrop-blur-sm"
				onClick={() => onOpenChange(false)}
				role="presentation"
			>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: click-away layer, keyboard handled globally */}
				<div
					className="animate-slide-up mt-[14vh] h-fit w-full max-w-xl overflow-hidden rounded-2xl bg-(--panel-strong) shadow-[0_32px_80px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
					onClick={(e) => e.stopPropagation()}
					role="dialog"
					aria-label="Quick navigation"
				>
					<div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--accent) text-white">
							<IconSearch size={15} />
						</span>
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Jump to a board, video, or action…"
							className="h-8 w-full bg-transparent text-[15px] text-(--foreground) outline-none placeholder:text-(--muted-foreground)/60"
						/>
						<kbd className="font-data shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-(--muted-foreground)">
							{paletteShortcutLabel()}
						</kbd>
					</div>

					<div ref={listRef} className="max-h-72 overflow-y-auto p-2">
						{entries.length === 0 ? (
							<p className="px-3 py-6 text-center text-sm text-(--muted-foreground)">
								Nothing found. Try another search.
							</p>
						) : (
							entries.map((entry, i) => {
								const showHeader = entry.kind !== lastKind;
								lastKind = entry.kind;
								const active = i === activeIndex;
								return (
									<div key={`${entry.kind}-${entry.id}`}>
										{showHeader ? (
											<p className="font-data px-2.5 pb-1 pt-2.5 text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)/70">
												{entry.kind === "board"
													? "Boards"
													: entry.kind === "video"
														? "Videos"
														: "Actions"}
											</p>
										) : null}
										<button
											type="button"
											data-index={i}
											onClick={() => runEntry(entry)}
											onMouseMove={() => setActiveIndex(i)}
											className={cn(
												"flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left",
												active
													? "bg-(--accent) text-white"
													: "text-(--foreground)/85 hover:bg-white/5",
											)}
										>
											<span
												className={cn(
													"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
													active
														? "bg-white/20 text-white"
														: "bg-white/6 text-(--muted-foreground)",
												)}
											>
												{entry.kind === "board" ? (
													<CategoryIcon name={entry.icon} size={15} />
												) : entry.kind === "video" ? (
													<IconPlayerPlayFilled size={13} />
												) : entry.id === "settings" ? (
													<IconSettings size={15} />
												) : entry.id === "rescan" ? (
													<IconRefresh size={15} />
												) : (
													<IconInbox size={15} />
												)}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-medium">
													{entry.name}
												</span>
												<span
													className={cn(
														"block text-[11px]",
														active
															? "text-white/70"
															: "text-(--muted-foreground)/70",
													)}
												>
													{entry.kind === "board"
														? "Open board"
														: entry.kind === "video"
															? `Play video · ${formatDuration(entry.duration)}`
															: entry.id === "rescan"
																? "Scan folders for new files"
																: entry.id === "settings"
																	? "Appearance, library, playback"
																	: "Videos waiting for a board"}
												</span>
											</span>
											{entry.kind === "board" ? (
												<IconFolder
													size={13}
													className={cn(
														"shrink-0",
														active
															? "text-white/70"
															: "text-(--muted-foreground)/50",
													)}
												/>
											) : null}
										</button>
									</div>
								);
							})
						)}
					</div>

					<div className="flex items-center gap-3 border-t border-white/8 px-4 py-2.5">
						<Hint keys={["↑", "↓"]} label="navigate" />
						<Hint keys={["↵"]} label="open" />
						<Hint keys={["esc"]} label="close" />
					</div>
				</div>
			</div>
		</>
	);
}

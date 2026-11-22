import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoryIcon } from "@/lib/category-icons";
import { buildCategoryTree, type CategoryTreeNode } from "@/lib/category-tree";
import type { CategoryDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import {
	cn,
	paletteShortcutLabel,
	preventMiddleClickAutoscroll,
	resolveTitlebarMode,
} from "@/lib/utils";
import { getDraggedVideoId, hasDraggedVideo } from "@/lib/video-drag";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconChevronLeft from "~icons/tabler/chevron-left";
import IconChevronRight from "~icons/tabler/chevron-right";
import IconEye from "~icons/tabler/eye";
import IconEyeOff from "~icons/tabler/eye-off";
import IconFolderPlus from "~icons/tabler/folder-plus";
import IconInbox from "~icons/tabler/inbox";
import IconLayoutGrid from "~icons/tabler/layout-grid";
import IconLayoutSidebar from "~icons/tabler/layout-sidebar";
import IconMenu2 from "~icons/tabler/menu-2";
import IconPencil from "~icons/tabler/pencil";
import IconPin from "~icons/tabler/pin";
import IconPinFilled from "~icons/tabler/pin-filled";
import IconSearch from "~icons/tabler/search";
import IconSettings from "~icons/tabler/settings";
import IconTrash from "~icons/tabler/trash";
import { CategoryFormDialog } from "../categories/category-form-dialog";
import { DeleteCategoryDialog } from "../categories/delete-category-dialog";
import { CommandPalette } from "../shared/command-palette";
import { Button } from "../ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "../ui/context-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "../ui/sheet";
import { useAppState } from "./app-state";
import { WindowTitlebar } from "./window-titlebar";

const NOISE_STORAGE_KEY = "player:noiseOpacity";
const SIDEBAR_PINNED_KEY = "player:sidebar:pinned";
const COLLAPSED_CATEGORIES_KEY = "player:sidebar:collapsed-categories";

function initNoise() {
	const stored = localStorage.getItem(NOISE_STORAGE_KEY);
	if (stored !== null) {
		document.documentElement.style.setProperty("--noise-opacity", stored);
	}
}

export function loadSidebarPinned(): boolean {
	return localStorage.getItem(SIDEBAR_PINNED_KEY) === "1";
}

export function storeSidebarPinned(next: boolean) {
	localStorage.setItem(SIDEBAR_PINNED_KEY, next ? "1" : "0");
}

export function isPlayerPath(pathname: string): boolean {
	return pathname.startsWith("/player/");
}

export const SIDEBAR_CLOSE_DELAY_MS = 450;

export type OverlaySidebarKeepOpenState = {
	pointerInside: boolean;
	focusInside: boolean;
	interactionLocked: boolean;
};

/**
 * Returns true if any active interaction (pointer hover, keyboard focus, or an
 * open context menu / dialog) should prevent the overlay sidebar from closing.
 */
export function shouldKeepOverlaySidebarOpen(
	state: OverlaySidebarKeepOpenState,
): boolean {
	return state.pointerInside || state.focusInside || state.interactionLocked;
}

export type SidebarHoverController = {
	open: () => void;
	pointerEnter: () => void;
	pointerLeave: () => void;
	setFocusInside: (focusInside: boolean) => void;
	setInteractionLocked: (interactionLocked: boolean) => void;
	closeNow: () => void;
	dispose: () => void;
};

/**
 * Coordinates delayed auto-closing for the overlay sidebar so brief pointer
 * transitions, keyboard focus inside the panel, and Portaled menus/dialogs
 * never snap the sidebar shut unexpectedly.
 */
export function createSidebarHoverController({
	closeDelayMs = SIDEBAR_CLOSE_DELAY_MS,
	onOpenChange,
}: {
	closeDelayMs?: number;
	onOpenChange: (open: boolean) => void;
}): SidebarHoverController {
	let open = false;
	let pointerInside = false;
	let focusInside = false;
	let interactionLocked = false;
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function clearCloseTimer() {
		if (closeTimer !== null) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
	}

	function emitOpen(next: boolean) {
		if (open === next) return;
		open = next;
		onOpenChange(next);
	}

	function isKeptOpen() {
		return shouldKeepOverlaySidebarOpen({
			pointerInside,
			focusInside,
			interactionLocked,
		});
	}

	function scheduleClose() {
		if (isKeptOpen() || !open) {
			clearCloseTimer();
			return;
		}
		clearCloseTimer();
		closeTimer = setTimeout(() => {
			closeTimer = null;
			if (!isKeptOpen()) {
				emitOpen(false);
			}
		}, closeDelayMs);
	}

	return {
		open() {
			clearCloseTimer();
			emitOpen(true);
		},
		pointerEnter() {
			pointerInside = true;
			clearCloseTimer();
			emitOpen(true);
		},
		pointerLeave() {
			pointerInside = false;
			scheduleClose();
		},
		setFocusInside(next: boolean) {
			if (focusInside === next) return;
			focusInside = next;
			if (next) {
				clearCloseTimer();
				return;
			}
			scheduleClose();
		},
		setInteractionLocked(next: boolean) {
			if (interactionLocked === next) return;
			interactionLocked = next;
			if (next) {
				clearCloseTimer();
				return;
			}
			scheduleClose();
		},
		closeNow() {
			clearCloseTimer();
			pointerInside = false;
			focusInside = false;
			emitOpen(false);
		},
		dispose() {
			clearCloseTimer();
		},
	};
}

export function resolveSidebarLayout({
	inPlayer,
	pinned,
}: {
	inPlayer: boolean;
	pinned: boolean;
}) {
	return {
		showOverlaySidebar: !inPlayer && !pinned,
		showPinnedSidebar: !inPlayer && pinned,
	};
}

export function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

function isRelatedTargetInside(e: {
	currentTarget: Element;
	relatedTarget: EventTarget | null;
}): boolean {
	return (
		e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)
	);
}

export type AppShellShortcut = "palette" | "pin" | "back" | "forward";

export function getAppShellShortcut(
	e: { metaKey: boolean; ctrlKey: boolean; altKey?: boolean; key: string },
	typing: boolean,
): AppShellShortcut | null {
	if (typing) return null;
	if (e.altKey && !e.metaKey && !e.ctrlKey) {
		if (e.key === "ArrowLeft") return "back";
		if (e.key === "ArrowRight") return "forward";
		return null;
	}
	if (e.metaKey || e.ctrlKey) {
		if (e.altKey) return null;
		const key = e.key.toLowerCase();
		if (key === "p" || key === "k") return "palette";
		if (key === "b" || key === "s") return "pin";
		if (e.key === "[") return "back";
		if (e.key === "]") return "forward";
		return null;
	}
	if (e.key === "/" || e.key === "?") return "palette";
	return null;
}

function ActiveBar({ active }: { active: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-(--accent) transition-opacity duration-150",
				active ? "opacity-100" : "opacity-0",
			)}
		/>
	);
}

function NavItem({
	to,
	icon,
	label,
	active,
	count,
}: {
	to: "/dump" | "/settings";
	icon: React.ReactNode;
	label: string;
	active: boolean;
	count?: number;
}) {
	return (
		<Link
			to={to}
			onMouseDown={preventMiddleClickAutoscroll}
			className={cn(
				"group relative flex h-8 items-center gap-2.5 rounded-(--radius) px-2.5 text-[13px] transition-colors duration-150",
				active
					? "bg-white/8 text-(--foreground)"
					: "text-(--muted-foreground) hover:bg-white/5 hover:text-(--foreground)",
			)}
		>
			<ActiveBar active={active} />
			<span
				className={cn(
					"shrink-0",
					active ? "text-(--accent)" : "text-(--muted-foreground)",
				)}
			>
				{icon}
			</span>
			<span className="flex-1 truncate">{label}</span>
			{count !== undefined && (
				<span className="tnum text-xs text-(--muted-foreground)">{count}</span>
			)}
		</Link>
	);
}

function SidebarContent({
	onOpenPalette,
	onInteractionLockChange,
}: {
	onOpenPalette: () => void;
	onInteractionLockChange?: (locked: boolean) => void;
}) {
	const { categories, library, scanStatus, refreshAll, refreshCategories } =
		useAppState();
	const location = useLocation();
	const categoryTree = buildCategoryTree(categories);
	const [boardsExpanded, setBoardsExpanded] = useState(
		() => sessionStorage.getItem("player:sidebar:boards") !== "0",
	);
	const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
		() => {
			const stored = sessionStorage.getItem(COLLAPSED_CATEGORIES_KEY);
			if (stored) {
				try {
					return new Set(JSON.parse(stored));
				} catch {
					return new Set<string>();
				}
			}
			return new Set<string>();
		},
	);

	function toggleBoards() {
		const next = !boardsExpanded;
		setBoardsExpanded(next);
		sessionStorage.setItem("player:sidebar:boards", next ? "1" : "0");
	}

	function toggleCategoryCollapsed(categoryId: string) {
		const next = new Set(collapsedCategoryIds);
		if (next.has(categoryId)) {
			next.delete(categoryId);
		} else {
			next.add(categoryId);
		}
		sessionStorage.setItem(COLLAPSED_CATEGORIES_KEY, JSON.stringify([...next]));
		setCollapsedCategoryIds(next);
	}

	function isCategoryCollapsed(categoryId: string) {
		return collapsedCategoryIds.has(categoryId);
	}

	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [createParentCategoryId, setCreateParentCategoryId] = useState<
		string | null
	>(null);
	const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(
		null,
	);
	const [deletingCategory, setDeletingCategory] = useState<CategoryDto | null>(
		null,
	);
	const [openContextMenuIds, setOpenContextMenuIds] = useState<Set<string>>(
		() => new Set(),
	);

	const handleContextMenuOpenChange = useCallback(
		(key: string, open: boolean) => {
			setOpenContextMenuIds((prev) => {
				if (prev.has(key) === open) return prev;
				const next = new Set(prev);
				if (open) {
					next.add(key);
				} else {
					next.delete(key);
				}
				return next;
			});
		},
		[],
	);

	const interactionLocked =
		createDialogOpen ||
		editingCategory !== null ||
		deletingCategory !== null ||
		openContextMenuIds.size > 0;

	useEffect(() => {
		onInteractionLockChange?.(interactionLocked);
	}, [interactionLocked, onInteractionLockChange]);

	useEffect(() => {
		return () => {
			onInteractionLockChange?.(false);
		};
	}, [onInteractionLockChange]);

	async function handleCreateCategory(input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryDto["icon"];
		hiddenFromHome?: boolean;
	}) {
		await getPlayerApi().categories.create(input);
		await refreshCategories();
		setCreateDialogOpen(false);
		setCreateParentCategoryId(null);
	}

	async function handleEditCategory(input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryDto["icon"];
		hiddenFromHome?: boolean;
	}) {
		if (!editingCategory) return;
		await getPlayerApi().categories.update({
			id: editingCategory.id,
			name: input.name,
			description: input.description,
			parentCategoryId: input.parentCategoryId,
			icon: input.icon,
			hiddenFromHome: input.hiddenFromHome,
		});
		await refreshCategories();
		setEditingCategory(null);
	}

	async function handleToggleHiddenFromHome(category: CategoryDto) {
		await getPlayerApi().categories.update({
			id: category.id,
			name: category.name,
			description: category.description ?? undefined,
			parentCategoryId: category.parentCategoryId,
			icon: category.icon,
			hiddenFromHome: !category.hiddenFromHome,
		});
		await refreshCategories();
	}

	async function handleDropVideo(videoId: string, categoryId: string) {
		await getPlayerApi().categories.addVideo({
			videoId,
			categories: [{ categoryId }],
		});
		await refreshAll();
	}

	return (
		<div className="flex min-h-full flex-col">
			<nav className="space-y-px">
				<button
					type="button"
					onClick={onOpenPalette}
					className="flex h-8 w-full items-center gap-2.5 rounded-(--radius) px-2.5 text-[13px] text-(--muted-foreground) transition-colors duration-150 hover:bg-white/5 hover:text-(--foreground)"
				>
					<span className="shrink-0">
						<IconSearch size={16} />
					</span>
					<span className="flex-1 text-left">Search</span>
					<kbd className="font-data rounded border border-white/10 bg-white/5 px-1 py-px text-[10px] text-(--muted-foreground)/70">
						{paletteShortcutLabel()}
					</kbd>
				</button>

				<p className="eyebrow px-2.5 pb-1 pt-3 text-(--muted-foreground)/70">
					Library
				</p>

				<NavItem
					to="/dump"
					icon={<IconInbox size={17} />}
					label="Unsorted"
					active={location.pathname.startsWith("/dump")}
				/>

				{/* Boards group */}
				<ContextMenu
					onOpenChange={(open) => handleContextMenuOpenChange("boards", open)}
				>
					<ContextMenuTrigger asChild>
						<button
							type="button"
							onClick={toggleBoards}
							aria-expanded={boardsExpanded}
							className={cn(
								"group relative flex h-8 w-full items-center gap-2.5 rounded-(--radius) px-2.5 text-[13px] transition-colors duration-150",
								location.pathname.startsWith("/categories/")
									? "bg-white/8 text-(--foreground)"
									: "text-(--muted-foreground) hover:bg-white/5 hover:text-(--foreground)",
							)}
						>
							<ActiveBar
								active={location.pathname.startsWith("/categories/")}
							/>
							<span
								className={cn(
									"shrink-0",
									location.pathname.startsWith("/categories/")
										? "text-(--accent)"
										: "text-(--muted-foreground)",
								)}
							>
								<IconLayoutGrid size={16} />
							</span>
							<span className="flex-1 text-left">Boards</span>
							{categories.length > 0 && (
								<span className="tnum text-xs text-(--muted-foreground)">
									{categories.length}
								</span>
							)}
							<IconChevronDown
								size={14}
								className={cn(
									"shrink-0 text-(--muted-foreground) transition-transform duration-200",
									boardsExpanded && "rotate-180",
								)}
							/>
						</button>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem
							onClick={() => {
								setCreateParentCategoryId(null);
								setCreateDialogOpen(true);
							}}
						>
							<IconFolderPlus size={16} />
							New board
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>

				{/* Board list */}
				{boardsExpanded && (
					<div className="mt-px space-y-px pl-3">
						{categoryTree.map((category) => (
							<CategoryTreeItem
								key={category.id}
								category={category}
								pathname={location.pathname}
								onCreateChild={(parentCategoryId) => {
									setCreateParentCategoryId(parentCategoryId);
									setCreateDialogOpen(true);
								}}
								onEdit={(nextCategory) => setEditingCategory(nextCategory)}
								onToggleHidden={handleToggleHiddenFromHome}
								onDelete={(nextCategory) => setDeletingCategory(nextCategory)}
								onContextMenuOpenChange={handleContextMenuOpenChange}
								onToggleCollapsed={toggleCategoryCollapsed}
								isCollapsed={isCategoryCollapsed}
								onDropVideo={handleDropVideo}
							/>
						))}
						{categories.length === 0 && (
							<button
								type="button"
								onClick={() => {
									setCreateParentCategoryId(null);
									setCreateDialogOpen(true);
								}}
								className="flex w-full items-center gap-2 rounded-(--radius) px-3 py-2 text-xs text-(--muted-foreground) transition-colors hover:text-(--foreground)"
							>
								<IconFolderPlus size={14} />
								New board
							</button>
						)}
					</div>
				)}
			</nav>

			{/* Bottom nav */}
			<div className="mt-auto space-y-0.5 pt-3">
				<NavItem
					to="/settings"
					icon={<IconSettings size={17} />}
					label="Settings"
					active={location.pathname.startsWith("/settings")}
				/>

				<div className="flex items-center gap-2 px-2.5 py-2">
					<div
						aria-hidden="true"
						className={cn(
							"h-1.5 w-1.5 shrink-0 rounded-full",
							scanStatus?.status === "scanning"
								? "animate-pulse bg-(--accent)"
								: "bg-(--success)",
						)}
					/>
					<span className="truncate text-xs text-(--muted-foreground)">
						{scanStatus?.status === "scanning"
							? `Scanning ${scanStatus.scannedFiles}/${scanStatus.totalFiles}`
							: library?.sourcePaths?.length
								? `${library.sourcePaths[0].path.split(/[\\/]/).pop()}${library.sourcePaths.length > 1 ? ` +${library.sourcePaths.length - 1}` : ""}`
								: "No folder"}
					</span>
				</div>

				{scanStatus?.status === "scanning" && (
					<div className="px-2.5 pb-2">
						<div className="h-0.5 w-full overflow-hidden rounded-full bg-white/8">
							<div
								className="h-full rounded-full bg-(--accent) transition-[width] duration-300 ease-out"
								style={{
									width: `${scanStatus.totalFiles > 0 ? (scanStatus.scannedFiles / scanStatus.totalFiles) * 100 : 0}%`,
								}}
							/>
						</div>
						<p className="mt-1 truncate text-[10px] text-(--muted-foreground)/70">
							{scanStatus.currentPath
								? scanStatus.currentPath.split(/[\\/]/).pop()
								: scanStatus.message}
						</p>
					</div>
				)}
			</div>

			{/* Dialogs */}
			<CategoryFormDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				category={null}
				categories={categories}
				initialParentCategoryId={createParentCategoryId}
				onSubmit={handleCreateCategory}
			/>
			<CategoryFormDialog
				open={editingCategory !== null}
				onOpenChange={(open) => {
					if (!open) setEditingCategory(null);
				}}
				category={editingCategory}
				categories={categories}
				onSubmit={handleEditCategory}
			/>
			<DeleteCategoryDialog
				open={deletingCategory !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingCategory(null);
				}}
				category={deletingCategory}
			/>
		</div>
	);
}

function CategoryTreeItem({
	category,
	pathname,
	onCreateChild,
	onEdit,
	onToggleHidden,
	onDelete,
	onContextMenuOpenChange,
	onToggleCollapsed,
	isCollapsed,
	onDropVideo,
}: {
	category: CategoryTreeNode;
	pathname: string;
	onCreateChild: (parentCategoryId: string) => void;
	onEdit: (category: CategoryDto) => void;
	onToggleHidden: (category: CategoryDto) => Promise<void>;
	onDelete: (category: CategoryDto) => void;
	onContextMenuOpenChange: (key: string, open: boolean) => void;
	onToggleCollapsed: (categoryId: string) => void;
	isCollapsed: (categoryId: string) => boolean;
	onDropVideo: (videoId: string, categoryId: string) => Promise<void>;
}) {
	const [dragOver, setDragOver] = useState(false);
	const [dropping, setDropping] = useState(false);

	useEffect(() => {
		return () => {
			onContextMenuOpenChange(category.id, false);
		};
	}, [category.id, onContextMenuOpenChange]);

	function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
		if (!hasDraggedVideo(e.dataTransfer)) {
			return;
		}
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
		setDragOver(true);
	}

	function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
		if (isRelatedTargetInside(e)) {
			return;
		}
		setDragOver(false);
	}

	async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		if (!hasDraggedVideo(e.dataTransfer)) {
			return;
		}
		e.preventDefault();
		setDragOver(false);

		const videoId = getDraggedVideoId(e.dataTransfer);
		if (!videoId) {
			return;
		}

		setDropping(true);
		try {
			await onDropVideo(videoId, category.id);
		} finally {
			setDropping(false);
		}
	}

	const hasChildren = category.children.length > 0;
	const collapsed = isCollapsed(category.id);
	const active = pathname === `/categories/${category.slug}`;

	return (
		<>
			<ContextMenu
				onOpenChange={(open) => onContextMenuOpenChange(category.id, open)}
			>
				<ContextMenuTrigger asChild>
					{/* biome-ignore lint/a11y/noStaticElementInteractions: drop target for video drag-and-drop */}
					<div
						className={cn(
							"group relative flex h-8 items-center justify-between rounded-(--radius) px-2.5 text-[13px] transition-colors duration-150",
							dragOver || dropping
								? "bg-(--accent-subtle) text-(--foreground) ring-1 ring-(--accent)/40"
								: active
									? "bg-white/8 text-(--foreground)"
									: "text-(--muted-foreground) hover:bg-white/5 hover:text-(--foreground)",
						)}
						style={{ marginLeft: `${category.depth * 12}px` }}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						<ActiveBar active={active} />
						<Link
							to="/categories/$categorySlug"
							params={{ categorySlug: category.slug }}
							onMouseDown={preventMiddleClickAutoscroll}
							className="flex min-w-0 flex-1 items-center gap-2"
						>
							<CategoryIcon name={category.icon} size={14} />
							<span className="truncate">{category.name}</span>
						</Link>
						<div className="ml-2 flex shrink-0 items-center gap-1">
							{category.hiddenFromHome && (
								<span
									role="img"
									title="Hidden from Home"
									aria-label="Hidden from Home"
									className="inline-flex shrink-0 items-center opacity-55"
								>
									<IconEyeOff size={12} aria-hidden="true" />
								</span>
							)}
							<span className="tnum text-xs opacity-60">
								{category.postCount}
							</span>
							{hasChildren && (
								<button
									type="button"
									aria-label={
										collapsed ? "Expand category" : "Collapse category"
									}
									title={collapsed ? "Expand" : "Collapse"}
									onClick={(e) => {
										e.stopPropagation();
										onToggleCollapsed(category.id);
									}}
									className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-(--muted-foreground) transition-colors hover:bg-white/8 hover:text-(--foreground)"
								>
									<IconChevronRight
										size={14}
										className={cn(
											"transition-transform duration-200",
											!collapsed && "rotate-90",
										)}
									/>
								</button>
							)}
						</div>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onClick={() => onCreateChild(category.id)}>
						<IconFolderPlus size={16} />
						New subcategory
					</ContextMenuItem>
					<ContextMenuItem onClick={() => onEdit(category)}>
						<IconPencil size={16} />
						Edit board
					</ContextMenuItem>
					<ContextMenuItem onClick={() => void onToggleHidden(category)}>
						{category.hiddenFromHome ? (
							<IconEye size={16} />
						) : (
							<IconEyeOff size={16} />
						)}
						{category.hiddenFromHome ? "Show on Home" : "Hide from Home"}
					</ContextMenuItem>
					<ContextMenuItem
						onClick={() => onDelete(category)}
						className="text-(--destructive)"
					>
						<IconTrash size={16} />
						Delete board
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
			{!collapsed &&
				category.children.map((child) => (
					<CategoryTreeItem
						key={child.id}
						category={child}
						pathname={pathname}
						onCreateChild={onCreateChild}
						onEdit={onEdit}
						onToggleHidden={onToggleHidden}
						onDelete={onDelete}
						onContextMenuOpenChange={onContextMenuOpenChange}
						onToggleCollapsed={onToggleCollapsed}
						isCollapsed={isCollapsed}
						onDropVideo={onDropVideo}
					/>
				))}
		</>
	);
}

function SidebarPanel({
	pinned,
	onTogglePinned,
	onDismiss,
	onOpenPalette,
	onInteractionLockChange,
}: {
	pinned: boolean;
	onTogglePinned: () => void;
	onDismiss: () => void;
	onOpenPalette: () => void;
	onInteractionLockChange?: (locked: boolean) => void;
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-11 shrink-0 items-center justify-end gap-0.5 px-3">
				{!pinned && (
					<button
						type="button"
						onClick={onDismiss}
						title="Hide sidebar"
						aria-label="Hide sidebar"
						className="window-no-drag flex h-7 w-7 items-center justify-center rounded-full text-(--muted-foreground) transition-colors hover:bg-white/8 hover:text-(--foreground)"
					>
						<IconChevronLeft size={15} />
					</button>
				)}
				<button
					type="button"
					onClick={onTogglePinned}
					title={pinned ? "Unpin sidebar (Ctrl+B)" : "Pin sidebar (Ctrl+B)"}
					aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
					aria-pressed={pinned}
					className={cn(
						"window-no-drag flex h-7 w-7 items-center justify-center rounded-full transition-colors",
						pinned
							? "text-(--accent) hover:bg-white/8"
							: "text-(--muted-foreground) hover:bg-white/8 hover:text-(--foreground)",
					)}
				>
					{pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
				</button>
			</div>

			<div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
				<SidebarContent
					onOpenPalette={onOpenPalette}
					onInteractionLockChange={onInteractionLockChange}
				/>
			</div>
		</div>
	);
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const location = useLocation();
	const { preferences } = useAppState();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [pinned, setPinned] = useState(loadSidebarPinned);
	const [hovered, setHovered] = useState(false);

	const hoverController = useMemo(
		() =>
			createSidebarHoverController({
				onOpenChange: setHovered,
			}),
		[],
	);

	useEffect(() => {
		return () => hoverController.dispose();
	}, [hoverController]);

	const inPlayer = isPlayerPath(location.pathname);
	const titlebarMode = resolveTitlebarMode(preferences?.titlebarMode ?? "auto");
	const { showOverlaySidebar, showPinnedSidebar } = resolveSidebarLayout({
		inPlayer,
		pinned,
	});

	useEffect(() => {
		if (pinned || inPlayer) {
			hoverController.closeNow();
		}
	}, [pinned, inPlayer, hoverController]);

	const togglePinned = useCallback(() => {
		const next = !pinned;
		setPinned(next);
		storeSidebarPinned(next);
		if (!next) hoverController.closeNow();
	}, [pinned, hoverController]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const action = getAppShellShortcut(e, isTypingTarget(e.target));
			if (!action) return;
			e.preventDefault();
			if (action === "palette") {
				setPaletteOpen((open) => !open);
				return;
			}
			if (action === "pin") {
				togglePinned();
				return;
			}
			if (action === "back") {
				router.history.back();
				return;
			}
			router.history.forward();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [togglePinned, router]);

	useEffect(() => {
		initNoise();
	}, []);

	useEffect(() => {
		if (!window.playerApi) {
			return;
		}

		return window.playerApi.app.subscribeOpenVideo(({ filePath }) => {
			void router.navigate({
				to: "/player/external",
				search: { path: filePath },
			});
		});
	}, [router]);

	return (
		<div className="relative flex h-screen overflow-hidden text-(--foreground)">
			<WindowTitlebar mode={titlebarMode} nonBlocking={inPlayer} />

			{/* Overlay sidebar: reveals on hover, drag-enter, or toggle click, floats above the content. */}
			{showOverlaySidebar && (
				<>
					{!hovered && (
						<button
							type="button"
							aria-label="Open sidebar"
							title="Open sidebar (Ctrl+B)"
							onMouseEnter={hoverController.pointerEnter}
							onMouseLeave={hoverController.pointerLeave}
							onClick={hoverController.open}
							className={cn(
								"window-no-drag fixed top-2.5 z-40 hidden h-8 w-8 items-center justify-center rounded-(--radius) border border-(--border) bg-(--panel) text-(--muted-foreground) shadow-(--shadow-sm) backdrop-blur-xl transition-colors duration-150 hover:border-(--border-strong) hover:bg-(--panel-strong) hover:text-(--foreground) lg:flex",
								titlebarMode === "macos" ? "left-20" : "left-3",
							)}
						>
							<IconLayoutSidebar size={16} />
						</button>
					)}
					<div
						className="group fixed inset-y-0 left-0 z-30 hidden w-5 cursor-pointer lg:block"
						onMouseEnter={hoverController.pointerEnter}
						onMouseLeave={hoverController.pointerLeave}
						onClick={hoverController.open}
						onDragEnter={hoverController.open}
						role="presentation"
						aria-hidden="true"
					>
						<span className="absolute left-0.5 top-1/2 h-24 w-1.5 -translate-y-1/2 rounded-full border border-white/15 bg-(--accent)/45 shadow-sm transition-[width,background-color,border-color,opacity] duration-200 group-hover:w-2 group-hover:border-(--accent)/60 group-hover:bg-(--accent) group-hover:opacity-95" />
					</div>
					<aside
						inert={!hovered}
						className={cn(
							"fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-(--border) bg-(--panel) shadow-[0_0_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl lg:flex",
							"transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
							hovered
								? "translate-x-0"
								: "pointer-events-none -translate-x-full",
						)}
						onMouseEnter={hoverController.pointerEnter}
						onMouseMove={hoverController.pointerEnter}
						onMouseLeave={hoverController.pointerLeave}
						onDragEnter={hoverController.open}
						onDropCapture={hoverController.pointerEnter}
						onDragLeave={(e) => {
							if (!isRelatedTargetInside(e)) {
								hoverController.pointerLeave();
							}
						}}
						onFocusCapture={() => hoverController.setFocusInside(true)}
						onBlurCapture={(e) => {
							hoverController.setFocusInside(isRelatedTargetInside(e));
						}}
					>
						<SidebarPanel
							pinned={false}
							onTogglePinned={togglePinned}
							onDismiss={hoverController.closeNow}
							onOpenPalette={() => setPaletteOpen(true)}
							onInteractionLockChange={hoverController.setInteractionLocked}
						/>
					</aside>
				</>
			)}

			{/* Pinned sidebar: part of the layout, content reflows around it. */}
			{showPinnedSidebar && (
				<aside className="relative z-40 hidden h-full w-[264px] shrink-0 flex-col border-r border-(--border) bg-(--panel) backdrop-blur-2xl lg:flex">
					<SidebarPanel
						pinned
						onTogglePinned={togglePinned}
						onDismiss={hoverController.closeNow}
						onOpenPalette={() => setPaletteOpen(true)}
					/>
				</aside>
			)}

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{/* Mobile topbar */}
				<div className="flex items-center px-3 py-3 lg:hidden">
					<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon" aria-label="Open navigation">
								<IconMenu2 size={18} />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="h-full w-64 p-3">
							<SheetHeader className="sr-only">
								<SheetTitle>Navigation</SheetTitle>
							</SheetHeader>
							<SidebarContent
								onOpenPalette={() => {
									setMobileOpen(false);
									setPaletteOpen(true);
								}}
							/>
						</SheetContent>
					</Sheet>
				</div>

				<main
					id="main-scroll"
					className="app-scrollbar min-h-0 flex-1 overflow-y-auto"
				>
					{children}
				</main>
			</div>

			<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
		</div>
	);
}

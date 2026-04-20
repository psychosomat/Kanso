import {
	IconChevronDown,
	IconChevronRight,
	IconFolderPlus,
	IconInbox,
	IconLayoutGrid,
	IconLayoutSidebarLeftCollapse,
	IconLayoutSidebarLeftExpand,
	IconMenu2,
	IconPencil,
	IconPlayerSkipBackFilled,
	IconSettings,
} from "@tabler/icons-react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CategoryIcon } from "@/lib/category-icons";
import {
	buildCategoryTree,
	flattenCategoryTree,
	type CategoryTreeNode,
} from "@/lib/category-tree";
import { APP_NAME } from "@/lib/constants";
import type { CategoryDto } from "@/lib/contracts";
import { getPlayerApi } from "@/lib/player-api";
import { cn, resolveTitlebarMode } from "@/lib/utils";
import { CategoryFormDialog } from "../categories/category-form-dialog";
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
const SIDEBAR_COLLAPSED_KEY = "player:sidebar:collapsed";
const SIDEBAR_AUTO_COLLAPSE_KEY = "player:sidebar:auto-collapsed";
const SIDEBAR_PRE_PLAYER_KEY = "player:sidebar:pre-player";
const COLLAPSED_CATEGORIES_KEY = "player:sidebar:collapsed-categories";
const SIDEBAR_WIDTH_KEY = "player:sidebar:width";

function canUseDom() {
	return typeof window !== "undefined" && typeof document !== "undefined";
}

function getSessionStorageItem(key: string) {
	if (typeof window === "undefined") {
		return null;
	}

	return window.sessionStorage.getItem(key);
}

function setSessionStorageItem(key: string, value: string) {
	if (typeof window === "undefined") {
		return;
	}

	window.sessionStorage.setItem(key, value);
}

function initNoise() {
	if (!canUseDom()) {
		return;
	}

	const stored = window.localStorage.getItem(NOISE_STORAGE_KEY);
	if (stored !== null) {
		document.documentElement.style.setProperty("--noise-opacity", stored);
	}
}

function NavItem({
	to,
	icon,
	label,
	active,
	collapsed,
	count,
}: {
	to: "/dump" | "/settings";
	icon: React.ReactNode;
	label: string;
	active: boolean;
	collapsed: boolean;
	count?: number;
}) {
	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button === 1) {
			e.preventDefault();
		}
	};

	return (
		<Link
			to={to}
			title={collapsed ? label : undefined}
			onMouseDown={handleMouseDown}
			className={cn(
				"group relative flex items-center gap-3 rounded-(--radius) px-3 py-2 text-sm transition-colors duration-150",
				active
					? "bg-(--accent-subtle) text-(--accent-strong)"
					: "text-(--muted-foreground) hover:bg-(--panel-strong) hover:text-(--foreground)",
				collapsed && "justify-center px-2",
			)}
		>
			{active && (
				<span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-(--accent)" />
			)}
			<span className={cn("shrink-0", active && "text-(--accent)")}>
				{icon}
			</span>
			{!collapsed && <span className="flex-1 truncate">{label}</span>}
			{!collapsed && count !== undefined && (
				<span className="text-xs tabular-nums text-(--muted-foreground)">
					{count}
				</span>
			)}
		</Link>
	);
}

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
	const { categories, library, scanStatus, refreshCategories } = useAppState();
	const location = useLocation();
	const categoryTree = buildCategoryTree(categories);
	const [boardsExpanded, setBoardsExpanded] = useState(
		() => getSessionStorageItem("player:sidebar:boards") !== "0",
	);
	const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
		() => {
			const stored = getSessionStorageItem(COLLAPSED_CATEGORIES_KEY);
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
		setSessionStorageItem("player:sidebar:boards", next ? "1" : "0");
	}

	function toggleCategoryCollapsed(categoryId: string) {
		setCollapsedCategoryIds((prev) => {
			const next = new Set(prev);
			if (next.has(categoryId)) {
				next.delete(categoryId);
			} else {
				next.add(categoryId);
			}
			setSessionStorageItem(
				COLLAPSED_CATEGORIES_KEY,
				JSON.stringify([...next]),
			);
			return next;
		});
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

	async function handleCreateCategory(input: {
		name: string;
		description?: string;
		parentCategoryId?: string | null;
		icon?: CategoryDto["icon"];
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
	}) {
		if (!editingCategory) return;
		await getPlayerApi().categories.update({
			id: editingCategory.id,
			name: input.name,
			description: input.description,
			parentCategoryId: input.parentCategoryId,
			icon: input.icon,
		});
		await refreshCategories();
		setEditingCategory(null);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Brand */}
			<div
				className={cn(
					"mb-5 flex items-center gap-2.5 px-2 pt-1",
					collapsed && "justify-center px-0",
				)}
			>
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius) bg-(--accent) text-white shadow-sm">
					<IconPlayerSkipBackFilled size={16} />
				</div>
				{!collapsed && (
					<span className="font-display truncate text-sm font-semibold tracking-wide text-(--foreground)">
						{APP_NAME}
					</span>
				)}
			</div>

			{/* Navigation */}
			<nav className="space-y-0.5">
				{!collapsed && (
					<p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-(--muted-foreground)/60">
						Library
					</p>
				)}

				<NavItem
					to="/dump"
					icon={<IconInbox size={18} />}
					label="Unsorted"
					active={location.pathname.startsWith("/dump")}
					collapsed={collapsed}
				/>

				{/* Boards group */}
				<ContextMenu>
					<ContextMenuTrigger asChild>
						<button
							type="button"
							onClick={() => !collapsed && toggleBoards()}
							title={collapsed ? "Boards" : undefined}
							className={cn(
								"group relative flex w-full items-center gap-3 rounded-(--radius) px-3 py-2 text-sm transition-colors duration-150",
								location.pathname.startsWith("/categories/")
									? "bg-(--accent-subtle) text-(--accent-strong)"
									: "text-(--muted-foreground) hover:bg-(--panel-strong) hover:text-(--foreground)",
								collapsed && "justify-center px-2",
							)}
						>
							{location.pathname.startsWith("/categories/") && (
								<span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-(--accent)" />
							)}
							<span
								className={cn(
									"shrink-0",
									location.pathname.startsWith("/categories/") &&
										"text-(--accent)",
								)}
							>
								<IconLayoutGrid size={18} />
							</span>
							{!collapsed && (
								<>
									<span className="flex-1 text-left">Boards</span>
									{categories.length > 0 && (
										<span className="text-xs tabular-nums text-(--muted-foreground)">
											{categories.length}
										</span>
									)}
									<IconChevronDown
										size={14}
										className={cn(
											"shrink-0 transition-transform duration-200",
											boardsExpanded && "rotate-180",
										)}
									/>
								</>
							)}
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
				{boardsExpanded && !collapsed && (
					<div className="mt-0.5 space-y-0.5 pl-8">
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
								onToggleCollapsed={toggleCategoryCollapsed}
								isCollapsed={isCategoryCollapsed}
							/>
						))}
						{categories.length === 0 && (
							<button
								type="button"
								onClick={() => {
									setCreateParentCategoryId(null);
									setCreateDialogOpen(true);
								}}
								className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs text-(--muted-foreground) transition-colors hover:text-(--foreground)"
							>
								<IconFolderPlus size={14} />
								New board
							</button>
						)}
					</div>
				)}

				{/* Collapsed: compact category icons */}
				{collapsed && categories.length > 0 && (
					<div className="mt-2 flex flex-wrap justify-center gap-1">
						{flattenCategoryTree(categoryTree).map((category) => (
							<Link
								key={category.id}
								to="/categories/$categorySlug"
								params={{ categorySlug: category.slug }}
								title={category.name}
								className={cn(
									"flex h-7 w-7 items-center justify-center rounded-md transition-colors",
									location.pathname === `/categories/${category.slug}`
										? "bg-(--accent-subtle) text-(--accent)"
										: "text-(--muted-foreground) hover:bg-(--panel-strong) hover:text-(--foreground)",
								)}
							>
								<CategoryIcon name={category.icon} size={16} />
							</Link>
						))}
					</div>
				)}
			</nav>

			{/* Bottom nav */}
			<div
				className={cn(
					"mt-auto space-y-0.5 border-t border-(--border) pt-3",
					collapsed && "flex flex-col items-center",
				)}
			>
				<NavItem
					to="/settings"
					icon={<IconSettings size={18} />}
					label="Settings"
					active={location.pathname.startsWith("/settings")}
					collapsed={collapsed}
				/>

				{/* Status row */}
				{!collapsed && (
					<>
						<div className="flex items-center gap-2 px-3 py-2">
							<div
								className={cn(
									"h-1.5 w-1.5 shrink-0 rounded-full",
									scanStatus?.status === "scanning"
										? "animate-pulse bg-(--accent)"
										: "bg-(--success)",
								)}
							/>
							<span className="truncate text-[11px] text-(--muted-foreground)">
								{scanStatus?.status === "scanning"
									? `Scanning ${scanStatus.scannedFiles}/${scanStatus.totalFiles}`
									: library?.sourcePaths?.length
										? `${library.sourcePaths[0].path.split(/[\\/]/).pop()}${library.sourcePaths.length > 1 ? ` +${library.sourcePaths.length - 1}` : ""}`
										: "No folder"}
							</span>
						</div>

						{scanStatus?.status === "scanning" && (
							<div className="px-3 pb-2">
								<div className="h-1 w-full overflow-hidden rounded-full bg-(--panel-strong)">
									<div
										className="h-full rounded-full bg-(--accent) transition-all duration-300 ease-out"
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
					</>
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
		</div>
	);
}

function CategoryTreeItem({
	category,
	pathname,
	onCreateChild,
	onEdit,
	onToggleCollapsed,
	isCollapsed,
}: {
	category: CategoryTreeNode;
	pathname: string;
	onCreateChild: (parentCategoryId: string) => void;
	onEdit: (category: CategoryDto) => void;
	onToggleCollapsed: (categoryId: string) => void;
	isCollapsed: (categoryId: string) => boolean;
}) {
	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button === 1) {
			e.preventDefault();
		}
	};

	const hasChildren = category.children.length > 0;
	const collapsed = isCollapsed(category.id);

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						className={cn(
							"flex items-center justify-between rounded-sm px-3 py-1.5 text-sm transition-colors duration-150",
							pathname === `/categories/${category.slug}`
								? "bg-(--accent-subtle) text-(--accent-strong) font-medium"
								: "text-(--muted-foreground) hover:bg-(--panel-strong) hover:text-(--foreground)",
						)}
						style={{ marginLeft: `${category.depth * 14}px` }}
					>
						<Link
							to="/categories/$categorySlug"
							params={{ categorySlug: category.slug }}
							onMouseDown={handleMouseDown}
							className="flex min-w-0 flex-1 items-center gap-2"
						>
							<CategoryIcon name={category.icon} size={15} />
							<span className="truncate">{category.name}</span>
						</Link>
						<div className="ml-2 flex shrink-0 items-center gap-1">
							<span className="text-xs tabular-nums opacity-60">
								{category.postCount}
							</span>
							{hasChildren && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onToggleCollapsed(category.id);
									}}
									className={cn(
										"ml-1 flex h-5 w-5 items-center justify-center rounded-sm transition-colors",
										"text-(--muted-foreground) hover:bg-(--panel-elevated) hover:text-(--foreground)",
									)}
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
						onToggleCollapsed={onToggleCollapsed}
						isCollapsed={isCollapsed}
					/>
				))}
		</>
	);
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const location = useLocation();
	const { preferences } = useAppState();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(
		() => getSessionStorageItem(SIDEBAR_COLLAPSED_KEY) === "1",
	);
	const [sidebarHidden, setSidebarHidden] = useState(false);
	const [sidebarHovered, setSidebarHovered] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState(() => {
		const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
		return stored ? parseInt(stored, 10) : 256;
	});
	const [isResizing, setIsResizing] = useState(false);

	function toggleCollapsed() {
		const next = !collapsed;
		setCollapsed(next);
		setSessionStorageItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
		setSessionStorageItem(SIDEBAR_AUTO_COLLAPSE_KEY, "0");
	}

	function handleMouseDown(e: React.MouseEvent) {
		if (collapsed) return;
		setIsResizing(true);
		e.preventDefault();
	}

	useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			const newWidth = e.clientX;
			if (newWidth >= 200 && newWidth <= 500) {
				setSidebarWidth(newWidth);
			}
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing, sidebarWidth]);

	useEffect(() => {
		initNoise();
	}, []);

	useEffect(() => {
		const inPlayerRoute = location.pathname.startsWith("/player/");
		const autoCollapsed =
			getSessionStorageItem(SIDEBAR_AUTO_COLLAPSE_KEY) === "1";

		if (inPlayerRoute) {
			const currentCollapsed =
				getSessionStorageItem(SIDEBAR_COLLAPSED_KEY) === "1";
			if (currentCollapsed) {
				return;
			}

			setSessionStorageItem(SIDEBAR_PRE_PLAYER_KEY, "0");
			setSessionStorageItem(SIDEBAR_AUTO_COLLAPSE_KEY, "1");
			setCollapsed(true);
			setSessionStorageItem(SIDEBAR_COLLAPSED_KEY, "1");
			return;
		}

		if (!autoCollapsed) {
			setSidebarHidden(false);
			return;
		}

		const previousCollapsed =
			getSessionStorageItem(SIDEBAR_PRE_PLAYER_KEY) === "1";
		setCollapsed(previousCollapsed);
		setSessionStorageItem(SIDEBAR_COLLAPSED_KEY, previousCollapsed ? "1" : "0");
		setSessionStorageItem(SIDEBAR_AUTO_COLLAPSE_KEY, "0");
		setSidebarHidden(false);
	}, [location.pathname]);

	useEffect(() => {
		if (!window.playerApi) {
			return;
		}

		return window.playerApi.app.subscribeOpenVideo(({ filePath }) => {
			setSessionStorageItem(SIDEBAR_PRE_PLAYER_KEY, collapsed ? "1" : "0");
			setSessionStorageItem(SIDEBAR_AUTO_COLLAPSE_KEY, collapsed ? "0" : "1");
			setCollapsed(true);
			setSessionStorageItem(SIDEBAR_COLLAPSED_KEY, "1");
			setSidebarHidden(true);
			void router.navigate({
				to: "/player/external",
				search: { path: filePath },
			});
		});
	}, [collapsed, router]);

	return (
		<div className="flex h-screen flex-col bg-(--background) text-(--foreground)">
			<WindowTitlebar
				mode={resolveTitlebarMode(preferences?.titlebarMode ?? "auto")}
			/>
			<div className="flex min-h-0 flex-1">
				{/* Hover zone for hidden sidebar */}
				{sidebarHidden && (
					<div
						className="hidden lg:block"
						style={{ width: "20px" }}
						onMouseEnter={() => setSidebarHovered(true)}
						onMouseLeave={() => setSidebarHovered(false)}
						role="presentation"
						aria-hidden="true"
					/>
				)}

				{/* Desktop sidebar */}
				<aside
					className={cn(
						"relative hidden min-h-0 shrink-0 flex-col border-r border-(--border) bg-(--panel-elevated) lg:flex",
						isResizing ? "" : "transition-[width] duration-200 ease-in-out",
						sidebarHidden && !sidebarHovered
							? "w-0 overflow-hidden border-none"
							: collapsed
								? "w-16"
								: "",
					)}
					style={
						!collapsed && !sidebarHidden
							? { width: `${sidebarWidth}px` }
							: undefined
					}
					onMouseEnter={() => sidebarHidden && setSidebarHovered(true)}
					onMouseLeave={() => sidebarHidden && setSidebarHovered(false)}
				>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
						<SidebarContent collapsed={collapsed} />
					</div>

					{/* Resize handle */}
					{!collapsed && (
						<button
							type="button"
							className={cn(
								"absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-(--accent) transition-colors",
								isResizing && "bg-(--accent)",
							)}
							onMouseDown={handleMouseDown}
							aria-label="Resize sidebar"
						/>
					)}

					{/* Collapse toggle */}
					<button
						type="button"
						onClick={() => {
							toggleCollapsed();
							if (sidebarHidden) {
								setSidebarHidden(false);
							}
						}}
						className={cn(
							"absolute -right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-(--border) bg-(--background) text-(--muted-foreground) shadow-md transition-colors hover:text-(--foreground) hover:bg-(--panel-strong)",
							sidebarHidden && !sidebarHovered && "hidden",
						)}
						aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						{collapsed ? (
							<IconLayoutSidebarLeftExpand size={14} />
						) : (
							<IconLayoutSidebarLeftCollapse size={14} />
						)}
					</button>
				</aside>

				<div className="flex min-h-0 flex-1 flex-col">
					{/* Mobile topbar */}
					<div className="flex items-center justify-between border-b border-(--border) bg-(--panel-elevated) px-4 py-2 lg:hidden">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded-sm bg-(--accent) text-white">
								<IconPlayerSkipBackFilled size={14} />
							</div>
							<span className="font-display text-sm font-semibold text-(--foreground)">
								{APP_NAME}
							</span>
						</div>
						<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
							<SheetTrigger asChild>
								<Button variant="ghost" size="icon">
									<IconMenu2 size={18} />
								</Button>
							</SheetTrigger>
							<SheetContent side="left" className="h-full w-64 border-0 p-3">
								<SheetHeader className="mb-4">
									<SheetTitle className="sr-only">Navigation</SheetTitle>
								</SheetHeader>
								<SidebarContent />
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
			</div>
		</div>
	);
}

// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_PREFERENCES } from "@/lib/constants";
import type {
	CategoryDto,
	LibrarySettingsDto,
	PlayerPreferencesDto,
	ScanStatusDto,
	SourcePathDto,
	VideoCardDto,
} from "@/lib/contracts";
import {
	getCategoriesFingerprint,
	getIdleScanRefreshKey,
	getSourcePathsFingerprint,
	LibraryRails,
	RAIL_SCROLL_STEP,
	railCollapsedStorageKey,
	readRailCollapsed,
	removeVideoFromRailList,
	resolveRailPreferences,
	writeRailCollapsed,
} from "./library-rails";

const mocks = vi.hoisted(() => ({
	appState: {
		preferences: null as PlayerPreferencesDto | null,
		savePreferences: vi.fn(),
		library: null as LibrarySettingsDto | null,
		categories: [] as CategoryDto[],
		scanStatus: null as ScanStatusDto | null,
	},
	getContinueWatching: vi.fn(),
	getRecentlyAdded: vi.fn(),
	dismissContinueWatching: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: "/dump" }),
	Link: ({
		children,
		to: _to,
		params: _params,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		to: string;
		params?: Record<string, string>;
	}) => (
		<a href="#player" {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/components/layout/app-state", () => ({
	useAppState: () => mocks.appState,
}));

vi.mock("@/lib/player-api", () => ({
	getPlayerApi: () => ({
		library: {
			getContinueWatching: mocks.getContinueWatching,
			getRecentlyAdded: mocks.getRecentlyAdded,
		},
		player: {
			dismissContinueWatching: mocks.dismissContinueWatching,
		},
	}),
}));

function makeSourcePath(overrides: Partial<SourcePathDto> = {}): SourcePathDto {
	return {
		id: "src-1",
		path: "/media",
		watchEnabled: true,
		hiddenFromHome: false,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		...overrides,
	};
}

function makeCategory(overrides: Partial<CategoryDto> = {}): CategoryDto {
	return {
		id: "cat-1",
		slug: "movies",
		name: "Movies",
		description: null,
		parentCategoryId: null,
		icon: "folder",
		hiddenFromHome: false,
		postCount: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		...overrides,
	};
}

function makeVideo(
	id: string,
	overrides: Partial<VideoCardDto> = {},
): VideoCardDto {
	return {
		origin: "library",
		id,
		fileName: `${id}.mp4`,
		sourcePath: `/media/${id}.mp4`,
		folderPath: "/media",
		durationSec: 120,
		width: 1920,
		height: 1080,
		modifiedAt: "2026-01-01T00:00:00.000Z",
		posterUrl: null,
		streamUrl: `video://${id}`,
		resumeSec: 30,
		lastPlayedAt: "2026-01-02T00:00:00.000Z",
		playCount: 1,
		exists: true,
		categoryCount: 0,
		...overrides,
	};
}

beforeEach(() => {
	sessionStorage.clear();
	mocks.appState.preferences = { ...DEFAULT_PLAYER_PREFERENCES };
	mocks.appState.savePreferences = vi.fn().mockResolvedValue(undefined);
	mocks.appState.library = {
		sourcePaths: [makeSourcePath()],
		watchEnabled: true,
		lastScanAt: null,
		scanStatus: "idle",
		scanError: null,
	};
	mocks.appState.categories = [makeCategory()];
	mocks.appState.scanStatus = null;
	mocks.getContinueWatching
		.mockReset()
		.mockResolvedValue([makeVideo("cw-1"), makeVideo("cw-2")]);
	mocks.getRecentlyAdded
		.mockReset()
		.mockResolvedValue([makeVideo("ra-1", { resumeSec: 0 })]);
	mocks.dismissContinueWatching.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(window, "playerApi", {
		configurable: true,
		writable: true,
		value: {},
	});
});

afterEach(() => {
	cleanup();
});

describe("library-rails helpers", () => {
	it("defaults rail preferences to true when missing", () => {
		expect(resolveRailPreferences(null)).toEqual({
			showContinueWatching: true,
			showRecentlyAdded: true,
		});
		expect(
			resolveRailPreferences({
				showContinueWatching: false,
				showRecentlyAdded: true,
			}),
		).toEqual({
			showContinueWatching: false,
			showRecentlyAdded: true,
		});
	});

	it("fingerprints source paths including id and hiddenFromHome", () => {
		expect(getSourcePathsFingerprint(null)).toBe("");
		expect(getSourcePathsFingerprint([])).toBe("");
		const visible = getSourcePathsFingerprint([
			makeSourcePath({ id: "a", hiddenFromHome: false }),
		]);
		const hidden = getSourcePathsFingerprint([
			makeSourcePath({ id: "a", hiddenFromHome: true }),
		]);
		expect(visible).not.toBe(hidden);
		expect(visible).toContain("a:0");
		expect(hidden).toContain("a:1");
	});

	it("fingerprints categories including id, hiddenFromHome, parentCategoryId, and postCount", () => {
		expect(getCategoriesFingerprint([])).toBe("");
		const base = getCategoriesFingerprint([
			makeCategory({ id: "c1", hiddenFromHome: false }),
		]);
		const hidden = getCategoriesFingerprint([
			makeCategory({ id: "c1", hiddenFromHome: true }),
		]);
		const reparented = getCategoriesFingerprint([
			makeCategory({
				id: "c1",
				hiddenFromHome: false,
				parentCategoryId: "secret",
			}),
		]);
		expect(base).not.toBe(hidden);
		expect(base).not.toBe(reparented);
	});

	it("returns scan updatedAt only when status is idle", () => {
		expect(getIdleScanRefreshKey(null)).toBeNull();
		expect(
			getIdleScanRefreshKey({
				status: "scanning",
				updatedAt: "2026-01-01T00:00:01Z",
			}),
		).toBeNull();
		expect(
			getIdleScanRefreshKey({
				status: "error",
				updatedAt: "2026-01-01T00:00:02Z",
			}),
		).toBeNull();
		expect(
			getIdleScanRefreshKey({
				status: "idle",
				updatedAt: "2026-01-01T00:00:03Z",
			}),
		).toBe("2026-01-01T00:00:03Z");
	});

	it("removes a dismissed video from a rail list without mutating input", () => {
		const original = [makeVideo("a"), makeVideo("b")];
		expect(removeVideoFromRailList(original, "a").map((v) => v.id)).toEqual([
			"b",
		]);
		expect(original).toHaveLength(2);
	});

	it("reads and persists collapsed state in sessionStorage", () => {
		expect(railCollapsedStorageKey("continue-watching")).toBe(
			"kanso:rail-collapsed:continue-watching",
		);
		expect(readRailCollapsed("continue-watching")).toBe(false);
		writeRailCollapsed("continue-watching", true);
		expect(readRailCollapsed("continue-watching")).toBe(true);
		writeRailCollapsed("continue-watching", false);
		expect(readRailCollapsed("continue-watching")).toBe(false);
	});
});

describe("LibraryRails component", () => {
	it("never fetches or renders disabled rails", async () => {
		mocks.appState.preferences = {
			...DEFAULT_PLAYER_PREFERENCES,
			showContinueWatching: false,
			showRecentlyAdded: true,
		};

		render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);

		expect(await screen.findByText("ra-1.mp4")).toBeTruthy();
		expect(mocks.getContinueWatching).not.toHaveBeenCalled();
		expect(mocks.getRecentlyAdded).toHaveBeenCalledOnce();
		expect(
			screen.queryByRole("region", { name: "Continue Watching" }),
		).toBeNull();

		cleanup();
		mocks.getContinueWatching.mockClear();
		mocks.getRecentlyAdded.mockClear();
		mocks.appState.preferences = {
			...DEFAULT_PLAYER_PREFERENCES,
			showContinueWatching: false,
			showRecentlyAdded: false,
		};

		const { container } = render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);

		expect(container.firstChild).toBeNull();
		expect(mocks.getContinueWatching).not.toHaveBeenCalled();
		expect(mocks.getRecentlyAdded).not.toHaveBeenCalled();
	});

	it("scrolls rails smoothly with left/right buttons, collapses, and saves hide preferences", async () => {
		render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);

		await screen.findByText("cw-1.mp4");

		const section = screen.getByRole("region", { name: "Continue Watching" });
		const scroller = section.querySelector(".overflow-x-auto") as HTMLElement;
		const scrollByMock = vi.fn();
		scroller.scrollBy = scrollByMock;

		fireEvent.click(
			screen.getByRole("button", { name: "Scroll Continue Watching right" }),
		);
		expect(scrollByMock).toHaveBeenCalledWith({
			left: RAIL_SCROLL_STEP,
			behavior: "smooth",
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Scroll Continue Watching left" }),
		);
		expect(scrollByMock).toHaveBeenCalledWith({
			left: -RAIL_SCROLL_STEP,
			behavior: "smooth",
		});

		const collapseBtn = screen.getByRole("button", {
			name: "Collapse Continue Watching",
		});
		expect(collapseBtn.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(collapseBtn);

		expect(screen.queryByText("cw-1.mp4")).toBeNull();
		expect(readRailCollapsed("continue-watching")).toBe(true);
		const expandBtn = screen.getByRole("button", {
			name: "Expand Continue Watching",
		});
		expect(expandBtn.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(expandBtn);
		expect(screen.getByText("cw-1.mp4")).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", { name: "Hide Continue Watching section" }),
		);
		expect(mocks.appState.savePreferences).toHaveBeenCalledWith({
			showContinueWatching: false,
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Hide Recently Added section" }),
		);
		expect(mocks.appState.savePreferences).toHaveBeenCalledWith({
			showRecentlyAdded: false,
		});
	});

	it("dismisses Continue Watching cards in one click without affecting Recently Added", async () => {
		render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);

		await screen.findByText("cw-1.mp4");
		expect(
			screen.queryByRole("button", {
				name: "Dismiss ra-1.mp4 from Continue Watching",
			}),
		).toBeNull();

		fireEvent.click(
			screen.getByRole("button", {
				name: "Dismiss cw-1.mp4 from Continue Watching",
			}),
		);

		expect(screen.queryByText("cw-1.mp4")).toBeNull();
		expect(screen.getByText("cw-2.mp4")).toBeTruthy();
		expect(mocks.dismissContinueWatching).toHaveBeenCalledWith("cw-1");
	});

	it("passes onRemove to rail cards and removes deleted items immediately", async () => {
		const onRemove = vi.fn().mockResolvedValue(undefined);
		render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
				onRemove={onRemove}
			/>,
		);

		await screen.findByText("ra-1.mp4");
		const menuTrigger = screen.getByRole("button", {
			name: "Video actions for ra-1.mp4",
		});
		fireEvent.pointerDown(menuTrigger, { button: 0, ctrlKey: false });
		fireEvent.click(await screen.findByText("Remove from library"));
		fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

		await waitFor(() => expect(onRemove).toHaveBeenCalledWith("ra-1"));
		await waitFor(() => expect(screen.queryByText("ra-1.mp4")).toBeNull());
	});

	it("refreshes rails on folder privacy toggle, board privacy toggle, and idle scan updates", async () => {
		const { rerender } = render(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);

		await waitFor(() =>
			expect(mocks.getContinueWatching).toHaveBeenCalledTimes(1),
		);

		// Scanning updates should NOT trigger refetches
		mocks.appState.scanStatus = {
			status: "scanning",
			stage: "scan",
			scannedFiles: 1,
			totalFiles: 5,
			currentPath: "/media/a.mp4",
			message: "Scanning",
			error: null,
			updatedAt: "2026-01-01T00:00:01Z",
		};
		rerender(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);
		expect(mocks.getContinueWatching).toHaveBeenCalledTimes(1);

		// Idle scan update MUST trigger refetch
		mocks.appState.scanStatus = {
			status: "idle",
			stage: "watch",
			scannedFiles: 0,
			totalFiles: 0,
			currentPath: null,
			message: "Updated",
			error: null,
			updatedAt: "2026-01-01T00:00:02Z",
		};
		rerender(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);
		await waitFor(() =>
			expect(mocks.getContinueWatching).toHaveBeenCalledTimes(2),
		);

		// Source folder hiddenFromHome toggle MUST trigger refetch
		mocks.appState.library = {
			sourcePaths: [makeSourcePath({ hiddenFromHome: true })],
			watchEnabled: true,
			lastScanAt: null,
			scanStatus: "idle",
			scanError: null,
		};
		rerender(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);
		await waitFor(() =>
			expect(mocks.getContinueWatching).toHaveBeenCalledTimes(3),
		);

		// Category hiddenFromHome toggle MUST trigger refetch
		mocks.appState.categories = [makeCategory({ hiddenFromHome: true })];
		rerender(
			<LibraryRails
				duplicateIds={new Set()}
				onAssign={vi.fn()}
				onAction={vi.fn()}
			/>,
		);
		await waitFor(() =>
			expect(mocks.getContinueWatching).toHaveBeenCalledTimes(4),
		);
	});
});

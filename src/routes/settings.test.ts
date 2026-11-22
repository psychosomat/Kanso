// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_PREFERENCES } from "@/lib/constants";
import type {
	CategoryDto,
	LibrarySettingsDto,
	PlayerPreferencesDto,
	ScanStatusDto,
} from "@/lib/contracts";
import {
	buildHomeRailSettings,
	getFolderHideButtonMeta,
	getScanProgress,
	parseSpeedPreset,
	Route,
} from "./settings";

const mocks = vi.hoisted(() => ({
	appState: {
		library: null as LibrarySettingsDto | null,
		scanStatus: null as ScanStatusDto | null,
		categories: [] as CategoryDto[],
		preferences: null as PlayerPreferencesDto | null,
		refreshAll: vi.fn(),
		savePreferences: vi.fn(),
	},
	toggleHideFolderFromHome: vi.fn(),
	toggleWatchFolder: vi.fn(),
	removeLibraryFolder: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		createFileRoute: () => (opts: { component: React.ComponentType }) => ({
			options: opts,
		}),
	};
});

vi.mock("@/components/layout/app-state", () => ({
	useAppState: () => mocks.appState,
}));

vi.mock("@/hooks/use-animations", () => ({
	usePageTransition: () => React.createRef(),
}));

vi.mock("@/hooks/use-scroll-restore", () => ({
	useScrollRestore: vi.fn(),
}));

vi.mock("@/hooks/use-folder-playlist-prompt", () => ({
	useFolderPlaylistPrompt: () => ({
		promptFolder: null,
		promptForFolders: vi.fn(),
		dismissCurrent: vi.fn(),
	}),
}));

vi.mock("@/lib/player-api", () => ({
	getPlayerApi: () => ({
		settings: {
			toggleHideFolderFromHome: mocks.toggleHideFolderFromHome,
			toggleWatchFolder: mocks.toggleWatchFolder,
			removeLibraryFolder: mocks.removeLibraryFolder,
		},
	}),
}));

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
		clear: () => store.clear(),
	});
	mocks.appState.preferences = { ...DEFAULT_PLAYER_PREFERENCES };
	mocks.appState.library = {
		sourcePaths: [
			{
				id: "f1",
				path: "D:/Videos/Public",
				watchEnabled: true,
				hiddenFromHome: false,
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
			},
			{
				id: "f2",
				path: "D:/Videos/Private",
				watchEnabled: true,
				hiddenFromHome: true,
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
			},
		],
		watchEnabled: true,
		lastScanAt: null,
		scanStatus: "idle",
		scanError: null,
	};
	mocks.appState.categories = [];
	mocks.appState.scanStatus = null;
	mocks.appState.refreshAll = vi.fn().mockResolvedValue(undefined);
	mocks.appState.savePreferences = vi.fn().mockResolvedValue(undefined);
	mocks.toggleHideFolderFromHome.mockReset().mockResolvedValue(null);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const SettingsPage = (
	Route as unknown as { options: { component: React.ComponentType } }
).options.component;

describe("parseSpeedPreset", () => {
	it("parses and rounds to one decimal", () => {
		expect(parseSpeedPreset("1.5")).toBe(1.5);
		expect(parseSpeedPreset("2.25")).toBe(2.3);
	});

	it("clamps into the playback-rate range", () => {
		expect(parseSpeedPreset("0.05")).toBe(0.2);
		expect(parseSpeedPreset("10")).toBe(4);
	});

	it("rejects non-numeric input", () => {
		expect(parseSpeedPreset("abc")).toBeNull();
		expect(parseSpeedPreset("")).toBe(0.2);
	});
});

describe("getScanProgress", () => {
	it("rounds the scanned fraction to a percentage", () => {
		expect(getScanProgress({ scannedFiles: 1, totalFiles: 3 })).toBe(33);
		expect(getScanProgress({ scannedFiles: 25, totalFiles: 100 })).toBe(25);
	});

	it("returns null without a positive total", () => {
		expect(getScanProgress(null)).toBeNull();
		expect(getScanProgress(undefined)).toBeNull();
		expect(getScanProgress({ scannedFiles: 0, totalFiles: 0 })).toBeNull();
	});
});

describe("buildHomeRailSettings", () => {
	it("defaults both home screen rail toggles to enabled when preferences are absent", () => {
		expect(buildHomeRailSettings(null)).toEqual([
			expect.objectContaining({
				key: "showContinueWatching",
				label: "Continue Watching rail",
				enabled: true,
			}),
			expect.objectContaining({
				key: "showRecentlyAdded",
				label: "Recently Added rail",
				enabled: true,
			}),
		]);
	});

	it("reflects stored preference toggles", () => {
		expect(
			buildHomeRailSettings({
				showContinueWatching: false,
				showRecentlyAdded: true,
			}).map((item) => [item.key, item.enabled]),
		).toEqual([
			["showContinueWatching", false],
			["showRecentlyAdded", true],
		]);
	});
});

describe("getFolderHideButtonMeta", () => {
	it("returns descriptive labels for visible and hidden folders", () => {
		expect(
			getFolderHideButtonMeta({ path: "D:/Clips", hiddenFromHome: false }),
		).toEqual({
			ariaLabel: "Hide D:/Clips from Home",
			title: "Hide from Home",
		});
		expect(
			getFolderHideButtonMeta({ path: "D:/Clips", hiddenFromHome: true }),
		).toEqual({
			ariaLabel: "Show D:/Clips on Home",
			title: "Show on Home",
		});
	});
});

async function renderSettingsPage() {
	await act(async () => {
		await (
			SettingsPage as unknown as { preload?: () => Promise<void> }
		).preload?.();
		render(
			React.createElement(
				React.Suspense,
				{ fallback: null },
				React.createElement(SettingsPage),
			),
		);
	});
}

describe("SettingsPage Home screen and folder privacy controls", () => {
	it("renders Hidden from Home badge and toggles folder visibility", async () => {
		await renderSettingsPage();

		expect(
			await screen.findAllByText("Hidden from Home", {}, { timeout: 5000 }),
		).toHaveLength(1);

		fireEvent.click(
			screen.getByRole("button", { name: "Hide D:/Videos/Public from Home" }),
		);

		await waitFor(() =>
			expect(mocks.toggleHideFolderFromHome).toHaveBeenCalledWith("f1"),
		);
		expect(mocks.appState.refreshAll).toHaveBeenCalledOnce();
	});

	it("renders Home screen switches and persists rail visibility toggles", async () => {
		await renderSettingsPage();

		expect(
			await screen.findByText(
				/Private boards and folders marked Hidden from Home/,
				{},
				{ timeout: 5000 },
			),
		).toBeTruthy();

		const cwSwitch = screen.getByRole("switch", {
			name: "Continue Watching rail",
		});
		const raSwitch = screen.getByRole("switch", {
			name: "Recently Added rail",
		});

		expect(cwSwitch.getAttribute("aria-checked")).toBe("true");
		expect(raSwitch.getAttribute("aria-checked")).toBe("true");

		fireEvent.click(cwSwitch);
		expect(mocks.appState.savePreferences).toHaveBeenCalledWith({
			showContinueWatching: false,
		});

		fireEvent.click(raSwitch);
		expect(mocks.appState.savePreferences).toHaveBeenCalledWith({
			showRecentlyAdded: false,
		});
	});
});

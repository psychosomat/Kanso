import path from "node:path";
import {
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	type OpenDialogOptions,
	shell,
} from "electron";
import type {
	AddVideoToCategoriesDto,
	CreateCategoryDto,
	MarkPlayedDto,
	RemoveVideoFromCategoryDto,
	SavePlayerPreferencesDto,
	SaveProgressDto,
	UpdateCategoryDto,
	VideoNativeAction,
} from "../../src/lib/contracts";
import { DatabaseService } from "../services/db";
import { getExternalVideoDetails } from "../services/external-video";
import { LibraryIndexerService } from "../services/library-indexer";

type Services = {
	db: DatabaseService;
	indexer: LibraryIndexerService;
	getMainWindow: () => BrowserWindow | null;
};

export function registerIpc({ db, indexer, getMainWindow }: Services) {
	ipcMain.handle("window:minimize", () => {
		getMainWindow()?.minimize();
	});
	ipcMain.handle("window:toggle-maximize", () => {
		const window = getMainWindow();
		if (!window) return;
		if (window.isMaximized()) {
			window.unmaximize();
		} else {
			window.maximize();
		}
	});
	ipcMain.handle("window:close", () => {
		getMainWindow()?.close();
	});

	ipcMain.handle("settings:get-library", () => db.getLibrarySettings());
	ipcMain.handle("settings:choose-library-folders", async () => {
		const parentWindow = getMainWindow();
		const options: OpenDialogOptions = {
			properties: ["openDirectory", "multiSelections"],
			title: "Choose Video Folders",
		};
		const result = parentWindow
			? await dialog.showOpenDialog(parentWindow, options)
			: await dialog.showOpenDialog(options);
		if (result.canceled || result.filePaths.length === 0) {
			return db.getLibrarySettings();
		}

		// Add all selected folders
		for (const sourcePath of result.filePaths) {
			db.addLibrarySourcePath(sourcePath);
		}

		const settings = db.getLibrarySettings();
		const pathsToScan = settings.sourcePaths.map((sp) => sp.path);
		await indexer.fullScanAll(pathsToScan);
		if (settings.watchEnabled) {
			const pathsToWatch = settings.sourcePaths
				.filter((sp) => sp.watchEnabled)
				.map((sp) => sp.path);
			await indexer.configureWatches(pathsToWatch);
		}
		return settings;
	});

	ipcMain.handle("settings:add-library-folder", async () => {
		const parentWindow = getMainWindow();
		const options: OpenDialogOptions = {
			properties: ["openDirectory"],
			title: "Add Video Folder",
		};
		const result = parentWindow
			? await dialog.showOpenDialog(parentWindow, options)
			: await dialog.showOpenDialog(options);
		if (result.canceled || result.filePaths.length === 0) {
			return db.getLibrarySettings();
		}

		const sourcePath = result.filePaths[0];
		db.addLibrarySourcePath(sourcePath);
		await indexer.fullScan(sourcePath);

		const settings = db.getLibrarySettings();
		if (settings.watchEnabled) {
			const pathsToWatch = settings.sourcePaths
				.filter((sp) => sp.watchEnabled)
				.map((sp) => sp.path);
			await indexer.configureWatches(pathsToWatch);
		}
		return settings;
	});

	ipcMain.handle(
		"settings:remove-library-folder",
		(_event, folderId: string) => {
			db.removeLibrarySourcePath(folderId);
			const settings = db.getLibrarySettings();
			if (settings.watchEnabled && settings.sourcePaths.length > 0) {
				const pathsToWatch = settings.sourcePaths
					.filter((sp) => sp.watchEnabled)
					.map((sp) => sp.path);
				void indexer.configureWatches(pathsToWatch);
			}
			return settings;
		},
	);

	ipcMain.handle("settings:toggle-watch-folder", (_event, folderId: string) => {
		db.toggleLibrarySourcePathWatch(folderId);
		const settings = db.getLibrarySettings();
		if (settings.watchEnabled && settings.sourcePaths.length > 0) {
			const pathsToWatch = settings.sourcePaths
				.filter((sp) => sp.watchEnabled)
				.map((sp) => sp.path);
			void indexer.configureWatches(pathsToWatch);
		}
		return settings;
	});

	ipcMain.handle("library:get-dump-page", (_event, input) =>
		db.getDumpPage(input),
	);
	ipcMain.handle("library:get-video", (_event, videoId: string) =>
		db.getVideoById(videoId),
	);
	ipcMain.handle("library:get-external-video", (_event, sourcePath: string) =>
		getExternalVideoDetails(sourcePath),
	);
	ipcMain.handle("library:rescan", async () => {
		const settings = db.getLibrarySettings();
		if (settings.sourcePaths.length === 0) return;
		const pathsToScan = settings.sourcePaths.map((sp) => sp.path);
		await indexer.fullScanAll(pathsToScan);
		if (settings.watchEnabled) {
			const pathsToWatch = settings.sourcePaths
				.filter((sp) => sp.watchEnabled)
				.map((sp) => sp.path);
			await indexer.configureWatches(pathsToWatch);
		}
	});
	ipcMain.handle("library:remove-video", (_event, videoId: string) =>
		db.removeVideo(videoId),
	);
	ipcMain.handle(
		"library:video-action",
		async (_event, videoId: string, action: VideoNativeAction) => {
			const sourcePath = db.getVideoSourcePath(videoId);
			if (!sourcePath) throw new Error("Video path not found.");
			if (action === "open-folder") {
				await shell.openPath(path.dirname(sourcePath));
			} else if (action === "reveal-file") {
				shell.showItemInFolder(sourcePath);
			} else {
				clipboard.writeText(sourcePath);
			}
		},
	);

	ipcMain.handle("categories:list", () => db.listCategories());
	ipcMain.handle("categories:get-by-slug", (_event, slug: string) =>
		db.getCategoryBySlug(slug),
	);
	ipcMain.handle("categories:create", (_event, input: CreateCategoryDto) =>
		db.createCategory(input),
	);
	ipcMain.handle("categories:update", (_event, input: UpdateCategoryDto) =>
		db.updateCategory(input),
	);
	ipcMain.handle("categories:remove", (_event, categoryId: string) =>
		db.removeCategory(categoryId),
	);
	ipcMain.handle("categories:get-feed", (_event, input) =>
		db.getCategoryFeed(input),
	);
	ipcMain.handle(
		"categories:add-video",
		(_event, input: AddVideoToCategoriesDto) => db.addVideoToCategories(input),
	);
	ipcMain.handle(
		"categories:remove-video",
		(_event, input: RemoveVideoFromCategoryDto) =>
			db.removeVideoFromCategory(input.videoId, input.categoryId),
	);

	ipcMain.handle("player:get-preferences", () => db.getPlayerPreferences());
	ipcMain.handle(
		"player:save-preferences",
		(_event, input: SavePlayerPreferencesDto) =>
			db.savePlayerPreferences(input),
	);
	ipcMain.handle("player:save-progress", (_event, input: SaveProgressDto) =>
		db.saveProgress(input.videoId, input.resumeSec),
	);
	ipcMain.handle("player:mark-played", (_event, input: MarkPlayedDto) =>
		db.markPlayed(input.videoId, input.completed),
	);

	const unsubscribe = indexer.subscribe((status) => {
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return;
		window.webContents.send("library:scan-status", status);
	});

	return () => {
		unsubscribe();
		for (const channel of [
			"settings:get-library",
			"settings:choose-library-folders",
			"settings:add-library-folder",
			"settings:remove-library-folder",
			"settings:toggle-watch-folder",
			"window:minimize",
			"window:toggle-maximize",
			"window:close",
			"library:get-dump-page",
			"library:get-video",
			"library:get-external-video",
			"library:rescan",
			"library:remove-video",
			"library:video-action",
			"categories:list",
			"categories:get-by-slug",
			"categories:create",
			"categories:update",
			"categories:remove",
			"categories:get-feed",
			"categories:add-video",
			"categories:remove-video",
			"player:get-preferences",
			"player:save-preferences",
			"player:save-progress",
			"player:mark-played",
		] as const) {
			ipcMain.removeHandler(channel);
		}
	};
}

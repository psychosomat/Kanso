import { contextBridge, ipcRenderer } from "electron";
import type { PlayerApi } from "../src/lib/contracts";

let backendReady = false;
const readyCallbacks: Array<() => void> = [];
const openVideoCallbacks = new Set<(payload: { filePath: string }) => void>();
const pendingOpenVideoPayloads: Array<{ filePath: string }> = [];

ipcRenderer.once("app:ready", () => {
	backendReady = true;
	for (const cb of readyCallbacks) cb();
	readyCallbacks.length = 0;
});

ipcRenderer.on("app:open-video", (_event, payload: { filePath: string }) => {
	if (openVideoCallbacks.size === 0) {
		pendingOpenVideoPayloads.push(payload);
		return;
	}

	for (const cb of openVideoCallbacks) {
		cb(payload);
	}
});

const playerApi: PlayerApi = {
	app: {
		isElectron: true,
		getPlatform: () => process.platform as "win32" | "darwin" | "linux",
		waitForReady: () =>
			new Promise<void>((resolve) => {
				if (backendReady) {
					resolve();
				} else {
					readyCallbacks.push(resolve);
				}
			}),
		subscribeOpenVideo: (cb) => {
			openVideoCallbacks.add(cb);
			while (pendingOpenVideoPayloads.length > 0) {
				const payload = pendingOpenVideoPayloads.shift();
				if (payload) {
					cb(payload);
				}
			}
			return () => {
				openVideoCallbacks.delete(cb);
			};
		},
	},
	window: {
		minimize: () => ipcRenderer.invoke("window:minimize"),
		toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
		close: () => ipcRenderer.invoke("window:close"),
	},
	settings: {
		getLibrary: () => ipcRenderer.invoke("settings:get-library"),
		chooseLibraryFolders: () =>
			ipcRenderer.invoke("settings:choose-library-folders"),
		addLibraryFolder: () => ipcRenderer.invoke("settings:add-library-folder"),
		removeLibraryFolder: (folderId: string) =>
			ipcRenderer.invoke("settings:remove-library-folder", folderId),
		toggleWatchFolder: (folderId: string) =>
			ipcRenderer.invoke("settings:toggle-watch-folder", folderId),
		toggleHideFolderFromHome: (folderId: string) =>
			ipcRenderer.invoke("settings:toggle-hide-folder", folderId),
	},
	library: {
		getDumpPage: (input) => ipcRenderer.invoke("library:get-dump-page", input),
		getVideo: (videoId) => ipcRenderer.invoke("library:get-video", videoId),
		getExternalVideo: (sourcePath) =>
			ipcRenderer.invoke("library:get-external-video", sourcePath),
		getContinueWatching: (limit) =>
			ipcRenderer.invoke("library:get-continue-watching", limit),
		getRecentlyAdded: (limit) =>
			ipcRenderer.invoke("library:get-recently-added", limit),
		getDuplicateGroups: () =>
			ipcRenderer.invoke("library:get-duplicate-groups"),
		rescanNow: () => ipcRenderer.invoke("library:rescan"),
		removeVideo: (videoId) =>
			ipcRenderer.invoke("library:remove-video", videoId),
		updateVideoMetadata: (input) =>
			ipcRenderer.invoke("library:update-video-metadata", input),
		runVideoAction: (videoId, action) =>
			ipcRenderer.invoke("library:video-action", videoId, action),
		subscribeScanStatus: (cb) => {
			const handler = (_event: unknown, payload: Parameters<typeof cb>[0]) =>
				cb(payload);
			ipcRenderer.on("library:scan-status", handler);
			return () => ipcRenderer.removeListener("library:scan-status", handler);
		},
	},
	categories: {
		list: () => ipcRenderer.invoke("categories:list"),
		create: (input) => ipcRenderer.invoke("categories:create", input),
		createFromFolder: (input) =>
			ipcRenderer.invoke("categories:create-from-folder", input),
		update: (input) => ipcRenderer.invoke("categories:update", input),
		remove: (categoryId) => ipcRenderer.invoke("categories:remove", categoryId),
		getBySlug: (slug) => ipcRenderer.invoke("categories:get-by-slug", slug),
		getFeed: (input) => ipcRenderer.invoke("categories:get-feed", input),
		addVideo: (input) => ipcRenderer.invoke("categories:add-video", input),
		removeVideo: (input) =>
			ipcRenderer.invoke("categories:remove-video", input),
		reorderPosts: (input) =>
			ipcRenderer.invoke("categories:reorder-posts", input),
	},
	player: {
		saveProgress: (input) => ipcRenderer.invoke("player:save-progress", input),
		markPlayed: (input) => ipcRenderer.invoke("player:mark-played", input),
		dismissContinueWatching: (videoId) =>
			ipcRenderer.invoke("player:dismiss-continue-watching", videoId),
		getPreferences: () => ipcRenderer.invoke("player:get-preferences"),
		savePreferences: (input) =>
			ipcRenderer.invoke("player:save-preferences", input),
	},
};

contextBridge.exposeInMainWorld("playerApi", playerApi);

import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, nativeImage, protocol, shell } from "electron";
import { SUPPORTED_VIDEO_EXTENSIONS } from "../src/lib/constants";
import { registerIpc } from "./ipc/register-ipc";
import { DatabaseService } from "./services/db";
import { LibraryIndexerService } from "./services/library-indexer";
import { PosterCacheService } from "./services/poster-cache";

let mainWindow: BrowserWindow | null = null;
let cleanupIpc: (() => void) | null = null;
let db: DatabaseService | null = null;
let indexer: LibraryIndexerService | null = null;
let prodServer: http.Server | null = null;
let prodServerUrl: string | null = null;
const pendingOpenPaths: string[] = [];
const gotSingleInstanceLock = app.requestSingleInstanceLock();

type StreamingRequestInit = RequestInit & { duplex?: "half" };

function toNodeReadableStream(stream: globalThis.ReadableStream) {
	return stream as unknown as NodeReadableStream;
}

if (!gotSingleInstanceLock) {
	app.quit();
}

function getPreloadPath() {
	const currentDir = path.dirname(fileURLToPath(import.meta.url));
	return path.join(currentDir, "preload.cjs");
}

function sendAppReady() {
	mainWindow?.webContents.send("app:ready");
}

function initializeBackend() {
	const appData = app.getPath("userData");
	db = new DatabaseService(path.join(appData, "data", "player.db"));
	const posterCache = new PosterCacheService(
		path.join(appData, "cache", "posters"),
	);
	indexer = new LibraryIndexerService(db, posterCache);

	cleanupIpc = registerIpc({
		db,
		indexer,
		posterCache,
		getMainWindow: () => mainWindow,
	});
}

function isSupportedVideoFile(targetPath: string) {
	return SUPPORTED_VIDEO_EXTENSIONS.includes(
		path
			.extname(targetPath)
			.toLowerCase() as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number],
	);
}

function normalizeOpenPath(targetPath: string) {
	if (!targetPath) {
		return null;
	}

	const resolvedPath = path.resolve(targetPath);
	if (!existsSync(resolvedPath) || !isSupportedVideoFile(resolvedPath)) {
		return null;
	}

	return resolvedPath;
}

function flushPendingOpenPaths() {
	if (!mainWindow || mainWindow.isDestroyed()) {
		return;
	}

	while (pendingOpenPaths.length > 0) {
		const filePath = pendingOpenPaths.shift();
		if (filePath) {
			mainWindow.webContents.send("app:open-video", { filePath });
		}
	}
}

function queueOpenPath(targetPath: string) {
	const normalizedPath = normalizeOpenPath(targetPath);
	if (!normalizedPath) {
		return;
	}

	pendingOpenPaths.push(normalizedPath);
	flushPendingOpenPaths();
}

function focusMainWindow() {
	if (!mainWindow || mainWindow.isDestroyed()) {
		return;
	}

	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}

	mainWindow.focus();
}

function collectOpenPathsFromArgv(argv: string[]) {
	return argv
		.map((argument) => normalizeOpenPath(argument))
		.filter((value): value is string => value !== null);
}

async function getProdServerUrl() {
	if (prodServerUrl) {
		return prodServerUrl;
	}

	const serverEntryPath = path.join(
		app.getAppPath(),
		"dist",
		"server",
		"server.js",
	);
	const serverEntryModule = (await import(
		pathToFileURL(serverEntryPath).href
	)) as {
		default?: {
			fetch(request: Request): Promise<Response>;
		};
	};
	const serverEntry = serverEntryModule.default;

	if (!serverEntry) {
		throw new Error("Production server entry is missing.");
	}

	prodServer = http.createServer(async (request, response) => {
		try {
			const requestUrl = new URL(
				request.url ?? "/",
				prodServerUrl ?? "http://127.0.0.1",
			);
			const clientRoot = path.join(app.getAppPath(), "dist", "client");
			const relativePath = decodeURIComponent(requestUrl.pathname).replace(
				/^\/+/,
				"",
			);
			const staticPath = path.join(clientRoot, relativePath);

			if (
				(request.method === "GET" || request.method === "HEAD") &&
				relativePath &&
				staticPath.startsWith(clientRoot) &&
				existsSync(staticPath)
			) {
				const staticResponse = createStaticAssetResponse(staticPath);
				if (staticResponse) {
					response.statusCode = staticResponse.status;
					response.statusMessage = staticResponse.statusText;
					staticResponse.headers.forEach((value, key) => {
						response.setHeader(key, value);
					});

					if (request.method === "HEAD" || !staticResponse.body) {
						response.end();
						return;
					}

					Readable.fromWeb(toNodeReadableStream(staticResponse.body)).pipe(
						response,
					);
					return;
				}
			}

			const headers = new Headers();
			for (const [key, value] of Object.entries(request.headers)) {
				if (Array.isArray(value)) {
					for (const item of value) {
						headers.append(key, item);
					}
					continue;
				}

				if (typeof value === "string") {
					headers.set(key, value);
				}
			}

			const origin = prodServerUrl ?? "http://127.0.0.1";
			const body =
				request.method === "GET" || request.method === "HEAD"
					? undefined
					: toNodeReadableStream(
							Readable.toWeb(request) as unknown as globalThis.ReadableStream,
						);
			const webRequest = new Request(`${origin}${request.url ?? "/"}`, {
				method: request.method,
				headers,
				body,
				duplex: body ? "half" : undefined,
			} as StreamingRequestInit);
			const webResponse = await serverEntry.fetch(webRequest);

			response.statusCode = webResponse.status;
			response.statusMessage = webResponse.statusText;
			webResponse.headers.forEach((value, key) => {
				response.setHeader(key, value);
			});

			if (!webResponse.body) {
				response.end();
				return;
			}

			Readable.fromWeb(toNodeReadableStream(webResponse.body)).pipe(response);
		} catch (error) {
			response.statusCode = 500;
			response.end(
				error instanceof Error ? error.message : "Failed to render app.",
			);
		}
	});

	await new Promise<void>((resolve, reject) => {
		prodServer?.once("error", reject);
		prodServer?.listen(0, "127.0.0.1", () => {
			prodServer?.off("error", reject);
			resolve();
		});
	});

	const address = prodServer.address();
	if (!address || typeof address === "string") {
		throw new Error("Production server failed to bind to a TCP port.");
	}

	prodServerUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
	return prodServerUrl;
}

async function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1480,
		height: 960,
		minWidth: 1120,
		minHeight: 760,
		title: "Kanso",
		backgroundColor: "#090b0f",
		autoHideMenuBar: true,
		frame: false,
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		webPreferences: {
			preload: getPreloadPath(),
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: !process.env.VITE_DEV_SERVER_URL,
			devTools: false,
		},
	});

	if (!process.env.VITE_DEV_SERVER_URL) {
		const iconPath = path.join(
			app.getAppPath(),
			"dist",
			"client",
			"favicon.ico",
		);
		try {
			mainWindow.setIcon(nativeImage.createFromPath(iconPath));
		} catch {}
	}

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	// Disable debugging in production
	if (!process.env.VITE_DEV_SERVER_URL) {
		mainWindow.webContents.on("before-input-event", (event, input) => {
			// Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
			if (
				input.key === "F12" ||
				(input.control &&
					input.shift &&
					(input.key === "I" || input.key === "J" || input.key === "C")) ||
				(input.control && input.key === "U")
			) {
				event.preventDefault();
			}
		});

		// Disable right-click context menu
		mainWindow.webContents.on("context-menu", (event) => {
			event.preventDefault();
		});

		// Block DevTools via code
		mainWindow.webContents.on("devtools-opened", () => {
			mainWindow?.webContents.closeDevTools();
		});
	}

	if (process.env.VITE_DEV_SERVER_URL) {
		await loadDevUrlWithRetry(mainWindow, process.env.VITE_DEV_SERVER_URL);
	} else {
		await mainWindow.loadURL(await getProdServerUrl());
	}

	flushPendingOpenPaths();
}

async function loadDevUrlWithRetry(window: BrowserWindow, url: string) {
	let lastError: unknown = null;
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
			await window.loadURL(url);
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
	}
	throw lastError;
}

function getMimeType(targetPath: string) {
	const extension = path.extname(targetPath).toLowerCase();
	switch (extension) {
		case ".html":
			return "text/html; charset=utf-8";
		case ".js":
		case ".mjs":
		case ".cjs":
			return "text/javascript; charset=utf-8";
		case ".css":
			return "text/css; charset=utf-8";
		case ".json":
			return "application/json; charset=utf-8";
		case ".svg":
			return "image/svg+xml";
		case ".ico":
			return "image/x-icon";
		case ".mp4":
			return "video/mp4";
		case ".webm":
			return "video/webm";
		case ".mov":
			return "video/quicktime";
		case ".mkv":
			return "video/x-matroska";
		case ".avi":
			return "video/x-msvideo";
		case ".m4v":
			return "video/x-m4v";
		case ".ts":
			return "video/mp2t";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".png":
			return "image/png";
		default:
			return "application/octet-stream";
	}
}

function parseRangeHeader(rangeHeader: string | null, fileSize: number) {
	if (!rangeHeader?.startsWith("bytes=")) {
		return null;
	}

	const [startText, endText] = rangeHeader.replace("bytes=", "").split("-");
	const start = Number.parseInt(startText, 10);
	const end = endText ? Number.parseInt(endText, 10) : fileSize - 1;

	if (
		Number.isNaN(start) ||
		Number.isNaN(end) ||
		start < 0 ||
		end >= fileSize ||
		start > end
	) {
		return null;
	}

	return { start, end };
}

function createMediaResponse(targetPath: string, request: Request) {
	// Normalize path for macOS compatibility
	let normalizedPath = targetPath;
	if (process.platform === "darwin") {
		// Ensure path is properly resolved for macOS
		normalizedPath = path.resolve(targetPath);
		console.log("[MEDIA RESPONSE] macOS normalized path:", normalizedPath);
	}

	const stats = statSync(normalizedPath);
	const mimeType = getMimeType(normalizedPath);
	const range = parseRangeHeader(request.headers.get("range"), stats.size);

	if (range) {
		const stream = createReadStream(normalizedPath, {
			start: range.start,
			end: range.end,
		});

		return new Response(
			Readable.toWeb(stream) as unknown as globalThis.ReadableStream,
			{
				status: 206,
				headers: {
					"Accept-Ranges": "bytes",
					"Content-Length": String(range.end - range.start + 1),
					"Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
					"Content-Type": mimeType,
					"Cache-Control": "no-cache",
				},
			},
		);
	}

	const stream = createReadStream(normalizedPath);
	return new Response(
		Readable.toWeb(stream) as unknown as globalThis.ReadableStream,
		{
			status: 200,
			headers: {
				"Accept-Ranges": "bytes",
				"Content-Length": String(stats.size),
				"Content-Type": mimeType,
				"Cache-Control": "no-cache",
			},
		},
	);
}

function createStaticAssetResponse(targetPath: string) {
	const stats = statSync(targetPath);
	if (!stats.isFile()) {
		return null;
	}

	const stream = createReadStream(targetPath);
	return new Response(
		Readable.toWeb(stream) as unknown as globalThis.ReadableStream,
		{
			status: 200,
			headers: {
				"Content-Length": String(stats.size),
				"Content-Type": getMimeType(targetPath),
				"Cache-Control": targetPath.includes(`${path.sep}assets${path.sep}`)
					? "public, max-age=31536000, immutable"
					: "public, max-age=300",
			},
		},
	);
}

protocol.registerSchemesAsPrivileged([
	{
		scheme: "video",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true,
			corsEnabled: true,
			bypassCSP: true,
		},
	},
]);

async function bootstrap() {
	if (!gotSingleInstanceLock) {
		return;
	}

	for (const filePath of collectOpenPathsFromArgv(process.argv.slice(1))) {
		pendingOpenPaths.push(filePath);
	}

	app.on("second-instance", (_event, argv) => {
		for (const filePath of collectOpenPathsFromArgv(argv.slice(1))) {
			queueOpenPath(filePath);
		}

		if (BrowserWindow.getAllWindows().length === 0) {
			void createMainWindow();
			return;
		}

		focusMainWindow();
	});

	app.on("open-file", (event, targetPath) => {
		event.preventDefault();
		queueOpenPath(targetPath);

		if (BrowserWindow.getAllWindows().length === 0) {
			void createMainWindow();
			return;
		}

		focusMainWindow();
	});

	await app.whenReady();

	protocol.handle("video", async (request) => {
		const url = new URL(request.url);
		const filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
		try {
			// Additional logging for macOS debugging
			if (process.platform === "darwin") {
				console.log("[VIDEO PROTOCOL] macOS request:", filePath);
			}

			const response = createMediaResponse(filePath, request);

			// Log success on macOS
			if (process.platform === "darwin") {
				console.log("[VIDEO PROTOCOL] macOS response created successfully");
			}

			return response;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to read local media";

			// Enhanced error logging for macOS
			if (process.platform === "darwin") {
				console.error("[VIDEO PROTOCOL] macOS error:", error);
				console.error("[VIDEO PROTOCOL] filePath:", filePath);
				console.error("[VIDEO PROTOCOL] error message:", message);
			}

			return new Response(message, { status: 500 });
		}
	});

	const createWindowPromise = createMainWindow();
	initializeBackend();
	await createWindowPromise;
	if (!db || !indexer) {
		throw new Error("Backend services failed to initialize.");
	}

	sendAppReady();
	flushPendingOpenPaths();

	const settings = db.getLibrarySettings();
	if (settings.watchEnabled) {
		const pathsToWatch = settings.sourcePaths
			.filter((sourcePath) => sourcePath.watchEnabled)
			.map((sourcePath) => sourcePath.path);
		if (pathsToWatch.length > 0) {
			await indexer.configureWatches(pathsToWatch);
		}
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			void createMainWindow();
		}
	});
}

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
	cleanupIpc?.();
	await indexer?.stopWatch();
	db?.close();
	await new Promise<void>((resolve) => {
		if (!prodServer) {
			resolve();
			return;
		}

		prodServer.close(() => resolve());
		prodServer = null;
		prodServerUrl = null;
	});
});

void bootstrap().catch((error) => {
	console.error("Electron bootstrap failed:", error);
	app.exit(1);
});

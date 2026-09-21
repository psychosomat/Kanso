import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	nativeImage,
	protocol,
	screen,
	shell,
} from "electron";
import { registerIpc } from "./ipc/register-ipc";
import {
	getMimeType,
	parseRangeHeader,
	shouldServeStaticAsset,
} from "./lib/http-utils";
import { DatabaseService } from "./services/db";
import {
	LibraryIndexerService,
	isSupportedVideo,
	selectWatchPaths,
} from "./services/library-indexer";
import { PosterCacheService } from "./services/poster-cache";
import {
	allowExternalMediaPath,
	isAllowedExternalMediaPath,
	resolveMediaPath,
} from "./services/smart-library";
import { TransmuxerService } from "./services/transmuxer";

// Disable hardware video decoding to prevent crashes with 4K HEVC video
// This is a workaround for GPU decoder crashes on some systems
// GPU is still used for rendering, only video decoding is affected
app.commandLine.appendSwitch("disable-gpu-video-decoder");
app.commandLine.appendSwitch("disable-features", "UseSkiaRenderer");

let mainWindow: BrowserWindow | null = null;
let cleanupIpc: (() => void) | null = null;
let db: DatabaseService | null = null;
let indexer: LibraryIndexerService | null = null;
let transmuxer: TransmuxerService | null = null;
let prodServer: http.Server | null = null;
let prodServerUrl: string | null = null;
const pendingOpenPaths: string[] = [];
const gotSingleInstanceLock = app.requestSingleInstanceLock();

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
	console.log("[BACKEND] Initializing backend services...");
	const appData = app.getPath("userData");
	console.log("[BACKEND] User data path:", appData);
	db = new DatabaseService(path.join(appData, "data", "player.db"));
	const posterCache = new PosterCacheService(
		path.join(appData, "cache", "posters"),
	);
	transmuxer = new TransmuxerService(path.join(appData, "cache", "transmux"));
	indexer = new LibraryIndexerService(db, posterCache, transmuxer);
	console.log("[BACKEND] Backend services initialized");

	cleanupIpc = registerIpc({
		db,
		indexer,
		posterCache,
		getMainWindow: () => mainWindow,
	});
}

function normalizeOpenPath(targetPath: string) {
	if (!targetPath) {
		return null;
	}

	const resolvedPath = path.resolve(targetPath);
	if (!existsSync(resolvedPath) || !isSupportedVideo(resolvedPath)) {
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

	allowExternalMediaPath(normalizedPath);
	pendingOpenPaths.push(normalizedPath);
	flushPendingOpenPaths();
}

function getWindowSize() {
	const primaryDisplay = screen.getPrimaryDisplay();
	const { width, height } = primaryDisplay.workAreaSize;

	// Base dimensions (logical pixels)
	const baseWidth = 1480;
	const baseHeight = 960;
	const minBaseWidth = 1120;
	const minBaseHeight = 760;

	// Calculate available space with margins
	const availableWidth = width * 0.85; // 85% of screen width
	const availableHeight = height * 0.85; // 85% of screen height

	// Calculate final dimensions (ensure they fit within available space)
	const windowWidth = Math.min(baseWidth, availableWidth);
	const windowHeight = Math.min(baseHeight, availableHeight);
	const minWidth = Math.min(minBaseWidth, availableWidth);
	const minHeight = Math.min(minBaseHeight, availableHeight);

	return {
		width: Math.round(windowWidth),
		height: Math.round(windowHeight),
		minWidth: Math.round(minWidth),
		minHeight: Math.round(minHeight),
	};
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

function resolveProdRequestPath(
	request: http.IncomingMessage,
	clientRoot: string,
) {
	const requestUrl = new URL(
		request.url ?? "/",
		`http://${request.headers.host ?? "127.0.0.1"}`,
	);
	const relativePath = decodeURIComponent(requestUrl.pathname).replace(
		/^\/+/,
		"",
	);
	return { relativePath, staticPath: path.join(clientRoot, relativePath) };
}

function pipeAssetResponse(
	response: http.ServerResponse,
	assetResponse: Response,
	method: string | undefined,
) {
	response.statusCode = assetResponse.status;
	response.statusMessage = assetResponse.statusText;
	assetResponse.headers.forEach((value, key) => {
		response.setHeader(key, value);
	});

	if (method === "HEAD" || !assetResponse.body) {
		response.end();
		return;
	}

	Readable.fromWeb(toNodeReadableStream(assetResponse.body)).pipe(response);
}

function serveStaticAssetIfPresent(
	request: http.IncomingMessage,
	response: http.ServerResponse,
	relativePath: string,
	staticPath: string,
	clientRoot: string,
) {
	if (
		!shouldServeStaticAsset(
			request.method,
			relativePath,
			staticPath,
			clientRoot,
			existsSync(staticPath),
		)
	) {
		return false;
	}

	const staticResponse = createStaticAssetResponse(staticPath);
	if (!staticResponse) {
		return false;
	}

	pipeAssetResponse(response, staticResponse, request.method);
	return true;
}

function serveIndexFallback(
	request: http.IncomingMessage,
	response: http.ServerResponse,
	clientRoot: string,
) {
	if (request.method !== "GET") {
		return false;
	}

	const indexPath = path.join(clientRoot, "index.html");
	if (!existsSync(indexPath)) {
		return false;
	}

	const indexResponse = createStaticAssetResponse(indexPath);
	if (!indexResponse) {
		return false;
	}

	pipeAssetResponse(response, indexResponse, request.method);
	return true;
}

async function handleProdRequest(
	request: http.IncomingMessage,
	response: http.ServerResponse,
	clientRoot: string,
) {
	try {
		const { relativePath, staticPath } = resolveProdRequestPath(
			request,
			clientRoot,
		);

		if (
			serveStaticAssetIfPresent(
				request,
				response,
				relativePath,
				staticPath,
				clientRoot,
			)
		) {
			return;
		}

		// For SPA, serve index.html for all non-file requests
		if (serveIndexFallback(request, response, clientRoot)) {
			return;
		}

		response.statusCode = 404;
		response.end("Not Found");
	} catch (error) {
		console.error("Error serving static file:", error);
		response.statusCode = 500;
		response.end(
			error instanceof Error ? error.message : "Failed to render app.",
		);
	}
}

async function getProdServerUrl() {
	if (prodServerUrl) {
		return prodServerUrl;
	}

	const clientRoot = path.join(app.getAppPath(), "dist");
	console.log("[PROD SERVER] Client root path:", clientRoot);
	console.log("[PROD SERVER] Dist exists:", existsSync(clientRoot));

	prodServer = http.createServer(async (request, response) => {
		await handleProdRequest(request, response, clientRoot);
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

function applyProductionIcon(window: BrowserWindow) {
	if (process.env.VITE_DEV_SERVER_URL) {
		return;
	}

	const iconPath = path.join(app.getAppPath(), "dist", "favicon.ico");
	try {
		window.setIcon(nativeImage.createFromPath(iconPath));
	} catch (error) {
		console.warn("[WINDOW] Failed to set window icon:", error);
	}
}

async function loadRendererContent(window: BrowserWindow) {
	if (process.env.VITE_DEV_SERVER_URL) {
		await loadDevUrlWithRetry(window, process.env.VITE_DEV_SERVER_URL);
		window.webContents.openDevTools({ mode: "detach" });
		return;
	}

	const prodUrl = await getProdServerUrl();
	console.log("[WINDOW] Loading production URL:", prodUrl);
	await window.loadURL(prodUrl);
}

async function createMainWindow() {
	console.log("[WINDOW] Creating main window...");
	const { width, height, minWidth, minHeight } = getWindowSize();

	mainWindow = new BrowserWindow({
		width,
		height,
		minWidth,
		minHeight,
		title: "Kanso",
		backgroundColor: "#090b0f",
		autoHideMenuBar: true,
		frame: false,
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		webPreferences: {
			preload: getPreloadPath(),
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: false,
			devTools: true,
			offscreen: false,
			webgl: true,
			experimentalFeatures: false,
		},
	});

	applyProductionIcon(mainWindow);

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	await loadRendererContent(mainWindow);

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

function corsHeaders() {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	};
}

function resolveMediaRequestPath(targetPath: string): string {
	if (!db) {
		throw new Error("Backend services failed to initialize.");
	}
	const settings = db.getLibrarySettings();
	return resolveMediaPath(targetPath, {
		libraryRoots: settings.sourcePaths.map((source) => source.path),
		transmuxDir: transmuxer?.getCacheDir() ?? null,
		isKnownSourcePath: (candidate) => db?.isKnownSourcePath(candidate) ?? false,
		isAllowedExternalPath: isAllowedExternalMediaPath,
	});
}

async function createMediaResponse(targetPath: string, request: Request) {
	// Security gate: resolve -> realpath -> must be inside the library,
	// the transmux cache, the DB index, or an explicitly opened file.
	const safePath = resolveMediaRequestPath(targetPath);
	let resolved = safePath;

	// Remux .ts (MPEG-TS) to .mp4 on-the-fly for browser compatibility
	if (path.extname(resolved).toLowerCase() === ".ts" && transmuxer) {
		console.log("[MEDIA] Remuxing .ts file:", resolved);
		resolved = await transmuxer.ensureTransmuxed(resolved);
		console.log("[MEDIA] Served path after remux:", resolved);
	}

	const stats = statSync(resolved);
	const mimeType = getMimeType(resolved);
	const range = parseRangeHeader(request.headers.get("range"), stats.size);

	const baseHeaders = {
		...corsHeaders(),
		"Accept-Ranges": "bytes",
		"Content-Type": mimeType,
		"Cache-Control": "no-cache",
	};

	if (range) {
		const stream = createReadStream(resolved, {
			start: range.start,
			end: range.end,
		});

		return new Response(
			Readable.toWeb(stream) as unknown as globalThis.ReadableStream,
			{
				status: 206,
				headers: {
					...baseHeaders,
					"Content-Length": String(range.end - range.start + 1),
					"Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
				},
			},
		);
	}

	const stream = createReadStream(resolved);
	return new Response(
		Readable.toWeb(stream) as unknown as globalThis.ReadableStream,
		{
			status: 200,
			headers: {
				...baseHeaders,
				"Content-Length": String(stats.size),
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

function queueArgvOpenPaths(argv: string[]) {
	for (const filePath of collectOpenPathsFromArgv(argv)) {
		pendingOpenPaths.push(filePath);
	}
}

function focusOrCreateMainWindow() {
	if (BrowserWindow.getAllWindows().length === 0) {
		void createMainWindow();
		return;
	}

	focusMainWindow();
}

function registerFileOpenHandlers() {
	app.on("second-instance", (_event, argv) => {
		for (const filePath of collectOpenPathsFromArgv(argv.slice(1))) {
			queueOpenPath(filePath);
		}

		focusOrCreateMainWindow();
	});

	app.on("open-file", (event, targetPath) => {
		event.preventDefault();
		queueOpenPath(targetPath);

		focusOrCreateMainWindow();
	});
}

function registerVideoProtocolHandler() {
	protocol.handle("video", async (request) => {
		const url = new URL(request.url);
		const filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
		try {
			// Additional logging for macOS debugging
			if (process.platform === "darwin") {
				console.log("[VIDEO PROTOCOL] macOS request:", filePath);
			}

			const response = await createMediaResponse(filePath, request);

			// Log success on macOS
			if (process.platform === "darwin") {
				console.log("[VIDEO PROTOCOL] macOS response created successfully");
			}

			return response;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to read local media";
			const status = message.includes("outside the library")
				? 403
				: message.includes("not found")
					? 404
					: 500;

			// Enhanced error logging for macOS
			if (process.platform === "darwin") {
				console.error("[VIDEO PROTOCOL] macOS error:", error);
				console.error("[VIDEO PROTOCOL] filePath:", filePath);
				console.error("[VIDEO PROTOCOL] error message:", message);
			}

			return new Response(message, { status });
		}
	});
}

async function configureLibraryWatches() {
	if (!db || !indexer) {
		throw new Error("Backend services failed to initialize.");
	}

	const settings = db.getLibrarySettings();
	if (!settings.watchEnabled) {
		return;
	}

	const pathsToWatch = selectWatchPaths(settings.sourcePaths);
	if (pathsToWatch.length > 0) {
		await indexer.configureWatches(pathsToWatch);
	}
}

function registerActivateHandler() {
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			void createMainWindow();
		}
	});
}

async function bootstrap() {
	console.log("[BOOTSTRAP] Starting Kanso bootstrap...");
	console.log("[BOOTSTRAP] Platform:", process.platform);
	console.log("[BOOTSTRAP] App path:", app.getAppPath());

	if (!gotSingleInstanceLock) {
		console.log("[BOOTSTRAP] Single instance lock not acquired, quitting");
		return;
	}

	queueArgvOpenPaths(process.argv.slice(1));
	registerFileOpenHandlers();

	await app.whenReady();
	registerVideoProtocolHandler();

	const createWindowPromise = createMainWindow();
	initializeBackend();
	await createWindowPromise;

	sendAppReady();
	flushPendingOpenPaths();

	await configureLibraryWatches();
	registerActivateHandler();
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

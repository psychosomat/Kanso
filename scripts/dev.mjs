import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

const HOST = "127.0.0.1";
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;

function findFreePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.on("error", reject);
		server.listen(0, HOST, () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
	});
}

async function waitFor(predicate, label) {
	const startedAt = Date.now();
	for (;;) {
		if (await predicate()) return;
		if (Date.now() - startedAt > READY_TIMEOUT_MS) {
			throw new Error(`Timed out waiting for ${label}`);
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
}

async function waitForHttpOk(url) {
	await waitFor(async () => {
		try {
			const res = await fetch(url);
			return res.ok;
		} catch {
			return false;
		}
	}, url);
}

const children = new Set();

function run(name, command, args, env = {}) {
	const child = spawn(command, args, {
		stdio: "inherit",
		env: { ...process.env, ...env },
	});
	children.add(child);
	child.on("exit", (code, signal) => {
		children.delete(child);
		if (signal === null && code !== 0 && code !== null) {
			console.error(`[${name}] exited with code ${code}`);
			shutdown(1);
		}
	});
	return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	for (const child of children) {
		child.kill("SIGTERM");
	}
	process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const port = await findFreePort();
const devServerUrl = `http://${HOST}:${port}`;
console.log(`[dev] Vite will listen on ${devServerUrl}`);

run("vite", "bunx", [
	"vite",
	"dev",
	"--port",
	String(port),
	"--strictPort",
	"--host",
	HOST,
]);
run("tsup:main", "bunx", [
	"tsup",
	"electron/main.ts",
	"--watch",
	"--format",
	"esm",
	"--out-dir",
	"dist-electron",
	"--external",
	"electron",
]);
run("tsup:preload", "bunx", [
	"tsup",
	"electron/preload.ts",
	"--watch",
	"--format",
	"cjs",
	"--out-dir",
	"dist-electron",
	"--external",
	"electron",
]);

await waitForHttpOk(devServerUrl);
await waitFor(
	() =>
		existsSync("dist-electron/main.js") &&
		existsSync("dist-electron/preload.cjs"),
	"dist-electron output",
);

run("electron", "bunx", ["electron", "dist-electron/main.js"], {
	VITE_DEV_SERVER_URL: devServerUrl,
});

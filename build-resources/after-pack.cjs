const fs = require("fs");
const path = require("path");

/**
 * Removes ffprobe-static binaries for platforms other than the build target.
 * electron-builder unpacks native modules into app.asar.unpacked, so this hook
 * cleans up the unpacked copy after packaging.
 */
exports.default = async function afterPack(context) {
	const platformMap = {
		linux: "linux",
		darwin: "darwin",
		win32: "win32",
	};

	const keepDir = platformMap[context.electronPlatformName];
	if (!keepDir) {
		return;
	}

	const archMap = {
		x64: "x64",
		arm64: "arm64",
		ia32: "ia32",
	};

	const keepArch = archMap[context.arch];
	const ffprobeDir = path.join(
		context.appOutDir,
		"resources",
		"app.asar.unpacked",
		"node_modules",
		"ffprobe-static",
		"bin",
	);

	if (!fs.existsSync(ffprobeDir)) {
		return;
	}

	for (const entry of fs.readdirSync(ffprobeDir)) {
		const entryPath = path.join(ffprobeDir, entry);
		if (entry !== keepDir) {
			fs.rmSync(entryPath, { recursive: true, force: true });
			console.log(`[afterPack] removed ${entryPath}`);
			continue;
		}

		// Remove other architectures inside the kept platform directory.
		if (!keepArch) {
			continue;
		}

		for (const archEntry of fs.readdirSync(entryPath)) {
			if (archEntry === keepArch) {
				continue;
			}

			const archPath = path.join(entryPath, archEntry);
			fs.rmSync(archPath, { recursive: true, force: true });
			console.log(`[afterPack] removed ${archPath}`);
		}
	}
};

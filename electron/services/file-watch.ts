import chokidar, { type FSWatcher } from "chokidar";

type WatchCallbacks = {
	onAdd: (filePath: string) => void;
	onChange: (filePath: string) => void;
	onUnlink: (filePath: string) => void;
};

export class FileWatchService {
	private watchers = new Map<string, FSWatcher>();

	async start(sourcePath: string, callbacks: WatchCallbacks) {
		await this.stop(sourcePath);
		const watcher = chokidar.watch(sourcePath, {
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 800,
				pollInterval: 100,
			},
		});

		watcher.on("add", callbacks.onAdd);
		watcher.on("change", callbacks.onChange);
		watcher.on("unlink", callbacks.onUnlink);
		this.watchers.set(sourcePath, watcher);
	}

	async stop(sourcePath?: string) {
		if (sourcePath) {
			const watcher = this.watchers.get(sourcePath);
			if (!watcher) return;
			await watcher.close();
			this.watchers.delete(sourcePath);
			return;
		}

		for (const watcher of this.watchers.values()) {
			await watcher.close();
		}
		this.watchers.clear();
	}
}

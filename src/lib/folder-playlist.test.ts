import { describe, expect, it, vi } from "vitest";
import {
	chooseFoldersAndPromptNew,
	collectPreviousFolderPaths,
	submitFolderPlaylistRequest,
} from "./folder-playlist";

describe("collectPreviousFolderPaths", () => {
	it("maps source paths to plain path strings", () => {
		expect(
			collectPreviousFolderPaths([
				{
					id: "1",
					path: "/media/a",
					watchEnabled: true,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				},
				{
					id: "2",
					path: "/media/b",
					watchEnabled: false,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				},
			]),
		).toEqual(["/media/a", "/media/b"]);
	});

	it("falls back to an empty list when library is missing", () => {
		expect(collectPreviousFolderPaths(undefined)).toEqual([]);
		expect(collectPreviousFolderPaths(null)).toEqual([]);
	});
});

describe("chooseFoldersAndPromptNew", () => {
	it("prompts only for newly added folders and resets pending state", async () => {
		const promptForFolders = vi.fn();
		const setPending = vi.fn();
		const refreshAll = vi.fn().mockResolvedValue(undefined);
		const choose = vi.fn().mockResolvedValue({
			sourcePaths: [{ path: "/media/a" }, { path: "/media/b" }],
		});

		await chooseFoldersAndPromptNew({
			previousPaths: ["/media/a"],
			choose,
			refreshAll,
			promptForFolders,
			setPending,
		});

		expect(setPending.mock.calls).toEqual([[true], [false]]);
		expect(refreshAll).toHaveBeenCalledOnce();
		expect(promptForFolders).toHaveBeenCalledWith(["/media/b"]);
	});

	it("resets pending state when choosing folders fails", async () => {
		const promptForFolders = vi.fn();
		const setPending = vi.fn();
		const refreshAll = vi.fn();
		const failure = new Error("dialog cancelled");
		const choose = vi.fn().mockRejectedValue(failure);

		await expect(
			chooseFoldersAndPromptNew({
				previousPaths: [],
				choose,
				refreshAll,
				promptForFolders,
				setPending,
			}),
		).rejects.toThrow("dialog cancelled");
		expect(setPending.mock.calls).toEqual([[true], [false]]);
		expect(refreshAll).not.toHaveBeenCalled();
		expect(promptForFolders).not.toHaveBeenCalled();
	});
});

describe("submitFolderPlaylistRequest", () => {
	it("creates a category from the prompted folder and refreshes", async () => {
		const createFromFolder = vi.fn().mockResolvedValue({ id: "cat-1" });
		const refreshAll = vi.fn().mockResolvedValue(undefined);

		await submitFolderPlaylistRequest({
			promptFolder: "/media/b",
			input: { name: "B", description: "/media/b" },
			createFromFolder,
			refreshAll,
		});

		expect(createFromFolder).toHaveBeenCalledWith({
			name: "B",
			description: "/media/b",
			folderPath: "/media/b",
		});
		expect(refreshAll).toHaveBeenCalledOnce();
	});

	it("does nothing without a prompted folder", async () => {
		const createFromFolder = vi.fn();
		const refreshAll = vi.fn();

		await submitFolderPlaylistRequest({
			promptFolder: null,
			input: { name: "B" },
			createFromFolder,
			refreshAll,
		});

		expect(createFromFolder).not.toHaveBeenCalled();
		expect(refreshAll).not.toHaveBeenCalled();
	});
});

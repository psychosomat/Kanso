// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
	buildVideoCardMenuItems,
	getRemoveDialogDescription,
} from "./video-card";
import { preventMiddleClickAutoscroll } from "@/lib/utils";

describe("getRemoveDialogDescription", () => {
	it("reassures that the source file stays on disk for existing videos", () => {
		expect(getRemoveDialogDescription(true)).toBe(
			"This only removes the indexed entry and category posts. The original file stays on disk.",
		);
	});

	it("explains cleanup of dangling references for missing videos", () => {
		expect(getRemoveDialogDescription(false)).toBe(
			"This removes the missing entry and any category posts that still reference it.",
		);
	});
});

describe("buildVideoCardMenuItems", () => {
	it("lists dropdown actions without the folder-only entry", () => {
		expect(
			buildVideoCardMenuItems("dropdown", { canRemove: true }).map(
				(item) => item.id,
			),
		).toEqual(["categorize", "reveal-file", "copy-path", "remove"]);
	});

	it("uses the short reveal label in the dropdown", () => {
		const items = buildVideoCardMenuItems("dropdown", { canRemove: true });
		expect(items.find((item) => item.id === "reveal-file")?.label).toBe(
			"Reveal",
		);
	});

	it("lists context actions with the folder entry and long reveal label", () => {
		const items = buildVideoCardMenuItems("context", { canRemove: true });
		expect(items.map((item) => item.id)).toEqual([
			"categorize",
			"open-folder",
			"reveal-file",
			"copy-path",
			"remove",
		]);
		expect(items.find((item) => item.id === "reveal-file")?.label).toBe(
			"Reveal file",
		);
	});

	it("omits the destructive remove entry when no remove handler exists", () => {
		for (const surface of ["dropdown", "context"] as const) {
			const items = buildVideoCardMenuItems(surface, { canRemove: false });
			expect(items.some((item) => item.id === "remove")).toBe(false);
			expect(items.every((item) => item.destructive !== true)).toBe(true);
		}
	});

	it("marks only remove as destructive", () => {
		const items = buildVideoCardMenuItems("context", { canRemove: true });
		expect(
			items.filter((item) => item.destructive).map((item) => item.id),
		).toEqual(["remove"]);
	});
});

describe("preventMiddleClickAutoscroll", () => {
	it("prevents default on middle click", () => {
		const event = { button: 1, preventDefault: vi.fn() };
		preventMiddleClickAutoscroll(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
	});

	it("ignores primary and secondary buttons", () => {
		for (const button of [0, 2]) {
			const event = { button, preventDefault: vi.fn() };
			preventMiddleClickAutoscroll(event);
			expect(event.preventDefault).not.toHaveBeenCalled();
		}
	});
});

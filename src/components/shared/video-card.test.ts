// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VideoCardDto } from "@/lib/contracts";
import { preventMiddleClickAutoscroll } from "@/lib/utils";
import {
	buildVideoCardMenuItems,
	getDismissButtonLabel,
	getRemoveDialogDescription,
	hasRenderableDuration,
	VideoCard,
} from "./video-card";

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: "/dump" }),
	Link: ({
		children,
		to: _to,
		params: _params,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		to: string;
		params?: Record<string, string>;
	}) => React.createElement("a", { href: "#player", ...props }, children),
}));

afterEach(cleanup);

function makeVideo(overrides: Partial<VideoCardDto> = {}): VideoCardDto {
	return {
		origin: "library",
		id: "v1",
		fileName: "clip.mp4",
		sourcePath: "/media/clip.mp4",
		folderPath: "/media",
		durationSec: 125,
		width: 1920,
		height: 1080,
		modifiedAt: "2026-01-01T00:00:00.000Z",
		posterUrl: null,
		streamUrl: "video://v1",
		resumeSec: 0,
		lastPlayedAt: null,
		playCount: 0,
		exists: true,
		categoryCount: 0,
		...overrides,
	};
}

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

describe("hasRenderableDuration", () => {
	it("accepts positive finite durations only", () => {
		expect(hasRenderableDuration(0.5)).toBe(true);
		expect(hasRenderableDuration(125)).toBe(true);
		expect(hasRenderableDuration(0)).toBe(false);
		expect(hasRenderableDuration(-5)).toBe(false);
		expect(hasRenderableDuration(null)).toBe(false);
		expect(hasRenderableDuration(undefined)).toBe(false);
		expect(hasRenderableDuration(Number.NaN)).toBe(false);
		expect(hasRenderableDuration(Number.POSITIVE_INFINITY)).toBe(false);
	});
});

describe("getDismissButtonLabel", () => {
	it("formats an accessible label including the filename", () => {
		expect(getDismissButtonLabel("clip.mp4")).toBe(
			"Dismiss clip.mp4 from Continue Watching",
		);
	});
});

describe("VideoCard rendering", () => {
	it("renders the duration badge only when durationSec is positive", () => {
		const { rerender } = render(
			React.createElement(VideoCard, {
				video: makeVideo({ durationSec: null }),
				onAssign: vi.fn(),
				onAction: vi.fn(),
			}),
		);
		expect(screen.queryByText("Unknown")).toBeNull();
		expect(screen.queryByText("0:00")).toBeNull();

		rerender(
			React.createElement(VideoCard, {
				video: makeVideo({ durationSec: 0 }),
				onAssign: vi.fn(),
				onAction: vi.fn(),
			}),
		);
		expect(screen.queryByText("0:00")).toBeNull();

		rerender(
			React.createElement(VideoCard, {
				video: makeVideo({ durationSec: 125 }),
				onAssign: vi.fn(),
				onAction: vi.fn(),
			}),
		);
		expect(screen.getByText("2:05")).toBeTruthy();
	});

	it("renders dismiss button when onDismiss is provided and invokes it without navigating", () => {
		const onDismiss = vi.fn();
		const { rerender } = render(
			React.createElement(VideoCard, {
				video: makeVideo(),
				onAssign: vi.fn(),
				onAction: vi.fn(),
			}),
		);
		expect(
			screen.queryByRole("button", {
				name: "Dismiss clip.mp4 from Continue Watching",
			}),
		).toBeNull();

		rerender(
			React.createElement(VideoCard, {
				video: makeVideo(),
				onAssign: vi.fn(),
				onAction: vi.fn(),
				onDismiss,
			}),
		);
		const dismissBtn = screen.getByRole("button", {
			name: "Dismiss clip.mp4 from Continue Watching",
		});
		const clickEvent = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
		});
		fireEvent(dismissBtn, clickEvent);
		expect(clickEvent.defaultPrevented).toBe(true);
		expect(onDismiss).toHaveBeenCalledWith("v1");
	});
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	consumePlayerReturnTarget,
	getPlayerReturnTarget,
	getScrollStorageKey,
	resolveSafeReturnPathname,
	savePlayerReturnTarget,
	saveScrollPosition,
} from "./player-return";

describe("resolveSafeReturnPathname", () => {
	it("returns safe non-player route pathnames", () => {
		expect(resolveSafeReturnPathname({ pathname: "/dump", scrollTop: 0 })).toBe(
			"/dump",
		);
		expect(
			resolveSafeReturnPathname({
				pathname: "/categories/anime",
				scrollTop: 120,
			}),
		).toBe("/categories/anime");
		expect(
			resolveSafeReturnPathname({ pathname: "/settings", scrollTop: 10 }),
		).toBe("/settings");
	});

	it("rejects null, player routes, relative strings, and non-app URLs", () => {
		expect(resolveSafeReturnPathname(null)).toBeNull();
		expect(
			resolveSafeReturnPathname({ pathname: "/player/abc", scrollTop: 0 }),
		).toBeNull();
		expect(
			resolveSafeReturnPathname({ pathname: "/player/external", scrollTop: 0 }),
		).toBeNull();
		expect(
			resolveSafeReturnPathname({ pathname: "dump", scrollTop: 0 }),
		).toBeNull();
		expect(
			resolveSafeReturnPathname({ pathname: "", scrollTop: 0 }),
		).toBeNull();
		expect(
			resolveSafeReturnPathname({
				pathname: "https://example.com/dump",
				scrollTop: 0,
			}),
		).toBeNull();
		expect(
			resolveSafeReturnPathname({ pathname: "//evil.com", scrollTop: 0 }),
		).toBeNull();
	});
});

describe("player return storage", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("saves, reads, and consumes the matching return target", () => {
		savePlayerReturnTarget({ pathname: "/dump", scrollTop: 420 });
		expect(sessionStorage.getItem(getScrollStorageKey("/dump"))).toBe("420");
		expect(getPlayerReturnTarget()).toEqual({
			pathname: "/dump",
			scrollTop: 420,
		});

		expect(consumePlayerReturnTarget("/settings")).toBeNull();
		expect(consumePlayerReturnTarget("/dump")).toEqual({
			pathname: "/dump",
			scrollTop: 420,
		});
		expect(getPlayerReturnTarget()).toBeNull();
	});

	it("stores scroll positions per pathname", () => {
		saveScrollPosition("/categories/clips", 88);
		expect(
			sessionStorage.getItem(getScrollStorageKey("/categories/clips")),
		).toBe("88");
	});
});

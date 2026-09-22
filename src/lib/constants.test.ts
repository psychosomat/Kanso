import { describe, expect, it } from "vitest";
import {
	APP_NAME,
	DEFAULT_DUMP_QUERY,
	DEFAULT_PLAYER_PREFERENCES,
	SUPPORTED_VIDEO_EXTENSIONS,
} from "./constants";
import { DEFAULT_EQ_GAINS } from "./equalizer";
import { DEFAULT_ACCENT } from "./settings-appearance";

describe("shared defaults", () => {
	it("keeps a single accent default across layers", () => {
		expect(DEFAULT_PLAYER_PREFERENCES.accentColor).toBe(DEFAULT_ACCENT);
	});

	it("keeps dump defaults in sync", () => {
		expect(DEFAULT_PLAYER_PREFERENCES.dumpSort).toBe(DEFAULT_DUMP_QUERY.sort);
		expect(DEFAULT_DUMP_QUERY.page).toBe(1);
	});

	it("decouples player EQ gains from the shared equalizer default", () => {
		expect(DEFAULT_PLAYER_PREFERENCES.playerEqGains).toEqual(DEFAULT_EQ_GAINS);
		expect(DEFAULT_PLAYER_PREFERENCES.playerEqGains).not.toBe(DEFAULT_EQ_GAINS);
	});

	it("lists supported video extensions sanely", () => {
		expect(SUPPORTED_VIDEO_EXTENSIONS.length).toBeGreaterThan(0);
		expect(new Set(SUPPORTED_VIDEO_EXTENSIONS).size).toBe(
			SUPPORTED_VIDEO_EXTENSIONS.length,
		);
		for (const ext of SUPPORTED_VIDEO_EXTENSIONS) {
			expect(ext).toMatch(/^\.[a-z0-9]+$/);
		}
	});

	it("exposes the app name", () => {
		expect(APP_NAME).toBe("Kanso");
	});
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	getEmptyLibraryCtaLabel,
	shouldShowElectronWarning,
} from "./empty-library-state";

describe("getEmptyLibraryCtaLabel", () => {
	it("invites choosing a folder by default", () => {
		expect(getEmptyLibraryCtaLabel()).toBe("Choose folder");
	});

	it("invites choosing a folder when not pending", () => {
		expect(getEmptyLibraryCtaLabel(false)).toBe("Choose folder");
	});

	it("signals progress while the folder dialog is pending", () => {
		expect(getEmptyLibraryCtaLabel(true)).toBe("Opening...");
	});
});

describe("shouldShowElectronWarning", () => {
	it("warns when the bridge state is unknown", () => {
		expect(shouldShowElectronWarning()).toBe(true);
	});

	it("warns when the bridge is not ready", () => {
		expect(shouldShowElectronWarning(false)).toBe(true);
	});

	it("hides the warning once the bridge is ready", () => {
		expect(shouldShowElectronWarning(true)).toBe(false);
	});
});

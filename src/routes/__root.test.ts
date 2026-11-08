import { describe, expect, it } from "vitest";
import { shouldSuppressMiddleClick } from "./__root";

function target(hasAnchor: boolean): { closest: (selector: string) => unknown } {
	return { closest: (selector: string) => (hasAnchor ? { selector } : null) };
}

describe("shouldSuppressMiddleClick", () => {
	it("suppresses middle clicks on anchors", () => {
		expect(shouldSuppressMiddleClick(1, target(true))).toBe(true);
	});

	it("ignores non-middle buttons", () => {
		for (const button of [0, 2]) {
			expect(shouldSuppressMiddleClick(button, target(true))).toBe(false);
		}
	});

	it("ignores middle clicks outside anchors", () => {
		expect(shouldSuppressMiddleClick(1, target(false))).toBe(false);
	});

	it("handles a missing target", () => {
		expect(shouldSuppressMiddleClick(1, null)).toBe(false);
	});
});

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	SheetContent,
} from "./dialog";

afterEach(cleanup);

describe("DialogOverlay", () => {
	it("renders with the base dimming classes", () => {
		const { baseElement } = render(
			<Dialog open>
				<DialogOverlay />
			</Dialog>,
		);
		const el = baseElement.querySelector('div[class*="bg-black"]');
		expect(el?.className).toContain("bg-black/55");
		expect(el?.className).toContain("backdrop-blur-md");
	});

	it("merges a custom className", () => {
		const { baseElement } = render(
			<Dialog open>
				<DialogOverlay className="extra-class" />
			</Dialog>,
		);
		expect(
			baseElement.querySelector('div[class*="bg-black"]')?.className,
		).toContain("extra-class");
	});
});

describe("DialogContent", () => {
	it("renders children inside an open dialog with a close button", () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Assign video</DialogTitle>
					<DialogDescription>Pick a category</DialogDescription>
				</DialogContent>
			</Dialog>,
		);
		expect(screen.getByRole("dialog", { name: "Assign video" }).tagName).toBe(
			"DIV",
		);
		expect(screen.getByText("Pick a category").tagName).toBe("P");
		expect(screen.getByRole("button", { name: "Close dialog" }).tagName).toBe(
			"BUTTON",
		);
	});

	it("merges a custom className over the centered panel classes", () => {
		render(
			<Dialog open>
				<DialogContent className="extra-class">body</DialogContent>
			</Dialog>,
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.className).toContain("extra-class");
		expect(dialog.className).toContain("-translate-x-1/2");
	});
});

describe("DialogHeader and DialogFooter", () => {
	it("applies the vertical stack layout", () => {
		const { container } = render(<DialogHeader className="extra-class" />);
		expect(container.firstElementChild?.className).toContain("flex-col");
		expect(container.firstElementChild?.className).toContain("extra-class");
	});

	it("applies the trailing action layout", () => {
		const { container } = render(<DialogFooter className="extra-class" />);
		expect(container.firstElementChild?.className).toContain("justify-end");
		expect(container.firstElementChild?.className).toContain("extra-class");
	});
});

describe("DialogTitle and DialogDescription", () => {
	it("renders text with typography classes", () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle className="extra-title">Title</DialogTitle>
					<DialogDescription className="extra-desc">
						Description
					</DialogDescription>
				</DialogContent>
			</Dialog>,
		);
		expect(screen.getByText("Title").className).toContain("extra-title");
		expect(screen.getByText("Description").className).toContain(
			"text-(--muted-foreground)",
		);
	});
});

describe("SheetContent", () => {
	it("docks to the right by default with a close button", () => {
		render(
			<Dialog open>
				<SheetContent>sheet body</SheetContent>
			</Dialog>,
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.className).toContain("right-0");
		expect(dialog.className).not.toContain("left-0");
		expect(screen.getByRole("button", { name: "Close dialog" }).tagName).toBe(
			"BUTTON",
		);
	});

	it("docks to the left when side is left and merges className", () => {
		render(
			<Dialog open>
				<SheetContent side="left" className="extra-class">
					sheet body
				</SheetContent>
			</Dialog>,
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.className).toContain("left-0");
		expect(dialog.className).toContain("extra-class");
	});
});

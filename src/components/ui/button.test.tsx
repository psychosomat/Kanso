// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("buttonVariants", () => {
	it("applies base, default variant and default size without arguments", () => {
		const classes = buttonVariants();
		expect(classes).toContain("inline-flex");
		expect(classes).toContain("bg-(--accent)");
		expect(classes).toContain("h-9");
	});

	it("resolves each variant to a distinct token", () => {
		expect(buttonVariants({ variant: "secondary" })).toContain(
			"backdrop-blur-xl",
		);
		expect(buttonVariants({ variant: "ghost" })).toContain(
			"text-(--muted-foreground)",
		);
		expect(buttonVariants({ variant: "destructive" })).toContain(
			"text-(--destructive)",
		);
	});

	it("resolves each size to a distinct token", () => {
		expect(buttonVariants({ size: "sm" })).toContain("h-7");
		expect(buttonVariants({ size: "lg" })).toContain("h-11");
		expect(buttonVariants({ size: "icon" })).toContain("rounded-full");
	});

	it("merges a custom className through cn", () => {
		expect(buttonVariants({ className: "extra-class" })).toContain(
			"extra-class",
		);
	});
});

describe("Button", () => {
	it("renders a native button by default and forwards props", () => {
		render(
			<Button type="submit" disabled>
				Save
			</Button>,
		);
		const el = screen.getByRole("button", { name: "Save" });
		expect(el.tagName).toBe("BUTTON");
		expect(el).toHaveProperty("type", "submit");
		expect(el).toHaveProperty("disabled", true);
		expect(el.className).toContain("bg-(--accent)");
	});

	it("renders the Slot child when asChild is set", () => {
		render(
			<Button asChild variant="ghost" size="sm">
				<a href="/library">Library</a>
			</Button>,
		);
		const el = screen.getByRole("link", { name: "Library" });
		expect(el.tagName).toBe("A");
		expect(el.className).toContain("text-(--muted-foreground)");
	});

	it("forwards refs to the underlying button", () => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<Button ref={ref}>Ref</Button>);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
		expect(ref.current?.textContent).toBe("Ref");
	});

	it("keeps a stable displayName for devtools", () => {
		expect(Button.displayName).toBe("Button");
	});
});

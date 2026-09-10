// @vitest-environment jsdom

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";

function renderOpenMenu(ui: React.ReactNode) {
	return render(
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger>Open</DropdownMenuTrigger>
			{ui}
		</DropdownMenu>,
	);
}

describe("DropdownMenu re-exports", () => {
	it("exposes the Radix Root and Trigger primitives unchanged", () => {
		expect(DropdownMenu).toBe(DropdownMenuPrimitive.Root);
		expect(DropdownMenuTrigger).toBe(DropdownMenuPrimitive.Trigger);
	});
});

describe("DropdownMenuContent", () => {
	it("renders in a portal with base positioning and surface classes", () => {
		renderOpenMenu(<DropdownMenuContent>Profile</DropdownMenuContent>);
		const el = screen.getByText("Profile");
		expect(el.className).toContain("z-50");
		expect(el.className).toContain("island-strong");
		expect(el.className).toContain("min-w-44");
	});

	it("merges a custom className and forwards Content props", () => {
		renderOpenMenu(
			<DropdownMenuContent className="extra-class" align="end">
				Settings
			</DropdownMenuContent>,
		);
		const el = screen.getByText("Settings");
		expect(el.className).toContain("extra-class");
		expect(el.className).toContain("island-strong");
		expect(el.getAttribute("data-align")).toBe("end");
	});

	it("allows overriding the default sideOffset", () => {
		renderOpenMenu(
			<DropdownMenuContent sideOffset={0}>Offset</DropdownMenuContent>,
		);
		const el = screen.getByText("Offset");
		expect(el.getAttribute("data-side")).not.toBeNull();
	});
});

describe("DropdownMenuItem", () => {
	it("renders a menuitem with base layout classes", () => {
		renderOpenMenu(
			<DropdownMenuContent>
				<DropdownMenuItem>Open video</DropdownMenuItem>
			</DropdownMenuContent>,
		);
		const el = screen.getByRole("menuitem", { name: "Open video" });
		expect(el.className).toContain("items-center");
		expect(el.className).toContain("rounded-(--radius-sm)");
	});

	it("adds inset padding only when inset is set", () => {
		renderOpenMenu(
			<DropdownMenuContent>
				<DropdownMenuItem inset>Indented</DropdownMenuItem>
				<DropdownMenuItem>Plain</DropdownMenuItem>
			</DropdownMenuContent>,
		);
		expect(
			screen.getByRole("menuitem", { name: "Indented" }).className,
		).toContain("pl-8");
		expect(
			screen.getByRole("menuitem", { name: "Plain" }).className,
		).not.toContain("pl-8");
	});

	it("merges destructive/custom classes without dropping base classes", () => {
		renderOpenMenu(
			<DropdownMenuContent>
				<DropdownMenuItem className="text-(--destructive)">
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>,
		);
		const el = screen.getByRole("menuitem", { name: "Delete" });
		expect(el.className).toContain("text-(--destructive)");
		expect(el.className).toContain("items-center");
	});
});

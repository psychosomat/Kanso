import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { menuContentBaseClass, menuItemBaseClass } from "./menu-surface";

describe("menu-surface shared contract", () => {
	it("keeps the common content surface both menus compose from", () => {
		for (const token of [
			"island-strong",
			"z-50",
			"overflow-hidden",
			"rounded-(--radius-md)",
			"p-1",
			"text-(--foreground)",
		]) {
			expect(menuContentBaseClass).toContain(token);
		}
		expect(menuContentBaseClass).not.toContain("min-w-");
	});

	it("keeps the common item layout both menus compose from", () => {
		for (const token of [
			"flex",
			"items-center",
			"gap-2",
			"rounded-(--radius-sm)",
			"px-2",
			"py-2",
			"text-[13px]",
		]) {
			expect(menuItemBaseClass).toContain(token);
		}
	});

	it("keeps inset padding alongside the base horizontal padding", () => {
		const composed = cn(menuItemBaseClass, "relative", true && "pl-8");
		expect(composed).toContain("pl-8");
		expect(composed).toContain("px-2");
	});

	it("keeps each menu width independent of the shared base", () => {
		expect(cn(menuContentBaseClass, "min-w-44")).toContain("min-w-44");
		expect(cn(menuContentBaseClass, "min-w-40")).toContain("min-w-40");
	});
});

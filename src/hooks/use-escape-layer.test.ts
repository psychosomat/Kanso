// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	consumeTopEscapeLayer,
	escapeLayerCount,
	pushEscapeLayer,
	useEscapeLayer,
} from "./use-escape-layer";

afterEach(() => {
	while (consumeTopEscapeLayer()) {
		// Drain leaked layers; closers here are plain vi.fn() spies.
	}
});

describe("escape stack", () => {
	it("consumes layers top-first", () => {
		const order: string[] = [];
		pushEscapeLayer(() => order.push("bottom"));
		pushEscapeLayer(() => order.push("top"));

		expect(consumeTopEscapeLayer()).toBe(true);
		expect(consumeTopEscapeLayer()).toBe(true);
		expect(consumeTopEscapeLayer()).toBe(false);
		expect(order).toEqual(["top", "bottom"]);
	});

	it("reports an empty stack", () => {
		expect(escapeLayerCount()).toBe(0);
		expect(consumeTopEscapeLayer()).toBe(false);
	});

	it("removes layers without consuming", () => {
		const closer = vi.fn();
		const remove = pushEscapeLayer(closer);
		expect(escapeLayerCount()).toBe(1);
		remove();
		remove();
		expect(escapeLayerCount()).toBe(0);
		expect(consumeTopEscapeLayer()).toBe(false);
		expect(closer).not.toHaveBeenCalled();
	});
});

describe("useEscapeLayer", () => {
	it("registers while active and cleans up", () => {
		const onEscape = vi.fn();
		const { rerender, unmount } = renderHook(
			({ active }: { active: boolean }) => useEscapeLayer(active, onEscape),
			{ initialProps: { active: false } },
		);

		expect(escapeLayerCount()).toBe(0);
		rerender({ active: true });
		expect(escapeLayerCount()).toBe(1);

		expect(consumeTopEscapeLayer()).toBe(true);
		expect(onEscape).toHaveBeenCalledTimes(1);

		rerender({ active: true });
		unmount();
		expect(escapeLayerCount()).toBe(0);
	});

	it("unregisters when deactivated", () => {
		const { rerender } = renderHook(
			({ active }: { active: boolean }) => useEscapeLayer(active, () => {}),
			{ initialProps: { active: true } },
		);
		expect(escapeLayerCount()).toBe(1);
		rerender({ active: false });
		expect(escapeLayerCount()).toBe(0);
	});
});

// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	HIDE_DELAY_MS,
	usePlayerUiVisibility,
} from "./use-player-ui-visibility";

describe("usePlayerUiVisibility", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts visible and auto-hides after the delay when unsuspended", () => {
		const { result } = renderHook(() =>
			usePlayerUiVisibility({ suspended: false }),
		);

		expect(result.current.isVisible).toBe(true);

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
		});
		expect(result.current.isVisible).toBe(true);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.isVisible).toBe(false);
	});

	it("resets the countdown on resetTimer and wakes up when hidden", () => {
		const { result } = renderHook(() =>
			usePlayerUiVisibility({ suspended: false }),
		);

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS - 500);
		});
		act(() => {
			result.current.resetTimer();
		});
		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
		});
		expect(result.current.isVisible).toBe(true);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.isVisible).toBe(false);

		act(() => {
			result.current.resetTimer();
		});
		expect(result.current.isVisible).toBe(true);
	});

	it("stays visible while suspended and hides after delay once unsuspended", () => {
		const { result, rerender } = renderHook(
			({ suspended }) => usePlayerUiVisibility({ suspended }),
			{ initialProps: { suspended: true } },
		);

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS * 5);
		});
		expect(result.current.isVisible).toBe(true);

		act(() => {
			result.current.hideUi();
		});
		expect(result.current.isVisible).toBe(true);

		rerender({ suspended: false });
		expect(result.current.isVisible).toBe(true);

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
		});
		expect(result.current.isVisible).toBe(true);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.isVisible).toBe(false);
	});

	it("reveals and cancels pending hide when suspended mid-countdown", () => {
		const { result, rerender } = renderHook(
			({ suspended }) => usePlayerUiVisibility({ suspended }),
			{ initialProps: { suspended: false } },
		);

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS - 200);
		});
		rerender({ suspended: true });

		act(() => {
			vi.advanceTimersByTime(HIDE_DELAY_MS);
		});
		expect(result.current.isVisible).toBe(true);
	});
});

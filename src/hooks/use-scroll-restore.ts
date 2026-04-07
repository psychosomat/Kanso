import { useEffect, useRef } from "react";
import {
	consumePlayerReturnTarget,
	getMainScrollElement,
	getScrollStorageKey,
	saveScrollPosition,
} from "@/lib/player-return";

export function useScrollRestore(key: string, ready = true) {
	const storageKey = getScrollStorageKey(key);
	const restoredRef = useRef(false);
	const saveEnabledRef = useRef(false);

	useEffect(() => {
		const el = getMainScrollElement();
		if (!el) return;
		const scrollEl: HTMLElement = el;

		function onScroll() {
			if (!saveEnabledRef.current) return;
			saveScrollPosition(key, scrollEl.scrollTop);
		}

		scrollEl.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			if (saveEnabledRef.current) {
				saveScrollPosition(key, scrollEl.scrollTop);
			}
			scrollEl.removeEventListener("scroll", onScroll);
		};
	}, [key]);

	useEffect(() => {
		if (!ready || restoredRef.current) return;
		const el = getMainScrollElement();
		if (!el) return;

		const returnTarget = consumePlayerReturnTarget(key);
		const stored =
			returnTarget !== null
				? String(returnTarget.scrollTop)
				: sessionStorage.getItem(storageKey);

		if (stored !== null) {
			const targetScrollTop = Number(stored);
			let frameId = 0;
			let attempts = 0;
			const maxAttempts = 180;

			const restore = () => {
				el.scrollTop = targetScrollTop;
				attempts += 1;

				if (
					Math.abs(el.scrollTop - targetScrollTop) <= 1 ||
					attempts >= maxAttempts
				) {
					restoredRef.current = true;
					saveEnabledRef.current = true;
					return;
				}

				frameId = window.requestAnimationFrame(restore);
			};

			restore();
			return () => {
				if (frameId) {
					window.cancelAnimationFrame(frameId);
				}
			};
		}
		restoredRef.current = true;
		saveEnabledRef.current = true;
	}, [key, storageKey, ready]);
}

import { useCallback, useEffect, useRef, useState } from "react";

export const HIDE_DELAY_MS = 3000;

export function usePlayerUiVisibility(options?: { suspended?: boolean }) {
	const suspended = options?.suspended ?? false;
	const [isVisible, setIsVisible] = useState(true);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suspendedRef = useRef(suspended);

	const clearHideTimeout = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const showUi = useCallback(() => {
		setIsVisible(true);
		clearHideTimeout();
		if (suspendedRef.current) return;
		timeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, HIDE_DELAY_MS);
	}, [clearHideTimeout]);

	const hideUi = useCallback(() => {
		if (suspendedRef.current) return;
		clearHideTimeout();
		setIsVisible(false);
	}, [clearHideTimeout]);

	const resetTimer = useCallback(() => {
		showUi();
	}, [showUi]);

	useEffect(() => {
		suspendedRef.current = suspended;
		showUi();
		return clearHideTimeout;
	}, [clearHideTimeout, showUi, suspended]);

	return { isVisible, showUi, hideUi, resetTimer };
}

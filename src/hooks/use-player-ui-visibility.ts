import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 3000;

export function usePlayerUiVisibility(options?: { suspended?: boolean }) {
	const suspended = options?.suspended ?? false;
	const [isVisible, setIsVisible] = useState(true);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const suspendedRef = useRef(suspended);

	const showUi = useCallback(() => {
		setIsVisible(true);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		if (suspendedRef.current) return;
		timeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, HIDE_DELAY_MS);
	}, []);

	const hideUi = useCallback(() => {
		if (suspendedRef.current) return;
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setIsVisible(false);
	}, []);

	const resetTimer = useCallback(() => {
		showUi();
	}, [showUi]);

	useEffect(() => {
		suspendedRef.current = suspended;
		showUi();
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [showUi, suspended]);

	return { isVisible, showUi, hideUi, resetTimer };
}

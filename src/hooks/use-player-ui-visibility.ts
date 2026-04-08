import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 3000;

export function usePlayerUiVisibility() {
	const [isVisible, setIsVisible] = useState(true);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const showUi = useCallback(() => {
		setIsVisible(true);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, HIDE_DELAY_MS);
	}, []);

	const hideUi = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		setIsVisible(false);
	}, []);

	const resetTimer = useCallback(() => {
		showUi();
	}, [showUi]);

	useEffect(() => {
		// Initial hide after delay
		const initialTimeout = setTimeout(() => {
			setIsVisible(false);
		}, HIDE_DELAY_MS);

		return () => {
			clearTimeout(initialTimeout);
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return { isVisible, showUi, hideUi, resetTimer };
}

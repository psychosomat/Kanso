const SCROLL_PREFIX = "player:scroll:";
const RETURN_TARGET_KEY = "player:return-target";

type PlayerReturnTarget = {
	pathname: string;
	scrollTop: number;
};

export function getMainScrollElement(): HTMLElement | null {
	if (typeof document === "undefined") {
		return null;
	}

	return document.getElementById("main-scroll");
}

export function getScrollStorageKey(key: string) {
	return `${SCROLL_PREFIX}${key}`;
}

export function saveScrollPosition(key: string, scrollTop: number) {
	if (typeof window === "undefined") {
		return;
	}

	sessionStorage.setItem(getScrollStorageKey(key), String(scrollTop));
}

export function savePlayerReturnTarget(target: PlayerReturnTarget) {
	saveScrollPosition(target.pathname, target.scrollTop);
	sessionStorage.setItem(RETURN_TARGET_KEY, JSON.stringify(target));
}

export function getPlayerReturnTarget(): PlayerReturnTarget | null {
	if (typeof window === "undefined") {
		return null;
	}

	const stored = sessionStorage.getItem(RETURN_TARGET_KEY);
	if (!stored) return null;

	try {
		const parsed = JSON.parse(stored) as Partial<PlayerReturnTarget>;
		if (
			typeof parsed.pathname !== "string" ||
			typeof parsed.scrollTop !== "number"
		) {
			return null;
		}

		return parsed as PlayerReturnTarget;
	} catch {
		return null;
	}
}

export function consumePlayerReturnTarget(pathname: string) {
	if (typeof window === "undefined") {
		return null;
	}

	const target = getPlayerReturnTarget();
	if (!target || target.pathname !== pathname) {
		return null;
	}

	sessionStorage.removeItem(RETURN_TARGET_KEY);
	return target;
}

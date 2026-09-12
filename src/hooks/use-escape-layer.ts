import { useEffect, useRef } from "react";

/**
 * Layered Escape handling.
 *
 * Overlays that close themselves (Radix dialogs, the command palette) keep
 * their native Escape behavior. Custom layers that need an explicit closer —
 * popups, confirm dialogs — register here via `useEscapeLayer`.
 *
 * Consumers resolve Escape strictly top-first:
 * 1. `consumeTopEscapeLayer()` — closes the topmost custom layer, if any.
 * 2. Self-closing overlays handle Escape natively.
 * 3. The bottom action (e.g. leaving the player) runs only when nothing
 *    above claimed the key.
 */
export type EscapeLayerCloser = () => void;

const layers: EscapeLayerCloser[] = [];

export function pushEscapeLayer(closer: EscapeLayerCloser): () => void {
	let removed = false;
	layers.push(closer);
	return () => {
		if (removed) return;
		removed = true;
		const index = layers.lastIndexOf(closer);
		if (index >= 0) layers.splice(index, 1);
	};
}

export function consumeTopEscapeLayer(): boolean {
	const top = layers.pop();
	if (!top) return false;
	top();
	return true;
}

export function escapeLayerCount(): number {
	return layers.length;
}

export function useEscapeLayer(active: boolean, onEscape: () => void) {
	const onEscapeRef = useRef(onEscape);
	useEffect(() => {
		onEscapeRef.current = onEscape;
	});
	useEffect(() => {
		if (!active) return;
		return pushEscapeLayer(() => onEscapeRef.current());
	}, [active]);
}

import { clampEqGain, EQ_GAIN_MAX, EQ_GAIN_MIN } from "./equalizer";

export const EQ_GRAPH_WIDTH = 720;
export const EQ_GRAPH_HEIGHT = 260;
export const EQ_GRAPH_MARGIN = 28;

export type EqGraphPoint = {
	x: number;
	y: number;
};

export function bandX(
	index: number,
	count: number,
	width: number = EQ_GRAPH_WIDTH,
	margin: number = EQ_GRAPH_MARGIN,
): number {
	return margin + (index / Math.max(1, count - 1)) * (width - margin * 2);
}

export function gainToY(
	value: number,
	height: number = EQ_GRAPH_HEIGHT,
	margin: number = EQ_GRAPH_MARGIN,
): number {
	const clamped = clampEqGain(value);
	const ratio = (EQ_GAIN_MAX - clamped) / (EQ_GAIN_MAX - EQ_GAIN_MIN);
	return margin + ratio * (height - margin * 2);
}

export function yToGain(
	y: number,
	height: number = EQ_GRAPH_HEIGHT,
	margin: number = EQ_GRAPH_MARGIN,
): number {
	const ratio = Math.max(0, Math.min(1, (y - margin) / (height - margin * 2)));
	const gain = EQ_GAIN_MAX - ratio * (EQ_GAIN_MAX - EQ_GAIN_MIN);
	return clampEqGain(gain);
}

export function buildEqPath(points: EqGraphPoint[]): string {
	if (!points.length) return "";
	let d = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
	for (let i = 1; i < points.length; i += 1) {
		const prev = points[i - 1];
		const current = points[i];
		const midX = (prev.x + current.x) / 2;
		const midY = (prev.y + current.y) / 2;
		d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
	}
	d += ` T ${points.at(-1)?.x ?? 0} ${points.at(-1)?.y ?? 0}`;
	return d;
}

export function buildEqAreaPath(
	eqPath: string,
	bandPoints: Array<{ x: number }>,
	height: number = EQ_GRAPH_HEIGHT,
	margin: number = EQ_GRAPH_MARGIN,
): string {
	if (!eqPath) return "";
	const bottomY = height - margin;
	const lastX = bandPoints.at(-1)?.x ?? margin;
	return `${eqPath} L ${lastX} ${bottomY} L ${bandPoints[0]?.x ?? margin} ${bottomY} Z`;
}

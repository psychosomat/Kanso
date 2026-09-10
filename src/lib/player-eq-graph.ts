import type { EqBand } from "./equalizer";
import { clampEqGain, EQ_BANDS, normalizeEqGains } from "./equalizer";

export function ensureEqNodes(
	ctx: AudioContext,
	existing: BiquadFilterNode[],
): BiquadFilterNode[] {
	if (existing.length > 0) return existing;
	return EQ_BANDS.map((band: EqBand) => {
		const node = ctx.createBiquadFilter();
		node.type = band.type;
		node.frequency.value = band.frequency;
		if (band.q) {
			node.Q.value = band.q;
		}
		return node;
	});
}

export function applyEqGains(
	nodes: BiquadFilterNode[],
	enabled: boolean,
	gains: number[] | undefined,
): void {
	const normalized = normalizeEqGains(gains);
	nodes.forEach((node, index) => {
		node.gain.value = enabled ? clampEqGain(normalized[index] ?? 0) : 0;
	});
}

export function connectEqGraph(
	source: AudioNode,
	nodes: BiquadFilterNode[],
	destination: AudioNode,
	enabled: boolean,
): void {
	source.disconnect();
	for (const node of nodes) {
		node.disconnect();
	}
	if (!enabled) {
		source.connect(destination);
		return;
	}
	let previous: AudioNode = source;
	for (const node of nodes) {
		previous.connect(node);
		previous = node;
	}
	previous.connect(destination);
}

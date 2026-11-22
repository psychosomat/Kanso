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

export type EqSyncState = {
	audioContext: AudioContext | null;
	sourceNode: MediaElementAudioSourceNode | null;
	eqNodes: BiquadFilterNode[];
	connectedMode: boolean | null;
	connectedSource: MediaElementAudioSourceNode | null;
};

/**
 * Lazily attaches WebAudio EQ to a <video> element so default playback
 * (EQ disabled with no prior attachment) stays native with zero latency/drift.
 * Rewires the graph only when the connection mode or source node changes.
 */
export function syncVideoEqGraph(options: {
	videoElement: HTMLVideoElement;
	enabled: boolean;
	gains: number[] | undefined;
	sourceNodes: WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>;
	state: EqSyncState;
	createAudioContext?: () => AudioContext;
}): EqSyncState {
	const { videoElement, enabled, gains, sourceNodes, state } = options;
	const existingSource = sourceNodes.get(videoElement) ?? null;

	// Never create an AudioContext or capture the <video> stream until EQ is enabled.
	if (!enabled && !existingSource) {
		return state;
	}

	const audioContext =
		state.audioContext ??
		options.createAudioContext?.() ??
		new AudioContext({ latencyHint: "interactive" });

	if (audioContext.state === "suspended") {
		void audioContext.resume();
	}

	let sourceNode = existingSource;
	if (!sourceNode) {
		sourceNode = audioContext.createMediaElementSource(videoElement);
		sourceNodes.set(videoElement, sourceNode);
	}

	const eqNodes = ensureEqNodes(audioContext, state.eqNodes);
	applyEqGains(eqNodes, enabled, gains);

	if (state.connectedSource !== sourceNode || state.connectedMode !== enabled) {
		connectEqGraph(sourceNode, eqNodes, audioContext.destination, enabled);
	}

	return {
		audioContext,
		sourceNode,
		eqNodes,
		connectedMode: enabled,
		connectedSource: sourceNode,
	};
}

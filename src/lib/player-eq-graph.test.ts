import { afterEach, describe, expect, it, vi } from "vitest";
import { EQ_BANDS } from "./equalizer";
import {
	applyEqGains,
	connectEqGraph,
	type EqSyncState,
	ensureEqNodes,
	syncVideoEqGraph,
} from "./player-eq-graph";

function createFilterNode() {
	return {
		type: "",
		frequency: { value: 0 },
		Q: { value: 0 },
		gain: { value: 0 },
		disconnect: vi.fn(),
		connect: vi.fn(),
	} as unknown as BiquadFilterNode & { disconnect: ReturnType<typeof vi.fn> };
}

function createAudioNode() {
	return {
		disconnect: vi.fn(),
		connect: vi.fn(),
	} as unknown as AudioNode & {
		disconnect: ReturnType<typeof vi.fn>;
		connect: ReturnType<typeof vi.fn>;
	};
}

describe("ensureEqNodes", () => {
	it("reuses already built nodes", () => {
		const ctx = {} as AudioContext;
		const existing = [createFilterNode()];
		expect(ensureEqNodes(ctx, existing)).toBe(existing);
	});

	it("builds one filter per EQ band", () => {
		const created: ReturnType<typeof createFilterNode>[] = [];
		const ctx = {
			createBiquadFilter: () => {
				const node = createFilterNode();
				created.push(node);
				return node;
			},
		} as unknown as AudioContext;

		const nodes = ensureEqNodes(ctx, []);
		expect(nodes).toHaveLength(EQ_BANDS.length);
		expect(created[1]?.type).toBe(EQ_BANDS[1]?.type);
		expect(created[1]?.frequency.value).toBe(EQ_BANDS[1]?.frequency);
	});
});

describe("applyEqGains", () => {
	it("writes normalized gains when enabled", () => {
		const nodes = [createFilterNode(), createFilterNode()];
		applyEqGains(nodes, true, [3, -20]);
		expect(nodes[0]?.gain.value).toBe(3);
		expect(nodes[1]?.gain.value).toBe(-12);
	});

	it("silences every band when disabled", () => {
		const nodes = [createFilterNode(), createFilterNode()];
		applyEqGains(nodes, false, [3, 3]);
		expect(nodes[0]?.gain.value).toBe(0);
		expect(nodes[1]?.gain.value).toBe(0);
	});
});

describe("connectEqGraph", () => {
	it("chains source through every node when enabled", () => {
		const source = createAudioNode();
		const first = createFilterNode();
		const second = createFilterNode();
		const destination = createAudioNode();

		connectEqGraph(source, [first, second], destination, true);

		expect(source.disconnect).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(first);
		expect(first.connect).toHaveBeenCalledWith(second);
		expect(second.connect).toHaveBeenCalledWith(destination);
	});

	it("bypasses the chain when disabled", () => {
		const source = createAudioNode();
		const first = createFilterNode();
		const destination = createAudioNode();

		connectEqGraph(source, [first], destination, false);

		expect(source.disconnect).toHaveBeenCalledTimes(1);
		expect(first.disconnect).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(destination);
		expect(first.connect).not.toHaveBeenCalled();
	});
});

describe("syncVideoEqGraph", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function createEmptyState(): EqSyncState {
		return {
			audioContext: null,
			sourceNode: null,
			eqNodes: [],
			connectedMode: null,
			connectedSource: null,
		};
	}

	function createMockContext() {
		const source =
			createAudioNode() as unknown as MediaElementAudioSourceNode & {
				disconnect: ReturnType<typeof vi.fn>;
				connect: ReturnType<typeof vi.fn>;
			};
		const destination = createAudioNode() as unknown as AudioDestinationNode;
		const filters: ReturnType<typeof createFilterNode>[] = [];
		const resume = vi.fn().mockResolvedValue(undefined);
		const createMediaElementSource = vi.fn(() => source);
		const ctx = {
			state: "suspended",
			destination,
			resume,
			createMediaElementSource,
			createBiquadFilter: vi.fn(() => {
				const node = createFilterNode();
				filters.push(node);
				return node;
			}),
		} as unknown as AudioContext;
		return {
			ctx,
			source,
			destination,
			filters,
			resume,
			createMediaElementSource,
		};
	}

	it("does not create AudioContext or MediaElementSource when disabled initially", () => {
		const videoElement = {} as HTMLVideoElement;
		const sourceNodes = new WeakMap<
			HTMLVideoElement,
			MediaElementAudioSourceNode
		>();
		const createAudioContext = vi.fn();

		const next = syncVideoEqGraph({
			videoElement,
			enabled: false,
			gains: [3, 0, 0, 0, 0, 0],
			sourceNodes,
			state: createEmptyState(),
			createAudioContext,
		});

		expect(createAudioContext).not.toHaveBeenCalled();
		expect(next.audioContext).toBeNull();
		expect(next.sourceNode).toBeNull();
		expect(sourceNodes.has(videoElement)).toBe(false);
	});

	it("constructs AudioContext with latencyHint interactive when enabled", () => {
		const videoElement = {} as HTMLVideoElement;
		const sourceNodes = new WeakMap<
			HTMLVideoElement,
			MediaElementAudioSourceNode
		>();
		const mock = createMockContext();
		const audioContextCtor = vi.fn(() => mock.ctx);
		vi.stubGlobal("AudioContext", audioContextCtor);

		const next = syncVideoEqGraph({
			videoElement,
			enabled: true,
			gains: [4, -2, 0, 0, 0, 0],
			sourceNodes,
			state: createEmptyState(),
		});

		expect(audioContextCtor).toHaveBeenCalledWith({
			latencyHint: "interactive",
		});
		expect(mock.resume).toHaveBeenCalledOnce();
		expect(mock.createMediaElementSource).toHaveBeenCalledWith(videoElement);
		expect(next.connectedMode).toBe(true);
		expect(mock.filters[0]?.gain.value).toBe(4);
		expect(mock.filters[1]?.gain.value).toBe(-2);
	});

	it("updates gains without rewiring connectEqGraph when mode stays unchanged", () => {
		const videoElement = {} as HTMLVideoElement;
		const sourceNodes = new WeakMap<
			HTMLVideoElement,
			MediaElementAudioSourceNode
		>();
		const mock = createMockContext();

		const firstState = syncVideoEqGraph({
			videoElement,
			enabled: true,
			gains: [1, 0, 0, 0, 0, 0],
			sourceNodes,
			state: createEmptyState(),
			createAudioContext: () => mock.ctx,
		});

		expect(mock.source.disconnect).toHaveBeenCalledTimes(1);
		expect(mock.source.connect).toHaveBeenCalledTimes(1);

		const secondState = syncVideoEqGraph({
			videoElement,
			enabled: true,
			gains: [6, -3, 0, 0, 0, 0],
			sourceNodes,
			state: firstState,
		});

		expect(mock.createMediaElementSource).toHaveBeenCalledTimes(1);
		expect(mock.source.disconnect).toHaveBeenCalledTimes(1);
		expect(mock.source.connect).toHaveBeenCalledTimes(1);
		expect(mock.filters[0]?.gain.value).toBe(6);
		expect(mock.filters[1]?.gain.value).toBe(-3);

		const bypassedState = syncVideoEqGraph({
			videoElement,
			enabled: false,
			gains: [6, -3, 0, 0, 0, 0],
			sourceNodes,
			state: secondState,
		});

		expect(mock.source.disconnect).toHaveBeenCalledTimes(2);
		expect(mock.source.connect).toHaveBeenLastCalledWith(mock.destination);
		expect(mock.filters[0]?.gain.value).toBe(0);
		expect(bypassedState.connectedMode).toBe(false);
	});
});

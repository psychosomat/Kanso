import { describe, expect, it, vi } from "vitest";
import { EQ_BANDS } from "./equalizer";
import { applyEqGains, connectEqGraph, ensureEqNodes } from "./player-eq-graph";

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

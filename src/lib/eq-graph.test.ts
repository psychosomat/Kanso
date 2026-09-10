import { describe, expect, it } from "vitest";
import {
	bandX,
	buildEqAreaPath,
	buildEqPath,
	EQ_GRAPH_HEIGHT,
	EQ_GRAPH_MARGIN,
	EQ_GRAPH_WIDTH,
	gainToY,
	yToGain,
} from "./eq-graph";
import { EQ_GAIN_MAX, EQ_GAIN_MIN } from "./equalizer";

describe("bandX", () => {
	it("pins the first and last bands to the graph margins", () => {
		expect(bandX(0, 6)).toBe(EQ_GRAPH_MARGIN);
		expect(bandX(5, 6)).toBe(EQ_GRAPH_WIDTH - EQ_GRAPH_MARGIN);
	});

	it("centers a middle band", () => {
		expect(bandX(1, 3)).toBe(EQ_GRAPH_WIDTH / 2);
	});
});

describe("gainToY / yToGain", () => {
	it("maps gain extremes to the graph edges", () => {
		expect(gainToY(EQ_GAIN_MAX)).toBe(EQ_GRAPH_MARGIN);
		expect(gainToY(EQ_GAIN_MIN)).toBe(EQ_GRAPH_HEIGHT - EQ_GRAPH_MARGIN);
	});

	it("maps silence to the vertical middle", () => {
		expect(gainToY(0)).toBe(EQ_GRAPH_HEIGHT / 2);
	});

	it("round-trips through the inverse mapping", () => {
		for (const gain of [-12, -6.5, 0, 3.3, 12]) {
			expect(yToGain(gainToY(gain))).toBeCloseTo(gain, 1);
		}
	});

	it("clamps pointer positions outside the graph", () => {
		expect(yToGain(-1000)).toBe(EQ_GAIN_MAX);
		expect(yToGain(1000)).toBe(EQ_GAIN_MIN);
	});
});

describe("buildEqPath", () => {
	it("returns an empty path without points", () => {
		expect(buildEqPath([])).toBe("");
	});

	it("draws a smooth curve through the band points", () => {
		const d = buildEqPath([
			{ x: 28, y: 130 },
			{ x: 160, y: 100 },
			{ x: 292, y: 130 },
		]);
		expect(d.startsWith("M 28 130")).toBe(true);
		expect(d).toContain("Q 28 130");
		expect(d.endsWith("T 292 130")).toBe(true);
	});
});

describe("buildEqAreaPath", () => {
	it("returns an empty area without a line path", () => {
		expect(buildEqAreaPath("", [{ x: 28 }])).toBe("");
	});

	it("closes the line path along the graph bottom", () => {
		const bottomY = EQ_GRAPH_HEIGHT - EQ_GRAPH_MARGIN;
		const area = buildEqAreaPath("M 28 130 T 692 130", [{ x: 28 }, { x: 692 }]);
		expect(area).toBe(`M 28 130 T 692 130 L 692 ${bottomY} L 28 ${bottomY} Z`);
	});
});

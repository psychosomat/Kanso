export const EQ_GAIN_MIN = -12;
export const EQ_GAIN_MAX = 12;

export type EqBand = {
	label: string;
	frequency: number;
	type: BiquadFilterType;
	q?: number;
};

export const EQ_BANDS: EqBand[] = [
	{ label: "60 Hz", frequency: 60, type: "lowshelf" },
	{ label: "180 Hz", frequency: 180, type: "peaking", q: 1 },
	{ label: "500 Hz", frequency: 500, type: "peaking", q: 0.9 },
	{ label: "1.5 kHz", frequency: 1500, type: "peaking", q: 0.9 },
	{ label: "4.5 kHz", frequency: 4500, type: "peaking", q: 1 },
	{ label: "12 kHz", frequency: 12000, type: "highshelf" },
];

export const DEFAULT_EQ_GAINS = EQ_BANDS.map(() => 0);

export function clampEqGain(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(EQ_GAIN_MAX, Math.max(EQ_GAIN_MIN, Number(value.toFixed(1))));
}

export function normalizeEqGains(input?: number[]): number[] {
	const safeInput = Array.isArray(input) ? input : [];
	return EQ_BANDS.map((_, index) => clampEqGain(safeInput[index] ?? 0));
}

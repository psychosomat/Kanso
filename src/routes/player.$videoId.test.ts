import { describe, expect, it } from "vitest";
import type { PlayerPreferencesDto } from "@/lib/contracts";
import { buildSpeedPresets, getVolumePercent } from "./player.$videoId";

function prefs(overrides: Partial<PlayerPreferencesDto> = {}): PlayerPreferencesDto {
  return overrides as PlayerPreferencesDto;
}

describe("getVolumePercent", () => {
  it("rounds the stored volume to a percentage", () => {
    expect(getVolumePercent(prefs({ playerVolume: 0.7 }))).toBe(70);
  });

  it("defaults to full volume without preferences", () => {
    expect(getVolumePercent(null)).toBe(100);
    expect(getVolumePercent(prefs())).toBe(100);
  });

  it("reports zero when muted", () => {
    expect(getVolumePercent(prefs({ playerVolume: 0.8, playerMuted: true }))).toBe(0);
  });
});

describe("buildSpeedPresets", () => {
  it("returns sorted, unique, normalized presets including 1x", () => {
    expect(buildSpeedPresets(2.2, 1)).toEqual([1, 2.2]);
  });

  it("uses the default presets without preferences", () => {
    expect(buildSpeedPresets(undefined, undefined)).toEqual([1, 2.2]);
  });

  it("normalizes out-of-range values", () => {
    expect(buildSpeedPresets(9, 0.05)).toEqual([0.2, 1, 4]);
  });
});

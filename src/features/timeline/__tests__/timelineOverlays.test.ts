import { describe, expect, it } from "vitest";
import type { ReactTrackSection } from "../../../components/vyzualz/react/ReactTypes";
import type { TrackIntelligenceAnalysis } from "../../musicIntelligence/types";
import {
  buildTimelineOverlaySource,
  overlayKindVisibleAtScale,
  selectVisibleTimelineOverlays,
} from "../timelineOverlays";

function analysisFixture(): TrackIntelligenceAnalysis {
  return {
    durationMs: 32_000,
    bpm: 120,
    beatGrid: Array.from({ length: 64 }, (_, index) => ({
      timeSec: index * 0.5,
      beatIndex: index,
      barIndex: Math.floor(index / 4),
      isDownbeat: index % 4 === 0,
      confidence: 0.95,
      gridConfidence: 0.95,
      gridSource: "automatic",
    })),
    downbeats: Array.from({ length: 8 }, (_, index) => ({
      timeSec: index * 2,
      beatIndex: index * 4,
      barIndex: index,
      isDownbeat: true,
      confidence: 0.95,
      gridConfidence: 0.95,
      gridSource: "automatic",
    })),
    barMarkers: Array.from({ length: 16 }, (_, index) => ({
      barIndex: index,
      startSec: index * 2,
      endSec: (index + 1) * 2,
      gridSource: "automatic",
      gridConfidence: 0.95,
    })),
    phrases: [{ id: "phrase-1", timeSec: 0, phraseLength: 8, confidence: 0.9 }],
    sections: [
      {
        id: "section-1",
        label: "Intro",
        type: "intro",
        startSec: 0,
        endSec: 16,
        confidence: 0.9,
      },
    ],
  } as TrackIntelligenceAnalysis;
}

const sections: ReactTrackSection[] = [
  {
    id: "manual-section",
    label: "Drop",
    type: "drop",
    startSec: 16,
    endSec: 32,
    source: "manual",
    intensity: 0.9,
  },
];

describe("timeline overlays", () => {
  it("builds beats, bars, musical landmarks, phrases, and resolved sections", () => {
    const source = buildTimelineOverlaySource(analysisFixture(), sections);
    expect(source.authoritative).toBe(true);
    expect(source.markers.some((marker) => marker.kind === "beat")).toBe(true);
    expect(source.markers.some((marker) => marker.kind === "downbeat")).toBe(
      true,
    );
    expect(source.markers.some((marker) => marker.kind === "bar")).toBe(true);
    expect(source.markers.some((marker) => marker.kind === "four_bar")).toBe(
      true,
    );
    expect(source.markers.some((marker) => marker.kind === "eight_bar")).toBe(
      true,
    );
    expect(source.markers.some((marker) => marker.kind === "sixteen_bar")).toBe(
      true,
    );
    expect(source.markers.some((marker) => marker.kind === "phrase")).toBe(
      true,
    );
    expect(source.ranges.map((range) => range.id)).toEqual(["manual-section"]);
  });

  it("uses sections as a readable fallback when Track Map analysis is missing", () => {
    const source = buildTimelineOverlaySource(null, sections);
    expect(source.authoritative).toBe(false);
    expect(source.markers).toEqual([]);
    expect(source.ranges).toEqual([
      expect.objectContaining({
        id: "manual-section",
        label: "Drop",
        startSec: 16,
        endSec: 32,
      }),
    ]);
  });

  it("applies level-of-detail rules and keeps marker work bounded", () => {
    expect(overlayKindVisibleAtScale("section", 1)).toBe(true);
    expect(overlayKindVisibleAtScale("beat", 40)).toBe(false);
    expect(overlayKindVisibleAtScale("beat", 80)).toBe(true);

    const source = buildTimelineOverlaySource(analysisFixture(), sections);
    const zoomedOut = selectVisibleTimelineOverlays(
      source,
      { startSec: 0, endSec: 32 },
      320,
    );
    expect(zoomedOut.markers.some((marker) => marker.kind === "beat")).toBe(
      false,
    );
    expect(zoomedOut.ranges).toHaveLength(1);

    const zoomedIn = selectVisibleTimelineOverlays(
      source,
      { startSec: 0, endSec: 4 },
      800,
      undefined,
      10,
    );
    expect(zoomedIn.markers.length).toBeLessThanOrEqual(10);
    expect(zoomedIn.markers.some((marker) => marker.kind === "beat")).toBe(
      true,
    );
  });
});

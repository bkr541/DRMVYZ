import type { TrackAnalysis, TrackSection, BeatMarker } from './types'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'

const SECTION_TEMPLATE: Array<{ type: ReactSectionType; pct: number; label: string; intensity: number }> = [
  { type: 'intro',     pct: 0.10, label: 'Intro',     intensity: 0.35 },
  { type: 'verse',     pct: 0.20, label: 'Verse 1',   intensity: 0.55 },
  { type: 'build',     pct: 0.10, label: 'Build',     intensity: 0.72 },
  { type: 'drop',      pct: 0.15, label: 'Drop 1',    intensity: 1.0  },
  { type: 'breakdown', pct: 0.10, label: 'Breakdown', intensity: 0.45 },
  { type: 'verse',     pct: 0.10, label: 'Verse 2',   intensity: 0.55 },
  { type: 'build',     pct: 0.08, label: 'Build 2',   intensity: 0.8  },
  { type: 'drop',      pct: 0.12, label: 'Drop 2',    intensity: 1.0  },
  { type: 'outro',     pct: 0.05, label: 'Outro',     intensity: 0.28 },
]

/**
 * Generates a mock TrackAnalysis from a track duration.
 * Useful for prototyping section automation without a real analysis backend.
 */
export function generateMockTrackAnalysis(durationMs: number, bpm = 128): TrackAnalysis {
  const sections: TrackSection[] = []
  let cursor = 0

  for (let i = 0; i < SECTION_TEMPLATE.length; i++) {
    const tmpl = SECTION_TEMPLATE[i]
    const startMs = cursor
    const endMs   = i === SECTION_TEMPLATE.length - 1
      ? durationMs
      : Math.round(cursor + durationMs * tmpl.pct)
    sections.push({
      id:        `mock-sec-${i}`,
      label:     tmpl.label,
      type:      tmpl.type,
      startMs,
      endMs,
      intensity: tmpl.intensity,
    })
    cursor = endMs
  }

  // Generate approximate beat markers at the given BPM
  const beatPeriodMs = 60000 / bpm
  const beatMarkers: BeatMarker[] = []
  for (let t = 0; t < durationMs; t += beatPeriodMs) {
    beatMarkers.push({ timeMs: Math.round(t), confidence: 0.85 })
  }

  return {
    durationMs,
    bpm,
    timeSignature: 4,
    sections,
    beatMarkers,
    analysisVersion: 'mock-1.0',
  }
}

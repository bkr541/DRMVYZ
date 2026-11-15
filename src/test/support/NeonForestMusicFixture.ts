/** Test-only upstream publications; production consumes the existing shared bus. */
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from './NightshiftMusicFixture'
export type NeonForestFixtureOptions = NightshiftFixtureOptions & { analysisRevision?: string; timelineRevision?: string; bpm?: number }
export function neonForestMusicFixture(options: NeonForestFixtureOptions) {
  const frame = nightshiftMusicFixture({ trackId: 'neon-forest-host-timing-fixture', ...options })
  return { ...frame, sourceId: 'neon-forest-deterministic-fixture',
    rhythm: { ...frame.rhythm, bpm: options.bpm ?? 120 },
    analysisRevision: options.analysisRevision ?? 'neon-forest-audio-v1', timelineRevision: options.timelineRevision ?? 'neon-forest-timeline-v1' }
}

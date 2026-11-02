/** Test-only upstream publications; production consumes the existing shared bus. */
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from './NightshiftMusicFixture'
export type PsyloFixtureOptions = NightshiftFixtureOptions & { analysisRevision?: string; timelineRevision?: string; bpm?: number }
export function psyloMusicFixture(options: PsyloFixtureOptions) {
  const frame = nightshiftMusicFixture({ trackId: 'psylo-host-timing-fixture', ...options })
  return { ...frame, sourceId: 'psylo-deterministic-fixture',
    rhythm: { ...frame.rhythm, bpm: options.bpm ?? 120 },
    analysisRevision: options.analysisRevision ?? 'psylo-audio-v1', timelineRevision: options.timelineRevision ?? 'psylo-timeline-v1' }
}

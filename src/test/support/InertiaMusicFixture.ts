import { nightshiftMusicFixture, type NightshiftFixtureOptions } from './NightshiftMusicFixture'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'

export interface InertiaFixtureOptions extends Partial<Omit<NightshiftFixtureOptions, 'timeSec' | 'frameId'>> {
  holdEvent?: boolean
  revision?: string
  timeline?: string
  transient?: boolean
  sectionStart?: number
}

/** Test upstream publications only; all analysis/meaning in production stays shared. */
export function inertiaMusicFixture(options: InertiaFixtureOptions, timeSec: number, frameId: number, trackId: string): MusicIntelligenceFrame {
  const result = nightshiftMusicFixture({ ...options, timeSec, frameId, trackId: options.trackId ?? trackId, advanceBeatGrid: true })
  result.sourceId = 'inertia-deterministic-source'
  result.analysisRevision = options.revision ?? 'inertia-fixture-analysis-v1'
  result.timelineRevision = options.timeline ?? 'inertia-fixture-timeline-v1'
  if (options.sectionStart != null) result.section = { ...result.section, startSec: options.sectionStart, endSec: options.sectionStart + 1000 }
  const hit = Math.abs(timeSec - (options.eventTime ?? timeSec)) < 0.0001
  const held = options.holdEvent && timeSec >= (options.eventTime ?? 0) - 0.0001
  if (held) {
    result.rhythm.beatHit = ['beat', 'downbeat', 'bar'].includes(options.event ?? '')
    result.rhythm.downbeatHit = options.event === 'downbeat' || options.event === 'bar'
    result.rhythm.kickHit = options.event === 'kick'; result.rhythm.kickStrength = result.rhythm.kickHit ? 1 : 0
    result.rhythm.snareHit = options.event === 'snare'; result.rhythm.snareStrength = result.rhythm.snareHit ? 1 : 0
    result.rhythm.phrase4Hit = options.event === 'bar'
  }
  if (options.transient && (hit || held)) {
    result.rhythm.transient = 1
    result.rhythm.transientConfidence = 0.95
  }
  return result
}

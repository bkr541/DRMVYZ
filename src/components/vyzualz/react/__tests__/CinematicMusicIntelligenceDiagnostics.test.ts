import { describe, expect, it } from 'vitest'
import type { MusicIntelligenceCapabilities } from '../../../../features/musicIntelligence/types'
import type { CinematicAudioRoute, CinematicAudioSource } from '../CinematicWorldConfig'
import {
  diagnoseCinematicMusicIntelligenceInputs,
  isCinematicAudioRouteActive,
} from '../CinematicMusicIntelligenceDiagnostics'

const ALL_AVAILABLE: MusicIntelligenceCapabilities = {
  liveBands: true,
  rhythmEvents: true,
  beatGrid: true,
  sections: true,
  trackEnergyCurve: true,
  stemCurves: true,
  lyrics: true,
}

function capabilities(patch: Partial<MusicIntelligenceCapabilities> = {}): MusicIntelligenceCapabilities {
  return { ...ALL_AVAILABLE, ...patch }
}

function route(source: CinematicAudioSource, patch: Partial<CinematicAudioRoute> = {}): CinematicAudioRoute {
  return {
    id: `route-${source}`,
    enabled: true,
    source,
    target: 'bloom',
    amount: 1,
    attackMs: 40,
    releaseMs: 220,
    ...patch,
  }
}

const TARGETS = ['bloom', 'impact'] as const

describe('Cinematic Music Intelligence diagnostics', () => {
  it('returns no warning when every active route is available', () => {
    const result = diagnoseCinematicMusicIntelligenceInputs(
      [route('subBass'), route('beat'), route('trackEnergy')],
      true,
      TARGETS,
      ALL_AVAILABLE,
    )

    expect(result.activeRouteCount).toBe(3)
    expect(result.unavailableRoutes).toEqual([])
    expect(result.reasons).toEqual([])
  })

  it('warns only for missing active routes', () => {
    const result = diagnoseCinematicMusicIntelligenceInputs(
      [
        route('sectionProgress'),
        route('trackEnergy', { enabled: false }),
        route('vocalEnergy', { amount: 0 }),
        route('subBass'),
      ],
      true,
      TARGETS,
      capabilities({ sections: false }),
    )

    expect(result.activeRouteCount).toBe(2)
    expect(result.unavailableRoutes.map(item => item.source)).toEqual(['sectionProgress'])
    expect(result.reasons.map(reason => reason.code)).toEqual(['sections'])
  })

  it('does not warn for unavailable but unused sources', () => {
    const result = diagnoseCinematicMusicIntelligenceInputs(
      [route('bass')],
      true,
      TARGETS,
      capabilities({
        beatGrid: false,
        sections: false,
        trackEnergyCurve: false,
        stemCurves: false,
        lyrics: false,
      }),
    )

    expect(result.activeRouteCount).toBe(1)
    expect(result.unavailableRoutes).toEqual([])
  })

  it('reports an actionable missing-sections reason', () => {
    const result = diagnoseCinematicMusicIntelligenceInputs(
      [route('dropEntry')],
      true,
      TARGETS,
      capabilities({ sections: false }),
    )

    expect(result.unavailableRoutes).toHaveLength(1)
    expect(result.unavailableRoutes[0].reasons).toEqual([
      expect.objectContaining({
        code: 'sections',
        message: 'Track sections unavailable. Add manual sections or complete track analysis.',
      }),
    ])
  })

  it('distinguishes missing stem analysis and timed lyrics for vocal energy', () => {
    const result = diagnoseCinematicMusicIntelligenceInputs(
      [route('vocalEnergy')],
      true,
      TARGETS,
      capabilities({ stemCurves: false, lyrics: false }),
    )

    expect(result.unavailableRoutes[0].reasons.map(reason => reason.code)).toEqual([
      'stemCurves',
      'lyrics',
    ])
    expect(result.unavailableRoutes[0].reasons.map(reason => reason.message)).toEqual([
      'Stem analysis unavailable.',
      'Timed lyrics unavailable.',
    ])
  })

  it('treats disabled mappings, zero-depth routes, and unsupported targets as inactive', () => {
    expect(isCinematicAudioRouteActive(route('subBass'), false, TARGETS)).toBe(false)
    expect(isCinematicAudioRouteActive(route('subBass', { enabled: false }), true, TARGETS)).toBe(false)
    expect(isCinematicAudioRouteActive(route('subBass', { amount: 0 }), true, TARGETS)).toBe(false)
    expect(isCinematicAudioRouteActive(route('subBass', { target: 'depth' }), true, TARGETS)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_WORLD_MODES,
  createDefaultCinematicAudioRoutes,
  type CinematicAudioRoute,
  type CinematicAudioSource,
  type CinematicAudioTarget,
} from '../../../CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS } from '../../../ReactTypes'
import { DEFAULT_MI_FRAME } from '../../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../../features/musicIntelligence/types'
import { cinematicWorldDefinitions } from '../worlds'
import {
  CinematicAudioFrameNormalizer,
  CinematicModulationEngine,
  canonicalCinematicAudioTarget,
  validateCinematicMappings,
  type CinematicAudioFrameInput,
  type CinematicNormalizedAudioFrame,
} from '../CinematicAudioModulation'

const ALL_CAPABILITIES = {
  musicIntelligence: true,
  broadBands: true,
  detailedBands: true,
  transientEvents: true,
  kickEvents: true,
  snareEvents: true,
  beatTiming: true,
  downbeatTiming: true,
  barTiming: true,
  phraseTiming: true,
  sectionTiming: true,
  buildProgress: true,
  dropState: true,
  trackEnergyCurve: true,
  vocalEnergy: true,
} as const

function values(overrides: Partial<Record<CinematicAudioSource, number>> = {}): Record<CinematicAudioSource, number> {
  return Object.assign(
    Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as Record<CinematicAudioSource, number>,
    overrides,
  )
}

function audioFrame(
  valueOverrides: Partial<Record<CinematicAudioSource, number>> = {},
  capabilityOverrides: Partial<CinematicNormalizedAudioFrame['capabilities']> = {},
): CinematicNormalizedAudioFrame {
  const sourceValues = values(valueOverrides)
  return {
    frameId: 1,
    sourceId: 'source-a',
    trackId: 'track-a',
    transportTimeSec: 1,
    isPlaying: true,
    values: sourceValues,
    events: Object.fromEntries(
      CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, sourceValues[source] > 0]),
    ) as CinematicNormalizedAudioFrame['events'],
    timing: {
      bpm: 120,
      beatPhase: sourceValues.beatPhase,
      beatIndex: 4,
      beatInBar: 0,
      barIndex: 1,
      barPosition: sourceValues.barPosition,
      phraseProgress: sourceValues.phraseProgress,
    },
    section: {
      type: 'verse',
      label: 'Verse',
      startSec: 0,
      endSec: 16,
      progress: 0.5,
      intensity: 0.6,
      confidence: 0.9,
    },
    capabilities: { ...ALL_CAPABILITIES, ...capabilityOverrides },
    resetReasons: [],
  }
}

function route(
  source: CinematicAudioSource,
  target: CinematicAudioTarget,
  overrides: Partial<CinematicAudioRoute> = {},
): CinematicAudioRoute {
  return {
    id: `${source}-${target}`,
    enabled: true,
    source,
    target,
    amount: 1,
    attackMs: 0,
    releaseMs: 0,
    ...overrides,
  }
}

function miFrame(options: {
  frameId?: number
  trackId?: string
  beatIndex?: number
  beatHit?: boolean
  kickHit?: boolean
  sectionType?: MusicIntelligenceFrame['section']['type']
} = {}): MusicIntelligenceFrame {
  const frameId = options.frameId ?? 1
  const beatIndex = options.beatIndex ?? 0
  return {
    ...DEFAULT_MI_FRAME,
    frameId,
    sourceId: `source-${options.trackId ?? 'a'}`,
    trackId: options.trackId ?? 'track-a',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.4,
      bass: 0.5,
      lowMid: 0.35,
      mid: 0.45,
      high: 0.3,
      air: 0.25,
      normalizedSub: 0.4,
      normalizedBass: 0.5,
      normalizedLowMid: 0.35,
      normalizedMid: 0.45,
      normalizedHigh: 0.3,
      normalizedAir: 0.25,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatPhase: 0,
      beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: options.beatHit ?? false,
      downbeatHit: Boolean(options.beatHit && beatIndex % 4 === 0),
      kickHit: options.kickHit ?? false,
      kickStrength: options.kickHit ? 0.9 : 0,
      transient: options.kickHit ? 0.9 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      shortTerm: 0.55,
      buildProgress: 0.4,
      trackCurve: 0.6,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: options.sectionType ?? 'verse',
      label: options.sectionType ?? 'verse',
      startSec: 0,
      endSec: 16,
      progress: 0.5,
      intensity: 0.6,
      confidence: 0.9,
      source: 'analysis',
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
    },
    raw: {
      freqData: new Uint8Array(16),
      timeDomainData: new Uint8Array(16),
    },
  }
}

function normalizerInput(
  mi: MusicIntelligenceFrame | null,
  overrides: Partial<CinematicAudioFrameInput> = {},
): CinematicAudioFrameInput {
  return {
    frameIndex: mi?.frameId ?? 1,
    deltaTimeSec: 1 / 60,
    transportTimeSec: (mi?.frameId ?? 1) / 60,
    isPlaying: true,
    beatHit: mi?.rhythm.beatHit ?? false,
    beatPhase: mi?.rhythm.beatPhase ?? 0,
    bpm: mi?.rhythm.bpm ?? 120,
    broadBands: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.5 },
    musicIntelligence: mi,
    section: {
      type: mi?.section.type ?? null,
      label: mi?.section.label ?? '',
      startSec: mi?.section.startSec ?? -1,
      endSec: mi?.section.endSec ?? -1,
      progress: mi?.section.progress ?? -1,
      intensity: mi?.section.intensity,
      confidence: mi?.section.confidence,
    },
    sectionChanged: false,
    worldId: 'eventHorizon',
    presetId: 'preset-a',
    ...overrides,
  }
}

describe('CinematicModulationEngine envelopes', () => {
  it('uses separate attack and release time constants', () => {
    const engine = new CinematicModulationEngine()
    const routes = [route('bass', 'depth', { attackMs: 100, releaseMs: 200 })]
    const targets: CinematicAudioTarget[] = ['depth']

    const attack = engine.update(audioFrame({ bass: 1 }), routes, targets, 0.05, 0, 1).values.depth
    const release = engine.update(audioFrame({ bass: 0 }), routes, targets, 0.05, 0, 1).values.depth

    expect(attack).toBeCloseTo(1 - Math.exp(-0.5), 5)
    expect(release).toBeLessThan(attack)
    expect(release).toBeGreaterThan(0)
  })

  it('applies route smoothing after the attack/release envelope', () => {
    const engine = new CinematicModulationEngine()
    const routes = [route('bass', 'depth', { smoothingMs: 100 })]
    const targets: CinematicAudioTarget[] = ['depth']

    engine.update(audioFrame({ bass: 0 }), routes, targets, 0.05, 0, 1)
    const result = engine.update(audioFrame({ bass: 1 }), routes, targets, 0.05, 0, 1).values.depth

    expect(result).toBeCloseTo(1 - Math.exp(-0.5), 5)
  })

  it('gates at threshold, applies response curves, and clamps output', () => {
    const engine = new CinematicModulationEngine()
    const targets: CinematicAudioTarget[] = ['depth']
    const routes = [route('bass', 'depth', {
      threshold: 0.25,
      responseCurve: 'smoothstep',
      clampMax: 0.2,
    })]

    expect(engine.update(audioFrame({ bass: 0.25 }), routes, targets, 1 / 60, 0, 1).values.depth).toBe(0)
    engine.reset()
    expect(engine.update(audioFrame({ bass: 0.5 }), routes, targets, 1 / 60, 0, 1).values.depth).toBeCloseTo(0.2, 6)
  })

  it('bounds accumulated positive and negative routes', () => {
    const targets: CinematicAudioTarget[] = ['depth']
    const positive = new CinematicModulationEngine().update(
      audioFrame({ bass: 1, mid: 1 }),
      [route('bass', 'depth', { id: 'a', amount: 2 }), route('mid', 'depth', { id: 'b', amount: 2 })],
      targets,
      1 / 60,
      0,
      1,
    ).values.depth
    const negative = new CinematicModulationEngine().update(
      audioFrame({ bass: 1 }),
      [route('bass', 'depth', { amount: -2 })],
      targets,
      1 / 60,
      0,
      1,
    ).values.depth

    expect(positive).toBe(1)
    expect(negative).toBe(-1)
  })

  it('returns zero for unavailable sources even with inversion and a positive clamp minimum', () => {
    const engine = new CinematicModulationEngine()
    const result = engine.update(
      audioFrame({ subBass: 0.9 }, { detailedBands: false }),
      [route('subBass', 'depth', { invert: true, clampMin: 0.4 })],
      ['depth'],
      1 / 60,
      0,
      1,
    )
    expect(result.values.depth).toBe(0)
  })

  it('uses deterministic seeded randomization', () => {
    const routes = [route('bass', 'depth', { randomizationAmount: 0.5 })]
    const targets: CinematicAudioTarget[] = ['depth']
    const first = new CinematicModulationEngine().update(audioFrame({ bass: 0.6 }), routes, targets, 1 / 60, 0, 42).values.depth
    const second = new CinematicModulationEngine().update(audioFrame({ bass: 0.6 }), routes, targets, 1 / 60, 0, 42).values.depth
    const different = new CinematicModulationEngine().update(audioFrame({ bass: 0.6 }), routes, targets, 1 / 60, 0, 43).values.depth

    expect(first).toBe(second)
    expect(first).not.toBe(different)
  })
})

describe('CinematicAudioFrameNormalizer events and capabilities', () => {
  it('deduplicates beat and kick events across adjacent render frames', () => {
    const normalizer = new CinematicAudioFrameNormalizer()
    const first = normalizer.update(normalizerInput(miFrame({ frameId: 1, beatIndex: 4, beatHit: true, kickHit: true })))
    const duplicate = normalizer.update(normalizerInput(miFrame({ frameId: 2, beatIndex: 4, beatHit: true, kickHit: true })))
    normalizer.update(normalizerInput(miFrame({ frameId: 3, beatIndex: 4, beatHit: false, kickHit: false })))
    const next = normalizer.update(normalizerInput(miFrame({ frameId: 4, beatIndex: 5, beatHit: true, kickHit: true })))

    expect(first.events.beat).toBe(false)
    expect(first.events.kick).toBe(false)
    expect(duplicate.events.beat).toBe(false)
    expect(duplicate.events.kick).toBe(false)
    expect(next.events.beat).toBe(true)
    expect(next.events.kick).toBe(true)
  })

  it('resets and suppresses events on seek, then accepts the next new event', () => {
    const normalizer = new CinematicAudioFrameNormalizer()
    normalizer.update(normalizerInput(miFrame({ frameId: 1, beatIndex: 1 })))
    normalizer.update(normalizerInput(miFrame({ frameId: 2, beatIndex: 2, beatHit: true }), { transportTimeSec: 2 / 60 }))
    const seek = normalizer.update(normalizerInput(miFrame({ frameId: 3, beatIndex: 30, beatHit: true }), { transportTimeSec: 20 }))
    normalizer.update(normalizerInput(miFrame({ frameId: 4, beatIndex: 30 }), { transportTimeSec: 20 + 1 / 60 }))
    const after = normalizer.update(normalizerInput(miFrame({ frameId: 5, beatIndex: 31, beatHit: true }), { transportTimeSec: 20 + 2 / 60 }))

    expect(seek.resetReasons).toContain('seek')
    expect(seek.events.beat).toBe(false)
    expect(after.events.beat).toBe(true)
  })

  it('resets event state when the track identity changes', () => {
    const normalizer = new CinematicAudioFrameNormalizer()
    normalizer.update(normalizerInput(miFrame({ frameId: 1, trackId: 'a' })))
    const replacement = normalizer.update(normalizerInput(
      miFrame({ frameId: 2, trackId: 'b', beatIndex: 8, beatHit: true }),
      { transportTimeSec: 2 / 60 },
    ))

    expect(replacement.resetReasons).toContain('trackReplacement')
    expect(replacement.events.beat).toBe(false)
  })

  it('does not claim detailed, grid, section, or vocal precision when MI is unavailable', () => {
    const frame = new CinematicAudioFrameNormalizer().update(normalizerInput(null, {
      transportTimeSec: 0,
      section: { type: null, startSec: -1, endSec: -1, progress: -1 },
    }))

    expect(frame.capabilities.broadBands).toBe(true)
    expect(frame.capabilities.musicIntelligence).toBe(false)
    expect(frame.capabilities.detailedBands).toBe(false)
    expect(frame.capabilities.downbeatTiming).toBe(false)
    expect(frame.capabilities.phraseTiming).toBe(false)
    expect(frame.capabilities.sectionTiming).toBe(false)
    expect(frame.capabilities.vocalEnergy).toBe(false)
    expect(frame.values.subBass).toBe(0)
    expect(frame.values.vocalEnergy).toBe(0)
    expect(frame.timing.beatIndex).toBe(-1)
  })
})

describe('additional modulation behavior and lifecycle resets', () => {
  it('applies response curves and section-based scaling independently', () => {
    const engine = new CinematicModulationEngine()
    const frame = audioFrame({ bass: 0.5 })
    frame.section.type = 'drop'
    const result = engine.update(
      frame,
      [route('bass', 'depth', { responseCurve: 'easeIn', sectionScale: { drop: 0.5 } })],
      ['depth'],
      1 / 60,
      0,
      1,
    )

    expect(result.values.depth).toBeCloseTo(0.125, 6)
  })

  it('holds and decays a discrete event without retriggering it', () => {
    const engine = new CinematicModulationEngine()
    const routes = [route('beat', 'impact', { beatHoldMs: 50, decayMs: 100 })]
    const targets: CinematicAudioTarget[] = ['impact']
    const event = audioFrame({ beat: 1 })
    const quiet = audioFrame({ beat: 0 })

    const fired = engine.update(event, routes, targets, 0, 0, 1).values.impact
    const held = engine.update(quiet, routes, targets, 0.04, 0, 1).values.impact
    const decayed = engine.update(quiet, routes, targets, 0.11, 0, 1).values.impact

    expect(fired).toBe(1)
    expect(held).toBe(1)
    expect(decayed).toBeGreaterThan(0)
    expect(decayed).toBeLessThan(1)
  })

  it('clears envelope state when a seek or track replacement is reported', () => {
    const routes = [route('bass', 'depth', { attackMs: 200, releaseMs: 500 })]
    const targets: CinematicAudioTarget[] = ['depth']
    for (const reason of ['seek', 'trackReplacement'] as const) {
      const engine = new CinematicModulationEngine()
      expect(engine.update(audioFrame({ bass: 1 }), routes, targets, 0.05, 0, 1).values.depth).toBeGreaterThan(0)
      const resetFrame = audioFrame({ bass: 0 })
      resetFrame.resetReasons = [reason]
      expect(engine.update(resetFrame, routes, targets, 0.05, 0, 1).values.depth).toBe(0)
    }
  })

  it('suppresses discrete events on transport, world, and preset replacement frames', () => {
    const cases: Array<{
      expected: 'transportRestart' | 'worldReplacement' | 'presetReplacement'
      first: Partial<CinematicAudioFrameInput>
      second: Partial<CinematicAudioFrameInput>
    }> = [
      { expected: 'transportRestart', first: { isPlaying: false }, second: { isPlaying: true } },
      { expected: 'worldReplacement', first: { worldId: 'eventHorizon' }, second: { worldId: 'stormGateway' } },
      { expected: 'presetReplacement', first: { presetId: 'a' }, second: { presetId: 'b' } },
    ]

    for (const item of cases) {
      const normalizer = new CinematicAudioFrameNormalizer()
      normalizer.update(normalizerInput(miFrame({ frameId: 1, beatIndex: 1 }), item.first))
      const changed = normalizer.update(normalizerInput(
        miFrame({ frameId: 2, beatIndex: 2, beatHit: true }),
        { transportTimeSec: 2 / 60, ...item.second },
      ))
      expect(changed.resetReasons).toContain(item.expected)
      expect(changed.events.beat).toBe(false)
    }
  })
})

describe('cinematic mapping validation and world defaults', () => {
  it('rejects duplicate, unknown, and unsupported mappings', () => {
    const routes = [
      route('bass', 'depth', { id: 'duplicate' }),
      route('mid', 'bloom', { id: 'duplicate' }),
      route('bass', 'lightning', { id: 'unsupported' }),
      route('bass', 'depth', { id: 'unknown-source', source: 'not-real' as CinematicAudioSource }),
      route('bass', 'depth', { id: 'unknown-target', target: 'not-real' as CinematicAudioTarget }),
    ]
    const codes = validateCinematicMappings(routes, ['depth', 'bloom']).map(issue => issue.code)

    expect(codes).toContain('duplicateRouteId')
    expect(codes).toContain('unsupportedTarget')
    expect(codes).toContain('unknownSource')
    expect(codes).toContain('unknownTarget')
  })

  it('keeps every shipped cinematic preset mapping compatible with its world targets', () => {
    const definitions = new Map(cinematicWorldDefinitions.map(definition => [definition.id, definition]))
    const legacyTargets: CinematicAudioTarget[] = [
      'portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact',
    ]

    const invalid: string[] = []
    for (const preset of DEFAULT_REACT_PRESETS) {
      if (preset.engine !== 'cinematicPortal' || !preset.cinematicConfig) continue
      const mode = preset.cinematicConfig.worldMode
      if (mode === 'mediaPortal') continue
      const targets = mode === 'legacyPortal'
        ? legacyTargets
        : definitions.get(mode)?.capabilities.modulationTargets
      if (!targets) {
        invalid.push(`${preset.id}:${mode}:missing-world`)
        continue
      }
      const issues = validateCinematicMappings(preset.cinematicConfig.audioMapping.routes, targets)
      invalid.push(...issues.map(issue => `${preset.id}:${mode}:${issue.routeId}:${issue.code}`))
    }
    expect(invalid).toEqual([])
  })

  it('provides valid supported default mappings for every implemented world', () => {
    const definitions = new Map(cinematicWorldDefinitions.map(definition => [definition.id, definition]))
    const legacyTargets: CinematicAudioTarget[] = [
      'portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact',
    ]
    const implemented = CINEMATIC_WORLD_MODES.filter(mode => mode !== 'mediaPortal')

    for (const mode of implemented) {
      const routes = createDefaultCinematicAudioRoutes(mode)
      const targets = mode === 'legacyPortal'
        ? legacyTargets
        : definitions.get(mode)!.capabilities.modulationTargets
      expect(routes.length, mode).toBeGreaterThan(0)
      expect(validateCinematicMappings(routes, targets), mode).toEqual([])
      for (const item of routes) {
        expect(targets.map(canonicalCinematicAudioTarget), `${mode}:${item.id}`)
          .toContain(canonicalCinematicAudioTarget(item.target))
      }
    }
  })
})

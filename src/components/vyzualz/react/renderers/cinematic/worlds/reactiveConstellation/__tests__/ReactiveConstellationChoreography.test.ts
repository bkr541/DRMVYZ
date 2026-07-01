import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_AUDIO_TARGETS,
  createDefaultCinematicAudioRoutes,
  type CinematicAudioSource,
  type CinematicAudioTarget,
} from '../../../../../CinematicWorldConfig'
import {
  REACTIVE_CONSTELLATION_BOUNDS,
  REACTIVE_CONSTELLATION_DEFAULTS,
} from '../../../../../CinematicWorldSettings'
import {
  CinematicModulationEngine,
  type CinematicModulationSnapshot,
  type CinematicNormalizedAudioFrame,
} from '../../../CinematicAudioModulation'
import {
  REACTIVE_CONSTELLATION_COMPOSITION_ORDER,
  resolveReactiveConstellationChoreography,
  resolveReactiveConstellationComposition,
  resolveReactiveConstellationMacroOffsets,
  resolveReactiveConstellationSection,
} from '../ReactiveConstellationChoreography'

const ALL_CAPABILITIES: CinematicNormalizedAudioFrame['capabilities'] = {
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
}

function sourceValues(overrides: Partial<Record<CinematicAudioSource, number>> = {}): Record<CinematicAudioSource, number> {
  return Object.assign(
    Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as Record<CinematicAudioSource, number>,
    overrides,
  )
}

function audioFrame(options: {
  section?: CinematicNormalizedAudioFrame['section']['type']
  progress?: number
  time?: number
  values?: Partial<Record<CinematicAudioSource, number>>
  capabilities?: Partial<CinematicNormalizedAudioFrame['capabilities']>
  events?: Partial<CinematicNormalizedAudioFrame['events']>
  frameId?: number
} = {}): CinematicNormalizedAudioFrame {
  const values = sourceValues(options.values)
  return {
    frameId: options.frameId ?? 1,
    sourceId: 'source-a',
    trackId: 'track-a',
    transportTimeSec: options.time ?? 32,
    isPlaying: true,
    values,
    events: {
      ...Object.fromEntries(
        CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, values[source] > 0]),
      ) as CinematicNormalizedAudioFrame['events'],
      ...options.events,
    },
    timing: {
      bpm: 120,
      beatPhase: values.beatPhase,
      beatIndex: 64,
      beatInBar: 0,
      barIndex: 16,
      barPosition: values.barPosition,
      phraseProgress: values.phraseProgress,
    },
    section: {
      type: options.section ?? 'verse',
      label: options.section ?? 'verse',
      startSec: 16,
      endSec: 48,
      progress: options.progress ?? 0.5,
      intensity: 0.6,
      confidence: 0.9,
      source: 'analysis',
    },
    capabilities: { ...ALL_CAPABILITIES, ...options.capabilities },
    resetReasons: [],
  }
}

function targetValues(overrides: Partial<Record<CinematicAudioTarget, number>> = {}): Record<CinematicAudioTarget, number> {
  return Object.assign(
    Object.fromEntries(CINEMATIC_AUDIO_TARGETS.map(target => [target, 0])) as Record<CinematicAudioTarget, number>,
    overrides,
  )
}

function modulation(overrides: Partial<Record<CinematicAudioTarget, number>> = {}): CinematicModulationSnapshot {
  return { values: targetValues(overrides), issues: [], planKey: 'test' }
}

describe('Reactive Constellation musical choreography', () => {
  it('uses analyzed sections when available and a bounded inferred fallback otherwise', () => {
    expect(resolveReactiveConstellationSection(audioFrame({ section: 'bridge' }))).toBe('bridge')

    const inferred = audioFrame({
      section: null,
      time: 48,
      values: { buildProgress: 0.9, overallEnergy: 0.7 },
      capabilities: { sectionTiming: false },
    })
    expect(resolveReactiveConstellationSection(inferred)).toBe('preDrop')
    expect(Object.values(resolveReactiveConstellationChoreography(inferred)).every(value => (
      value == null || Number.isFinite(value)
    ))).toBe(true)
  })

  it('creates distinct intro, build, pre-drop, drop, breakdown, and outro poses', () => {
    const intro = resolveReactiveConstellationChoreography(audioFrame({ section: 'intro' }))
    const earlyBuild = resolveReactiveConstellationChoreography(audioFrame({ section: 'build', progress: 0.1, values: { buildProgress: 0.1 } }))
    const lateBuild = resolveReactiveConstellationChoreography(audioFrame({ section: 'build', progress: 0.9, values: { buildProgress: 0.9 } }))
    const preDrop = resolveReactiveConstellationChoreography(audioFrame({ section: 'preDrop', progress: 0.8 }))
    const drop = resolveReactiveConstellationChoreography(audioFrame({ section: 'drop' }))
    const breakdown = resolveReactiveConstellationChoreography(audioFrame({ section: 'breakdown' }))
    const outro = resolveReactiveConstellationChoreography(audioFrame({ section: 'outro', progress: 1 }))

    expect(intro.edgeBrightness).toBeLessThan(0)
    expect(lateBuild.networkSpread!).toBeGreaterThan(earlyBuild.networkSpread!)
    expect(lateBuild.trailLength!).toBeGreaterThan(earlyBuild.trailLength!)
    expect(preDrop.collapseForce).toBeGreaterThan(0.5)
    expect(drop.edgeBrightness).toBeGreaterThan(0.8)
    expect(drop.networkSpread).toBeGreaterThan(0)
    expect(breakdown.motionScale).toBeLessThan(0)
    expect(outro.edgeBrightness).toBeLessThan(breakdown.edgeBrightness!)
  })


  it('compresses the crimson launch target through the build without increasing random motion', () => {
    const settings = {
      ...REACTIVE_CONSTELLATION_DEFAULTS,
      choreographyProfile: 'crimsonLaunch' as const,
      expansionTarget: 1.08,
      collapseAmount: 0,
    }
    const early = resolveReactiveConstellationComposition({
      settings,
      audio: audioFrame({ section: 'build', progress: 0.12, values: { buildProgress: 0.12 } }),
      modulation: modulation(),
    }).values
    const late = resolveReactiveConstellationComposition({
      settings,
      audio: audioFrame({ section: 'build', progress: 0.92, values: { buildProgress: 0.92 } }),
      modulation: modulation(),
    }).values

    expect(late.expansionTarget).toBeLessThan(early.expansionTarget)
    expect(late.edgeBrightness).toBeGreaterThan(early.edgeBrightness)
    expect(late.edgeWidth).toBeGreaterThan(early.edgeWidth)
    expect(late.trailLength).toBeGreaterThan(early.trailLength)
    expect(late.motionScale).toBeLessThanOrEqual(early.motionScale)
    expect(late.collapseForce).toBe(0)
  })

  it('releases the crimson launch target on the drop without a collapse-versus-burst tug-of-war', () => {
    const settings = {
      ...REACTIVE_CONSTELLATION_DEFAULTS,
      choreographyProfile: 'crimsonLaunch' as const,
      expansionTarget: 1.08,
      collapseAmount: 0,
      macroImpact: 1,
    }
    const preDrop = resolveReactiveConstellationComposition({
      settings,
      audio: audioFrame({ section: 'preDrop', progress: 0.96, values: { buildProgress: 0.98 } }),
      modulation: modulation(),
    }).values
    const drop = resolveReactiveConstellationComposition({
      settings,
      audio: audioFrame({ section: 'drop', events: { dropEntry: true } }),
      modulation: modulation(),
    }).values

    expect(preDrop.expansionTarget).toBeLessThan(0.2)
    expect(drop.expansionTarget).toBeGreaterThan(preDrop.expansionTarget)
    expect(preDrop.collapseForce).toBe(0)
    expect(drop.collapseForce).toBe(0)
    expect(drop.burstImpulse).toBe(0)
  })


  it('applies preset, section, audio, macro, action, and clamp layers in the documented order', () => {
    const audio = audioFrame({ section: 'unknown' })
    const result = resolveReactiveConstellationComposition({
      settings: REACTIVE_CONSTELLATION_DEFAULTS,
      audio,
      modulation: modulation({ networkSpread: 0.5 }),
      manualMacroOffsets: { networkSpread: 0.1 },
      performanceActionEnvelopes: { networkSpread: 0.2 },
      motionScale: 1,
    })

    expect(result.compositionOrder).toEqual(REACTIVE_CONSTELLATION_COMPOSITION_ORDER)
    expect(result.values.networkSpread).toBeCloseTo(1.2 - 0.02 + 0.5 * 0.62 + 0.1 + 0.2, 6)

    const clamped = resolveReactiveConstellationComposition({
      settings: REACTIVE_CONSTELLATION_DEFAULTS,
      audio,
      modulation: modulation(),
      manualMacroOffsets: {
        networkSpread: 99,
        nodeScale: -99,
        edgeBrightness: 99,
        edgeWidth: 99,
        trailLength: 99,
        topologyMorph: 99,
        collapseForce: 99,
        burstImpulse: 99,
        facetOpacity: -99,
      },
    }).values
    expect(clamped.networkSpread).toBe(REACTIVE_CONSTELLATION_BOUNDS.networkSpread[1])
    expect(clamped.nodeScale).toBe(REACTIVE_CONSTELLATION_BOUNDS.nodeScale[0])
    expect(clamped.edgeBrightness).toBe(REACTIVE_CONSTELLATION_BOUNDS.beamCoreBrightness[1])
    expect(clamped.edgeWidth).toBe(REACTIVE_CONSTELLATION_BOUNDS.beamWidth[1])
    expect(clamped.trailLength).toBe(REACTIVE_CONSTELLATION_BOUNDS.trailSamples[1])
    expect(clamped.topologyMorph).toBe(1)
    expect(clamped.collapseForce).toBe(REACTIVE_CONSTELLATION_BOUNDS.collapseAmount[1])
    expect(clamped.burstImpulse).toBe(2.5)
    expect(clamped.facetOpacity).toBe(REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[0])
  })

  it('keeps neutral macros inert and produces bounded, monotonic runtime changes', () => {
    expect(resolveReactiveConstellationMacroOffsets(REACTIVE_CONSTELLATION_DEFAULTS)).toEqual({
      networkSpread: 0,
      expansionTarget: 0,
      nodeScale: 0,
      topologyMorph: 0,
      springStrength: 0,
      nodeSpin: 0,
      motionScale: 0,
      edgeBrightness: 0,
      edgeWidth: 0,
      burstImpulse: 0,
      collapseForce: 0,
      trailLength: 0,
      facetOpacity: 0,
      internalGlow: 0,
      rimIntensity: 0,
      cameraOrbit: 0,
    })

    const lowSettings = {
      ...REACTIVE_CONSTELLATION_DEFAULTS,
      macroStructure: 0,
      macroMotion: 0,
      macroImpact: 0,
      macroTrails: 0,
      macroMaterial: 0,
      macroCamera: 0,
    }
    const highSettings = {
      ...REACTIVE_CONSTELLATION_DEFAULTS,
      macroStructure: 1,
      macroMotion: 1,
      macroImpact: 1,
      macroTrails: 1,
      macroMaterial: 1,
      macroCamera: 1,
    }
    const sourceSnapshot = JSON.stringify(highSettings)
    const low = resolveReactiveConstellationComposition({
      settings: lowSettings,
      audio: audioFrame({ section: 'unknown' }),
      modulation: modulation(),
    }).values
    const high = resolveReactiveConstellationComposition({
      settings: highSettings,
      audio: audioFrame({ section: 'unknown' }),
      modulation: modulation(),
    }).values

    expect(high.networkSpread).toBeGreaterThan(low.networkSpread)
    expect(high.nodeSpin).toBeGreaterThan(low.nodeSpin)
    expect(high.edgeBrightness).toBeGreaterThan(low.edgeBrightness)
    expect(high.trailLength).toBeGreaterThan(low.trailLength)
    expect(high.facetOpacity).toBeGreaterThan(low.facetOpacity)
    expect(high.internalGlow).toBeGreaterThan(low.internalGlow)
    expect(high.rimIntensity).toBeGreaterThan(low.rimIntensity)
    expect(high.cameraOrbit).toBeGreaterThan(low.cameraOrbit)
    expect(JSON.stringify(highSettings)).toBe(sourceSnapshot)
    expect(Object.values(high).every(Number.isFinite)).toBe(true)
  })

  it('degrades safely when offline analysis, beat grids, sections, stems, and lyrics are unavailable', () => {
    const audio = audioFrame({
      section: null,
      time: 0,
      capabilities: Object.fromEntries(Object.keys(ALL_CAPABILITIES).map(key => [key, false])) as Partial<CinematicNormalizedAudioFrame['capabilities']>,
    })
    const routes = createDefaultCinematicAudioRoutes('reactiveConstellation')
    const engine = new CinematicModulationEngine()
    const snapshot = engine.update(audio, routes, CINEMATIC_AUDIO_TARGETS, 1 / 60, 0, 44)
    const result = resolveReactiveConstellationComposition({
      settings: REACTIVE_CONSTELLATION_DEFAULTS,
      audio,
      modulation: snapshot,
    })

    expect(snapshot.values.networkSpread).toBe(0)
    expect(snapshot.values.burstImpulse).toBe(0)
    expect(result.sectionType).toBe('intro')
    expect(Object.values(result.values).every(Number.isFinite)).toBe(true)
  })

  it('is deterministic for identical normalized frames and route snapshots', () => {
    const input = {
      settings: REACTIVE_CONSTELLATION_DEFAULTS,
      audio: audioFrame({ section: 'build', progress: 0.72, values: { buildProgress: 0.8 } }),
      modulation: modulation({ networkSpread: 0.4, topologyMorph: 0.25, edgeBrightness: 0.6 }),
      manualMacroOffsets: { nodeSpin: 0.12 },
      performanceActionEnvelopes: { burstImpulse: 0.8 },
      motionScale: 1.1,
    }
    expect(resolveReactiveConstellationComposition(input)).toEqual(resolveReactiveConstellationComposition(input))
  })
})

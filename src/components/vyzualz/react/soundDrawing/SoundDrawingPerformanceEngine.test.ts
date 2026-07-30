import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { DEFAULT_OSCILLATOR_SETTINGS, type ReactTrackSection } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import {
  buildSoundDrawingPerformanceContext,
  resolveSoundDrawingPerformanceFrame,
} from './SoundDrawingPerformanceEngine'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './SoundDrawingPerformanceShows'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingPerformanceSettingsPatch,
  type SoundDrawingResolvedPerformanceFrame,
} from './SoundDrawingPerformanceTypes'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.92 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 16, intensity: 0.5, source: 'auto', confidence: 0.9 },
  { id: 'build', label: 'Build', type: 'build', startSec: 16, endSec: 24, intensity: 0.72, source: 'auto', confidence: 0.91 },
  { id: 'pre-drop', label: 'Pre-Drop', type: 'preDrop', startSec: 24, endSec: 28, intensity: 0.45, source: 'auto', confidence: 0.94 },
  {
    id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 28, endSec: 68, intensity: 0.95,
    source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 },
  },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 68, endSec: 84, intensity: 0.28, source: 'auto', confidence: 0.9 },
  {
    id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 84, endSec: 124, intensity: 1,
    source: 'auto', confidence: 0.97, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 },
  },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 124, endSec: 140, intensity: 0.2, source: 'auto', confidence: 0.88 },
]

type RhythmEvent = 'beat' | 'kick' | 'snare' | 'hat' | 'downbeat'

function intelligenceFrame(
  timeSec: number,
  events: readonly RhythmEvent[] = [],
  confidence = 0.92,
  trackId = 'track-a',
): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const beatPhase = absoluteBeat - beatIndex
  const eventSet = new Set(events)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.floor(timeSec * 60)),
    trackId,
    sourceId: trackId,
    analysisRevision: 'analysis-r1',
    timelineRevision: 'timeline-r1',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.72,
      mid: 0.48,
      high: 0.56,
      volume: 0.68,
      normalizedBass: 0.72,
      normalizedMid: 0.48,
      normalizedHigh: 0.56,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: confidence,
      beatIndex,
      beatPhase,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: eventSet.has('beat') || eventSet.has('kick') || eventSet.has('snare') || eventSet.has('downbeat'),
      downbeatHit: eventSet.has('downbeat'),
      kickHit: eventSet.has('kick'),
      kickStrength: eventSet.has('kick') ? 0.95 : 0,
      snareHit: eventSet.has('snare'),
      snareStrength: eventSet.has('snare') ? 0.9 : 0,
      hatHit: eventSet.has('hat'),
      hatStrength: eventSet.has('hat') ? 0.82 : 0,
      transient: events.length ? 0.88 : 0,
      transientConfidence: confidence,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.68,
      shortTerm: 0.66,
      longTerm: 0.6,
      percentile: 0.74,
      spectralFlux: 0.52,
      tension: 0.61,
      complexity: 0.58,
      buildProgress: timeSec >= 16 && timeSec < 24 ? (timeSec - 16) / 8 : 0,
      dropImpact: events.includes('downbeat') ? 0.9 : 0,
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalEnergy: 0.44 },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: DEFAULT_MI_FRAME.capabilities?.trackEnergyCurve ?? false,
      stemCurves: DEFAULT_MI_FRAME.capabilities?.stemCurves ?? false,
      lyrics: DEFAULT_MI_FRAME.capabilities?.lyrics ?? false,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: confidence,
      rhythm: confidence,
      section: confidence,
    },
  }
}

function frameAt(
  timeSec: number,
  options: {
    events?: readonly RhythmEvent[]
    confidence?: number
    trackKey?: string
    timingDiscontinuity?: boolean
    sections?: readonly ReactTrackSection[]
  } = {},
): ReactFrameContext {
  const trackKey = options.trackKey ?? 'track-a'
  const mi = intelligenceFrame(timeSec, options.events, options.confidence, trackKey)
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: timeSec * 60,
    elapsedTimeSec: timeSec,
    deltaTimeSec: 1 / 60,
    timingDiscontinuity: options.timingDiscontinuity,
    timeSec,
    audioTime: timeSec,
    trackKey,
    bpm: 120,
    beatPhase: mi.rhythm.beatPhase,
    beatHit: mi.rhythm.beatHit,
    isPlaying: true,
    audio: { bass: 0.72, mid: 0.48, high: 0.56, volume: 0.68 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: mi,
    trackSections: options.sections ?? SECTIONS,
  }
}

function settings(patch: SoundDrawingPerformanceSettingsPatch = {}): SoundDrawingPerformanceSettings {
  return {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    selectedShowId: 'radialPressureSystem',
    autoPerformance: true,
    complexity: 1,
    motionIntensity: 1,
    reactionIntensity: 1,
    trailIntensity: 1,
    ...patch,
    livingRibbon: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon,
      ...(patch.livingRibbon ?? {}),
    },
    locks: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
      ...(patch.locks ?? {}),
    },
    trailLockContract: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.trailLockContract,
      ...(patch.trailLockContract ?? {}),
    },
  }
}

function resolved(
  timeSec: number,
  options: Parameters<typeof frameAt>[1] = {},
  settingPatch: SoundDrawingPerformanceSettingsPatch = {},
  previousContext: SoundDrawingResolvedPerformanceFrame['context'] | null = null,
): SoundDrawingResolvedPerformanceFrame {
  const result = resolveSoundDrawingPerformanceFrame({
    frame: frameAt(timeSec, options),
    settings: settings(settingPatch),
    manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    previousContext,
  })
  expect(result).not.toBeNull()
  return result as SoundDrawingResolvedPerformanceFrame
}

function role(frame: SoundDrawingResolvedPerformanceFrame, name: SoundDrawingResolvedPerformanceFrame['layers'][number]['role']) {
  const found = frame.layers.find(layer => layer.role === name)
  expect(found).toBeDefined()
  return found!
}


function livingResolved(
  timeSec: number,
  options: Parameters<typeof frameAt>[1] = {},
  settingPatch: SoundDrawingPerformanceSettingsPatch = {},
  previousContext: SoundDrawingResolvedPerformanceFrame['context'] | null = null,
): SoundDrawingResolvedPerformanceFrame {
  return resolved(
    timeSec,
    options,
    {
      selectedShowId: 'livingRibbonSystem',
      performanceSource: 'generatedVisual',
      ...settingPatch,
    },
    previousContext,
  )
}

function ribbon(frame: SoundDrawingResolvedPerformanceFrame) {
  return role(frame, 'primaryMotif')
}

describe('Sound Drawing authored Performance Engine', () => {
  it('resolves built-in Professional Scope layers without enabling manual scope', () => {
    const performance = resolved(10, {}, {
      selectedShowId: 'stereoPulseStudy',
      performanceSource: 'activeUserSource',
    })
    const scope = performance.layers.find((layer) => layer.generator === 'professionalScope')
    expect(scope?.professionalScope?.state.signalMode).toBe('stereoXY')
    expect(scope?.professionalScope?.measurementSafe).toBe(true)
    expect(DEFAULT_OSCILLATOR_SETTINGS.classicMode).not.toBe('professionalScope')
  })

  it('does not inject manual Professional Scope into a show that does not author it', () => {
    const performance = resolveSoundDrawingPerformanceFrame({
      frame: frameAt(10),
      settings: settings({ selectedShowId: 'radialPressureSystem', performanceSource: 'generatedVisual' }),
      manualOscillator: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'classic',
        classicMode: 'professionalScope',
      },
    })!
    expect(performance.layers.some((layer) => layer.generator === 'professionalScope')).toBe(false)
  })

  it('returns manual ownership when Auto Performance is disabled', () => {
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(10),
      settings: settings({ autoPerformance: false, selectedShowId: 'stereoPulseStudy' }),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })).toBeNull()
  })

  it('applies authored scope automation to the resolved scope pipeline state', () => {
    const low = resolved(8.1, {}, {
      selectedShowId: 'stereoPulseStudy',
      performanceSource: 'generatedVisual',
    }).layers.find((layer) => layer.generator === 'professionalScope')!
    const high = resolved(14.9, {}, {
      selectedShowId: 'stereoPulseStudy',
      performanceSource: 'generatedVisual',
    }).layers.find((layer) => layer.generator === 'professionalScope')!
    expect(high.professionalScope?.exposure).toBeGreaterThan(1)
    expect(high.professionalScope?.state.phosphor.persistenceSeconds).not.toBe(
      low.professionalScope?.state.phosphor.persistenceSeconds,
    )
  })

  it('keeps exactly one genuine scope layer in the combined Scope and Shape show', () => {
    const performance = resolved(30, {}, {
      selectedShowId: 'scopeAndShape',
      performanceSource: 'generatedVisual',
    })
    expect(performance.layers.filter((layer) => layer.generator === 'professionalScope')).toHaveLength(1)
    expect(performance.layers.some((layer) => layer.generator === 'circularBassMembrane')).toBe(true)
  })

  it('publishes seven fundamentally distinct authored systems at the same playhead', () => {
    expect(SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => show.name)).toEqual([
      'Radial Pressure System',
      'Harmonic Ribbon Reactor',
      'Phase-Knot Cathedral',
      'Living Ribbon System',
      'Stereo Pulse Study',
      'Phase Orbit',
      'Scope and Shape',
    ])

    for (const timeSec of [10, 25, 31]) {
      const signatures = SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => {
        const performance = resolved(timeSec, {}, { selectedShowId: show.id })
        return performance.layers
          .filter(layer => layer.enabled)
          .map(layer => [
            layer.role,
            layer.generator,
            layer.professionalScope?.state.presetId ?? 'no-scope',
            layer.symmetry,
            layer.traceCount,
          ].join(':'))
          .join('|')
      })
      expect(new Set(signatures).size).toBe(SOUND_DRAWING_PERFORMANCE_SHOWS.length)
    }
  })

  it('preserves each show primary visual identity across every song section', () => {
    const expected = new Map(SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => [show.id, show.primaryGenerator]))
    for (const show of SOUND_DRAWING_PERFORMANCE_SHOWS) {
      for (const timeSec of [2, 10, 20, 25, 31, 72, 87, 132]) {
        const frame = resolved(timeSec, {}, { selectedShowId: show.id })
        expect(role(frame, 'primaryMotif').generator).toBe(expected.get(show.id))
      }
    }
  })

  it('authors every scene with the declared primary generator instead of relying on runtime substitution', () => {
    for (const show of SOUND_DRAWING_PERFORMANCE_SHOWS) {
      for (const candidate of show.program.scenes) {
        for (const action of candidate.actions ?? []) {
          if (action.type !== 'scene') continue
          const primary = action.layers.find(layer => layer.role === 'primaryMotif')
          if (primary) expect(primary.generator).toBe(show.primaryGenerator)
        }
      }
    }
  })

  it('uses Complexity only for primary trace detail and symmetry', () => {
    const low = resolved(31, {}, { complexity: 0 })
    const high = resolved(31, {}, { complexity: 1 })
    const lowPrimary = role(low, 'primaryMotif')
    const highPrimary = role(high, 'primaryMotif')

    expect(highPrimary.traceCount).toBeGreaterThanOrEqual(lowPrimary.traceCount)
    expect(highPrimary.symmetry).toBeGreaterThanOrEqual(lowPrimary.symmetry)
    expect(high.layers.map(layer => [layer.id, layer.enabled, layer.generator, layer.particleCount, layer.opacity])).toEqual(
      low.layers.map(layer => [layer.id, layer.enabled, layer.generator, layer.particleCount, layer.opacity]),
    )
  })

  it('uses Trail Intensity only for the primary fading history', () => {
    const dry = resolved(31, {}, { selectedShowId: 'stereoPulseStudy', trailIntensity: 0 })
    const long = resolved(31, {}, { selectedShowId: 'stereoPulseStudy', trailIntensity: 1 })
    const dryPrimary = role(dry, 'primaryMotif')
    const longPrimary = role(long, 'primaryMotif')

    expect(dryPrimary.trailPersistence).toBe(0)
    expect(longPrimary.trailPersistence).toBe(0)
    expect(longPrimary.professionalScope?.state.phosphor.persistenceSeconds).toBeGreaterThan(
      dryPrimary.professionalScope?.state.phosphor.persistenceSeconds ?? 0,
    )
    expect(longPrimary.feedbackAmount).toBe(0)
    expect(long.global).toEqual(dry.global)
    expect(long.layers.filter(layer => layer.role !== 'primaryMotif')).toEqual(
      dry.layers.filter(layer => layer.role !== 'primaryMotif'),
    )
  })

  it('starts with no Performance Show and treats explicit preset selection as the only authored-system selector', () => {
    expect(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId).toBeNull()
    expect(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.autoPerformance).toBe(false)
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS, autoPerformance: true },
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })).toBeNull()

    const living = resolved(31, {}, { selectedShowId: 'livingRibbonSystem' })
    const staleLivingOverride = resolved(31, {}, {
      selectedShowId: 'livingRibbonSystem',
      generatorPreference: 'horizontalOscilloscope',
    })
    expect(living.showId).toBe('livingRibbonSystem')
    expect(role(living, 'primaryMotif').generator).toBe('livingRibbon')
    expect(staleLivingOverride.layers).toEqual(living.layers)

    const harmonic = resolved(31, {}, { selectedShowId: 'harmonicRibbonReactor' })
    const staleHarmonicOverride = resolved(31, {}, {
      selectedShowId: 'harmonicRibbonReactor',
      generatorPreference: 'livingRibbon',
    })
    expect(staleHarmonicOverride.layers).toEqual(harmonic.layers)
  })

  it('consumes the authoritative shared context and preserves manual mode when Auto Performance is off', () => {
    const context = buildSoundDrawingPerformanceContext(frameAt(31))
    expect(context).toMatchObject({
      trackIdentity: 'track-a',
      macroSectionType: 'drop',
      dropOccurrence: 1,
      performanceFourBarBlockIndex: 0,
      bass: 0.72,
    })
    expect(resolveSoundDrawingPerformanceFrame({
      frame: frameAt(31),
      settings: settings({ autoPerformance: false }),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })).toBeNull()
  })

  it('uses the fallback Music Intelligence frame without reading the AudioFeatureBus', () => {
    const frame = frameAt(31)
    frame.musicIntelligence = null
    const context = buildSoundDrawingPerformanceContext(frame)
    expect(context.trackIdentity).toBe('track-a')
    expect(context.audioTimeSec).toBe(31)
    expect(context.bass).toBeGreaterThanOrEqual(0)
    const result = resolveSoundDrawingPerformanceFrame({
      frame,
      settings: settings(),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })
    expect(result).not.toBeNull()
  })

  it('separates kick, snare, hat, and downbeat responsibilities by layer role', () => {
    const baseline = resolved(29.01)
    const kick = resolved(29.01, { events: ['kick'] })
    const snare = resolved(29.01, { events: ['snare'] })
    const hat = resolved(29.01, { events: ['hat'] })
    const downbeatBaseline = resolved(28.01)
    const downbeat = resolved(28.01, { events: ['downbeat'] })

    expect(role(kick, 'primaryMotif').scale).toBeGreaterThan(role(baseline, 'primaryMotif').scale)
    expect(role(snare, 'rhythmAccent').rotation).toBeGreaterThan(role(baseline, 'rhythmAccent').rotation)
    expect(role(hat, 'atmosphereLayer').jitter).toBeGreaterThan(role(baseline, 'atmosphereLayer').jitter)
    expect(role(downbeat, 'primaryMotif').topologyVariant).toBeGreaterThan(role(downbeatBaseline, 'primaryMotif').topologyVariant)
    expect(role(hat, 'primaryMotif').scale).toBeCloseTo(role(baseline, 'primaryMotif').scale)
  })

  it('shows supporting visuals only in high-energy sections and never recruits them through Complexity', () => {
    const intro = resolved(4)
    const verse = resolved(12)
    const earlyBuild = resolved(17)
    const lateBuild = resolved(22)
    const drop = resolved(31)
    const breakdown = resolved(72)

    for (const frame of [intro, verse, earlyBuild, breakdown]) {
      expect(frame.layers.filter(layer => layer.enabled && layer.role !== 'primaryMotif')).toHaveLength(0)
    }
    for (const frame of [lateBuild, drop]) {
      const supporting = frame.layers.filter(layer => layer.enabled && layer.role !== 'primaryMotif')
      expect(supporting.length).toBeGreaterThan(0)
      expect(supporting.length).toBeLessThanOrEqual(2)
      expect(supporting.every(layer => layer.opacity <= 0.22)).toBe(true)
      expect(supporting.every(layer => layer.trailPersistence === 0 && layer.feedbackAmount === 0)).toBe(true)
    }

    const lowComplexity = resolved(31, {}, { complexity: 0 })
    const highComplexity = resolved(31, {}, { complexity: 1 })
    expect(highComplexity.layers.map(layer => [layer.id, layer.enabled, layer.generator])).toEqual(
      lowComplexity.layers.map(layer => [layer.id, layer.enabled, layer.generator]),
    )
  })

  it('keeps Drop 2 inside the same visual system while applying bounded occurrence-aware evolution', () => {
    const first = resolved(31)
    const second = resolved(87)
    expect(first.sceneId).toBe('rps-drop')
    expect(second.sceneId).toBe('rps-drop-2')
    expect(role(second, 'primaryMotif').generator).toBe('radialOscilloscope')
    expect(role(second, 'primaryMotif').generator).toBe(role(first, 'primaryMotif').generator)
    expect(role(second, 'primaryMotif').topologyVariant).not.toBe(role(first, 'primaryMotif').topologyVariant)
    expect(role(second, 'echoLayer').enabled).toBe(true)
  })

  it('contracts before a drop and removes supporting visuals during breakdown', () => {
    const preDrop = resolved(25)
    const drop = resolved(31)
    const breakdown = resolved(72)
    expect(role(preDrop, 'primaryMotif').scale).toBeLessThan(role(drop, 'primaryMotif').scale)
    expect(preDrop.global.feedbackAmount).toBe(0)
    expect(drop.global.feedbackAmount).toBe(0)
    expect(breakdown.layers.filter(layer => layer.enabled)).toHaveLength(1)
    expect(drop.layers.filter(layer => layer.enabled).length).toBeGreaterThan(1)
    expect(role(breakdown, 'primaryMotif').generator).toBe(role(drop, 'primaryMotif').generator)
  })

  it('is deterministic for direct resolution, seek discontinuities, and loop wraps', () => {
    const direct = resolved(47)
    const repeated = resolved(47)
    const beforeSeek = resolved(60)
    const sought = resolved(47, { timingDiscontinuity: true }, {}, beforeSeek.context)
    const beforeLoop = resolved(58)
    const looped = resolved(47, {}, {}, beforeLoop.context)

    expect(repeated.layers).toEqual(direct.layers)
    expect(sought.layers).toEqual(direct.layers)
    expect(looped.layers).toEqual(direct.layers)
    expect(sought.context.boundaries.timingDiscontinuity).toBe(true)
    expect(looped.context.loopWrapDetected).toBe(true)
  })

  it('ignores retired manual locks and manual oscillator topology during authored playback', () => {
    const baseline = resolved(29.01, { events: ['kick', 'downbeat'] })
    const result = resolveSoundDrawingPerformanceFrame({
      frame: frameAt(29.01, { events: ['kick', 'downbeat'] }),
      settings: settings({
        performanceSource: 'activeUserSource',
        generatorPreference: 'horizontalOscilloscope',
        locks: Object.fromEntries(
          Object.keys(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks).map(key => [key, true]),
        ) as SoundDrawingPerformanceSettings['locks'],
      }),
      manualOscillator: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'classic',
        classicMode: 'waveform',
        duplicateTraces: 5,
        mirrorX: true,
        renderMode: 'dots',
      },
    }) as SoundDrawingResolvedPerformanceFrame
    expect(result.layers).toEqual(baseline.layers)
    expect(result.global).toEqual(baseline.global)
  })

  it('enforces bounded layers, traces, particles, and low-confidence fallback', () => {
    const result = resolved(63)
    expect(result.layers.length).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    for (const layer of result.layers) {
      expect(layer.traceCount).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_TRACES)
      expect(layer.particleCount).toBeLessThanOrEqual(MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES)
    }

    const lowConfidenceSections = SECTIONS.map(section => ({ ...section, confidence: 0.12 }))
    const fallback = resolved(31, { confidence: 0.12, sections: lowConfidenceSections })
    expect(fallback.fallbackUsed).toBe(true)
    expect(fallback.sceneId).toContain('fallback')
    expect(fallback.layers.filter(layer => layer.enabled)).toHaveLength(1)
  })


  it('authors distinct Living Ribbon choreography across the complete song arc', () => {
    const intro = ribbon(livingResolved(2))
    const verse = ribbon(livingResolved(10))
    const build = ribbon(livingResolved(20))
    const preDrop = ribbon(livingResolved(25))
    const drop = ribbon(livingResolved(31))
    const breakdown = ribbon(livingResolved(72))
    const drop2 = ribbon(livingResolved(87))
    const outro = ribbon(livingResolved(132))

    expect(intro.livingRibbonControls.turbulence).toBeLessThan(verse.livingRibbonControls.turbulence)
    expect(intro.particleCount).toBeLessThan(verse.particleCount)
    expect(build.livingRibbonControls.tension).toBeGreaterThan(verse.livingRibbonControls.tension)
    expect(build.livingRibbonControls.collapseAmount).toBeGreaterThan(verse.livingRibbonControls.collapseAmount)
    expect(preDrop.livingRibbonControls.spread).toBeLessThan(build.livingRibbonControls.spread)
    expect(preDrop.livingRibbonControls.centerAttraction).toBeGreaterThan(build.livingRibbonControls.centerAttraction)
    expect(drop.livingRibbonControls.releaseAmount).toBeGreaterThan(0)
    expect(drop.livingRibbonControls.spread).toBeGreaterThan(preDrop.livingRibbonControls.spread)
    expect(breakdown.livingRibbonControls.drive).toBeLessThan(drop.livingRibbonControls.drive)
    expect(breakdown.trailPersistence).toBeGreaterThan(drop.trailPersistence)
    expect(drop2.livingRibbonControls.directionalDrift).not.toBe(drop.livingRibbonControls.directionalDrift)
    expect(drop2.livingRibbonControls.twist).not.toBe(drop.livingRibbonControls.twist)
    expect(outro.livingRibbonControls.collapseAmount).toBeGreaterThan(breakdown.livingRibbonControls.collapseAmount)
    expect(outro.livingRibbonControls.drive).toBeLessThan(breakdown.livingRibbonControls.drive)
  })

  it('keeps Living Ribbon visible and reactive through low-confidence and missing-section fallbacks', () => {
    const lowConfidenceSections = SECTIONS.map(section => ({ ...section, confidence: 0.08 }))
    const fallback = livingResolved(31.01, { confidence: 0.08, sections: lowConfidenceSections, events: ['kick'] })
    expect(fallback.fallbackUsed).toBe(true)
    expect(fallback.sceneId).toBe('lrs-fallback')
    expect(ribbon(fallback).opacity).toBeGreaterThan(0)
    expect(ribbon(fallback).livingRibbonControls.drive).toBeGreaterThan(0)
    expect(ribbon(fallback).livingRibbonImpulses.some(impulse => impulse.kind === 'radialImpact')).toBe(true)

    const missingSections = livingResolved(31.01, { sections: [], events: ['downbeat'] })
    expect(missingSections.fallbackUsed).toBe(true)
    expect(ribbon(missingSections).livingRibbonImpulses.length).toBeGreaterThan(0)
  })

  it('uses vocal capability gates to center and calm the ribbon without requiring vocal data', () => {
    const noVocalFrame = frameAt(10)
    noVocalFrame.musicIntelligence = {
      ...noVocalFrame.musicIntelligence!,
      stems: { ...noVocalFrame.musicIntelligence!.stems, vocalEnergy: 0 },
      capabilities: {
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
        sections: true,
        trackEnergyCurve: false,
        stemCurves: false,
        lyrics: false,
      },
    }
    const noVocal = resolveSoundDrawingPerformanceFrame({
      frame: noVocalFrame,
      settings: settings({ selectedShowId: 'livingRibbonSystem', performanceSource: 'generatedVisual' }),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    }) as SoundDrawingResolvedPerformanceFrame

    const vocalFrame = frameAt(10)
    vocalFrame.musicIntelligence = {
      ...vocalFrame.musicIntelligence!,
      stems: { ...vocalFrame.musicIntelligence!.stems, vocalEnergy: 0 },
      lyrics: { ...vocalFrame.musicIntelligence!.lyrics, vocalActivity: 0.95 },
      capabilities: {
        liveBands: true,
        rhythmEvents: true,
        beatGrid: true,
        sections: true,
        trackEnergyCurve: false,
        stemCurves: false,
        lyrics: true,
      },
    }
    const vocal = resolveSoundDrawingPerformanceFrame({
      frame: vocalFrame,
      settings: settings({ selectedShowId: 'livingRibbonSystem', performanceSource: 'generatedVisual' }),
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    }) as SoundDrawingResolvedPerformanceFrame

    expect(ribbon(noVocal).generator).toBe('livingRibbon')
    expect(ribbon(vocal).livingRibbonControls.centerAttraction).toBeGreaterThan(
      ribbon(noVocal).livingRibbonControls.centerAttraction,
    )
    expect(ribbon(vocal).livingRibbonControls.turbulence).toBeLessThan(ribbon(noVocal).livingRibbonControls.turbulence)
    expect(ribbon(vocal).livingRibbonControls.damping).toBeGreaterThan(ribbon(noVocal).livingRibbonControls.damping)
  })

  it('translates rhythm and structure into deterministic bounded physical impulses', () => {
    const kick = ribbon(livingResolved(29.01, { events: ['kick'] }))
    const snareLeft = ribbon(livingResolved(29.01, { events: ['snare'] }))
    const snareRight = ribbon(livingResolved(30.01, { events: ['snare'] }))
    const hat = ribbon(livingResolved(29.01, { events: ['hat'] }))
    const downbeat = ribbon(livingResolved(28.01, { events: ['downbeat'] }))

    expect(kick.livingRibbonImpulses.map(impulse => impulse.kind)).toEqual(
      expect.arrayContaining(['radialImpact', 'localizedImpulse']),
    )
    expect(hat.livingRibbonImpulses.some(impulse => impulse.kind === 'fineRipple')).toBe(true)
    const left = snareLeft.livingRibbonImpulses.find(impulse => impulse.kind === 'lateralShock')!
    const right = snareRight.livingRibbonImpulses.find(impulse => impulse.kind === 'lateralShock')!
    expect(Math.sign(left.direction?.[0] ?? 0)).toBe(-Math.sign(right.direction?.[0] ?? 0))
    const kickImpact = kick.livingRibbonImpulses.find(impulse => impulse.kind === 'radialImpact')!
    const downbeatImpact = downbeat.livingRibbonImpulses.find(impulse => impulse.kind === 'radialImpact')!
    expect(downbeatImpact.strength).toBeGreaterThan(kickImpact.strength)
    for (const impulse of [...kick.livingRibbonImpulses, ...snareLeft.livingRibbonImpulses, ...hat.livingRibbonImpulses]) {
      expect(impulse.strength).toBeGreaterThanOrEqual(0)
      expect(impulse.strength).toBeLessThanOrEqual(1.5)
    }
  })

  it('scales Living Ribbon reactions while retired lock flags remain inert', () => {
    const full = ribbon(livingResolved(29.01, { events: ['kick'] }, { livingRibbon: { audioReactionDepth: 1 } }))
    const restrained = ribbon(livingResolved(29.01, { events: ['kick'] }, { livingRibbon: { audioReactionDepth: 0.25 } }))
    expect(restrained.livingRibbonImpulses[0].strength).toBeLessThan(full.livingRibbonImpulses[0].strength)

    const ribbonSettings = {
      tension: 0.21,
      turbulence: 0.17,
      bodyWidth: 0.33,
      trailPersistence: 0.41,
      bloom: 0.37,
      sparkAmount: 0.15,
      centerAttraction: 0.77,
      audioReactionDepth: 0.55,
    }
    const authored = ribbon(livingResolved(31.01, { events: ['kick', 'snare', 'downbeat'] }, {
      livingRibbon: ribbonSettings,
    }))
    const staleLocks = ribbon(livingResolved(31.01, { events: ['kick', 'snare', 'downbeat'] }, {
      livingRibbon: ribbonSettings,
      locks: {
        ribbonMovement: true,
        ribbonWidth: true,
        ribbonTrail: true,
        ribbonGlow: true,
        ribbonReaction: true,
      },
    }))
    expect(staleLocks).toEqual(authored)
    expect(staleLocks.livingRibbonImpulses.length).toBeGreaterThan(0)
  })

  it('detects track replacement and resolves the replacement from a clean deterministic state', () => {
    const original = resolved(31, { trackKey: 'track-a' })
    const replaced = resolved(31, { trackKey: 'track-b' }, {}, original.context)
    const freshReplacement = resolved(31, { trackKey: 'track-b' })
    expect(replaced.context.trackReplacementDetected).toBe(true)
    expect(replaced.layers).toEqual(freshReplacement.layers)
  })
})

// ── Bounded authored composition ──────────────────────────────────────────────

describe('authored performance layers use bounded composition', () => {
  it('composites the readable primary motif last with source-over and restrains supporting layers to screen', () => {
    for (const timeSec of [4, 12, 20, 31, 74]) {
      const frame = resolved(timeSec)
      expect(frame.layers.length).toBeGreaterThan(0)
      const primary = role(frame, 'primaryMotif')
      expect(frame.layers[frame.layers.length - 1]?.id).toBe(primary.id)
      expect(primary.blendMode).toBe('source-over')
      expect(frame.layers.filter(layer => layer.role !== 'primaryMotif').every(layer => layer.blendMode === 'screen')).toBe(true)
    }
  })

  it('never permits an authored layer to use recursive additive composition', () => {
    const frame = resolved(31, {}, { selectedShowId: 'scopeAndShape' })
    expect(frame.layers.some(layer => layer.blendMode === 'lighter')).toBe(false)
    expect(role(frame, 'primaryMotif').blendMode).toBe('source-over')
  })
})

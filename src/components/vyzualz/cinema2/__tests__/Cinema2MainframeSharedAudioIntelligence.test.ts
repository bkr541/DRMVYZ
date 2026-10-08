import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { resolveCinema2MainframeMusicalEvents, readCinema2MainframeContinuous, type Cinema2MainframeMusicalCue } from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import { Cinema2MainframeReactivityEngine } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST } from '../presets/Cinema2ElectricStormPreset'
import { CINEMA2_MAINFRAME_PRESET_MANIFEST } from '../presets/Cinema2MainframePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting',
  'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar',
  'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop',
  'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

function music(frameId: number, timeSec: number, active: boolean): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    frameId, timeSec, trackId: 'shared-track', sourceId: 'shared-source',
    analysisRevision: 'analysis-A', timelineRevision: 'timeline-A',
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedSub: 0.8, normalizedBass: 0.75, normalizedMid: 0.55, normalizedHigh: 0.45 },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120, bpmConfidence: 0.96, bpmSource: 'offline_analysis',
      beatIndex: active ? 32 : 30, beatInBar: active ? 0 : 2, barIndex: active ? 8 : 7,
      beatPhase: 0, beatHit: active, downbeatHit: active,
      beatEventTimeSec: timeSec, kickHit: active, kickStrength: active ? 0.92 : 0,
      snareHit: active, snareStrength: active ? 0.8 : 0,
      transient: active ? 0.88 : 0, transientConfidence: 0.83,
      phrase4Hit: active, phrase8Hit: active, phrase16Hit: active,
    },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.77, rms: 0.58, spectralFlux: 0.68, buildProgress: 0.79 },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: active ? 'build' : 'verse', label: active ? 'Build' : 'Verse',
      startSec: active ? 10.5 : 0, endSec: 30, progress: 0.4,
      intensity: 0.81, confidence: 0.94,
    },
    phraseMarkers: active ? [{ id: 'phrase-001', timeSec, phraseLength: 8, lengthBars: 8, barIndex: 8, confidence: 0.91, source: 'structural_boundary', structurallyDetected: true }] : [],
    semanticMoments: active ? [{ id: 'drop-001', timeSec, type: 'drop_impact', confidence: 0.97, source: 'structural_analysis' }] : [],
    analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, phraseHierarchy: true, semanticMoments: true },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.91, rhythm: 0.89, section: 0.94 },
  }
}

function harness(manifest: typeof CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST | typeof CINEMA2_MAINFRAME_PRESET_MANIFEST) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('\n'))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const dispatched: { eventId: string; kind: string }[] = []
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    dispatchAction: event => dispatched.push({ eventId: event.eventId, kind: (event.payload as { kind?: string } | undefined)?.kind ?? '' }),
  })
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
  return { dispatched, choreography }
}

function ctx(audio: NonNullable<Cinema2ModuleFrameReadContext['audio']>, director: NonNullable<Cinema2ModuleFrameReadContext['director']>): Cinema2ModuleFrameReadContext {
  return {
    frameId: audio.visualFrameId, timestampMs: audio.upstream.timeSec * 1000,
    deltaTimeSec: 0.25, elapsedTimeSec: audio.upstream.timeSec,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, analysisActive: true, trackId: 'shared-track', timeSec: audio.upstream.timeSec },
    audio, director,
  }
}

const upstreamId = (dispatchedId: string) => dispatchedId.slice(0, dispatchedId.lastIndexOf(':'))

describe('Mainframe and Electric Storm shared Audio Intelligence / choreography', () => {
  it('routes identical upstream event IDs via the same bridge, Visual Director and choreography runtime', () => {
    let upstream = music(1, 10, false)
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => upstream,
      getPublicationMeta: () => ({ sequence: upstream.frameId, publishedAtMs: upstream.timeSec * 1000, publisherId: 'shared-test', kind: 'frame' as const }),
    })
    const director = new Cinema2VisualDirector()
    const mainframe = harness(CINEMA2_MAINFRAME_PRESET_MANIFEST)
    const storm = harness(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST)
    const initial = bridge.capture(1)
    const first = ctx(initial, director.capture(initial))
    mainframe.choreography.update(first)
    storm.choreography.update(first)
    mainframe.dispatched.length = 0
    storm.dispatched.length = 0

    upstream = music(2, 11, true)
    const audio = bridge.capture(2)
    const next = ctx(audio, director.capture(audio))
    mainframe.choreography.update(next)
    storm.choreography.update(next)
    const shared = ['kick', 'transient', 'downbeat', 'phrase', 'section', 'drop']
    const stormKind = (value: string) => value === 'section' ? 'section' : value
    for (const kind of shared) {
      const fromMainframe = mainframe.dispatched.filter(event => event.kind === kind).map(event => upstreamId(event.eventId))
      const fromStorm = storm.dispatched.filter(event => event.kind === stormKind(kind)).map(event => upstreamId(event.eventId))
      expect(fromMainframe, kind).toEqual(fromStorm)
      expect(fromMainframe.length, kind).toBeGreaterThan(0)
    }
    const cues: Cinema2MainframeMusicalCue[] = mainframe.dispatched.map(event => ({ kind: event.kind as Cinema2MainframeMusicalCue['kind'], dispatchedEventId: event.eventId }))
    const resolved = resolveCinema2MainframeMusicalEvents(next, cues)
    const kick = resolved.find(event => event.kind === 'kick')!
    expect(kick).toMatchObject({
      id: audio.rhythm.kick!.id, timeSec: audio.rhythm.kick!.timeSec,
      confidence: audio.rhythm.kick!.confidence, source: audio.rhythm.kick!.source,
      trackId: 'shared-track', sourceId: 'shared-source', analysisRevision: 'analysis-A', timelineRevision: 'timeline-A',
    })
    expect(resolved.find(event => event.kind === 'phrase')).toMatchObject({ id: audio.structure.analyzedPhrases.value![0]!.id, confidence: 0.91, timeSec: 11 })
    expect(resolved.find(event => event.kind === 'drop')).toMatchObject({ id: audio.structure.semanticMoments.value![0]!.id, confidence: 0.97, timeSec: 11 })
    expect(resolved.some(event => event.kind === 'section')).toBe(true)
    expect(readCinema2MainframeContinuous(audio, next.director).significance).toBeGreaterThan(0)

    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(first, 'outward-bus', true, 0, [])
    const light = engine.update(next, 'outward-bus', true, 0, resolved)
    expect(light.musicalEvents).toEqual(resolved)
    expect(light.impulses.kick).toBeGreaterThan(0)
    expect(light.impulses.section).toBeGreaterThan(0)
    expect(light.signals.build).toBeGreaterThan(0)

    // Repeated publication/event ID never fires the same cue twice.
    mainframe.choreography.update(next)
    storm.choreography.update(next)
    expect(mainframe.dispatched).toHaveLength(cues.length)
    expect(storm.choreography.getSnapshot().deduplicatedEventCount).toBeGreaterThan(0)
    mainframe.choreography.dispose()
    storm.choreography.dispose()
  })

  it('does not invent musical impulses from a director or no source', () => {
    const empty = readCinema2MainframeContinuous(null, null)
    expect(empty).toMatchObject({ overall: 0, significance: 0, impact: 0, build: 0 })
    expect(resolveCinema2MainframeMusicalEvents({ audio: null } as Cinema2ModuleFrameReadContext, [{ kind: 'kick', dispatchedEventId: 'fake:mainframe-kick-cue' }])).toEqual([])
  })
})

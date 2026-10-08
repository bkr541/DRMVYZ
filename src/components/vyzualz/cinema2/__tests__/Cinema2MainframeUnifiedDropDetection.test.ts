import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  Cinema2MainframeDropCoordinator,
  resolveCinema2MainframeMusicalEvents,
  shouldResetCinema2MainframeDropState,
  type Cinema2MainframeMusicalCue,
  type Cinema2MainframeMusicalEvent,
} from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import {
  Cinema2MainframePatternController,
  resolveCinema2MainframeTriggerEventIdentity,
} from '../modules/mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeReactivityEngine } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_MAINFRAME_PRESET_MANIFEST } from '../presets/Cinema2MainframePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const capabilities = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting',
  'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar',
  'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop',
  'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

function music(frameId: number, timeSec: number, section: 'verse' | 'drop', markers: MusicIntelligenceFrame['semanticMoments'] = []): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    frameId, timeSec, trackId: 'track-A', sourceId: 'source-A',
    analysisRevision: 'analysis-1', timelineRevision: 'timeline-1',
    section: {
      ...DEFAULT_MI_FRAME.section, type: section, label: section,
      startSec: section === 'drop' ? 10 : 0, endSec: 30,
      intensity: section === 'drop' ? 0.96 : 0.45, confidence: 0.95, source: 'analysis',
    },
    semanticMoments: markers,
    analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, semanticMoments: markers.length > 0 },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, sections: true, liveBands: true },
  }
}

function context(audio: NonNullable<Cinema2ModuleFrameReadContext['audio']>, director: NonNullable<Cinema2ModuleFrameReadContext['director']>): Cinema2ModuleFrameReadContext {
  return {
    frameId: audio.visualFrameId, timestampMs: audio.upstream.timeSec * 1000,
    deltaTimeSec: 0.05, elapsedTimeSec: audio.upstream.timeSec,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, analysisActive: true, trackId: 'track-A', timeSec: audio.upstream.timeSec },
    audio, director,
  }
}

function runner() {
  const compiled = compileCinema2NativePreset(CINEMA2_MAINFRAME_PRESET_MANIFEST, { availableCapabilities: capabilities })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(d => d.message).join('\n'))
  const parameters = new Cinema2ParameterState(compiled.plan.parameters)
  const cues: Cinema2MainframeMusicalCue[] = []
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameters.getValue(target.parameterId),
    dispatchAction: event => {
      const kind = (event.payload as { kind?: Cinema2MainframeMusicalCue['kind'] } | null)?.kind
      if (kind) cues.push({ kind, dispatchedEventId: event.eventId })
    },
  })
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, parameters, resolver)
  const director = new Cinema2VisualDirector()
  let upstream = music(1, 9, 'verse')
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence: upstream.frameId, publishedAtMs: upstream.timeSec * 1000, publisherId: 'test', kind: 'frame' as const }),
  })
  const render = (next: MusicIntelligenceFrame) => {
    upstream = next
    const audio = bridge.capture(next.frameId)
    const frame = context(audio, director.capture(audio))
    choreography.update(frame)
    const delivered = resolveCinema2MainframeMusicalEvents(frame, cues.splice(0))
    return { frame, delivered }
  }
  return { render, choreography }
}

const drop = (id: string, timeSec: number, strength = 0.95): Cinema2MainframeMusicalEvent => ({
  kind: 'drop', id, timeSec, strength, confidence: strength, source: 'shared', upstreamIdentity: id,
  trackId: 'track-A', sourceId: 'source-A', analysisRevision: 'analysis-1', timelineRevision: 'timeline-1',
})

const patternInput = {
  authoredPattern: 'outward-bus' as const, patternChange: true, trigger: 'drop' as const, absoluteBeat: 20,
}

function consume(controller: Cinema2MainframePatternController, coordinator: Cinema2MainframeDropCoordinator, frame: Cinema2ModuleFrameReadContext, events: Cinema2MainframeMusicalEvent[]) {
  const result = coordinator.update(frame, events)
  const identity = resolveCinema2MainframeTriggerEventIdentity(frame, 'drop', frame.audio!.upstream.timeSec - 0.1, result.dropEventId)
  return { result, selection: controller.update({ ...patternInput, triggerEventId: identity }) }
}

describe('Mainframe P0-06 unified choreography drop delivery', () => {
  it('uses one dispatched marker for both the surge and an enabled drop-based pattern change', () => {
    const shared = runner()
    shared.render(music(1, 9.8, 'verse'))
    const { frame, delivered } = shared.render(music(2, 10.05, 'drop', [
      { id: 'drop-1', timeSec: 10, type: 'drop_impact', confidence: 0.97, source: 'structural_analysis' },
    ]))
    const coordinator = new Cinema2MainframeDropCoordinator()
    const controller = new Cinema2MainframePatternController(['outward-bus', 'system-surge'])
    controller.update({ ...patternInput, triggerEventId: null })
    const { result, selection } = consume(controller, coordinator, frame, [...delivered])
    expect(result.events.filter(event => event.kind === 'drop')).toHaveLength(1)
    expect(result.dropEventId).toBe(frame.audio!.structure.semanticMoments.value![0]!.id)
    expect(selection).toMatchObject({ changed: true, activePattern: 'system-surge' })
    const engine = new Cinema2MainframeReactivityEngine()
    engine.update(context(frame.audio!, frame.director!), 'outward-bus', true, 0, [])
    const lighting = engine.update({ ...frame, deltaTimeSec: 0.05 }, selection.activePattern, true, selection.patternStartBeat, result.events)
    expect(lighting.impulses.drop).toBeGreaterThan(0)
    expect(lighting.circuitAccent).toBeGreaterThan(0)
    expect(lighting.musicalEvents?.find(event => event.kind === 'drop')?.confidence).toBe(0.97)
    shared.choreography.dispose()
  })

  it('honors shared director section transitions without any explicit semantic marker', () => {
    const shared = runner()
    shared.render(music(1, 9.8, 'verse'))
    const { frame, delivered } = shared.render(music(2, 10, 'drop'))
    const dropEvent = delivered.find(event => event.kind === 'drop')
    expect(dropEvent).toMatchObject({ kind: 'drop', source: 'analysis' })
    expect(dropEvent?.id).toBe(frame.director?.context.transition.eventId)
    const result = new Cinema2MainframeDropCoordinator().update(frame, delivered)
    expect(result.dropEventId).toBe(dropEvent?.id)
    shared.choreography.dispose()
  })

  it('coalesces a section report with one or more late or repeated marker reports', () => {
    const coordinator = new Cinema2MainframeDropCoordinator()
    const frame = { audio: null } as Cinema2ModuleFrameReadContext
    const first = coordinator.update(frame, [drop('section-change-1', 10)])
    expect(first.events).toHaveLength(1)
    expect(coordinator.update(frame, [drop('marker-A', 10.1), drop('marker-B', 10.15)]).events).toHaveLength(0)
    expect(coordinator.update(frame, [drop('section-change-1', 10), drop('marker-A', 10.1)]).dropEventId).toBeNull()
    expect(coordinator.update(frame, [drop('second-drop', 34)]).dropEventId).toBe('second-drop')
  })

  it('prioritizes the structural marker over a same-frame section fallback', () => {
    const coordinator = new Cinema2MainframeDropCoordinator()
    const frame = { audio: { structure: { semanticMoments: { available: true, value: [{ id: 'marker', timeSec: 10 }] } } } } as unknown as Cinema2ModuleFrameReadContext
    const output = coordinator.update(frame, [drop('section', 10), drop('marker', 10)])
    expect(output.dropEventId).toBe('marker')
    expect(output.events.filter(event => event.kind === 'drop')).toHaveLength(1)
  })

  it('re-arms an upstream drop identity after a seek or loop reset, not during repeated polling', () => {
    const coordinator = new Cinema2MainframeDropCoordinator()
    const frame = { audio: null } as Cinema2ModuleFrameReadContext
    expect(coordinator.update(frame, [drop('same-marker', 10)]).dropEventId).toBe('same-marker')
    expect(coordinator.update(frame, [drop('same-marker', 10)]).dropEventId).toBeNull()
    coordinator.reset() // Host discontinuity: seek (including forward seek).
    expect(coordinator.update(frame, [drop('same-marker', 10)]).dropEventId).toBe('same-marker')
    coordinator.reset() // Host discontinuity: transport loop/backwards clock.
    expect(coordinator.update(frame, [drop('same-marker', 10)]).dropEventId).toBe('same-marker')
  })

  it('resynchronizes on seeks, loops, source/track changes, stops and restart, but not a simple pause/resume', () => {
    const previous = { timeSec: 10, sourceIdentity: 'source-A', contextGeneration: 1, playback: 'playing' as const }
    const current = { timeSec: 10.05, sourceIdentity: 'source-A', playback: 'playing' as const }
    const normalFrame = { audio: null, contextGeneration: 1 } as Cinema2ModuleFrameReadContext
    const discontinuity = (reason: string) => ({ ...normalFrame, audio: { discontinuity: { occurred: true, reason } } }) as Cinema2ModuleFrameReadContext
    expect(shouldResetCinema2MainframeDropState(normalFrame, current, previous)).toBe(false)
    expect(shouldResetCinema2MainframeDropState(discontinuity('seek'), current, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState(discontinuity('loop'), current, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState(discontinuity('activation'), current, previous)).toBe(false)
    expect(shouldResetCinema2MainframeDropState(normalFrame, { ...current, timeSec: 2 }, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState(normalFrame, { ...current, sourceIdentity: 'source-B' }, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState({ ...normalFrame, contextGeneration: 2 }, current, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState(normalFrame, { ...current, playback: 'stopped' }, previous)).toBe(true)
    expect(shouldResetCinema2MainframeDropState(normalFrame, current, { ...previous, playback: 'stopped' })).toBe(true)
    expect(shouldResetCinema2MainframeDropState(normalFrame, { ...current, playback: 'paused' }, previous)).toBe(false)
    expect(shouldResetCinema2MainframeDropState(normalFrame, current, { ...previous, playback: 'paused' })).toBe(false)
  })

  it('does not automatically change patterns when disabled or a different trigger is chosen', () => {
    const shared = runner()
    const { frame } = shared.render(music(1, 9, 'verse'))
    const coordinator = new Cinema2MainframeDropCoordinator()
    const result = coordinator.update(frame, [drop('drop-one', 9)])
    const controller = new Cinema2MainframePatternController(['outward-bus', 'radar-sweep'])
    controller.update({ ...patternInput, patternChange: false, triggerEventId: null })
    expect(controller.update({ ...patternInput, patternChange: false, triggerEventId: result.dropEventId }).activePattern).toBe('outward-bus')
    controller.update({ ...patternInput, trigger: 'bar4', patternChange: true, triggerEventId: null })
    expect(controller.update({ ...patternInput, trigger: 'bar4', triggerEventId: null }).activePattern).toBe('outward-bus')
    expect(resolveCinema2MainframeTriggerEventIdentity(frame, 'drop', 8, null)).toBeNull()
    shared.choreography.dispose()
  })
})

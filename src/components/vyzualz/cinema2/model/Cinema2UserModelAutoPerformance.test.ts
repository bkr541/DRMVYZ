import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { createCinema2UserModelPreset, cinema2UserModelPreviewParameterId } from '../presets/Cinema2UserModelPresetFactory'
import { ifritMusicFixture } from '../../../../test/support/IfritMusicFixture'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'
import { CINEMA2_USER_MODEL_AUTO_PERFORMANCE_PATTERNS, Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'

const kinds = Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[]
const library = { THREE } as unknown as Cinema2ThreeLibrary
function context(values: Record<string, unknown>, time = 2, event?: 'kick' | 'beat' | 'drop' | 'phrase' | 'snare' | 'downbeat' | 'bar', eventId = 1, edit = 0, extra: { build?: number; paused?: boolean; trackId?: string; generation?: number } = {}): Cinema2ModuleUpdateContext {
  const published = ifritMusicFixture({ frameId: Math.floor(time * 100) + 1, timeSec: time, event, eventId, beatIndex: 128, energy: .6, build: extra.build, trackId: extra.trackId })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => published, getPublicationMeta: () => ({ sequence: published.frameId, kind: 'frame', publisherId: 'preview-test', reason: null, publishedAtMs: time * 1000 }) })
  const snapshot = bridge.capture(published.frameId)
  const audio = { ...snapshot, discontinuity: { ...snapshot.discontinuity, occurred: false } }
  const frame = { frameId: published.frameId, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: .016, contextGeneration: extra.generation ?? 1, viewport: { width: 800, height: 600, dpr: 1 }, transport: { trackId: published.trackId, sourcePresent: true, playing: !extra.paused, paused: extra.paused === true, animationActive: true, timeSec: time, analysisActive: true, bpm: 120 }, audio, director: null } as Cinema2ModuleFrameReadContext
  return { frame, parameters: { get: name => values[name] as never, getAuthored: () => undefined, resolve: () => null, getEditRevision: () => edit }, targets: {} as never }
}

/** Updates at 0.5 s steps; the shared drop coordination in these fixtures needs a fresh event identity each time. */
function setup(kind: Cinema2UserModelPreviewKind, values: Record<string, unknown>) {
  const controller = new Cinema2UserModelPreviewEffects(library, kind)
  const authored = CINEMA2_USER_MODEL_PREVIEWS[kind]
  return { controller, authored, values: { pattern: authored[0] as string, patternChange: false, trigger: 'beat', reactivity: 0, ...values } as Record<string, unknown> }
}

describe.each(kinds)('%s model preview Auto Performance', kind => {
  const programs = CINEMA2_USER_MODEL_AUTO_PERFORMANCE_PATTERNS[kind]

  it('is an Auto Performance toggle under Design > Master Controls, off by default, bound to the module, with programs from its own Pattern list', () => {
    const manifest = createCinema2UserModelPreset(kind)
    const parameter = manifest.parameters!.find(p => p.id === cinema2UserModelPreviewParameterId(kind, 'autoPerformance'))!
    expect(parameter).toMatchObject({ label: 'Auto Performance', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls' })
    expect(manifest.modules![0].parameters?.autoPerformance).toBe(false)
    expect(manifest.modules![0].parameterBindings?.autoPerformance).toEqual({ $ref: parameter.id })
    expect(CINEMA2_USER_MODEL_PREVIEWS[kind]).toContain(programs.build)
    expect(CINEMA2_USER_MODEL_PREVIEWS[kind]).toContain(programs.drop)
    expect(programs.build).not.toBe(programs.drop)
  })

  it('treats a saved preset without the parameter as off', () => {
    const { controller, authored, values } = setup(kind, {})
    controller.update(context(values, 2, 'drop', 1)); controller.update(context(values, 2.5, 'drop', 2))
    expect(controller.inspect().pattern).toBe(authored[0])
  })

  it('does nothing while off, through a build and a drop', () => {
    const { controller, authored, values } = setup(kind, { autoPerformance: false })
    controller.update(context(values, 2, undefined, 1, 0, { build: 0.8 }))
    controller.update(context(values, 4, 'drop', 2, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(authored[0])
    expect(controller.performancePattern).toBeNull()
  })

  it('puts the build program on stage during a build and the drop program from a drop, without changing the authored Pattern', () => {
    const { controller, values } = setup(kind, { autoPerformance: true })
    controller.update(context(values, 2))
    controller.update(context(values, 2.5, undefined, 1, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(programs.build)
    controller.update(context(values, 4, 'drop', 2, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(programs.drop)
    expect(values.pattern).toBe(CINEMA2_USER_MODEL_PREVIEWS[kind][0])
  })

  it('returns to the authored Pattern when switched off', () => {
    const { controller, authored, values } = setup(kind, { autoPerformance: true })
    controller.update(context(values, 2)); controller.update(context(values, 2.5, undefined, 1, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(programs.build)
    values.autoPerformance = false
    controller.update(context(values, 3, undefined, 1, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(authored[0])
  })

  it('lets a manual Pattern edit end the override at once, including re-picking the same value', () => {
    const { controller, authored, values } = setup(kind, { autoPerformance: true })
    controller.update(context(values, 2)); controller.update(context(values, 2.5, undefined, 1, 0, { build: 0.8 }))
    values.pattern = authored[2]
    controller.update(context(values, 3, undefined, 1, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(authored[2])
    controller.update(context(values, 4, 'drop', 2, 0, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(programs.drop)
    controller.update(context(values, 4.5, undefined, 2, 1, { build: 0.8 }))
    expect(controller.inspect().pattern).toBe(authored[2])
  })

  it('keeps Pattern Change and the Trigger running underneath, on or off', () => {
    for (const auto of [false, true]) {
      const { controller, authored, values } = setup(kind, { autoPerformance: auto, patternChange: true, trigger: 'beat' })
      controller.update(context(values, 2, 'beat', 1)); controller.update(context(values, 2.1, 'beat', 2))
      expect(controller.inspect().pattern).toBe(authored[1])
    }
  })

  it('releases on pause and on a track change, and never replays a consumed drop', () => {
    const { controller, authored, values } = setup(kind, { autoPerformance: true })
    controller.update(context(values, 2)); controller.update(context(values, 2.5, 'drop', 5))
    expect(controller.inspect().pattern).toBe(programs.drop)
    controller.update(context(values, 2.6, undefined, 5, 0, { paused: true }))
    expect(controller.inspect().pattern).toBe(authored[0])
    controller.update(context(values, 2.7, 'drop', 5))
    expect(controller.inspect().pattern).toBe(authored[0])
    controller.update(context(values, 5, 'drop', 6))
    expect(controller.inspect().pattern).toBe(programs.drop)
    controller.update(context(values, 5.1, undefined, 6, 0, { trackId: 'another-track', generation: 2 }))
    expect(controller.inspect().pattern).toBe(authored[0])
  })
})

import { describe, expect, it } from 'vitest'
import { NEUTRAL_AUDIO_FRAME, NEUTRAL_TIMING_FRAME } from '../../audio/shaderAudioTypes'
import {
  PRISM_DROP_TRANSFORMATION_LIMITS,
  PRISM_DROP_TRANSFORMATION_PARAMETER_ID,
  PrismDropTransformationDirector,
  type PrismDropTransformationTargets,
} from '../prismDropTransformationDirector'
import { PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM } from '../prismEchoSystem'
import { PRISM_FACET_RUNTIME_UNIFORMS } from '../prismFacetIlluminationChoreographer'
import { PrismRuntimeParameterController } from '../prismRotationTorqueSystem'

function createTargets() {
  const apertureOffsets: number[] = []
  const torqueImpulses: number[] = []
  const facetFlares: number[] = []
  const echoBursts: number[] = []
  const targets: PrismDropTransformationTargets = {
    setApertureOffset: value => apertureOffsets.push(value),
    applyTorqueImpulse: value => torqueImpulses.push(value),
    requestFacetFlare: value => facetFlares.push(value),
    requestEchoBurst: value => echoBursts.push(value),
  }
  return { targets, apertureOffsets, torqueImpulses, facetFlares, echoBursts }
}

function advanceToImpact(
  director: PrismDropTransformationDirector,
  targets: PrismDropTransformationTargets,
  eventId = 'drop:1',
  intensity = 1,
) {
  director.step({ intensity, deltaTimeSec: 0.04, dropStart: { active: true, eventId } }, targets)
  return director.step({ intensity, deltaTimeSec: 0.04, dropStart: { active: true, eventId } }, targets)
}

describe('PrismDropTransformationDirector', () => {
  it('deduplicates one canonical drop identity and coordinates the existing runtime systems once', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()

    const impact = advanceToImpact(director, harness.targets)
    expect(impact.phase).toBe('impact')
    expect(harness.torqueImpulses).toHaveLength(1)
    expect(harness.facetFlares).toHaveLength(1)
    expect(harness.echoBursts).toHaveLength(1)

    director.step({ intensity: 1, deltaTimeSec: 0.06, dropStart: { active: true, eventId: 'drop:1' } }, harness.targets)
    expect(harness.torqueImpulses).toHaveLength(1)
    expect(harness.facetFlares).toHaveLength(1)
    expect(harness.echoBursts).toHaveLength(1)
  })

  it('uses time-based bounded phases and returns the aperture offset to zero', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    director.step({ intensity: 1, deltaTimeSec: 0, dropStart: { active: true, eventId: 'drop:timeline' } }, harness.targets)
    expect(director.getSnapshot().phase).toBe('tension')
    expect(director.getSnapshot().apertureOffset).toBe(PRISM_DROP_TRANSFORMATION_LIMITS.tensionApertureOffset)

    for (let index = 0; index < 12; index += 1) {
      director.step({ intensity: 1, deltaTimeSec: 0.1, dropStart: { active: false, eventId: null } }, harness.targets)
    }

    expect(director.getSnapshot()).toMatchObject({ phase: 'idle', activeIntensity: 0, apertureOffset: 0 })
    expect(harness.apertureOffsets.at(-1)).toBe(0)
  })

  it('restarts cleanly on a new drop during an active transformation without stacking intensity', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    advanceToImpact(director, harness.targets, 'drop:1', 0.7)

    const retriggered = director.step({
      intensity: 1,
      deltaTimeSec: 0,
      dropStart: { active: true, eventId: 'drop:2' },
    }, harness.targets)
    expect(retriggered).toMatchObject({ phase: 'tension', activeIntensity: 1, acceptedEventId: 'drop:2' })
    advanceToImpact(director, harness.targets, 'drop:2', 1)

    expect(harness.torqueImpulses).toHaveLength(2)
    expect(Math.max(...harness.torqueImpulses)).toBeLessThanOrEqual(PRISM_DROP_TRANSFORMATION_LIMITS.torqueImpulse)
    expect(harness.facetFlares).toHaveLength(2)
    expect(harness.echoBursts).toHaveLength(2)
  })

  it('treats zero intensity as disabled and consumes the event without a delayed surprise trigger', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    director.step({ intensity: 0, deltaTimeSec: 0.1, dropStart: { active: true, eventId: 'drop:disabled' } }, harness.targets)
    director.step({ intensity: 1, deltaTimeSec: 0.1, dropStart: { active: true, eventId: 'drop:disabled' } }, harness.targets)

    expect(director.getSnapshot().phase).toBe('idle')
    expect(harness.torqueImpulses).toHaveLength(0)
    expect(harness.facetFlares).toHaveLength(0)
    expect(harness.echoBursts).toHaveLength(0)
  })

  it('reconstructs safely during an active event and does not replay the same event after seek/remount', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    advanceToImpact(director, harness.targets, 'drop:seek')
    expect(harness.torqueImpulses).toHaveLength(1)

    director.step({
      intensity: 1,
      deltaTimeSec: 0.1,
      reconstruct: true,
      dropStart: { active: true, eventId: 'drop:seek' },
    }, harness.targets)
    director.step({ intensity: 1, deltaTimeSec: 0.1, dropStart: { active: true, eventId: 'drop:seek' } }, harness.targets)

    expect(director.getSnapshot().phase).toBe('idle')
    expect(harness.apertureOffsets.at(-1)).toBe(0)
    expect(harness.torqueImpulses).toHaveLength(1)
  })

  it('allows the same canonical event identity to fire again after a runtime reconstruction such as loop/replay', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    advanceToImpact(director, harness.targets, 'drop:loop')
    expect(harness.torqueImpulses).toHaveLength(1)

    director.step({
      intensity: 1,
      deltaTimeSec: 0,
      reconstruct: true,
      dropStart: { active: false, eventId: null },
    }, harness.targets)
    advanceToImpact(director, harness.targets, 'drop:loop')

    expect(harness.torqueImpulses).toHaveLength(2)
    expect(harness.facetFlares).toHaveLength(2)
    expect(harness.echoBursts).toHaveLength(2)
  })

  it('clears all coordinated runtime state when the Prism runtime controller resets during an active drop', () => {
    const controller = new PrismRuntimeParameterController()
    const authored = {
      rotation: 0.2,
      rotationDrive: 0.4,
      rotationTorque: 1,
      rotationDrag: 0.5,
      aperture: 1.15,
      facetChoreography: 0,
      echoAmount: 0,
      echoCount: 3,
      echoSpacing: 0.03,
      echoDecay: 0.62,
      tunnelRadius: 0.9,
      warp: 0.6,
      [PRISM_DROP_TRANSFORMATION_PARAMETER_ID]: 1,
    }
    const base = {
      values: authored,
      audio: NEUTRAL_AUDIO_FRAME,
      timing: NEUTRAL_TIMING_FRAME,
      reconstruct: false,
    }

    controller.resolve({ ...base, deltaTimeSec: 0.04, events: { dropStart: { active: true, eventId: 'drop:reset' } } })
    controller.resolve({ ...base, deltaTimeSec: 0.04, events: { dropStart: { active: true, eventId: 'drop:reset' } } })
    expect(controller.rotation.getSnapshot().impulseVelocity).toBeGreaterThan(0)
    expect(controller.illumination.getSnapshot(1).flare).toBeGreaterThan(0)

    controller.reset()
    const rebuilt = controller.resolve({
      ...base,
      deltaTimeSec: 0,
      reconstruct: true,
      events: { dropStart: { active: false, eventId: null } },
    })

    expect(controller.dropTransformation.getSnapshot().phase).toBe('idle')
    expect(controller.rotation.getSnapshot().impulseVelocity).toBe(0)
    expect(controller.illumination.getSnapshot(1).flare).toBe(0)
    expect(controller.getRuntimeFloatUniformValues()[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM]).toBe(0)
    expect(rebuilt.aperture).toBe(authored.aperture)
    expect(rebuilt.facetChoreography).toBe(authored.facetChoreography)
  })

  it('stays idle and finite when the host has no discrete drop payload', () => {
    const director = new PrismDropTransformationDirector()
    const harness = createTargets()
    const snapshot = director.step({ intensity: 1, deltaTimeSec: 0.1 }, harness.targets)
    expect(snapshot).toMatchObject({ phase: 'idle', apertureOffset: 0, facetAmountFloor: 0 })
    expect(Number.isFinite(snapshot.phaseProgress)).toBe(true)
    expect(harness.torqueImpulses).toHaveLength(0)
  })

  it('layers the event over authored Prism settings without mutating canonical values', () => {
    const controller = new PrismRuntimeParameterController()
    const authored = {
      rotation: 0.2,
      rotationDrive: 0.4,
      rotationTorque: 1,
      rotationDrag: 0.5,
      aperture: 1.15,
      facetChoreography: 0,
      echoAmount: 0,
      echoCount: 3,
      echoSpacing: 0.03,
      echoDecay: 0.62,
      tunnelRadius: 0.9,
      warp: 0.6,
      [PRISM_DROP_TRANSFORMATION_PARAMETER_ID]: 1,
    }
    const original = { ...authored }
    const base = {
      values: authored,
      audio: NEUTRAL_AUDIO_FRAME,
      timing: NEUTRAL_TIMING_FRAME,
      reconstruct: false,
    }

    controller.resolve({ ...base, deltaTimeSec: 0.04, events: { dropStart: { active: true, eventId: 'drop:controller' } } })
    controller.resolve({ ...base, deltaTimeSec: 0.04, events: { dropStart: { active: true, eventId: 'drop:controller' } } })
    const impacted = controller.resolve({ ...base, deltaTimeSec: 0.04, events: { dropStart: { active: false, eventId: null } } })

    expect(controller.rotation.getSnapshot().impulseVelocity).toBeGreaterThan(0)
    expect(controller.illumination.getSnapshot(1).flare).toBeGreaterThan(0)
    expect(impacted.facetChoreography as number).toBeGreaterThan(0)
    expect(controller.getRuntimeFloatUniformValues()[PRISM_FACET_RUNTIME_UNIFORMS.flare]).toBeGreaterThan(0)
    expect(controller.getRuntimeFloatUniformValues()[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM]).toBeGreaterThan(0)
    expect(impacted.aperture).not.toBe(authored.aperture)
    expect(authored).toEqual(original)
  })
})

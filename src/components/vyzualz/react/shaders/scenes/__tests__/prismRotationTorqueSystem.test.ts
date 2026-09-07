import { describe, expect, it } from 'vitest'
import { NEUTRAL_TIMING_FRAME } from '../../audio/shaderAudioTypes'
import {
  PRISM_ROTATION_DRIVE_PARAMETER_ID,
  PRISM_ROTATION_LIMITS,
  PRISM_ROTATION_PARAMETER_ID,
  PrismRotationTorqueSystem,
  PrismRuntimeParameterController,
} from '../prismRotationTorqueSystem'

const DEFAULT_SETTINGS = Object.freeze({
  drive: PRISM_ROTATION_LIMITS.drive.default,
  torque: PRISM_ROTATION_LIMITS.torque.default,
  drag: PRISM_ROTATION_LIMITS.drag.default,
})

function simulate(fps: number, seconds: number) {
  const system = new PrismRotationTorqueSystem()
  system.applyTorqueImpulse(0.75)
  const frames = Math.round(fps * seconds)
  for (let index = 0; index < frames; index += 1) {
    system.step(DEFAULT_SETTINGS, 1 / fps)
  }
  return system.getSnapshot()
}

describe('PrismRotationTorqueSystem', () => {
  it('integrates the same motion at 30/60/120-ish FPS', () => {
    const at30 = simulate(30, 1)
    const at60 = simulate(60, 1)
    const at120 = simulate(120, 1)

    expect(at30.angle).toBeCloseTo(at60.angle, 6)
    expect(at60.angle).toBeCloseTo(at120.angle, 6)
    expect(at30.angularVelocity).toBeCloseTo(at120.angularVelocity, 6)
  })

  it('bounds angular velocity under repeated maximum torque impulses', () => {
    const system = new PrismRotationTorqueSystem()
    for (let index = 0; index < 100; index += 1) {
      system.applyTorqueImpulse(1)
      system.step({ drive: 1.5, torque: 1, drag: 0 }, 1 / 120)
    }

    const snapshot = system.getSnapshot()
    expect(snapshot.angularVelocity).toBeLessThanOrEqual(PRISM_ROTATION_LIMITS.maxAngularVelocity)
    expect(snapshot.impulseVelocity).toBeLessThanOrEqual(PRISM_ROTATION_LIMITS.maxImpulseVelocity)
  })

  it('adds no event kick when torque is zero', () => {
    const system = new PrismRotationTorqueSystem()
    system.step({ drive: 0, torque: 0, drag: 0.5 }, 1 / 60, { phrase8Hit: true })
    expect(system.getSnapshot().impulseVelocity).toBe(0)

    system.applyTorqueImpulse(1)
    system.step({ drive: 0, torque: 0, drag: 0.5 }, 1 / 60)
    expect(system.getSnapshot().impulseVelocity).toBe(0)
  })

  it('supports signed torque impulses that can accelerate or decelerate motion', () => {
    const system = new PrismRotationTorqueSystem()
    for (let index = 0; index < 120; index += 1) {
      system.step({ drive: 0.8, torque: 1, drag: 0.2 }, 1 / 60)
    }
    const cruising = system.getSnapshot().angularVelocity

    system.applyTorqueImpulse(0.5)
    system.step({ drive: 0.8, torque: 1, drag: 0.2 }, 1 / 60)
    const accelerated = system.getSnapshot().angularVelocity

    system.applyTorqueImpulse(-1)
    system.step({ drive: 0.8, torque: 1, drag: 0.2 }, 1 / 60)
    const decelerated = system.getSnapshot().angularVelocity

    expect(accelerated).toBeGreaterThan(cruising)
    expect(decelerated).toBeLessThan(accelerated)
  })

  it('uses drag to settle transient impulse velocity without changing authored drive', () => {
    const system = new PrismRotationTorqueSystem()
    system.applyTorqueImpulse(1)
    system.step({ drive: 0.4, torque: 1, drag: 1 }, 1 / 60)
    const kicked = system.getSnapshot()

    for (let index = 0; index < 240; index += 1) {
      system.step({ drive: 0.4, torque: 1, drag: 1 }, 1 / 60)
    }
    const settled = system.getSnapshot()

    expect(Math.abs(settled.impulseVelocity)).toBeLessThan(Math.abs(kicked.impulseVelocity))
    expect(settled.angularVelocity).toBeCloseTo(0.4, 3)
  })

  it('reverses direction by decelerating through zero instead of negating velocity', () => {
    const system = new PrismRotationTorqueSystem()
    for (let index = 0; index < 120; index += 1) {
      system.step({ drive: 1, torque: 0, drag: 0.5 }, 1 / 60)
    }
    expect(system.getSnapshot().angularVelocity).toBeGreaterThan(0.9)

    const samples: number[] = []
    for (let index = 0; index < 120; index += 1) {
      system.step({ drive: -1, torque: 0, drag: 0.5 }, 1 / 60)
      samples.push(system.getSnapshot().angularVelocity)
    }

    expect(samples[0]).toBeGreaterThan(0)
    expect(samples.some(value => Math.abs(value) < 0.05)).toBe(true)
    expect(samples.at(-1)).toBeLessThan(-0.9)
  })

  it('clamps pathological frame gaps and stays finite', () => {
    const system = new PrismRotationTorqueSystem()
    system.applyTorqueImpulse(1)
    const before = system.getSnapshot().angle
    const after = system.step({ drive: 1.5, torque: 1, drag: 0 }, 30)

    expect(Number.isFinite(after.angle)).toBe(true)
    expect(Number.isFinite(after.angularVelocity)).toBe(true)
    expect(Math.abs(after.angle - before)).toBeLessThan(PRISM_ROTATION_LIMITS.maxAngularVelocity * 0.051)
  })

  it('remains bounded during rapid signed-drive toggles', () => {
    const system = new PrismRotationTorqueSystem()
    for (let index = 0; index < 600; index += 1) {
      system.step({ drive: index % 2 === 0 ? 1.5 : -1.5, torque: 1, drag: 0.7 }, 1 / 120)
      const snapshot = system.getSnapshot()
      expect(Number.isFinite(snapshot.angle)).toBe(true)
      expect(Math.abs(snapshot.angularVelocity)).toBeLessThanOrEqual(PRISM_ROTATION_LIMITS.maxAngularVelocity)
    }
  })

  it('reconstructs runtime motion from canonical values without mutating them', () => {
    const controller = new PrismRuntimeParameterController()
    const authored = {
      rotation: 0.7,
      rotationDrive: 0.9,
      rotationTorque: 1,
      rotationDrag: 0.5,
      aperture: 1.2,
    }

    controller.applyImpulse(PRISM_ROTATION_PARAMETER_ID, 1)
    const moving = controller.resolve({ values: authored, deltaTimeSec: 1 / 30, reconstruct: false })
    expect(Math.abs(moving[PRISM_ROTATION_DRIVE_PARAMETER_ID] as number)).toBeGreaterThan(0)
    expect(authored.rotationDrive).toBe(0.9)

    const rebuilt = controller.resolve({ values: authored, deltaTimeSec: 1 / 60, reconstruct: true })
    expect(rebuilt[PRISM_ROTATION_DRIVE_PARAMETER_ID]).toBe(0)
    expect(rebuilt.rotation).toBe(0.7)
    expect(rebuilt.aperture).toBe(1.2)
    expect(authored).toEqual({
      rotation: 0.7,
      rotationDrive: 0.9,
      rotationTorque: 1,
      rotationDrag: 0.5,
      aperture: 1.2,
    })
  })

  it('turns the existing phrase-8 pulse into a physical torque kick only once per pulse', () => {
    const controller = new PrismRuntimeParameterController()
    const values = {
      rotation: 0,
      rotationDrive: 0.15,
      rotationTorque: 1,
      rotationDrag: 0.5,
      aperture: 1,
    }

    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: true, timing: { ...NEUTRAL_TIMING_FRAME, phrase8Hit: 0 } })
    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: false, timing: { ...NEUTRAL_TIMING_FRAME, phrase8Hit: 1 } })
    const kicked = controller.rotation.getSnapshot().impulseVelocity
    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: false, timing: { ...NEUTRAL_TIMING_FRAME, phrase8Hit: 1 } })
    const held = controller.rotation.getSnapshot().impulseVelocity

    expect(kicked).toBeGreaterThan(0)
    expect(held).toBeLessThan(kicked)
  })
})

import { describe, expect, it } from 'vitest'

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2CameraManifest,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST } from '../presets/Cinema2AtmosphereReferencePreset'
import { cinema2CinematicMotion } from '../presets/Cinema2CameraMotionAuthoring'
import { Cinema2CameraRuntime, cinema2CameraDriftNoise } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const CAMERA_ID = cinema2StableId<Cinema2CameraId>('motion-camera')
const MOTION_AMOUNT_ID = cinema2StableId<Cinema2ParameterId>('motion-amount')
const FOV_ID = cinema2StableId<Cinema2ParameterId>('motion-fov')

function manifest(camera: Partial<Cinema2CameraManifest>, withControls = false): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.camera-motion-test'),
    revision: 1,
    metadata: { name: 'camera motion' },
    parameters: [
      { id: MOTION_AMOUNT_ID, label: 'Motion', type: 'float', defaultValue: 1, min: 0, max: 2 },
      { id: FOV_ID, label: 'FOV', type: 'float', defaultValue: 40, min: 1, max: 179 },
    ],
    cameras: [{
      id: CAMERA_ID,
      label: 'Motion',
      projection: 'perspective',
      target: [0, 0, 0],
      fovDegrees: 40,
      controls: withControls ? { ...(camera.motion ? { motionAmount: cinema2Ref(MOTION_AMOUNT_ID) } : {}), fovDegrees: cinema2Ref(FOV_ID) } : undefined,
      ...camera,
    }],
    defaults: { camera: cinema2Ref(CAMERA_ID) },
  } as Cinema2NativePresetManifest
}

function build(camera: Partial<Cinema2CameraManifest>, withControls = false) {
  const compiled = compileCinema2NativePreset(manifest(camera, withControls))
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(entry => `${entry.path}: ${entry.message}`).join('; '))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
  return { plan: compiled.plan, state, resolver, camera: new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial) }
}

function frame(elapsedTimeSec: number, deltaTimeSec = 1 / 60): Cinema2ModuleFrameReadContext {
  return {
    frameId: Math.max(1, Math.round(elapsedTimeSec * 60) + 1),
    timestampMs: elapsedTimeSec * 1000,
    deltaTimeSec,
    elapsedTimeSec,
    viewport: { width: 800, height: 400, dpr: 1 },
    contextGeneration: 1,
    audio: null,
    director: null,
  }
}

/** Runs the camera for `seconds` at 60 fps and returns every frame. */
function run(camera: Cinema2CameraRuntime, seconds: number, from = 0) {
  const frames = []
  for (let step = 0; step <= Math.round(seconds * 60); step += 1) frames.push(camera.update(frame(from + step / 60)))
  return frames
}

const angleBetween = (a: readonly number[], b: readonly number[]) => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]))))) * 180 / Math.PI
}
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

// A zig-zag with very uneven point spacing: worst case for corners and uneven speed.
const ZIGZAG = [
  { position: [0, 1, 10] as const },
  { position: [2, 1, 9] as const },
  { position: [10, 2, 4] as const },
  { position: [11, 1, 5] as const },
  { position: [14, 1, -2] as const },
].map(point => ({ position: [...point.position] as [number, number, number] }))

describe('Cinema 2.0 camera motion: spline paths', () => {
  it('keeps linear paths exactly as authored (corners and uneven speed) unless a spline is requested', () => {
    const { camera } = build({ rig: { kind: 'path', points: ZIGZAG, durationSeconds: 10 } })
    const frames = run(camera, 10)
    const steps = frames.slice(1).map((current, index) => Math.hypot(...sub(current.position, frames[index].position)))
    expect(Math.max(...steps) / Math.min(...steps.filter(step => step > 0))).toBeGreaterThan(3)
    expect(frames[0].rollDegrees).toBe(0)
  })

  it('removes corners: heading changes smoothly through every interior waypoint', () => {
    const cornerAngle = (interpolation?: 'spline') => {
      const { camera } = build({ rig: { kind: 'path', points: ZIGZAG, durationSeconds: 40 }, motion: interpolation ? { interpolation, constantSpeed: false } : { } })
      const frames = run(camera, 40)
      let worst = 0
      for (let index = 2; index < frames.length; index += 1) {
        worst = Math.max(worst, angleBetween(sub(frames[index - 1].position, frames[index - 2].position), sub(frames[index].position, frames[index - 1].position)))
      }
      return worst
    }
    expect(cornerAngle()).toBeGreaterThan(20)
    expect(cornerAngle('spline')).toBeLessThan(3)
  })

  it('passes through every waypoint and can travel at constant speed', () => {
    const uniform = build({ rig: { kind: 'path', points: ZIGZAG, durationSeconds: 8 }, motion: { interpolation: 'spline', constantSpeed: false } })
    const start = uniform.camera.update(frame(0))
    expect(start.position).toEqual(ZIGZAG[0].position)
    const end = uniform.camera.update(frame(8))
    expect(end.position[0]).toBeCloseTo(14, 4)
    expect(end.position[2]).toBeCloseTo(-2, 4)
    const atThird = uniform.camera.update(frame(4))
    expect(atThird.position[0]).toBeCloseTo(10, 4)

    const constant = build({ rig: { kind: 'path', points: ZIGZAG, durationSeconds: 10 }, motion: { interpolation: 'spline' } })
    const frames = run(constant.camera, 10)
    const steps = frames.slice(1).map((current, index) => Math.hypot(...sub(current.position, frames[index].position)))
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.03)
  })

  it('loops seamlessly: the closing segment joins the last point back to the first without a kink', () => {
    const { camera } = build({ rig: { kind: 'fly', points: ZIGZAG, durationSeconds: 20, loop: true }, motion: { interpolation: 'spline' } })
    const frames = run(camera, 20, 0)
    expect(Math.hypot(...sub(frames[0].position, frames[frames.length - 1].position))).toBeLessThan(0.2)
    const before = sub(frames[frames.length - 1].position, frames[frames.length - 2].position)
    const after = sub(camera.update(frame(20 + 1 / 60)).position, frames[frames.length - 1].position)
    expect(angleBetween(before, after)).toBeLessThan(3)
  })

  it('derives spline path duration from arc length and speed', () => {
    const { camera } = build({ rig: { kind: 'path', points: ZIGZAG, speed: 2 }, motion: { interpolation: 'spline' } })
    const halfway = camera.update(frame(2))
    const fresh = build({ rig: { kind: 'path', points: ZIGZAG, speed: 2 }, motion: { interpolation: 'spline' } }).camera.update(frame(0))
    // Speed is in world units per second along the curve: after 2 s the camera is roughly 4 units along it.
    expect(Math.hypot(...sub(halfway.position, fresh.position))).toBeGreaterThan(3)
    expect(Math.hypot(...sub(halfway.position, fresh.position))).toBeLessThan(4.1)
  })
})

describe('Cinema 2.0 camera motion: drift', () => {
  const still = { rig: { kind: 'static' as const }, transform: { position: [0, 1, 8] as [number, number, number] } }

  it('produces bounded, smooth, deterministic wander', () => {
    for (let channel = 0; channel < 8; channel += 1) {
      for (let t = 0; t < 60; t += 0.37) expect(Math.abs(cinema2CameraDriftNoise(t, 0.08, 3, channel))).toBeLessThanOrEqual(1)
    }
    const a = run(build({ ...still, motion: { drift: { position: 0.3, target: 0.1, rollDegrees: 1, fovDegrees: 1 } } }).camera, 20)
    const b = run(build({ ...still, motion: { drift: { position: 0.3, target: 0.1, rollDegrees: 1, fovDegrees: 1 } } }).camera, 20)
    expect(a.map(entry => entry.position)).toEqual(b.map(entry => entry.position))
    const xs = a.map(entry => entry.position[0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.05)
    expect(Math.max(...xs.map(x => Math.abs(x)))).toBeLessThanOrEqual(0.3 + 1e-9)
    // Smooth: no frame-to-frame jump anywhere near the amplitude.
    expect(Math.max(...xs.slice(1).map((x, index) => Math.abs(x - xs[index])))).toBeLessThan(0.01)
    expect(Math.max(...a.map(entry => Math.abs(entry.rollDegrees)))).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('is off by default and a different seed changes the pattern', () => {
    const off = run(build({ ...still }).camera, 5)
    expect(new Set(off.map(entry => entry.position.join())).size).toBe(1)
    const seedA = run(build({ ...still, motion: { drift: { position: 0.3, seed: 1 } } }).camera, 5)
    const seedB = run(build({ ...still, motion: { drift: { position: 0.3, seed: 2 } } }).camera, 5)
    expect(seedA[100].position).not.toEqual(seedB[100].position)
  })

  it('is scaled by the motionAmount control, down to a locked-off camera', () => {
    const { camera, state } = build({ ...still, motion: { drift: { position: 0.3 } } }, true)
    const full = run(camera, 20).map(entry => entry.position[0])
    state.setPersistentValue(MOTION_AMOUNT_ID, 0)
    const locked = run(camera, 20, 20).map(entry => entry.position[0])
    expect(Math.max(...full) - Math.min(...full)).toBeGreaterThan(0.05)
    expect(new Set(locked).size).toBe(1)
  })
})

describe('Cinema 2.0 camera motion: bank and roll', () => {
  const orbit = (angularVelocityDegreesPerSecond: number, bank = { maxDegrees: 6, gain: 0.6, smoothingMs: 200 }) => build({
    rig: { kind: 'orbit', radius: 8, azimuthDegrees: 0, elevationDegrees: 10, angularVelocityDegreesPerSecond },
    motion: { bank },
  })

  it('banks into a turn, stays within maxDegrees, and leans opposite ways for opposite turns', () => {
    const left = run(orbit(20).camera, 6).slice(60)
    const right = run(orbit(-20).camera, 6).slice(60)
    expect(Math.max(...left.map(entry => Math.abs(entry.rollDegrees)))).toBeLessThanOrEqual(6 + 1e-9)
    expect(left[left.length - 1].rollDegrees).toBeLessThan(-1)
    expect(right[right.length - 1].rollDegrees).toBeGreaterThan(1)
    // Positive roll is a right bank: world up leans left in camera space.
    expect(right[right.length - 1].viewMatrix[4]).toBeLessThan(0)
    expect(left[left.length - 1].viewMatrix[4]).toBeGreaterThan(0)
  })

  it('stays level on a straight run and relaxes back to level when the turn ends', () => {
    const straight = build({
      rig: { kind: 'path', points: [{ position: [0, 1, 10] }, { position: [0, 1, -10] }], durationSeconds: 10 },
      motion: { bank: { maxDegrees: 6 } },
    })
    expect(Math.max(...run(straight.camera, 10).map(entry => Math.abs(entry.rollDegrees)))).toBeLessThan(0.01)
    const stopped = orbit(0)
    expect(Math.max(...run(stopped.camera, 3).map(entry => Math.abs(entry.rollDegrees)))).toBeLessThan(0.01)
  })

  it('exposes a writable roll target that composes with authored roll, only on cameras that author motion', () => {
    const withMotion = build({ rig: { kind: 'static' }, transform: { position: [0, 1, 8] }, motion: { rollDegrees: 2 } })
    const target = withMotion.plan.targets.targets.find(candidate => candidate.kind === 'camera' && candidate.property === 'roll')
    expect(target).toBeDefined()
    const settled = run(withMotion.camera, 0.1)
    expect(settled[settled.length - 1].rollDegrees).toBeCloseTo(2)
    const published = withMotion.resolver.replaceTransientContributions('choreography', [{
      targetId: target!.id,
      contribution: { contributorId: 'choreography:test:roll', operation: 'add', value: 3, priority: 1 },
    }])
    expect(published.diagnostics).toEqual([])
    expect(withMotion.camera.update(frame(1)).rollDegrees).toBeCloseTo(5)

    const plain = build({ rig: { kind: 'static' }, transform: { position: [0, 1, 8] } })
    expect(plain.plan.targets.targets.some(candidate => candidate.kind === 'camera' && candidate.property === 'roll')).toBe(false)
  })
})

describe('Cinema 2.0 camera motion: restrained FOV', () => {
  it('limits how fast the lens can change', () => {
    const { camera, state } = build({ rig: { kind: 'static' }, transform: { position: [0, 1, 8] }, motion: { fovRateLimitDegreesPerSecond: 10 } }, true)
    camera.update(frame(0))
    state.setPersistentValue(FOV_ID, 90)
    const frames = run(camera, 1, 1 / 60)
    expect(frames[frames.length - 1].fovDegrees).toBeGreaterThan(48)
    expect(frames[frames.length - 1].fovDegrees).toBeLessThan(52)
    expect(Math.max(...frames.slice(1).map((entry, index) => Math.abs(entry.fovDegrees - frames[index].fovDegrees)))).toBeLessThan(10 / 60 + 1e-6)
    const unrestricted = build({ rig: { kind: 'static' }, transform: { position: [0, 1, 8] } }, true)
    unrestricted.camera.update(frame(0))
    unrestricted.state.setPersistentValue(FOV_ID, 90)
    expect(unrestricted.camera.update(frame(1 / 60)).fovDegrees).toBeCloseTo(90)
  })
})

describe('Cinema 2.0 camera motion: authoring validation', () => {
  const codes = (camera: Partial<Cinema2CameraManifest>, withControls = false) => {
    const result = compileCinema2NativePreset(manifest(camera, withControls))
    return result.ok ? [] : result.diagnostics.map(entry => entry.code)
  }

  it('accepts sensible motion and rejects malformed motion', () => {
    expect(codes({ rig: { kind: 'path', points: ZIGZAG, durationSeconds: 5 }, motion: { interpolation: 'spline', drift: { position: 0.1 }, bank: { maxDegrees: 4 }, fovRateLimitDegreesPerSecond: 8 } })).toEqual([])
    expect(codes({ motion: { bank: { maxDegrees: 90 } } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ motion: { drift: { position: -1 } } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ motion: { drift: { speed: 0 } } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ motion: { rollDegrees: 80 } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ rig: { kind: 'orbit' }, motion: { interpolation: 'spline' } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
    expect(codes({ motion: { interpolation: 'cubic' as never } })).toContain('CINEMA2_PRESET_CAMERA_MOTION_INVALID')
  })

  it('requires motion to be authored for the motionAmount control', () => {
    expect(codes({ motion: { drift: { position: 0.1 } } }, true)).toEqual([])
    const withoutMotion = compileCinema2NativePreset({
      ...manifest({}),
      cameras: [{ ...manifest({}).cameras![0], controls: { motionAmount: cinema2Ref(MOTION_AMOUNT_ID) } }],
    })
    expect(withoutMotion.ok).toBe(false)
    expect(withoutMotion.diagnostics.map(entry => entry.code)).toContain('CINEMA2_PRESET_CAMERA_CONTROLS_INVALID')
  })
})

describe('Cinema 2.0 cinematic motion presets and the Atmosphere Reference dolly', () => {
  it('orders the named levels from calm to lively and only adds a spline for path rigs on request', () => {
    const [steady, gentle, dynamic] = (['steady', 'gentle', 'dynamic'] as const).map(level => cinema2CinematicMotion(level))
    expect(steady.drift!.position!).toBeLessThan(gentle.drift!.position!)
    expect(gentle.drift!.position!).toBeLessThan(dynamic.drift!.position!)
    expect(steady.bank!.maxDegrees).toBeLessThan(dynamic.bank!.maxDegrees)
    expect(gentle.interpolation).toBeUndefined()
    expect(cinema2CinematicMotion('gentle', { splinePath: true })).toMatchObject({ interpolation: 'spline', constantSpeed: true })
    expect(cinema2CinematicMotion('gentle', { overrides: { fovRateLimitDegreesPerSecond: 3 } }).fovRateLimitDegreesPerSecond).toBe(3)
  })

  it('keeps the reference dolly above the floor plane, within its bank and lens limits, all the way around the loop', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, {
      availableCapabilities: ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.downbeat', 'music.phrase', 'visual-director.significance'],
    })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, spatial)
    const frames = []
    for (let step = 0; step <= 85 * 30; step += 1) frames.push(camera.update(frame(step / 30, 1 / 30)))
    const floorY = -1.2
    expect(Math.min(...frames.map(entry => entry.position[1]))).toBeGreaterThan(floorY + 1)
    expect(Math.max(...frames.map(entry => Math.abs(entry.rollDegrees)))).toBeLessThan(3 + 0.4 + 0.5)
    expect(Math.max(...frames.map(entry => entry.fovDegrees)) - Math.min(...frames.map(entry => entry.fovDegrees))).toBeLessThan(2)
    // The 80 s loop returns to where it started.
    expect(Math.hypot(...sub(frames[80 * 30].position, frames[0].position))).toBeLessThan(0.5)
  })
})

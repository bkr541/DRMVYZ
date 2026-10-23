import { describe, expect, it } from 'vitest'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS, type Cinema2BlockshiftInstance } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { buildCinema2BlockshiftLayout, cinema2BlockshiftHalfExtents } from '../modules/blockshift/Cinema2BlockshiftLayout'
import { blendCinema2BlockshiftPoses, Cinema2BlockshiftOrchestration } from '../modules/blockshift/Cinema2BlockshiftOrchestration'
import { CINEMA2_BLOCKSHIFT_PRESET_MANIFEST as manifest, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../presets/Cinema2BlockshiftPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

function frame(index: number, paused = false): Cinema2ModuleFrameReadContext {
  return { frameId: index + 1, timestampMs: index * 100, deltaTimeSec: 0.1, elapsedTimeSec: index * 0.1, contextGeneration: 1,
    viewport: { width: 960, height: 540, dpr: 1 }, audio: null, director: null,
    transport: { sourcePresent: true, playing: !paused, paused, animationActive: !paused, analysisActive: true, trackId: 'p4-test', timeSec: index * 0.1, bpmSync: false, bpm: 120 } }
}
function safe(blocks: readonly Readonly<Cinema2BlockshiftInstance>[]) {
  expect(blocks).toHaveLength(15)
  for (const block of blocks) {
    expect(block.position.every(Number.isFinite)).toBe(true)
    expect(Math.hypot(...block.position) - Math.sqrt(3) * block.size / 2).toBeGreaterThanOrEqual(2.5 - 1e-8)
    expect(Math.hypot(...block.position) + Math.sqrt(3) * block.size / 2).toBeLessThanOrEqual(300)
    const extent = cinema2BlockshiftHalfExtents(block)
    for (const other of blocks.slice(0, block.index)) {
      const otherExtent = cinema2BlockshiftHalfExtents(other)
      expect(block.position.some((value, axis) => Math.abs(value - other.position[axis]!) >= extent[axis]! + otherExtent[axis]! + 1.5 - 1e-8)).toBe(true)
    }
  }
}
function cameraFixture(smoothingMs?: number) {
  const compiled = compileCinema2NativePreset(smoothingMs == null ? manifest : { ...manifest, cameras: manifest.cameras!.map(camera => ({ ...camera, smoothingMs })) })
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId ? state.getValue(target.parameterId) : target.authoredBaseValue })
  const camera = new Cinema2CameraRuntime(compiled.plan, state, resolver, new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver))
  return { state, camera }
}

describe('BLOCKSHIFT P4 authored motion and transitions', () => {
  it('has six distinct spatial trajectories, all moving with a stationary camera', () => {
    const trajectories = new Set<string>()
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) {
      const poses = [0, 0.25, 0.5, 0.75].map(phase => buildCinema2BlockshiftLayout({ pattern, phase }))
      expect(poses[0]!.map(block => block.position)).not.toEqual(poses[1]!.map(block => block.position))
      trajectories.add(JSON.stringify(poses.map(pose => pose.map(block => block.position))))
    }
    expect(trajectories.size).toBe(6)
  })

  it('keeps animation safe through complete cycles at the geometry extrema', () => {
    for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const blockSize of [1.35, 3]) for (const spread of [0.5, 3]) for (const depth of [0, 1]) for (const phase of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
      safe(buildCinema2BlockshiftLayout({ pattern, blockSize, spread, depth, phase, rotationRange: 45 }))
    }
  })

  it('keeps every pattern pair outside the observer and separated through mid-transition', () => {
    for (const from of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const to of CINEMA2_BLOCKSHIFT_PATTERN_IDS) {
      if (from === to) continue
      for (const blockSize of [1.35, 3]) {
        const a = buildCinema2BlockshiftLayout({ pattern: from, phase: 0.27, blockSize, rotationRange: 45 })
        const b = buildCinema2BlockshiftLayout({ pattern: to, phase: 0.71, blockSize, rotationRange: 45 })
        for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) safe(blendCinema2BlockshiftPoses(a, b, progress))
      }
    }
  })

  it('retargets from the current visible pose, honors duration and idle editing, and freezes paused transitions', () => {
    const controller = new Cinema2BlockshiftOrchestration()
    const stack = buildCinema2BlockshiftLayout({ pattern: 'stack' }), orbit = buildCinema2BlockshiftLayout({ pattern: 'orbit', phase: 0.1 }), wave = buildCinema2BlockshiftLayout({ pattern: 'wave', phase: 0.2 })
    const input = { target: stack, pattern: 'stack' as const, geometryKey: 'same', deltaBeats: 0.25, deltaSeconds: 0.1, durationBeats: 1, active: true, frozen: false }
    controller.update(input)
    expect(controller.update({ ...input, pattern: 'orbit', target: orbit })).toEqual(stack)
    const moving = controller.update({ ...input, pattern: 'orbit', target: orbit })
    expect(controller.getProgress()).toBe(0.25)
    expect(controller.update({ ...input, pattern: 'wave', target: wave })).toEqual(moving)
    expect(controller.update({ ...input, pattern: 'wave', target: wave, frozen: true })).toEqual(moving)
    controller.update({ ...input, pattern: 'wave', target: wave, active: false, deltaSeconds: 0.25 })
    expect(controller.getProgress()).toBe(0.5)
    controller.update({ ...input, pattern: 'wave', target: wave, frozen: true, durationBeats: 4 })
    expect(controller.getProgress()).toBe(0.5)
    for (let i = 0; i < 12; i++) controller.update({ ...input, pattern: 'wave', target: wave, durationBeats: 4 })
    expect(controller.getProgress()).toBe(1)
    expect(controller.update({ ...input, pattern: 'stack', target: stack, geometryKey: 'manual-size-edit' })).toEqual(stack)
  })

  it('uses the selected 0.5/1/2/4-beat duration without altering source or target identities', () => {
    for (const durationBeats of [0.5, 1, 2, 4]) {
      const controller = new Cinema2BlockshiftOrchestration()
      const a = buildCinema2BlockshiftLayout({ pattern: 'stack' }), b = buildCinema2BlockshiftLayout({ pattern: 'orbit' })
      const input = { target: a, pattern: 'stack' as const, geometryKey: 'same', deltaBeats: 0.25, deltaSeconds: 0.1, durationBeats, active: true, frozen: false }
      controller.update(input); controller.update({ ...input, target: b, pattern: 'orbit' })
      for (let i = 0; i < durationBeats * 4; i++) controller.update({ ...input, target: b, pattern: 'orbit' })
      expect(controller.getProgress()).toBe(1)
    }
  })
})

describe('BLOCKSHIFT P4 shared floating camera', () => {
  it('binds real camera controls and exposes Transition Length in the ordinary Inspector', () => {
    expect(manifest.parameters!.find(p => p.id === ids.transitionLength)?.exposure).toBe('primary')
    expect(manifest.cameras![0]!.controls).toMatchObject({ motionEnabled: { $ref: ids.cameraMotion }, motionSpeed: { $ref: ids.cameraFloatSpeed }, motionAmount: { $ref: ids.cameraFloatAmount }, fovDegrees: { $ref: ids.cameraFov } })
  })

  it('moves within the central safe volume, responds to Float Speed and Amount, and hard-disables at OFF or master zero', () => {
    const slow = cameraFixture(), fast = cameraFixture()
    for (const fixture of [slow, fast]) { fixture.state.setPersistentValue(ids.motionAmount, 1); fixture.state.setPersistentValue(ids.cameraFloatAmount, 1) }
    slow.state.setPersistentValue(ids.cameraFloatSpeed, 0.25); fast.state.setPersistentValue(ids.cameraFloatSpeed, 2)
    const initial = fast.camera.update(frame(0))
    for (let i = 1; i <= 60; i++) {
      slow.camera.update(frame(i)); const pose = fast.camera.update(frame(i))
      expect(Math.hypot(...pose.position)).toBeLessThan(1)
    }
    expect(fast.camera.getFrame().position).not.toEqual(initial.position)
    expect(fast.camera.getFrame().position).not.toEqual(slow.camera.getFrame().position)
    fast.state.setPersistentValue(ids.cameraMotion, false)
    expect(fast.camera.update(frame(61)).position).toEqual([0, 0, 0])
    fast.state.setPersistentValue(ids.cameraMotion, true); fast.state.setPersistentValue(ids.motionAmount, 0)
    expect(fast.camera.update(frame(62)).position).toEqual([0, 0, 0])
    fast.state.setPersistentValue(ids.motionAmount, 1); fast.state.setPersistentValue(ids.cameraFloatAmount, 0)
    expect(fast.camera.update(frame(63)).position).toEqual([0, 0, 0])
  })

  it('freezes pause, resumes without catch-up, applies manual FOV while stopped, and rebases on seek/track changes', () => {
    const fixture = cameraFixture()
    for (let i = 0; i <= 10; i++) fixture.camera.update(frame(i))
    const before = fixture.camera.getFrame()
    for (let i = 11; i <= 40; i++) expect(fixture.camera.update(frame(i, true)).position).toEqual(before.position)
    const resumed = fixture.camera.update(frame(41))
    expect(Math.hypot(...resumed.position.map((value, axis) => value - before.position[axis]!))).toBeLessThan(0.05)
    fixture.state.setPersistentValue(ids.cameraFov, 60)
    expect(fixture.camera.update(frame(42, true)).fovDegrees).toBe(60)
    const source = frame(43)
    const reset = fixture.camera.update({ ...source, transport: { ...source.transport!, trackId: 'new-track', timeSec: 0 } })
    const fresh = cameraFixture(); fresh.state.setPersistentValue(ids.cameraFov, 60)
    expect(reset.position).toEqual(fresh.camera.update(frame(0)).position)
  })
})


describe('BLOCKSHIFT additive orbit camera', () => {
  const relativeHeading = (base: ReturnType<typeof cameraFixture>, orbit: ReturnType<typeof cameraFixture>) => {
    const direction = (fixture: typeof base) => { const pose = fixture.camera.getFrame(); return Math.atan2(pose.target[0] - pose.position[0], pose.target[2] - pose.position[2]) }
    return ((direction(orbit) - direction(base) + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  }
  it('adds orbit to float and integrates the speed slider without replacing or speeding up the float', () => {
    const base = cameraFixture(0), slow = cameraFixture(0), fast = cameraFixture(0)
    for (const fixture of [slow, fast]) fixture.state.setPersistentValue(ids.orbitCamera, true)
    slow.state.setPersistentValue(ids.orbitIntensity, 0.25); fast.state.setPersistentValue(ids.orbitIntensity, 1)
    for (let i = 0; i <= 60; i++) for (const fixture of [base, slow, fast]) fixture.camera.update(frame(i))
    expect(Math.abs(relativeHeading(base, slow))).toBeCloseTo(36 * Math.PI / 180, 6)
    expect(Math.abs(relativeHeading(base, fast))).toBeCloseTo(144 * Math.PI / 180, 6)
    expect(fast.camera.getFrame().position[1]).toBe(base.camera.getFrame().position[1])
    expect(Math.hypot(...fast.camera.getFrame().position)).toBeCloseTo(Math.hypot(...base.camera.getFrame().position), 6)
    const before = relativeHeading(base, fast)
    fast.state.setPersistentValue(ids.orbitIntensity, 0)
    for (let i = 61; i <= 65; i++) for (const fixture of [base, fast]) fixture.camera.update(frame(i))
    expect(relativeHeading(base, fast)).toBeCloseTo(before, 6)
    fast.state.setPersistentValue(ids.orbitIntensity, 1); fast.state.setPersistentValue(ids.orbitCamera, false)
    for (let i = 66; i <= 70; i++) for (const fixture of [base, fast]) fixture.camera.update(frame(i))
    expect(relativeHeading(base, fast)).toBeCloseTo(before, 6)
    fast.state.setPersistentValue(ids.orbitCamera, true)
    for (const fixture of [base, fast]) fixture.camera.update(frame(71))
    expect(Math.abs(relativeHeading(base, fast) - before)).toBeCloseTo(2.4 * Math.PI / 180, 6)
  })

  it('supports a complete turn inside the observer volume, freezes pause, honors parent/master zero and resets on seek', () => {
    const fixture = cameraFixture(0); fixture.state.setPersistentValue(ids.orbitCamera, true); fixture.state.setPersistentValue(ids.orbitIntensity, 1)
    let rearSeen = false
    for (let i = 0; i <= 150; i++) {
      const pose = fixture.camera.update(frame(i)); expect(Math.hypot(...pose.position)).toBeLessThan(1)
      expect(pose.viewProjectionMatrix.every(Number.isFinite)).toBe(true)
      expect(Math.hypot(...pose.target.map((v, a) => v - pose.position[a]!))).toBeGreaterThan(9)
      rearSeen ||= pose.target[2] > 0
    }
    expect(rearSeen).toBe(true)
    const before = fixture.camera.getFrame()
    for (let i = 151; i <= 160; i++) expect(fixture.camera.update(frame(i, true)).viewProjectionMatrix).toEqual(before.viewProjectionMatrix)
    fixture.state.setPersistentValue(ids.cameraMotion, false)
    expect(fixture.camera.update(frame(161)).position).toEqual([0, 0, 0])
    expect(fixture.camera.getFrame().target).toEqual([0, 0, -10])
    fixture.state.setPersistentValue(ids.cameraMotion, true); fixture.state.setPersistentValue(ids.motionAmount, 0)
    expect(fixture.camera.update(frame(162)).target).toEqual([0, 0, -10])
    fixture.state.setPersistentValue(ids.motionAmount, 0.55)
    const sought = { ...frame(163), transport: { ...frame(163).transport!, timeSec: 0 } }
    const pose = fixture.camera.update(sought)
    const fresh = cameraFixture(0); fresh.state.setPersistentValue(ids.orbitCamera, true); fresh.state.setPersistentValue(ids.orbitIntensity, 1)
    expect(pose.viewProjectionMatrix).toEqual(fresh.camera.update(frame(0)).viewProjectionMatrix)
  })

  it('validates additive orbit configuration and control types without requiring an outside orbit rig', () => {
    expect(compileCinema2NativePreset(manifest).ok).toBe(true)
    const withoutOrbit = { ...manifest, cameras: manifest.cameras!.map(camera => ({ ...camera, motion: { ...camera.motion, orbit: undefined } })) }
    expect(compileCinema2NativePreset(withoutOrbit).ok).toBe(false)
    const badSpeed = { ...manifest, cameras: manifest.cameras!.map(camera => ({ ...camera, motion: { ...camera.motion, orbit: { angularSpeedDegreesPerSecond: -1 } } })) }
    expect(compileCinema2NativePreset(badSpeed).ok).toBe(false)
    const badBinding = { ...manifest, cameras: manifest.cameras!.map(camera => ({ ...camera, controls: { ...camera.controls, orbitMotionEnabled: { $ref: ids.orbitIntensity } } })) }
    expect(compileCinema2NativePreset(badBinding).ok).toBe(false)
  })
})

it('keeps the complete float/orbit camera inside the exclusion volume for every pattern, lens and aspect', () => {
  for (const [width, height] of [[960, 540], [720, 720], [540, 960]]) for (const fov of [60, 85, 100]) {
    const fixture = cameraFixture()
    for (const [id, value] of [[ids.motionAmount, 1], [ids.cameraFloatAmount, 1], [ids.cameraFloatSpeed, 2], [ids.orbitCamera, true], [ids.orbitIntensity, 1], [ids.cameraFov, fov]] as const) fixture.state.setPersistentValue(id, value)
    // A full turn: continuous drift and the observer's lens must never reach the cube envelope.
    for (let i = 0; i <= 150; i++) {
      const pose = fixture.camera.update({ ...frame(i), viewport: { width: width!, height: height!, dpr: 1 } })
      expect(pose.viewProjectionMatrix.every(Number.isFinite)).toBe(true)
      expect(Math.hypot(...pose.position)).toBeLessThan(1)
      if (i % 25 !== 0) continue
      for (const pattern of CINEMA2_BLOCKSHIFT_PATTERN_IDS) for (const block of buildCinema2BlockshiftLayout({ pattern, phase: i / 150, blockSize: 3, spread: 0.5, depth: 1, rotationRange: 45 })) {
        expect(Math.hypot(...block.position.map((n, a) => n - pose.position[a]!)) - block.size * Math.sqrt(3) / 2).toBeGreaterThan(0.2)
      }
    }
  }
})

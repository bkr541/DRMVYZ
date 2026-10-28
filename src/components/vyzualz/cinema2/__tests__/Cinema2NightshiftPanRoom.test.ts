import { describe, expect, it } from 'vitest'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_NIGHTSHIFT_PRESET_MANIFEST as manifest, CINEMA2_NIGHTSHIFT_PARAMETER_IDS as P } from '../presets/Cinema2NightshiftPreset'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

function setup(sync = true) {
  const result = compileCinema2NativePreset(manifest)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  const state = new Cinema2ParameterState(result.plan.parameters)
  state.setPersistentValue(P.panRoom, true)
  state.setPersistentValue(P.bpmSync, sync)
  state.setPersistentValue(P.camera, 0) // Pan Room is independent of handheld drift.
  const resolver = new Cinema2FinalValueResolver(result.plan.targets, { resolveBaseValue: t => t.parameterId ? state.getValue(t.parameterId) : t.authoredBaseValue })
  const spatial = new Cinema2SpatialRuntime(result.plan.scene, result.plan.targets.targets, resolver)
  const camera = new Cinema2CameraRuntime(result.plan, state, resolver, spatial)
  let t = 0
  const step = (seconds: number, bpm = 120, paused = false, idle = false) => {
    let output = camera.getSnapshot().camera
    for (let i = 0; i < Math.max(1, Math.round(seconds * 60)); i++) {
      t += 1 / 60
      const frame: Cinema2ModuleFrameReadContext = { frameId: Math.round(t * 60), timestampMs: t * 1000, elapsedTimeSec: t, deltaTimeSec: idle ? 0 : 1 / 60,
        viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio: null, director: null,
        transport: { timeSec: t, trackId: 'pan-test', playing: !paused && !idle, paused, animationActive: !paused && !idle, analysisActive: !idle, sourcePresent: !idle, bpm } }
      output = camera.update(frame)
    }
    return output
  }
  return { state, step }
}

describe('NIGHTSHIFT room pan', () => {
  it('shows every side in 64 beats while holding the ball on the same vertical screen axis', () => {
    const { step } = setup()
    const initial = step(0)
    const positions = Array.from({ length: 4 }, () => step(8)) // 16 beats per wall at 120 BPM.
    expect(positions[0].position[0]).toBeGreaterThan(16)
    expect(positions[1].position[2]).toBeLessThan(-18)
    expect(positions[2].position[0]).toBeLessThan(-16)
    expect(positions[3].position[2]).toBeCloseTo(initial.position[2], 3)
    const project = (m: readonly number[]) => {
      const point = [0, 5.7, -2.3, 1]
      const clip = [0, 1, 2, 3].map(row => point.reduce((sum, v, column) => sum + v * m[column * 4 + row], 0))
      return [clip[0] / clip[3], clip[1] / clip[3]]
    }
    for (const frame of positions) {
      const p = project(frame.viewProjectionMatrix), reference = project(initial.viewProjectionMatrix)
      expect(p[0]).toBeCloseTo(0, 6)
      expect(p[1]).toBeCloseTo(reference[1], 6)
      expect(p[1]).toBeGreaterThan(.4)
      expect(p[1]).toBeLessThan(1)
    }
  })

  it('uses shared BPM, runs freely at 100 BPM with sync off, holds on pause and restores framing when disabled', () => {
    const slow = setup(), fast = setup(), free = setup(false), otherFree = setup(false)
    slow.step(0, 60); fast.step(0, 120); free.step(0, 60); otherFree.step(0, 180)
    const a = slow.step(4, 60), b = fast.step(2, 120)
    expect(a.position[0]).toBeCloseTo(b.position[0], 5)
    expect(free.step(4, 60).position).toEqual(otherFree.step(4, 180).position)
    const held = fast.step(2, 120, true)
    expect(held.position).toEqual(b.position)
    fast.state.setPersistentValue(P.panRoom, false)
    const restored = fast.step(0)
    expect(restored.position).toEqual([0, 3.1, 14.5])
    expect(restored.target).toEqual([0, 2.05, 0])
  })
  it('continues panning without a track even when the host analysis clock is idle', () => {
    const { step } = setup()
    const initial = step(0, 120, false, true)
    const moved = step(2, 120, false, true)
    expect(moved.position[0]).toBeGreaterThan(initial.position[0] + 1)
    expect(step(2, 120, true, true).position).toEqual(moved.position)
  })

})

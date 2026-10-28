import { describe, expect, it } from 'vitest'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST as manifest } from '../presets/Cinema2ThresholdPreset'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { humMusicFrame } from './support/Cinema2HumNFrameFactory'

describe('Threshold continuous camera flight', () => {
  it('waves gently while advancing smoothly through every scene and two loop boundaries under repeated kicks', () => {
    const compiled = compileCinema2NativePreset(manifest)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const parameters = new Cinema2ParameterState(compiled.plan.parameters)
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: t => t.parameterId ? parameters.getValue(t.parameterId) : t.authoredBaseValue })
    const spatial = new Cinema2SpatialRuntime(compiled.plan.scene, compiled.plan.targets.targets, resolver)
    const camera = new Cinema2CameraRuntime(compiled.plan, parameters, resolver, spatial)
    let source = humMusicFrame({ frameId: 0, timeSec: 0, bpm: 120 })
    const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => source, getPublicationMeta: () => ({ sequence: source.frameId, publishedAtMs: source.timeSec * 1000, publisherId: 'threshold-camera', kind: 'frame' }) })
    let previous = camera.getSnapshot().camera
    let previousDx = 0, minX = Infinity, maxX = -Infinity
    for (let i = 0; i <= 196 * 60; i++) {
      const time = i / 60
      source = humMusicFrame({ frameId: i + 1, timeSec: time, bpm: 120, kick: i % 30 === 0 ? 1 : 0, downbeat: i % 120 === 0 })
      const frame: Cinema2ModuleFrameReadContext = { frameId: i + 1, timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
        viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1, audio: bridge.capture(i + 1), director: null,
        transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, timeSec: time, trackId: 'track', bpm: 120 } }
      const current = camera.update(frame)
      if (i > 1) {
        const dx = current.position[0] - previous.position[0]
        expect(Math.abs(dx)).toBeLessThan(.02)
        expect(Math.abs(dx - previousDx)).toBeLessThan(.005)
        expect(current.position[2]).toBeLessThan(previous.position[2])
        expect(previous.position[2] - current.position[2]).toBeLessThan(.08)
        expect(Math.abs(current.rollDegrees)).toBeLessThan(.25)
        expect(current.fovDegrees).toBeCloseTo(68, 6)
        previousDx = dx
      }
      minX = Math.min(minX, current.position[0]); maxX = Math.max(maxX, current.position[0])
      previous = current
    }
    expect(maxX - minX).toBeGreaterThan(.3)
    expect(maxX - minX).toBeLessThan(1.5)
  })
})

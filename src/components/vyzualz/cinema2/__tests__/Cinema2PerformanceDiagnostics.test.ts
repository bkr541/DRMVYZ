import { describe, expect, it } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_ELECTRIC_STORM_PRESET_ID,
  CINEMA2_QUALITY_MODE_PARAMETER_ID,
  CINEMA2_REACTOR_PRESET_ID,
  CINEMA2_REFERENCE_VISUAL_PRESET_ID,
  CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
  Cinema2PerformanceDiagnostics,
  cinema2NativePresetRegistry,
  cinema2QualityPolicy,
} from '..'

describe('Cinema2 performance quality and diagnostics', () => {
  it('maps explicit modes to measurable render/resource policies', () => {
    expect(cinema2QualityPolicy('performance')).toMatchObject({ resolvedQuality: 'low', renderTargetScale: 0.67 })
    expect(cinema2QualityPolicy('balanced')).toMatchObject({ resolvedQuality: 'medium', renderTargetScale: 0.82 })
    expect(cinema2QualityPolicy('quality')).toMatchObject({ resolvedQuality: 'high', renderTargetScale: 1 })
  })

  it('adapts Auto quality conservatively from rolling CPU frame time and can disable timing payloads', () => {
    const gl = createCinemaMockWebGL()
    const telemetry = new Cinema2PerformanceDiagnostics(gl, 'auto')
    for (let index = 0; index < 24; index += 1) telemetry.sampleCpuFrame(25)
    expect(telemetry.getSnapshot()).toMatchObject({ requestedMode: 'auto', resolvedQuality: 'low' })
    for (let index = 0; index < 220; index += 1) telemetry.sampleCpuFrame(8)
    expect(telemetry.getSnapshot().resolvedQuality).toBe('high')
    telemetry.dispose()

    const disabled = new Cinema2PerformanceDiagnostics(gl, 'balanced', false)
    disabled.sampleCpuFrame(12)
    expect(disabled.getSnapshot()).toMatchObject({
      diagnosticsEnabled: false,
      resolvedQuality: 'medium',
      cpuFrameTimeMs: null,
      cpuFrameTimeAverageMs: null,
    })
    disabled.dispose()
  })

  it('exposes one shared engine-level quality control across every reference preset', () => {
    const presetIds = [
      CINEMA2_REFERENCE_VISUAL_PRESET_ID,
      CINEMA2_REACTOR_PRESET_ID,
      CINEMA2_SPATIAL_REFERENCE_PRESET_ID,
      CINEMA2_ELECTRIC_STORM_PRESET_ID,
    ]
    for (const presetId of presetIds) {
      const compiled = cinema2NativePresetRegistry.compile(presetId)
      expect(compiled.ok).toBe(true)
      if (!compiled.ok) continue
      const definition = compiled.plan.parameters.definitions.find(candidate => candidate.id === CINEMA2_QUALITY_MODE_PARAMETER_ID)
      expect(definition).toMatchObject({
        label: 'Quality / Performance',
        type: 'enum',
        defaultValue: 'auto',
        persistence: 'user',
      })
    }
  })
})

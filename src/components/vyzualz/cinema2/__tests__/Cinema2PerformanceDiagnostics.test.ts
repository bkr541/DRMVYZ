import { describe, expect, it, vi } from 'vitest'
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

  it('requests the GPU timer extension again after a context restore and drops stale queries on loss', () => {
    const gl = createCinemaMockWebGL()
    const extension = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb }
    let extensionEnabled = true
    gl.getExtension = vi.fn((name: string) => (name === 'EXT_disjoint_timer_query_webgl2' && extensionEnabled ? extension : null)) as typeof gl.getExtension
    Object.assign(gl, {
      createQuery: vi.fn(() => ({})),
      beginQuery: vi.fn(),
      endQuery: vi.fn(),
      deleteQuery: vi.fn(),
      getQueryParameter: vi.fn(() => false),
    })
    const telemetry = new Cinema2PerformanceDiagnostics(gl, 'auto')
    expect(telemetry.getSnapshot().gpuTimingSupported).toBe(true)
    telemetry.beginGpuFrame()

    telemetry.handleContextLost()
    expect(telemetry.getSnapshot().gpuTimingSupported).toBe(false)
    const queriesBeforeRestore = vi.mocked(gl.beginQuery).mock.calls.length
    telemetry.beginGpuFrame()
    telemetry.endGpuFrame()
    expect(vi.mocked(gl.beginQuery).mock.calls.length).toBe(queriesBeforeRestore)

    const requestsBeforeRestore = vi.mocked(gl.getExtension).mock.calls.length
    telemetry.handleContextRestored()
    expect(vi.mocked(gl.getExtension).mock.calls.length).toBeGreaterThan(requestsBeforeRestore)
    expect(telemetry.getSnapshot().gpuTimingSupported).toBe(true)
    telemetry.beginGpuFrame()
    expect(vi.mocked(gl.beginQuery).mock.calls.length).toBe(queriesBeforeRestore + 1)

    // A restore where the extension is unavailable must degrade to CPU-only timing instead of throwing.
    extensionEnabled = false
    telemetry.handleContextLost()
    telemetry.handleContextRestored()
    expect(telemetry.getSnapshot().gpuTimingSupported).toBe(false)
    telemetry.dispose()
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

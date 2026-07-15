import { describe, expect, it } from 'vitest'
import {
  clearLaserDmxRendererDiagnostics,
  getLaserDmxRendererDiagnostics,
  publishLaserDmxRendererDiagnostics,
} from './LaserDmxRendererDiagnosticsStore'

const snapshot = {
  activeRenderer: 'webgl' as const,
  requestedRenderer: 'auto' as const,
  presentationMode: 'live' as const,
  webgl2Available: true,
  floatTargetsAvailable: true,
  requestedQuality: 'auto' as const,
  effectiveQuality: 'high' as const,
  atmosphereQuality: 'medium' as const,
  renderWidth: 1920,
  renderHeight: 1080,
  atmosphereWidth: 960,
  atmosphereHeight: 540,
  atmosphereSampleCount: 3,
  activeBeamCount: 120,
  requestedBeamCount: 140,
  activeFixtureCount: 24,
  cpuFrameMs: 10.26,
  gpuFrameMs: 8.74,
  hdrMode: 'rgba16f' as const,
  bloomLevels: 3,
  temporalHistoryActive: true,
  fallbackReason: null,
  contextLossCount: 0,
  postProcessingStatus: 'hdr' as const,
}

describe('LaserDmxRendererDiagnosticsStore', () => {
  it('publishes ephemeral renderer diagnostics and clears them on disposal', () => {
    publishLaserDmxRendererDiagnostics(snapshot, 1_000)
    expect(getLaserDmxRendererDiagnostics().cpuFrameMs).toBe(10.5)
    expect(getLaserDmxRendererDiagnostics().gpuFrameMs).toBe(8.5)
    clearLaserDmxRendererDiagnostics()
    expect(getLaserDmxRendererDiagnostics().activeRenderer).toBe('inactive')
  })
})

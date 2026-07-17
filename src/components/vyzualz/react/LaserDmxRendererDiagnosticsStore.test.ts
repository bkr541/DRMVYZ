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
  scannerHeadCount: 6,
  selectedScannerHeadId: 'scanner-1',
  activeScannerPattern: 'fanSweep' as const,
  scannerPointCount: 24,
  visibleScannerSegmentCount: 18,
  blankedScannerSegmentCount: 2,
  orderedPathCount: 6,
  exposureSampleCount: 96,
  legacyConvertedPathCount: 6,
  explicitOpticalCopyCount: 2,
  scannerApertureCount: 6,
  scannerDwellTotalMicros: 640,
  currentScanRatePps: 24000,
  blankedScannerSampleCount: 4,
  scannerValidationErrorCount: 0,
  scannerCompatibilityMode: 'legacy-converted' as const,
  scannerMigrationStatus: 'migrated' as const,
  cpuFrameMs: 10.26,
  gpuFrameMs: 8.74,
  hdrMode: 'rgba16f' as const,
  bloomLevels: 3,
  temporalHistoryActive: true,
  laserHistoryInputCount: 64,
  laserHistorySliceCount: 7,
  depthMode: 'continuous-slices' as const,
  depthSliceCount: 7,
  depthBufferStatus: 'slice-accumulation' as const,
  fallbackCode: null,
  fallbackReason: null,
  qualityAdjustmentReason: 'stable',
  contextLossCount: 0,
  postProcessingStatus: 'hdr' as const,
  lastWebGLFailure: null,
  failureClassification: null,
  retryCount: 0,
  nextAutomaticRetryMs: null,
  lastSuccessfulInitializationMs: 900,
  manualRetryAvailable: false,
  manualRetryAvailableAtMs: null,
  finalFallbackReason: null,
}

describe('LaserDmxRendererDiagnosticsStore', () => {
  it('publishes ephemeral renderer diagnostics and clears them on disposal', () => {
    publishLaserDmxRendererDiagnostics(snapshot, 1_000)
    expect(getLaserDmxRendererDiagnostics().cpuFrameMs).toBe(10.5)
    expect(getLaserDmxRendererDiagnostics().gpuFrameMs).toBe(8.5)
    expect(getLaserDmxRendererDiagnostics()).toMatchObject({
      depthMode: 'continuous-slices',
      depthSliceCount: 7,
      laserHistoryInputCount: 64,
      activeScannerPattern: 'fanSweep',
      scannerDwellTotalMicros: 640,
      qualityAdjustmentReason: 'stable',
    })
    clearLaserDmxRendererDiagnostics()
    expect(getLaserDmxRendererDiagnostics().activeRenderer).toBe('inactive')
  })
})

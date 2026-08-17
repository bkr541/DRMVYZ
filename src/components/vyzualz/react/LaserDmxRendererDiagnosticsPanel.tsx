import awaitingAudioIconUrl from '../../../assets/laserDmx/awaiting-audio.svg'
import { Collapsible } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import {
  requestLaserDmxWebGLRetry,
  useLaserDmxRendererDiagnostics,
} from './LaserDmxRendererDiagnosticsStore'

function timing(value: number | null): string {
  return value == null ? 'Unavailable' : `${value.toFixed(1)} ms`
}

function timestamp(value: number | null): string {
  return value == null ? 'None' : new Date(value).toLocaleTimeString()
}

function retryTime(value: number | null): string {
  if (value == null) return 'None scheduled'
  const remainingMs = Math.max(0, value - Date.now())
  return remainingMs > 0 ? `in ${(remainingMs / 1_000).toFixed(1)} s` : 'pending'
}

export function LaserDmxRendererDiagnosticsPanel() {
  const diagnostics = useLaserDmxRendererDiagnostics()
  const showManualRetry = diagnostics.presentationMode !== 'capture' && diagnostics.manualRetryAvailable
  return (
    <Collapsible label="Renderer Diagnostics" defaultOpen={false}>
      {diagnostics.activeRenderer === 'inactive' ? (
        <div className="rv-renderer-diagnostics-empty">
          <img src={awaitingAudioIconUrl} alt="" aria-hidden="true" />
          <strong>Awaiting Audio</strong>
          <span>Renderer diagnostics appear while LaserDMX is actively rendering.</span>
        </div>
      ) : (
        <div className="vz-mi-panel" data-laser-dmx-renderer-diagnostics>
          <div className="vz-mi-section vz-mi-section--kv-grid">
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Renderer</span><span className="vz-mi-kv-val">{diagnostics.activeRenderer === 'webgl' ? 'WebGL2' : 'Canvas2D'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Requested</span><span className="vz-mi-kv-val">{diagnostics.requestedRenderer}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Presentation</span><span className="vz-mi-kv-val">{diagnostics.presentationMode}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Authored Show Dimmer</span><span className="vz-mi-kv-val">{diagnostics.authoredShowDimmer.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Preview Output Trim</span><span className="vz-mi-kv-val">{diagnostics.previewOutputTrim.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Safety Clamp</span><span className="vz-mi-kv-val">{diagnostics.safetyClamp.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Resolved Preview Product</span><span className="vz-mi-kv-val">{diagnostics.resolvedPreviewIntensity.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Hardware-Safe Product</span><span className="vz-mi-kv-val">{diagnostics.resolvedHardwareIntensity.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Authored / Preview Glow</span><span className="vz-mi-kv-val">{diagnostics.authoredShowGlow.toFixed(3)} × {diagnostics.previewGlowTrim.toFixed(3)} = {diagnostics.resolvedPreviewGlow.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Hardware-Safe Glow</span><span className="vz-mi-kv-val">{diagnostics.resolvedHardwareGlow.toFixed(3)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">WebGL2</span><span className="vz-mi-kv-val">{diagnostics.webgl2Available == null ? 'Not probed' : diagnostics.webgl2Available ? 'Available' : 'Unavailable'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Float Targets</span><span className="vz-mi-kv-val">{diagnostics.floatTargetsAvailable ? 'RGBA16F' : 'RGBA8 / none'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Quality</span><span className="vz-mi-kv-val">{diagnostics.requestedQuality}{diagnostics.effectiveQuality ? ` → ${diagnostics.effectiveQuality}` : ''}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Quality Decision</span><span className="vz-mi-kv-val">{diagnostics.qualityAdjustmentReason ?? 'Stable'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Atmosphere</span><span className="vz-mi-kv-val">{diagnostics.atmosphereQuality ?? 'Canvas2D'}{diagnostics.atmosphereSampleCount ? ` · ${diagnostics.atmosphereSampleCount} samples` : ''}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Resolution</span><span className="vz-mi-kv-val">{diagnostics.renderWidth} × {diagnostics.renderHeight}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Atmosphere Buffer</span><span className="vz-mi-kv-val">{diagnostics.atmosphereWidth} × {diagnostics.atmosphereHeight}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Beams</span><span className="vz-mi-kv-val">{diagnostics.activeBeamCount}{diagnostics.requestedBeamCount !== diagnostics.activeBeamCount ? ` / ${diagnostics.requestedBeamCount}` : ''}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Fixtures</span><span className="vz-mi-kv-val">{diagnostics.activeFixtureCount}</span></div>
            {diagnostics.presentationMode !== 'capture' && (
              <>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Scanner Heads</span><span className="vz-mi-kv-val">{diagnostics.scannerHeadCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Selected Head</span><span className="vz-mi-kv-val">{diagnostics.selectedScannerHeadId ?? 'None'}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Pattern</span><span className="vz-mi-kv-val">{diagnostics.activeScannerPattern ?? 'Inactive'}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Path Points</span><span className="vz-mi-kv-val">{diagnostics.scannerPointCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Path Segments</span><span className="vz-mi-kv-val">{diagnostics.visibleScannerSegmentCount} visible / {diagnostics.blankedScannerSegmentCount} blanked</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Ordered Paths</span><span className="vz-mi-kv-val">{diagnostics.orderedPathCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Exposure Samples</span><span className="vz-mi-kv-val">{diagnostics.exposureSampleCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Raw / Aggregated</span><span className="vz-mi-kv-val">{diagnostics.rawExposureSampleCount} / {diagnostics.aggregatedRayCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Exposure Energy</span><span className="vz-mi-kv-val">{diagnostics.scannerEnergyBeforeAggregation.toFixed(3)} → {diagnostics.scannerEnergyAfterAggregation.toFixed(3)}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Macro Paths</span><span className="vz-mi-kv-val">{diagnostics.macroControlledPathCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Legacy Paths</span><span className="vz-mi-kv-val">{diagnostics.legacyConvertedPathCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Optical Copies</span><span className="vz-mi-kv-val">{diagnostics.explicitOpticalCopyCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Apertures</span><span className="vz-mi-kv-val">{diagnostics.scannerApertureCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Dwell</span><span className="vz-mi-kv-val">{diagnostics.scannerDwellTotalMicros.toLocaleString()} μs</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Scan Rate</span><span className="vz-mi-kv-val">{diagnostics.currentScanRatePps ? `${diagnostics.currentScanRatePps.toLocaleString()} pps` : 'Inactive'}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Blanked Samples</span><span className="vz-mi-kv-val">{diagnostics.blankedScannerSampleCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Retrace Segments</span><span className="vz-mi-kv-val">{diagnostics.retraceScannerSegmentCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Velocity / Dwell</span><span className="vz-mi-kv-val">{diagnostics.averageScannerVelocity.toFixed(3)} / {diagnostics.averageScannerDwellWeight.toFixed(3)}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Exposure / History</span><span className="vz-mi-kv-val">{diagnostics.averageScannerExposureWeight.toFixed(3)} / {diagnostics.averageScannerHistoryWeight.toFixed(3)}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Normalized Energy</span><span className="vz-mi-kv-val">{diagnostics.normalizedScannerFixtureEnergy.toFixed(3)}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Cue Owner</span><span className="vz-mi-kv-val">{diagnostics.currentScannerCueOwner ?? 'None'}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Stable / Animated</span><span className="vz-mi-kv-val">{diagnostics.stableScannerPathCount} / {diagnostics.animatedScannerPathCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Path Errors</span><span className="vz-mi-kv-val">{diagnostics.scannerValidationErrorCount}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Scanner Mode</span><span className="vz-mi-kv-val">{diagnostics.scannerCompatibilityMode}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Migration</span><span className="vz-mi-kv-val">{diagnostics.scannerMigrationStatus}</span></div>
                <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Duplicate Paths</span><span className="vz-mi-kv-val">{diagnostics.duplicateRenderingFixtureIds.length ? diagnostics.duplicateRenderingFixtureIds.join(', ') : 'None'}</span></div>
              </>
            )}
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">CPU Frame</span><span className="vz-mi-kv-val">{timing(diagnostics.cpuFrameMs)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">GPU Frame</span><span className="vz-mi-kv-val">{timing(diagnostics.gpuFrameMs)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Post</span><span className="vz-mi-kv-val">{diagnostics.postProcessingStatus}{diagnostics.bloomLevels ? ` · ${diagnostics.bloomLevels} bloom levels` : ''}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Laser History</span><span className="vz-mi-kv-val">{diagnostics.temporalHistoryActive ? `Active · ${diagnostics.laserHistoryInputCount} inputs / ${diagnostics.laserHistorySliceCount} slices` : 'Clear'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Depth</span><span className="vz-mi-kv-val">{diagnostics.depthMode === 'none' ? 'Canvas2D' : `${diagnostics.depthMode} · ${diagnostics.depthSliceCount} slices`}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Depth Buffer</span><span className="vz-mi-kv-val">{diagnostics.depthBufferStatus}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Context Losses</span><span className="vz-mi-kv-val">{diagnostics.contextLossCount}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Failure Class</span><span className="vz-mi-kv-val">{diagnostics.failureClassification ?? 'None'}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Retry Count</span><span className="vz-mi-kv-val">{diagnostics.retryCount}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Automatic Retry</span><span className="vz-mi-kv-val">{retryTime(diagnostics.nextAutomaticRetryMs)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Manual Retry</span><span className="vz-mi-kv-val">{diagnostics.manualRetryAvailable ? 'Available' : retryTime(diagnostics.manualRetryAvailableAtMs)}</span></div>
            <div className="vz-mi-kv-row"><span className="vz-mi-kv-label">Last WebGL Start</span><span className="vz-mi-kv-val">{timestamp(diagnostics.lastSuccessfulInitializationMs)}</span></div>
          </div>
          {diagnostics.fallbackCode && (
            <p className="rv-show-director-performance-status__warning">Fallback code: {diagnostics.fallbackCode}</p>
          )}
          {diagnostics.lastWebGLFailure && (
            <p className="rv-show-director-performance-status__warning">Last WebGL failure: {diagnostics.lastWebGLFailure}</p>
          )}
          {diagnostics.finalFallbackReason && (
            <p className="rv-show-director-performance-status__warning">Final fallback: {diagnostics.finalFallbackReason}</p>
          )}
          {!diagnostics.finalFallbackReason && diagnostics.fallbackReason && (
            <p className="rv-show-director-performance-status__warning">Fallback: {diagnostics.fallbackReason}</p>
          )}
          {showManualRetry && (
            <div className="rv-bm-button-row rv-bm-button-row--spaced-sm">
              <IconChipButton onClick={() => requestLaserDmxWebGLRetry()}>
                Retry WebGL
              </IconChipButton>
            </div>
          )}
        </div>
      )}
    </Collapsible>
  )
}

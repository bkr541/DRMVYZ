import { Collapsible } from './ReactControlRows'
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
        <div className="rv-ctrl-info">Renderer diagnostics appear while LaserDMX is actively rendering.</div>
      ) : (
        <div className="rv-show-director-performance-status" data-laser-dmx-renderer-diagnostics>
          <dl className="rv-show-director-performance-status__grid">
            <div><dt>Renderer</dt><dd>{diagnostics.activeRenderer === 'webgl' ? 'WebGL2' : 'Canvas2D'}</dd></div>
            <div><dt>Requested</dt><dd>{diagnostics.requestedRenderer}</dd></div>
            <div><dt>Presentation</dt><dd>{diagnostics.presentationMode}</dd></div>
            <div><dt>WebGL2</dt><dd>{diagnostics.webgl2Available == null ? 'Not probed' : diagnostics.webgl2Available ? 'Available' : 'Unavailable'}</dd></div>
            <div><dt>Float Targets</dt><dd>{diagnostics.floatTargetsAvailable ? 'RGBA16F' : 'RGBA8 / none'}</dd></div>
            <div><dt>Quality</dt><dd>{diagnostics.requestedQuality}{diagnostics.effectiveQuality ? ` → ${diagnostics.effectiveQuality}` : ''}</dd></div>
            <div><dt>Atmosphere</dt><dd>{diagnostics.atmosphereQuality ?? 'Canvas2D'}{diagnostics.atmosphereSampleCount ? ` · ${diagnostics.atmosphereSampleCount} samples` : ''}</dd></div>
            <div><dt>Resolution</dt><dd>{diagnostics.renderWidth} × {diagnostics.renderHeight}</dd></div>
            <div><dt>Atmosphere Buffer</dt><dd>{diagnostics.atmosphereWidth} × {diagnostics.atmosphereHeight}</dd></div>
            <div><dt>Beams</dt><dd>{diagnostics.activeBeamCount}{diagnostics.requestedBeamCount !== diagnostics.activeBeamCount ? ` / ${diagnostics.requestedBeamCount}` : ''}</dd></div>
            <div><dt>Fixtures</dt><dd>{diagnostics.activeFixtureCount}</dd></div>
            {diagnostics.presentationMode !== 'capture' && (
              <>
                <div><dt>Scanner Heads</dt><dd>{diagnostics.scannerHeadCount}</dd></div>
                <div><dt>Ordered Paths</dt><dd>{diagnostics.orderedPathCount}</dd></div>
                <div><dt>Exposure Samples</dt><dd>{diagnostics.exposureSampleCount}</dd></div>
                <div><dt>Legacy Paths</dt><dd>{diagnostics.legacyConvertedPathCount}</dd></div>
                <div><dt>Optical Copies</dt><dd>{diagnostics.explicitOpticalCopyCount}</dd></div>
                <div><dt>Scan Rate</dt><dd>{diagnostics.currentScanRatePps ? `${diagnostics.currentScanRatePps.toLocaleString()} pps` : 'Inactive'}</dd></div>
                <div><dt>Blanked Samples</dt><dd>{diagnostics.blankedScannerSampleCount}</dd></div>
                <div><dt>Path Errors</dt><dd>{diagnostics.scannerValidationErrorCount}</dd></div>
                <div><dt>Scanner Mode</dt><dd>{diagnostics.scannerCompatibilityMode}</dd></div>
              </>
            )}
            <div><dt>CPU Frame</dt><dd>{timing(diagnostics.cpuFrameMs)}</dd></div>
            <div><dt>GPU Frame</dt><dd>{timing(diagnostics.gpuFrameMs)}</dd></div>
            <div><dt>Post</dt><dd>{diagnostics.postProcessingStatus}{diagnostics.bloomLevels ? ` · ${diagnostics.bloomLevels} bloom levels` : ''}</dd></div>
            <div><dt>Laser History</dt><dd>{diagnostics.temporalHistoryActive ? `Active · ${diagnostics.laserHistoryInputCount} inputs / ${diagnostics.laserHistorySliceCount} slices` : 'Clear'}</dd></div>
            <div><dt>Depth</dt><dd>{diagnostics.depthMode === 'none' ? 'Canvas2D' : `${diagnostics.depthMode} · ${diagnostics.depthSliceCount} slices`}</dd></div>
            <div><dt>Depth Buffer</dt><dd>{diagnostics.depthBufferStatus}</dd></div>
            <div><dt>Context Losses</dt><dd>{diagnostics.contextLossCount}</dd></div>
            <div><dt>Failure Class</dt><dd>{diagnostics.failureClassification ?? 'None'}</dd></div>
            <div><dt>Retry Count</dt><dd>{diagnostics.retryCount}</dd></div>
            <div><dt>Automatic Retry</dt><dd>{retryTime(diagnostics.nextAutomaticRetryMs)}</dd></div>
            <div><dt>Last WebGL Start</dt><dd>{timestamp(diagnostics.lastSuccessfulInitializationMs)}</dd></div>
          </dl>
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
              <button type="button" className="rv-glyph-upload-btn" onClick={() => requestLaserDmxWebGLRetry()}>
                Retry WebGL
              </button>
            </div>
          )}
        </div>
      )}
    </Collapsible>
  )
}

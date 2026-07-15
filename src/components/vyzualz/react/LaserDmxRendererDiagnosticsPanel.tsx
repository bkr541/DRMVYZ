import { Collapsible } from './ReactControlRows'
import { useLaserDmxRendererDiagnostics } from './LaserDmxRendererDiagnosticsStore'

function timing(value: number | null): string {
  return value == null ? 'Unavailable' : `${value.toFixed(1)} ms`
}

export function LaserDmxRendererDiagnosticsPanel() {
  const diagnostics = useLaserDmxRendererDiagnostics()
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
            <div><dt>CPU Frame</dt><dd>{timing(diagnostics.cpuFrameMs)}</dd></div>
            <div><dt>GPU Frame</dt><dd>{timing(diagnostics.gpuFrameMs)}</dd></div>
            <div><dt>Post</dt><dd>{diagnostics.postProcessingStatus}{diagnostics.bloomLevels ? ` · ${diagnostics.bloomLevels} bloom levels` : ''}</dd></div>
            <div><dt>History</dt><dd>{diagnostics.temporalHistoryActive ? 'Active' : 'Clear'}</dd></div>
            <div><dt>Context Losses</dt><dd>{diagnostics.contextLossCount}</dd></div>
          </dl>
          {diagnostics.fallbackReason && (
            <p className="rv-show-director-performance-status__warning">Fallback: {diagnostics.fallbackReason}</p>
          )}
        </div>
      )}
    </Collapsible>
  )
}

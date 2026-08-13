import { useReactStore } from '../../../stores/reactStore'
import { MusicIntelligenceDiagnosticsPanel } from '../modulation/MusicIntelligenceDiagnosticsPanel'
import { LaserDmxRendererDiagnosticsPanel } from './LaserDmxRendererDiagnosticsPanel'
import { LaserDmxRuntimeCueInspectorPanel } from './LaserDmxRuntimeCueInspectorPanel'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'

export function ReactAudioPanel() {
  const isLaserDmx = useReactStore(state => state.activeReactEngineId === 'laserDmx')
  const isCanvas = useReactStore(state => state.activeReactEngineId === 'canvas')
  const isSoundDrawing = useReactStore(state => state.activeReactEngineId === 'oscilloscope')
  return (
    <div className="rv-audio-analysis-panel">
      <MusicIntelligenceDiagnosticsPanel />
      {isCanvas && <SharedPerformanceDiagnosticsPanel engine="canvas" variant="audioIntelligence" />}
      {isSoundDrawing && <SharedPerformanceDiagnosticsPanel engine="soundDrawing" />}
      {isLaserDmx && <SharedPerformanceDiagnosticsPanel engine="laserDmx" label="Shared Core Diagnostics" />}
      {isLaserDmx && <LaserDmxRuntimeCueInspectorPanel />}
      {isLaserDmx && <LaserDmxRendererDiagnosticsPanel />}
    </div>
  )
}

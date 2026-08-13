import { useReactStore } from '../../../stores/reactStore'
import { MusicIntelligenceDiagnosticsPanel } from '../modulation/MusicIntelligenceDiagnosticsPanel'
import { LaserDmxRendererDiagnosticsPanel } from './LaserDmxRendererDiagnosticsPanel'
import { LaserDmxRuntimeCueInspectorPanel } from './LaserDmxRuntimeCueInspectorPanel'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'

export function ReactAudioPanel() {
  const isLaserDmx = useReactStore(state => state.activeReactEngineId === 'laserDmx')
  const isCanvas = useReactStore(state => state.activeReactEngineId === 'canvas')
  return (
    <div className="rv-audio-analysis-panel">
      <MusicIntelligenceDiagnosticsPanel />
      {isCanvas && <SharedPerformanceDiagnosticsPanel engine="canvas" variant="audioIntelligence" />}
      {isLaserDmx && <LaserDmxRuntimeCueInspectorPanel />}
      {isLaserDmx && <LaserDmxRendererDiagnosticsPanel />}
    </div>
  )
}

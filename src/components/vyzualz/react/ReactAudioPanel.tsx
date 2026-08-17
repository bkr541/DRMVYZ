import { useReactStore } from '../../../stores/reactStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { MusicIntelligenceDiagnosticsPanel } from '../modulation/MusicIntelligenceDiagnosticsPanel'
import { LaserDmxRendererDiagnosticsPanel } from './LaserDmxRendererDiagnosticsPanel'
import { LaserDmxRuntimeCueInspectorPanel } from './LaserDmxRuntimeCueInspectorPanel'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'
import { SliderRow } from './ReactControlRows'

export function ReactAudioPanel() {
  const audio = useSharedAudio()
  const isLaserDmx = useReactStore(state => state.activeReactEngineId === 'laserDmx')
  const isCanvas = useReactStore(state => state.activeReactEngineId === 'canvas')
  const isSoundDrawing = useReactStore(state => state.activeReactEngineId === 'oscilloscope')
  const liveInputActive = audio.source === 'microphone' && audio.liveInputActive
  return (
    <div className="rv-audio-analysis-panel">
      {liveInputActive && (
        <section className="rv-ctrl-section" aria-label="Live Input master analysis controls">
          <div className="rv-ctrl-section-label">Live Input Analysis</div>
          <SliderRow
            id="live-input-analysis-sensitivity"
            label="Input Sensitivity"
            value={audio.liveInputSensitivity}
            min={0.25}
            max={4}
            step={0.05}
            resetValue={1}
            onChange={audio.setLiveInputSensitivity}
            description="Shapes the shared analysis signal only; Live Input remains inaudible."
          />
          <SliderRow
            id="live-input-analysis-noise-gate"
            label="Noise Gate"
            value={audio.liveInputNoiseGate}
            min={0}
            max={0.2}
            step={0.005}
            resetValue={0.02}
            onChange={audio.setLiveInputNoiseGate}
            description="Suppresses low-level room noise before shared realtime feature analysis."
          />
        </section>
      )}
      <MusicIntelligenceDiagnosticsPanel liveInputActive={liveInputActive} />
      {isCanvas && <SharedPerformanceDiagnosticsPanel engine="canvas" variant="audioIntelligence" />}
      {isSoundDrawing && <SharedPerformanceDiagnosticsPanel engine="soundDrawing" />}
      {isLaserDmx && <SharedPerformanceDiagnosticsPanel engine="laserDmx" label="Shared Core Diagnostics" variant="audioIntelligence" twoColumn />}
      {isLaserDmx && <LaserDmxRuntimeCueInspectorPanel />}
      {isLaserDmx && <LaserDmxRendererDiagnosticsPanel />}
    </div>
  )
}

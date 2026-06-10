import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'

interface SliderRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  color?: string
}

function SliderRow({ label, value, onChange, color = '#4ac7db' }: SliderRowProps) {
  const pct = `${Math.round(value * 100)}%`
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <div className="rv-ctrl-slider-wrap">
        <input
          type="range"
          className="rv-ctrl-slider"
          min={0} max={1} step={0.01}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ '--accent': color, '--pct': pct } as React.CSSProperties}
        />
        <span className="rv-ctrl-val">{pct}</span>
      </div>
    </div>
  )
}

interface SectionProps { label: string }
function CtrlSection({ label }: SectionProps) {
  return <div className="rv-ctrl-section-label">{label}</div>
}

export function ReactControlPanel() {
  const {
    reactIntensity,       setReactIntensity,
    reactMotion,          setReactMotion,
    reactGlow,            setReactGlow,
    reactBassReactivity,  setReactBassReactivity,
    reactTrailDecay,      setReactTrailDecay,
    reactFogDensity,      setReactFogDensity,
    reactParticleDensity, setReactParticleDensity,
    activeReactEngineId,
    resetReactView,
  } = useReactStore(useShallow(s => ({
    reactIntensity:          s.reactIntensity,
    setReactIntensity:       s.setReactIntensity,
    reactMotion:             s.reactMotion,
    setReactMotion:          s.setReactMotion,
    reactGlow:               s.reactGlow,
    setReactGlow:            s.setReactGlow,
    reactBassReactivity:     s.reactBassReactivity,
    setReactBassReactivity:  s.setReactBassReactivity,
    reactTrailDecay:         s.reactTrailDecay,
    setReactTrailDecay:      s.setReactTrailDecay,
    reactFogDensity:         s.reactFogDensity,
    setReactFogDensity:      s.setReactFogDensity,
    reactParticleDensity:    s.reactParticleDensity,
    setReactParticleDensity: s.setReactParticleDensity,
    activeReactEngineId:     s.activeReactEngineId,
    resetReactView:          s.resetReactView,
  })))

  const isSoundDrawing  = activeReactEngineId === 'oscilloscope'
  const isCinematic     = activeReactEngineId === 'cinematicPortal'
  const isShaderPads    = activeReactEngineId === 'shaderPads'

  return (
    <div className="rv-control-panel">
      <div className="rv-panel-header">
        <span className="rv-panel-icon">⊛</span>
        <span className="rv-panel-title">Controls</span>
      </div>

      <div className="rv-ctrl-group">
        <CtrlSection label="Master" />
        <SliderRow label="Intensity"  value={reactIntensity}      onChange={setReactIntensity}      color="#4ac7db" />
        <SliderRow label="Motion"     value={reactMotion}         onChange={setReactMotion}         color="#61d6aa" />
        <SliderRow label="Glow"       value={reactGlow}           onChange={setReactGlow}           color="#b84fc9" />
        <SliderRow label="Bass React" value={reactBassReactivity} onChange={setReactBassReactivity} color="#d8b95a" />

        {/* Engine-specific controls */}
        {isSoundDrawing && (
          <>
            <CtrlSection label="Sound Drawing" />
            <SliderRow
              label="Trail Decay"
              value={reactTrailDecay}
              onChange={setReactTrailDecay}
              color="#4ac7db"
            />
          </>
        )}
        {isCinematic && (
          <>
            <CtrlSection label="Cinematic" />
            <SliderRow
              label="Fog Density"
              value={reactFogDensity}
              onChange={setReactFogDensity}
              color="#61d6aa"
            />
            <SliderRow
              label="Particles"
              value={reactParticleDensity}
              onChange={setReactParticleDensity}
              color="#4ac7db"
            />
          </>
        )}
        {isShaderPads && (
          <>
            <CtrlSection label="Shader Pads" />
            <SliderRow
              label="Particles"
              value={reactParticleDensity}
              onChange={setReactParticleDensity}
              color="#61d6aa"
            />
          </>
        )}
      </div>

      <div className="rv-ctrl-footer">
        <button className="rv-reset-btn" onClick={resetReactView} title="Reset all controls">
          Reset
        </button>
      </div>
    </div>
  )
}

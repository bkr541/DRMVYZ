import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  SliderRow, SelectRow, ToggleRow,
  CtrlSection, Collapsible,
} from './ReactControlRows'
import type { OscillatorRenderMode } from './ReactTypes'

// ── FX panel ──────────────────────────────────────────────────────────────────
// Styles the currently active visual engine.
// Source/mode/shape selection lives in the ENGINE tab.

export function ReactFxPanel() {
  const {
    reactIntensity,       setReactIntensity,
    reactMotion,          setReactMotion,
    reactGlow,            setReactGlow,
    reactBassReactivity,  setReactBassReactivity,
    reactTrailDecay,      setReactTrailDecay,
    reactFogDensity,      setReactFogDensity,
    reactParticleDensity, setReactParticleDensity,
    activeReactEngineId,
    oscillatorSettings,   setOscillatorSettings, resetOscillatorSettings,
    laserDmxSettings,     setLaserDmxSettings,
    resetReactView,
  } = useReactStore(useShallow(s => ({
    reactIntensity:              s.reactIntensity,
    setReactIntensity:           s.setReactIntensity,
    reactMotion:                 s.reactMotion,
    setReactMotion:              s.setReactMotion,
    reactGlow:                   s.reactGlow,
    setReactGlow:                s.setReactGlow,
    reactBassReactivity:         s.reactBassReactivity,
    setReactBassReactivity:      s.setReactBassReactivity,
    reactTrailDecay:             s.reactTrailDecay,
    setReactTrailDecay:          s.setReactTrailDecay,
    reactFogDensity:             s.reactFogDensity,
    setReactFogDensity:          s.setReactFogDensity,
    reactParticleDensity:        s.reactParticleDensity,
    setReactParticleDensity:     s.setReactParticleDensity,
    activeReactEngineId:         s.activeReactEngineId,
    oscillatorSettings:          s.oscillatorSettings,
    setOscillatorSettings:       s.setOscillatorSettings,
    resetOscillatorSettings:     s.resetOscillatorSettings,
    laserDmxSettings:            s.laserDmxSettings,
    setLaserDmxSettings:         s.setLaserDmxSettings,
    resetReactView:              s.resetReactView,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'
  const isCinematic    = activeReactEngineId === 'cinematicPortal'
  const isShaderPads   = activeReactEngineId === 'shaderPads'
  const isLaserDmx     = activeReactEngineId === 'laserDmx'

  // SVG Visual is a pure image display mode — point-path controls have no effect on it.
  const isSvgVisual = isSoundDrawing && osc.sourceType === 'svgVisual'

  return (
    <>
      <div className="rv-ctrl-group">
        {/* ── Master ──────────────────────────────────────────────────── */}
        <CtrlSection label="Master" />
        <SliderRow label="Intensity"  value={reactIntensity}      onChange={setReactIntensity}      color="#4ac7db" />
        <SliderRow label="Motion"     value={reactMotion}         onChange={setReactMotion}         color="#61d6aa" />
        <SliderRow label="Glow"       value={reactGlow}           onChange={setReactGlow}           color="#b84fc9" />
        <SliderRow label="Bass React" value={reactBassReactivity} onChange={setReactBassReactivity} color="#d8b95a" />

        {/* ── Engine Appearance: Oscilloscope ─────────────────────────── */}
        {isSoundDrawing && (
          isSvgVisual ? (
            // SVG Visual: only scale and rotation affect rendering.
            // Trail, render mode, duplicate traces, and mirror are point-path features
            // that do nothing when displaying a native SVG image.
            <>
              <CtrlSection label="SVG Visual" />
              <Collapsible label="Transform" defaultOpen>
                <SliderRow
                  label="Scale"
                  value={osc.pathScale}
                  onChange={v => set({ pathScale: v })}
                  min={0.1} max={1.5} step={0.01}
                  color="#61d6aa"
                />
                <SliderRow
                  label="Rotation Speed"
                  value={osc.rotationSpeed}
                  onChange={v => set({ rotationSpeed: v })}
                  min={-1} max={1} step={0.01}
                  color="#d8b95a"
                />
              </Collapsible>
            </>
          ) : (
            // Built-in Shape, Text, SVG Glyph: full point-path controls
            <>
              <CtrlSection label="Sound Drawing" />
              <SliderRow
                label="Trail Decay"
                value={reactTrailDecay}
                onChange={setReactTrailDecay}
                color="#4ac7db"
              />
              <SelectRow
                label="Render Mode"
                value={osc.renderMode}
                onChange={v => set({ renderMode: v as OscillatorRenderMode })}
                options={[
                  { value: 'outline',    label: 'Outline' },
                  { value: 'multiTrace', label: 'Multi Trace' },
                  { value: 'dots',       label: 'Dots' },
                  { value: 'ribbon',     label: 'Ribbon' },
                ]}
              />
              <SliderRow
                label="Duplicate Traces"
                value={osc.duplicateTraces}
                onChange={v => set({ duplicateTraces: Math.round(v) })}
                min={1} max={6} step={1}
                color="#61d6aa"
              />
              <Collapsible label="Path">
                <SliderRow
                  label="Scale"
                  value={osc.pathScale}
                  onChange={v => set({ pathScale: v })}
                  min={0.1} max={1.5} step={0.01}
                  color="#61d6aa"
                />
                <SliderRow
                  label="Rotation Speed"
                  value={osc.rotationSpeed}
                  onChange={v => set({ rotationSpeed: v })}
                  min={-1} max={1} step={0.01}
                  color="#d8b95a"
                />
                <ToggleRow label="Mirror X" value={osc.mirrorX} onChange={v => set({ mirrorX: v })} />
                <ToggleRow label="Mirror Y" value={osc.mirrorY} onChange={v => set({ mirrorY: v })} />
              </Collapsible>
              <button
                type="button"
                className="rv-osc-reset-btn"
                onClick={resetOscillatorSettings}
                title="Reset oscillator source settings to defaults"
              >
                Reset Source
              </button>
            </>
          )
        )}

        {/* ── Engine Appearance: Cinematic Portal ─────────────────────── */}
        {isCinematic && (
          <>
            <CtrlSection label="Cinematic" />
            <SliderRow label="Fog Density" value={reactFogDensity}      onChange={setReactFogDensity}      color="#61d6aa" />
            <SliderRow label="Particles"   value={reactParticleDensity} onChange={setReactParticleDensity} color="#4ac7db" />
          </>
        )}

        {/* ── Engine Appearance: Shader Pads ──────────────────────────── */}
        {isShaderPads && (
          <>
            <CtrlSection label="Shader Pads" />
            <SliderRow label="Particles" value={reactParticleDensity} onChange={setReactParticleDensity} color="#61d6aa" />
          </>
        )}

        {/* ── Engine Appearance: LaserDMX ──────────────────────────────── */}
        {isLaserDmx && (
          <>
            <CtrlSection label="Global Output" />
            <SliderRow label="Master Dimmer" value={laserDmxSettings.masterDimmer} onChange={v => setLaserDmxSettings({ masterDimmer: v })} color="#4ac7db" />
            <ToggleRow  label="Blackout"     value={laserDmxSettings.blackout}     onChange={v => setLaserDmxSettings({ blackout: v })} />
            <SliderRow label="Safety Clamp"  value={laserDmxSettings.safetyClamp}  onChange={v => setLaserDmxSettings({ safetyClamp: v })} color="#c0314a" />

            <CtrlSection label="Atmosphere" />
            <SliderRow label="Haze"         value={laserDmxSettings.hazeAmount}     onChange={v => setLaserDmxSettings({ hazeAmount: v })}     color="#61d6aa" />
            <SliderRow label="Glow"         value={laserDmxSettings.glowAmount}     onChange={v => setLaserDmxSettings({ glowAmount: v })}     color="#b84fc9" />
            <SliderRow label="Persistence"  value={laserDmxSettings.beamPersistence}onChange={v => setLaserDmxSettings({ beamPersistence: v })} color="#4ac7db" />
            <SliderRow label="Bg Fade"      value={laserDmxSettings.backgroundFade} onChange={v => setLaserDmxSettings({ backgroundFade: v })} color="#d8b95a" />

            <CtrlSection label="Beam Global" />
            <SliderRow label="Beam Width"   value={laserDmxSettings.globalBeamWidth}  onChange={v => setLaserDmxSettings({ globalBeamWidth: v })}  min={0.2} max={6} step={0.05} color="#61d6aa" />
            <SliderRow label="Strobe Rate"  value={laserDmxSettings.globalStrobeRate} onChange={v => setLaserDmxSettings({ globalStrobeRate: v })} color="#c0314a" />

            <Collapsible label="Preview / Debug" defaultOpen={false}>
              <ToggleRow label="Show Origins"   value={laserDmxSettings.showFixtureOrigins ?? false} onChange={v => setLaserDmxSettings({ showFixtureOrigins: v })} />
              <ToggleRow label="Show Points"    value={laserDmxSettings.showPathPoints     ?? false} onChange={v => setLaserDmxSettings({ showPathPoints: v })} />
              <ToggleRow label="DMX Debug"      value={laserDmxSettings.showDmxDebug       ?? false} onChange={v => setLaserDmxSettings({ showDmxDebug: v })} />
            </Collapsible>
          </>
        )}
      </div>

      {/* ── Reset ───────────────────────────────────────────────────────── */}
      <div className="rv-ctrl-footer">
        <button className="rv-reset-btn" onClick={resetReactView} title="Reset all controls">
          Reset
        </button>
      </div>
    </>
  )
}

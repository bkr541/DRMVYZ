import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  SliderRow, SelectRow, ToggleRow,
  Collapsible,
} from './ReactControlRows'
import { getUnifiedSvgPointCount, resolveSvgUiCapabilities } from './svgSourceLifecycle'
import {
  coerceLaserDmxWorkspaceMode,
  type LaserDmxFogSettings,
  type OscillatorRenderMode,
} from './ReactTypes'
import { ShaderParameterPanel } from './shaders/ui/ShaderParameterPanel'
import { getReactFxMasterControls } from './reactFxMasterControls'
import { ReactResetActions } from './ReactResetActions'
import { CinematicWorldsFxControls } from './CinematicWorldsControls'

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
    laserDmxWorkspaceMode,
    oscillatorSettings, oscillatorGlyphAssets, oscillatorGlyphPointCache,
    setOscillatorSettings, resetOscillatorSettings,
    laserDmxSettings,     setLaserDmxSettings,
    laserDmxBeamMatrix,   setLaserDmxBeamMatrixSettings, setLaserDmxBeamMatrixEditorSettings,
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
    laserDmxWorkspaceMode:       s.laserDmxWorkspaceMode,
    oscillatorSettings:          s.oscillatorSettings,
    oscillatorGlyphAssets:        s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:    s.oscillatorGlyphPointCache,
    setOscillatorSettings:       s.setOscillatorSettings,
    resetOscillatorSettings:     s.resetOscillatorSettings,
    laserDmxSettings:            s.laserDmxSettings,
    setLaserDmxSettings:         s.setLaserDmxSettings,
    laserDmxBeamMatrix:                  s.laserDmxBeamMatrix,
    setLaserDmxBeamMatrixSettings:       s.setLaserDmxBeamMatrixSettings,
    setLaserDmxBeamMatrixEditorSettings: s.setLaserDmxBeamMatrixEditorSettings,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isShader        = activeReactEngineId === 'shaderPads'
  const isSoundDrawing  = activeReactEngineId === 'oscilloscope'
  const isCinematic     = activeReactEngineId === 'cinematicPortal'
  const isLaserDmx      = activeReactEngineId === 'laserDmx'
  const lockedLaserDmxWorkspaceMode = coerceLaserDmxWorkspaceMode(laserDmxWorkspaceMode)
  const isBeamMatrix    = isLaserDmx && lockedLaserDmxWorkspaceMode === 'beamMatrix'
  const isSpatialFixtures = isLaserDmx && lockedLaserDmxWorkspaceMode === 'spatialFixtures'

  const masterControls = getReactFxMasterControls(activeReactEngineId, lockedLaserDmxWorkspaceMode)
  const showMasterIntensity = masterControls.includes('intensity')
  const showMasterMotion = masterControls.includes('motion')
  const showMasterGlow = masterControls.includes('glow')
  const showMasterBassReactivity = masterControls.includes('bassReactivity')

  const masterControlRows = (
    <>
      {showMasterIntensity && (
        <SliderRow
          label={isLaserDmx ? 'Master Intensity' : 'Intensity'}
          value={reactIntensity}
          onChange={setReactIntensity}
          color="#4ac7db"
        />
      )}
      {showMasterMotion && (
        <SliderRow label="Motion" value={reactMotion} onChange={setReactMotion} color="#61d6aa" />
      )}
      {showMasterGlow && (
        <SliderRow
          label={isLaserDmx ? 'Master Glow' : 'Glow'}
          value={reactGlow}
          onChange={setReactGlow}
          color="#b84fc9"
        />
      )}
      {showMasterBassReactivity && (
        <SliderRow
          label="Bass React"
          value={reactBassReactivity}
          onChange={setReactBassReactivity}
          color="#d8b95a"
        />
      )}
    </>
  )

  const bm     = laserDmxBeamMatrix
  const bmOut  = bm.output
  const bmFog  = bm.fog
  const bmEd   = bm.editor

  function setOutput(patch: Partial<typeof bmOut>) {
    setLaserDmxBeamMatrixSettings({ output: { ...bmOut, ...patch } })
  }
  function setFog(patch: Partial<LaserDmxFogSettings>) {
    setLaserDmxBeamMatrixSettings({ fog: { ...bmFog, ...patch } })
  }

  // Resolve SVG UI behavior through the unified source model. Legacy source
  // values are normalized at this compatibility boundary rather than branching
  // throughout the panel.
  const svgPointCount = getUnifiedSvgPointCount(
    osc,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
  )
  const svgCapabilities = resolveSvgUiCapabilities(osc, svgPointCount)
  const isSvgOriginalArtwork = isSoundDrawing && svgCapabilities.isOriginalArtwork

  // Shader scenes consume the same React-wide master values passed into the
  // renderer, so keep them visible above the scene-specific parameter controls.
  if (isCinematic) {
    return <CinematicWorldsFxControls />
  }

  if (isShader) {
    return (
      <>
        <div className="rv-ctrl-group">
          <Collapsible label="Shader Master" defaultOpen>
            {masterControlRows}
          </Collapsible>
        </div>
        <ShaderParameterPanel />
      </>
    )
  }

  return (
    <>
      <div className="rv-ctrl-group">
        {/* ── Master ──────────────────────────────────────────────────── */}
        <Collapsible label={isLaserDmx ? 'React Master' : 'Master'} defaultOpen>
          {masterControlRows}
        </Collapsible>


        {/* ── Engine Appearance: Oscilloscope ─────────────────────────── */}
        {isSoundDrawing && (
          isSvgOriginalArtwork ? (
            // Original Artwork: only whole-artwork transforms affect rendering.
            // Trail, render mode, duplicate traces, and mirror are point-path features
            // that do nothing when displaying a native SVG image.
            <Collapsible label="SVG Original Artwork" defaultOpen>
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
            </Collapsible>
          ) : (
            // Built-in Shape, Text, SVG Glyph: full point-path controls
            <Collapsible label="Sound Drawing" defaultOpen>
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
                title="Reset all Sound Drawing source, rendering, modulation, text, and path settings"
              >
                Reset Sound Drawing Settings
              </button>
            </Collapsible>
          )
        )}

        {/* ── Engine Appearance: LaserDMX Spatial Fixtures ─────────────── */}
        {isSpatialFixtures && (
          <>
            <Collapsible label="Output Styling" defaultOpen>
              <SliderRow label="Master Dimmer" value={laserDmxSettings.masterDimmer} onChange={v => setLaserDmxSettings({ masterDimmer: v })} color="#4ac7db" />
              <SliderRow label="Safety Clamp"  value={laserDmxSettings.safetyClamp}  onChange={v => setLaserDmxSettings({ safetyClamp: v })} color="#c0314a" />
            </Collapsible>

            <Collapsible label="Atmosphere" defaultOpen>
              <SliderRow label="Haze"         value={laserDmxSettings.hazeAmount}      onChange={v => setLaserDmxSettings({ hazeAmount: v })}      color="#61d6aa" />
              <SliderRow label="Glow"         value={laserDmxSettings.glowAmount}      onChange={v => setLaserDmxSettings({ glowAmount: v })}      color="#b84fc9" />
              <SliderRow label="Persistence"  value={laserDmxSettings.beamPersistence} onChange={v => setLaserDmxSettings({ beamPersistence: v })} color="#4ac7db" />
              <SliderRow label="Bg Fade"      value={laserDmxSettings.backgroundFade}  onChange={v => setLaserDmxSettings({ backgroundFade: v })}  color="#d8b95a" />
            </Collapsible>

            <Collapsible label="Beam Global" defaultOpen>
              <SliderRow label="Beam Width"  value={laserDmxSettings.globalBeamWidth}  onChange={v => setLaserDmxSettings({ globalBeamWidth: v })}  min={0.2} max={6} step={0.05} color="#61d6aa" />
              <SliderRow label="Strobe Rate" value={laserDmxSettings.globalStrobeRate} onChange={v => setLaserDmxSettings({ globalStrobeRate: v })} color="#c0314a" />
            </Collapsible>

            <Collapsible label="Preview / Debug" defaultOpen={false}>
              <ToggleRow label="Show Origins" value={laserDmxSettings.showFixtureOrigins ?? false} onChange={v => setLaserDmxSettings({ showFixtureOrigins: v })} />
              <ToggleRow label="Show Points"  value={laserDmxSettings.showPathPoints     ?? false} onChange={v => setLaserDmxSettings({ showPathPoints: v })} />
              <ToggleRow label="DMX Debug"    value={laserDmxSettings.showDmxDebug       ?? false} onChange={v => setLaserDmxSettings({ showDmxDebug: v })} />
            </Collapsible>
          </>
        )}

        {/* ── Engine Appearance: LaserDMX Beam Matrix ──────────────────── */}
        {isBeamMatrix && (
          <>
            <Collapsible label="Output Styling" defaultOpen>
              <SliderRow label="Master Dimmer"  value={bmOut.masterDimmer}    onChange={v => setOutput({ masterDimmer: v })}    color="#4ac7db" />
              <SliderRow label="Safety Clamp"   value={bmOut.safetyClamp}     onChange={v => setOutput({ safetyClamp: v })}     color="#c0314a" />
              <SliderRow label="Bg Fade"        value={bmOut.backgroundFade}  onChange={v => setOutput({ backgroundFade: v })}  color="#d8b95a" />
              <SliderRow label="Persistence"    value={bmOut.beamPersistence} onChange={v => setOutput({ beamPersistence: v })} color="#4ac7db" />
            </Collapsible>

            <Collapsible label="Global Beam" defaultOpen>
              <SliderRow label="Beam Width"   value={bmOut.globalBeamWidth}  onChange={v => setOutput({ globalBeamWidth: v })}  min={0.1} max={6} step={0.05} color="#61d6aa" />
              <SliderRow label="Global Glow"  value={bmOut.globalGlow}       onChange={v => setOutput({ globalGlow: v })}       color="#b84fc9" />
              <SliderRow label="Strobe Rate"  value={bmOut.globalStrobeRate} onChange={v => setOutput({ globalStrobeRate: v })} color="#c0314a" />
            </Collapsible>

            <Collapsible label="Fog" defaultOpen={false}>
              <ToggleRow label="Fog Enabled"      value={bmFog.enabled}        onChange={v => setFog({ enabled: v })} />
              <SliderRow label="Density"          value={bmFog.density}        onChange={v => setFog({ density: v })}        color="#61d6aa" />
              <SliderRow label="Opacity"          value={bmFog.opacity}        onChange={v => setFog({ opacity: v })}        color="#4ac7db" />
              <SliderRow label="Noise Scale"      value={bmFog.noiseScale}     onChange={v => setFog({ noiseScale: v })}     min={0.1} max={4} step={0.05} color="#d8b95a" />
              <SliderRow label="Drift Speed"      value={bmFog.driftSpeed}     onChange={v => setFog({ driftSpeed: v })}     color="#61d6aa" />
              <SliderRow label="Drift Direction"  value={bmFog.driftDirection} onChange={v => setFog({ driftDirection: v })} color="#d8b95a" />
              <SliderRow label="Turbulence"       value={bmFog.turbulence}     onChange={v => setFog({ turbulence: v })}     color="#b84fc9" />
              <SliderRow label="Diffusion"        value={bmFog.diffusion}      onChange={v => setFog({ diffusion: v })}      color="#4ac7db" />
              <SliderRow label="Dissipation"      value={bmFog.dissipation}    onChange={v => setFog({ dissipation: v })}    color="#61d6aa" />
              <SliderRow label="Beam Scatter"     value={bmFog.beamScatter}    onChange={v => setFog({ beamScatter: v })}    color="#4ac7db" />
              <SliderRow label="Color Absorption" value={bmFog.colorAbsorption}onChange={v => setFog({ colorAbsorption: v })}color="#d8b95a" />
              <SelectRow
                label="Quality"
                value={bmFog.quality}
                onChange={v => setFog({ quality: v as LaserDmxFogSettings['quality'] })}
                options={[
                  { value: 'low',    label: 'Low'    },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high',   label: 'High'   },
                ]}
              />
            </Collapsible>

            <Collapsible label="Editor" defaultOpen={false}>
              <ToggleRow
                label="Show Beam Editor"
                value={bmEd.beamEditorVisible}
                onChange={v => setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: v })}
                title="Show editing handles and Beam Matrix guides without affecting laser output."
              />
              <ToggleRow
                label="Show Beam Paths"
                value={bmEd.beamPathsVisible}
                onChange={v => setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible: v })}
                disabled={!bmEd.beamEditorVisible}
                title="Show origin-to-target path lines in the editor."
              />
              <ToggleRow
                label="Show Guides"
                value={bmEd.guidesVisible}
                onChange={v => setLaserDmxBeamMatrixEditorSettings({ guidesVisible: v })}
                disabled={!bmEd.beamEditorVisible}
              />
              <ToggleRow label="Snap to Grid" value={bmEd.snapEnabled}   onChange={v => setLaserDmxBeamMatrixEditorSettings({ snapEnabled: v })} />
              <SliderRow label="Overscan"     value={bmEd.overscanAmount} onChange={v => setLaserDmxBeamMatrixEditorSettings({ overscanAmount: v })} min={0} max={0.5} step={0.01} color="#d8b95a" />
            </Collapsible>
          </>
        )}
      </div>

      {/* ── Scoped reset actions ─────────────────────────────────────────── */}
      <div className="rv-ctrl-footer">
        <ReactResetActions />
      </div>
    </>
  )
}

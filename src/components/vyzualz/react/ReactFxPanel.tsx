import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  SliderRow, SelectRow, ToggleRow,
  Collapsible,
} from './ReactControlRows'
import {
  type LaserDmxFogSettings,
} from './ReactTypes'
import { ShaderParameterPanel } from './shaders/ui/ShaderParameterPanel'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { shaderRegistry } from './shaders/registry'
import { getReactFxMasterControls } from './reactFxMasterControls'
import { ReactResetActions } from './ReactResetActions'
import { CinematicWorldsDesignControls, CinematicWorldsFxControls } from './CinematicWorldsControls'
import { CanvasEngineFxPanel } from './ReactCanvasEngineShell'

// ── FX panel ──────────────────────────────────────────────────────────────────
// Styles the currently active visual engine.
// Source/mode/shape selection lives in the ENGINE tab.

export function ReactFxPanel() {
  const {
    reactIntensity,       setReactIntensity,
    reactMotion,          setReactMotion,
    reactGlow,            setReactGlow,
    reactBassReactivity,  setReactBassReactivity,
    activeReactEngineId,
    laserDmxBeamMatrix,   setLaserDmxBeamMatrixSettings,
  } = useReactStore(useShallow(s => ({
    reactIntensity:              s.reactIntensity,
    setReactIntensity:           s.setReactIntensity,
    reactMotion:                 s.reactMotion,
    setReactMotion:              s.setReactMotion,
    reactGlow:                   s.reactGlow,
    setReactGlow:                s.setReactGlow,
    reactBassReactivity:         s.reactBassReactivity,
    setReactBassReactivity:      s.setReactBassReactivity,
    activeReactEngineId:         s.activeReactEngineId,
    laserDmxBeamMatrix:            s.laserDmxBeamMatrix,
    setLaserDmxBeamMatrixSettings: s.setLaserDmxBeamMatrixSettings,
  })))

  const isShader        = activeReactEngineId === 'shaderPads'
  const isCinematic     = activeReactEngineId === 'cinematicPortal'
  const isLaserDmx      = activeReactEngineId === 'laserDmx'
  const isCanvas        = activeReactEngineId === 'canvas'
  const isPixGrid       = activeReactEngineId === 'pixGrid'
  const isBeamMatrix    = isLaserDmx
  const activeShaderId = useShaderPanelStore(state => state.activeShaderId)
  const shaderMasterCapabilities = isShader && activeShaderId
    ? shaderRegistry.get(activeShaderId)?.masterCapabilities
    : undefined

  const masterControls = getReactFxMasterControls(activeReactEngineId)
  const showMasterIntensity = masterControls.includes('intensity')
  const showMasterMotion = masterControls.includes('motion')
  const showMasterGlow = masterControls.includes('glow')
  const showMasterBassReactivity = masterControls.includes('bassReactivity')

  const masterControlRows = (
    <>
      {showMasterIntensity && (
        isLaserDmx ? (
          <SliderRow
            label="Preview Output Trim"
            value={reactIntensity}
            onChange={setReactIntensity}
            color="#4ac7db"
            description="Preview-only trim applied consistently to WebGL and Canvas2D. It never changes production hardware output."
          />
        ) : (
          <SliderRow
            label={isPixGrid ? 'Authored Performance Trim' : 'Intensity'}
            value={reactIntensity}
            onChange={setReactIntensity}
            disabled={isShader && shaderMasterCapabilities?.intensity === false}
            color="#4ac7db"
            description={isPixGrid
              ? 'Trims the authored React performance output after PixGrid Output Intensity. Kept separate for automation and legacy preset compatibility.'
              : isShader && shaderMasterCapabilities?.intensity === false
                ? 'Not used by this scene.'
                : isShader
                  ? 'Global scene output intensity. Scene-local brightness controls retain their authored scope.'
                  : undefined}
          />
        )
      )}
      {showMasterMotion && (
        <SliderRow
          label="Motion"
          value={reactMotion}
          onChange={setReactMotion}
          disabled={isShader && shaderMasterCapabilities?.motion === false}
          color="#61d6aa"
          description={isShader && shaderMasterCapabilities?.motion === false
            ? 'Not used by this scene.'
            : isShader
              ? 'Global animation-rate trim. Scene-local motion parameters keep their authored behavior.'
              : undefined}
        />
      )}
      {showMasterGlow && (
        isLaserDmx ? (
          <SliderRow
            label="Preview Glow Trim"
            value={reactGlow}
            onChange={setReactGlow}
            color="#b84fc9"
            description="Preview-only glow trim applied after Authored Show Glow. Production hardware output never inherits it."
          />
        ) : (
          <SliderRow
            label={isPixGrid ? 'Halo Radius' : 'Glow'}
            value={reactGlow}
            onChange={setReactGlow}
            disabled={isShader && shaderMasterCapabilities?.glow === false}
            color="#b84fc9"
            description={isPixGrid
              ? 'Controls the spatial radius of the PixGrid halo. Emitter Glow controls halo strength.'
              : isShader && shaderMasterCapabilities?.glow === false
                ? 'Not used by this scene.'
                : isShader
                  ? 'Global post or scene glow trim. Scene-local glow controls remain independent.'
                  : undefined}
          />
        )
      )}
      {showMasterBassReactivity && (
        <SliderRow
          label="Bass React"
          value={reactBassReactivity}
          onChange={setReactBassReactivity}
          disabled={isShader && shaderMasterCapabilities?.bassReactivity === false}
          color="#d8b95a"
          description={isShader && shaderMasterCapabilities?.bassReactivity === false
            ? 'Not used by this scene.'
            : isShader
              ? 'Global bass-response trim. Scene-local audio parameters retain their authored sensitivity.'
              : undefined}
        />
      )}
    </>
  )

  const bm     = laserDmxBeamMatrix
  const bmOut  = bm.output
  const bmFog  = bm.fog

  function setOutput(patch: Partial<typeof bmOut>) {
    setLaserDmxBeamMatrixSettings({ output: { ...bmOut, ...patch } })
  }
  function setFog(patch: Partial<LaserDmxFogSettings>) {
    setLaserDmxBeamMatrixSettings({ fog: { ...bmFog, ...patch } })
  }

  // Shader scenes consume the same React-wide master values passed into the
  // renderer, so keep them visible above the scene-specific parameter controls.
  if (isCinematic) {
    return (
      <div className="rv-cinematic-design-controls">
        <CinematicWorldsDesignControls />
        <CinematicWorldsFxControls />
      </div>
    )
  }

  if (isCanvas) {
    return <CanvasEngineFxPanel />
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


        {/* ── Engine Appearance: LaserDMX Beam Matrix ──────────────────── */}
        {isBeamMatrix && (
          <>
            <Collapsible label="Output Styling" defaultOpen>
              <SliderRow label="Authored Show Dimmer"  value={bmOut.masterDimmer}    onChange={v => setOutput({ masterDimmer: v })}    color="#4ac7db" />
              <SliderRow label="Safety Clamp"   value={bmOut.safetyClamp}     onChange={v => setOutput({ safetyClamp: v })}     color="#c0314a" />
              <SliderRow label="Bg Fade"        value={bmOut.backgroundFade}  onChange={v => setOutput({ backgroundFade: v })}  color="#d8b95a" />
              <SliderRow label="Persistence"    value={bmOut.beamPersistence} onChange={v => setOutput({ beamPersistence: v })} color="#4ac7db" />
            </Collapsible>

            <Collapsible label="Global Beam" defaultOpen>
              <SliderRow label="Beam Width"   value={bmOut.globalBeamWidth}  onChange={v => setOutput({ globalBeamWidth: v })}  min={0.1} max={6} step={0.05} color="#61d6aa" />
              <SliderRow label="Authored Show Glow"  value={bmOut.globalGlow}       onChange={v => setOutput({ globalGlow: v })}       color="#b84fc9" />
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

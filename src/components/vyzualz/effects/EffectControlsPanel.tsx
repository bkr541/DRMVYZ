import { memo, useState, useMemo } from 'react'
import { MagicWand01Icon } from 'hugeicons-react'
import type { VzEffects } from '../../../stores/visualStore'
import type { VzEffectParams } from '../../../types/effectParams'
import type { EffectChainOptionRow } from '../../../types/database'
import {
  resolveGlitchParams, resolveSpectrumBarsParams, resolveTunnelParams,
  resolveStrobeParams, resolveNoiseFogParams, resolveParticleBurstParams,
  resolvePixelDistortionParams, resolveFrameQuantizationParams,
  resolveBloomEffectParams, resolveAnalogSignalParams,
  resolveFeedbackEffectParams, resolveDisplacementEffectParams,
} from '../../../types/effectParams'
import { VzSlider } from './VzSlider'
import { EffectGroup } from './EffectGroup'
import type { EffectGroupId } from './EffectGroup'
import type { HelpId } from '../../../help/HelpCenter'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

type EffectControlsPanelProps = {
  effects:       VzEffects
  effectOptions: EffectChainOptionRow[]
  enabledFx:     Set<string>
  onChange:      (key: keyof VzEffects, v: number) => void
  onReset:       () => void
  effectParams:  VzEffectParams
  onParamChange: <K extends keyof VzEffectParams>(key: K, patch: Partial<NonNullable<VzEffectParams[K]>>) => void
  audioReactivityEnabled?: boolean
}

const PRIORITY_ONE_EFFECT_HELP_IDS: Partial<Record<keyof VzEffects, HelpId>> = {
  masterIntensity: 'visualizer.effects.global.masterIntensity',
  bassReactivity: 'visualizer.effects.global.bassReactivity',
  logoScale: 'visualizer.effects.global.reactiveScale',
  colorShift: 'visualizer.effects.global.colorShift',
  spectrumBars: 'visualizer.effects.audioReactive.spectrumBars',
  circularSpectrum: 'visualizer.effects.audioReactive.circularSpectrum',
  oscilloscope: 'visualizer.effects.audioReactive.oscilloscope',
  beatRing: 'visualizer.effects.audioReactive.beatRing',
  particleBurst: 'visualizer.effects.audioReactive.particleBurst',
  reactiveGrid: 'visualizer.effects.audioReactive.reactiveGrid',
}

export const EffectControlsPanel = memo(function EffectControlsPanel({
  effects, effectOptions, enabledFx, onChange, onReset, effectParams, onParamChange, audioReactivityEnabled,
}: EffectControlsPanelProps) {
  const [openGroups, setOpenGroups] = useState<Record<EffectGroupId, boolean>>({
    global: true, motion: true, audioReactive: true, distortion: false, lighting: false,
  })
  const toggleGroup = (id: EffectGroupId) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  // Derive the effect_key → chain_name lookup from Supabase records.
  // Replaces the former hardcoded EFFECT_CONTROL_CHAIN_MAP.
  const effectChainNameByKey = useMemo(
    () => new Map(effectOptions.map(o => [o.effect_key, o.chain_name])),
    [effectOptions],
  )

  // Returns true when the chain item for a given VzEffects property key is enabled.
  const isEffectEnabled = (effectKey: keyof VzEffects): boolean => {
    const chainName = effectChainNameByKey.get(String(effectKey))
    return chainName ? enabledFx.has(chainName) : false
  }

  const s = (
    key: keyof VzEffects,
    label: string,
    opts?: { min?: number; max?: number; color?: boolean; tooltip?: string; offHint?: string; audioOff?: boolean },
  ) => {
    const chainName    = effectChainNameByKey.get(String(key))
    const chainEnabled = chainName === undefined ? undefined : enabledFx.has(chainName)
    const effectiveChainEnabled = opts?.audioOff ? false : chainEnabled
    return (
      <VzSlider key={key} label={label} value={effects[key]}
        min={opts?.min} max={opts?.max} colorTrack={opts?.color}
        chainEnabled={effectiveChainEnabled}
        tooltip={opts?.tooltip}
        offHint={opts?.offHint}
        helpId={PRIORITY_ONE_EFFECT_HELP_IDS[key]}
        onChange={v => onChange(key, v)}
      />
    )
  }

  // Compact number input for performance/rendering params
  const p = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts: { min: number; max: number; step?: number; isInt?: boolean; helpId?: HelpId },
  ) => (
    <div className="vz-param-row drm-help-target">
      <span className="vz-param-label">{label}</span>
      {opts.helpId && <HelpInfoTrigger helpId={opts.helpId} currentValue={String(value)} />}
      <input
        className="vz-param-input"
        type="number"
        value={value}
        min={opts.min}
        max={opts.max}
        step={opts.step ?? (opts.isInt ? 1 : 0.01)}
        onChange={e => {
          const n = opts.isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value)
          if (!isNaN(n)) onChange(Math.min(opts.max, Math.max(opts.min, n)))
        }}
      />
    </div>
  )

  // Boolean toggle for rendering params
  const b = (label: string, value: boolean, onChange: (v: boolean) => void, helpId?: HelpId) => (
    <div className="vz-param-row drm-help-target">
      <span className="vz-param-label">{label}</span>
      {helpId && (
        <HelpInfoTrigger
          helpId={helpId}
          currentValue={value ? 'On' : 'Off'}
          currentValueLabel="Status"
          currentValueTone={value ? 'success' : 'default'}
        />
      )}
      <button
        type="button"
        className={`vz-param-toggle${value ? ' vz-param-toggle--on' : ''}`}
        aria-pressed={value}
        onClick={() => onChange(!value)}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  )

  const gp  = resolveGlitchParams(effectParams)
  const sp  = resolveSpectrumBarsParams(effectParams)
  const tp  = resolveTunnelParams(effectParams)
  const str = resolveStrobeParams(effectParams)
  const np  = resolveNoiseFogParams(effectParams)
  const pp  = resolveParticleBurstParams(effectParams)
  const pdp = resolvePixelDistortionParams(effectParams)
  const fqp = resolveFrameQuantizationParams(effectParams)
  const blp = resolveBloomEffectParams(effectParams)
  const asp = resolveAnalogSignalParams(effectParams)
  const fbp = resolveFeedbackEffectParams(effectParams)
  const dsp = resolveDisplacementEffectParams(effectParams)

  return (
    <div className="vz-effects-panel">
      <div className="vz-panel-header">
        <MagicWand01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Effect Controls</span>
        <button className="vz-reset-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="vz-effects-scroll">
        <EffectGroup id="global" title="Global" helpId="visualizer.effects.global.overview" count={4} isOpen={openGroups.global} onToggle={toggleGroup}>
          {s('masterIntensity', 'Master Intensity')}
          {s('bassReactivity',  'Bass Reactivity')}
          {s('logoScale', 'Reactive Scale', {
            min: 0, max: 2,
            tooltip: 'Controls scale pulsing for media with Audio Reactivity enabled.',
            offHint: 'Audio Reactivity is off',
            audioOff: audioReactivityEnabled === false,
          })}
          {s('colorShift',      'Color Shift', { color: true })}
        </EffectGroup>

        <EffectGroup id="motion" title="Motion" count={8} isOpen={openGroups.motion} onToggle={toggleGroup}>
          {s('tunnelSpeed',  'Tunnel Speed')}
          {isEffectEnabled('tunnelSpeed') && <div className="vz-param-group">
            {p('Rings',     tp.ringCount, v => onParamChange('tunnel', { ringCount: v }),  { min: 3, max: 20, isInt: true })}
            {p('Line Width', tp.lineWidth, v => onParamChange('tunnel', { lineWidth: v }), { min: 0.5, max: 4, step: 0.5 })}
            {p('Depth',     tp.depth,     v => onParamChange('tunnel', { depth: v }),     { min: 0.1, max: 2, step: 0.1 })}
          </div>}
          {s('displacement', 'Displacement')}
          {isEffectEnabled('displacement') && <div className="vz-param-group">
            {p('Noise Scale',  dsp.noiseScale,  v => onParamChange('displacement', { noiseScale: v }),  { min: 0.5, max: 8, step: 0.5 })}
            {p('Noise Amount', dsp.noiseAmount, v => onParamChange('displacement', { noiseAmount: v }), { min: 0, max: 1, step: 0.05 })}
            {p('Warp Speed',   dsp.warpSpeed,   v => onParamChange('displacement', { warpSpeed: v }),   { min: 0, max: 2, step: 0.1 })}
            {p('H Bias',       dsp.horizontalBias, v => onParamChange('displacement', { horizontalBias: v }), { min: 0, max: 2, step: 0.1 })}
            {p('Bass Resp',    dsp.bassResponse, v => onParamChange('displacement', { bassResponse: v }), { min: 0, max: 1, step: 0.05 })}
            {b('Ghost Layer',  dsp.retainGhostLayer, v => onParamChange('displacement', { retainGhostLayer: v }))}
          </div>}
          {s('frameQuantization', 'Frame Quantize')}
          {isEffectEnabled('frameQuantization') && <div className="vz-param-group">
            {p('Target FPS',    fqp.targetFps,        v => onParamChange('frameQuantization', { targetFps: v }),        { min: 1, max: 60, isInt: true })}
            {p('Beat Hold',     fqp.beatHoldFrames,   v => onParamChange('frameQuantization', { beatHoldFrames: v }),   { min: 0, max: 10, isInt: true })}
            {p('Beat Stutter',  fqp.beatStutterAmount, v => onParamChange('frameQuantization', { beatStutterAmount: v }), { min: 0, max: 1, step: 0.05 })}
          </div>}
          {s('cameraShake',  'Camera Shake')}
          {s('radialBlur',   'Radial Blur')}
          {s('kaleidoscope', 'Kaleidoscope')}
          {s('mirrorSplit',  'Mirror Split')}
        </EffectGroup>

        <EffectGroup id="audioReactive" title="Audio Reactive" helpId="visualizer.effects.audioReactive.overview" count={6} isOpen={openGroups.audioReactive} onToggle={toggleGroup}>
          {s('spectrumBars', 'Spectrum Bars')}
          {isEffectEnabled('spectrumBars') && <div className="vz-param-group">
            {p('Bar Count', sp.barCount, v => onParamChange('spectrumBars', { barCount: v }), { min: 8, max: 120, isInt: true, helpId: 'visualizer.effects.audioReactive.barCount' })}
            {p('Smoothing', sp.smoothing, v => onParamChange('spectrumBars', { smoothing: v }), { min: 0, max: 0.95, step: 0.05, helpId: 'visualizer.effects.audioReactive.smoothing' })}
            {b('Mirror', sp.mirrorMode, v => onParamChange('spectrumBars', { mirrorMode: v }), 'visualizer.effects.audioReactive.mirror')}
          </div>}
          {s('circularSpectrum', 'Circular Spectrum')}
          {s('oscilloscope',     'Oscilloscope')}
          {s('beatRing',         'Beat Ring')}
          {s('particleBurst',    'Particle Burst')}
          {isEffectEnabled('particleBurst') && <div className="vz-param-group">
            {p('Max Particles', pp.maxParticles, v => onParamChange('particleBurst', { maxParticles: v }), { min: 10, max: 200, isInt: true, helpId: 'visualizer.effects.audioReactive.maxParticles' })}
          </div>}
          {s('reactiveGrid', 'Reactive Grid')}
        </EffectGroup>

        <EffectGroup id="distortion" title="Distortion" count={7} isOpen={openGroups.distortion} onToggle={toggleGroup}>
          {s('pixelDistortion', 'Pixel Distortion')}
          {isEffectEnabled('pixelDistortion') && <div className="vz-param-group">
            {p('Pixel Size',   pdp.pixelSize,        v => onParamChange('pixelDistortion', { pixelSize: v }),        { min: 1, max: 16, isInt: true })}
            {p('Posterize',    pdp.posterizeLevels,  v => onParamChange('pixelDistortion', { posterizeLevels: v }),  { min: 2, max: 16, isInt: true })}
            {p('Dither',       pdp.ditherAmount,     v => onParamChange('pixelDistortion', { ditherAmount: v }),     { min: 0, max: 1, step: 0.05 })}
            {p('Corruption',   pdp.corruptionAmount, v => onParamChange('pixelDistortion', { corruptionAmount: v }), { min: 0, max: 1, step: 0.05 })}
            {p('Overexposure', pdp.overexposure,     v => onParamChange('pixelDistortion', { overexposure: v }),     { min: 0, max: 1, step: 0.05 })}
            {p('Energy Tint',  pdp.energyTint,       v => onParamChange('pixelDistortion', { energyTint: v }),       { min: 0, max: 1, step: 0.05 })}
            {p('Beat Punch',   pdp.beatPunch,        v => onParamChange('pixelDistortion', { beatPunch: v }),        { min: 0, max: 1, step: 0.05 })}
          </div>}
          {s('glitchAmount', 'Glitch Amount')}
          {isEffectEnabled('glitchAmount') && <div className="vz-param-group">
            {p('Slices',      gp.sliceCount,  v => onParamChange('glitch', { sliceCount: v }),  { min: 2, max: 20, isInt: true })}
            {p('Probability', gp.probability, v => onParamChange('glitch', { probability: v }), { min: 0, max: 1, step: 0.05 })}
            {p('Max Shift',   gp.maxShift,    v => onParamChange('glitch', { maxShift: v }),    { min: 10, max: 200, isInt: true })}
          </div>}
          {s('rgbSplit',      'RGB Split')}
          {s('vhsStatic',     'VHS Static')}
          {s('datamoshSmear', 'Datamosh Smear')}
          {s('scanlines',     'Scanlines')}
          {isEffectEnabled('scanlines') && <div className="vz-param-group">
            {p('Density',    asp.density,      v => onParamChange('analogSignal', { density: v }),      { min: 0, max: 1, step: 0.05 })}
            {p('Strength',   asp.strength,     v => onParamChange('analogSignal', { strength: v }),     { min: 0, max: 1, step: 0.05 })}
            {p('Jitter',     asp.jitterAmount, v => onParamChange('analogSignal', { jitterAmount: v }), { min: 0, max: 1, step: 0.05 })}
            {p('Curvature',  asp.curvature,    v => onParamChange('analogSignal', { curvature: v }),    { min: 0, max: 1, step: 0.05 })}
          </div>}
        </EffectGroup>

        <EffectGroup id="lighting" title="Lighting / Atmosphere" count={9} isOpen={openGroups.lighting} onToggle={toggleGroup}>
          {s('bloom', 'Bloom')}
          {isEffectEnabled('bloom') && <div className="vz-param-group">
            {p('Radius',      blp.radius,              v => onParamChange('bloom', { radius: v }),              { min: 1, max: 40, isInt: true })}
            {p('Threshold',   blp.threshold,           v => onParamChange('bloom', { threshold: v }),           { min: 0, max: 1, step: 0.05 })}
            {p('Intensity',   blp.intensityMultiplier, v => onParamChange('bloom', { intensityMultiplier: v }), { min: 0, max: 3, step: 0.1 })}
            {p('Exposure',    blp.exposure,            v => onParamChange('bloom', { exposure: v }),            { min: -1, max: 2, step: 0.1 })}
            {p('Tint R',      blp.tintR,               v => onParamChange('bloom', { tintR: v }),               { min: 0, max: 1, step: 0.05 })}
            {p('Tint G',      blp.tintG,               v => onParamChange('bloom', { tintG: v }),               { min: 0, max: 1, step: 0.05 })}
            {p('Tint B',      blp.tintB,               v => onParamChange('bloom', { tintB: v }),               { min: 0, max: 1, step: 0.05 })}
          </div>}
          {s('strobe', 'Strobe')}
          {isEffectEnabled('strobe') && <div className="vz-param-group">
            {p('Beat Div',  str.beatDivision, v => onParamChange('strobe', { beatDivision: v }), { min: 0.25, max: 4, step: 0.25 })}
            {p('Safety Cap', str.safetyCap,   v => onParamChange('strobe', { safetyCap: v }),    { min: 0, max: 10, step: 1, isInt: true })}
          </div>}
          {s('feedbackTrails', 'Feedback Trails')}
          {isEffectEnabled('feedbackTrails') && <div className="vz-param-group">
            {p('Decay',    fbp.decay,         v => onParamChange('feedback', { decay: v }),         { min: 0, max: 0.97, step: 0.01 })}
            {p('Smear X',  fbp.smearX,        v => onParamChange('feedback', { smearX: v }),        { min: -20, max: 20, step: 1 })}
            {p('Smear Y',  fbp.smearY,        v => onParamChange('feedback', { smearY: v }),        { min: -20, max: 20, step: 1 })}
            {p('Zoom',     fbp.zoom,          v => onParamChange('feedback', { zoom: v }),          { min: 0.9, max: 1.1, step: 0.005 })}
            {p('Audio Resp', fbp.audioResponse, v => onParamChange('feedback', { audioResponse: v }), { min: 0, max: 1, step: 0.05 })}
          </div>}
          {s('edgeGlow',       'Edge Glow')}
          {s('colorCycle',     'Color Cycle')}
          {s('beatFlash',      'Beat Flash')}
          {s('edgeFlicker',    'Edge Flicker')}
          {s('noiseFog',       'Noise Fog')}
          {isEffectEnabled('noiseFog') && <div className="vz-param-group">
            {p('Particle Count', np.particleCount, v => onParamChange('noiseFog', { particleCount: v }), { min: 0, max: 1000, isInt: true })}
          </div>}
        </EffectGroup>
      </div>
    </div>
  )
})

import { memo, useState, useMemo } from 'react'
import { MagicWand01Icon } from 'hugeicons-react'
import type { VzEffects } from '../../../stores/visualStore'
import type { VzEffectParams } from '../../../types/effectParams'
import type { EffectChainOptionRow } from '../../../types/database'
import {
  resolveGlitchParams, resolveSpectrumBarsParams, resolveTunnelParams,
  resolveStrobeParams, resolveNoiseFogParams, resolveParticleBurstParams,
} from '../../../types/effectParams'
import { VzSlider } from './VzSlider'
import { EffectGroup } from './EffectGroup'
import type { EffectGroupId } from './EffectGroup'

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
        onChange={v => onChange(key, v)}
      />
    )
  }

  // Compact number input for performance/rendering params
  const p = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts: { min: number; max: number; step?: number; isInt?: boolean },
  ) => (
    <div className="vz-param-row">
      <span className="vz-param-label">{label}</span>
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
  const b = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <div className="vz-param-row">
      <span className="vz-param-label">{label}</span>
      <button
        className={`vz-param-toggle${value ? ' vz-param-toggle--on' : ''}`}
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

  return (
    <div className="vz-effects-panel">
      <div className="vz-panel-header">
        <MagicWand01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Effect Controls</span>
        <button className="vz-reset-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="vz-effects-scroll">
        <EffectGroup id="global" title="Global" count={4} isOpen={openGroups.global} onToggle={toggleGroup}>
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

        <EffectGroup id="motion" title="Motion" count={6} isOpen={openGroups.motion} onToggle={toggleGroup}>
          {s('tunnelSpeed',  'Tunnel Speed')}
          {isEffectEnabled('tunnelSpeed') && <div className="vz-param-group">
            {p('Rings',     tp.ringCount, v => onParamChange('tunnel', { ringCount: v }),  { min: 3, max: 20, isInt: true })}
            {p('Line Width', tp.lineWidth, v => onParamChange('tunnel', { lineWidth: v }), { min: 0.5, max: 4, step: 0.5 })}
            {p('Depth',     tp.depth,     v => onParamChange('tunnel', { depth: v }),     { min: 0.1, max: 2, step: 0.1 })}
          </div>}
          {s('displacement', 'Displacement')}
          {s('cameraShake',  'Camera Shake')}
          {s('radialBlur',   'Radial Blur')}
          {s('kaleidoscope', 'Kaleidoscope')}
          {s('mirrorSplit',  'Mirror Split')}
        </EffectGroup>

        <EffectGroup id="audioReactive" title="Audio Reactive" count={6} isOpen={openGroups.audioReactive} onToggle={toggleGroup}>
          {s('spectrumBars', 'Spectrum Bars')}
          {isEffectEnabled('spectrumBars') && <div className="vz-param-group">
            {p('Bar Count', sp.barCount, v => onParamChange('spectrumBars', { barCount: v }), { min: 8, max: 120, isInt: true })}
            {p('Smoothing', sp.smoothing, v => onParamChange('spectrumBars', { smoothing: v }), { min: 0, max: 0.95, step: 0.05 })}
            {b('Mirror', sp.mirrorMode, v => onParamChange('spectrumBars', { mirrorMode: v }))}
          </div>}
          {s('circularSpectrum', 'Circular Spectrum')}
          {s('oscilloscope',     'Oscilloscope')}
          {s('beatRing',         'Beat Ring')}
          {s('particleBurst',    'Particle Burst')}
          {isEffectEnabled('particleBurst') && <div className="vz-param-group">
            {p('Max Particles', pp.maxParticles, v => onParamChange('particleBurst', { maxParticles: v }), { min: 10, max: 200, isInt: true })}
          </div>}
          {s('reactiveGrid', 'Reactive Grid')}
        </EffectGroup>

        <EffectGroup id="distortion" title="Distortion" count={5} isOpen={openGroups.distortion} onToggle={toggleGroup}>
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
        </EffectGroup>

        <EffectGroup id="lighting" title="Lighting / Atmosphere" count={8} isOpen={openGroups.lighting} onToggle={toggleGroup}>
          {s('bloom', 'Bloom')}
          {s('strobe', 'Strobe')}
          {isEffectEnabled('strobe') && <div className="vz-param-group">
            {p('Beat Div',  str.beatDivision, v => onParamChange('strobe', { beatDivision: v }), { min: 0.25, max: 4, step: 0.25 })}
            {p('Safety Cap', str.safetyCap,   v => onParamChange('strobe', { safetyCap: v }),    { min: 0, max: 10, step: 1, isInt: true })}
          </div>}
          {s('feedbackTrails', 'Feedback Trails')}
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

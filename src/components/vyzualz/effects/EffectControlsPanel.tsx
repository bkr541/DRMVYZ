import { useState } from 'react'
import { MagicWand01Icon } from 'hugeicons-react'
import type { VzEffects } from '../../../stores/visualStore'
import { VzSlider } from './VzSlider'
import { EffectGroup } from './EffectGroup'
import type { EffectGroupId } from './EffectGroup'

const EFFECT_CONTROL_CHAIN_MAP: Partial<Record<keyof VzEffects, string>> = {
  glitchAmount:    'Glitch Bars',
  rgbSplit:        'RGB Split',
  tunnelSpeed:     'Tunnel',
  displacement:    'Displacement',
  bloom:           'Bloom',
  strobe:          'Strobe',
  feedbackTrails:  'Feedback',
  colorShift:      'Color Shift',
  spectrumBars:    'Spectrum Bars',
  circularSpectrum: 'Circular Spectrum',
  oscilloscope:    'Oscilloscope',
  beatRing:        'Beat Ring',
  particleBurst:   'Particle Burst',
  reactiveGrid:    'Reactive Grid',
  cameraShake:     'Camera Shake',
  kaleidoscope:    'Kaleidoscope',
  mirrorSplit:     'Mirror Split',
  radialBlur:      'Radial Blur',
  vhsStatic:       'VHS Static',
  datamoshSmear:   'Datamosh Smear',
  edgeGlow:        'Edge Glow',
  colorCycle:      'Color Cycle',
  noiseFog:        'Noise Fog',
  scanlines:       'Scanlines',
  beatFlash:       'Beat Flash',
  edgeFlicker:     'Edge Flicker',
}

type EffectControlsPanelProps = {
  effects: VzEffects
  enabledFx: Set<string>
  onChange: (key: keyof VzEffects, v: number) => void
  onReset: () => void
}

export function EffectControlsPanel({ effects, enabledFx, onChange, onReset }: EffectControlsPanelProps) {
  const [openGroups, setOpenGroups] = useState<Record<EffectGroupId, boolean>>({
    global: true, motion: true, audioReactive: true, distortion: false, lighting: false,
  })
  const toggleGroup = (id: EffectGroupId) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))

  const s = (key: keyof VzEffects, label: string, opts?: { min?: number; max?: number; color?: boolean }) => {
    const chainItem = EFFECT_CONTROL_CHAIN_MAP[key]
    const chainEnabled = chainItem === undefined ? undefined : enabledFx.has(chainItem)
    return (
      <VzSlider key={key} label={label} value={effects[key]}
        min={opts?.min} max={opts?.max} colorTrack={opts?.color}
        chainEnabled={chainEnabled}
        onChange={v => onChange(key, v)}
      />
    )
  }

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
          {s('logoScale',       'Logo Scale', { min: 0, max: 2 })}
          {s('colorShift',      'Color Shift', { color: true })}
        </EffectGroup>

        <EffectGroup id="motion" title="Motion" count={6} isOpen={openGroups.motion} onToggle={toggleGroup}>
          {s('tunnelSpeed',  'Tunnel Speed')}
          {s('displacement', 'Displacement')}
          {s('cameraShake',  'Camera Shake')}
          {s('radialBlur',   'Radial Blur')}
          {s('kaleidoscope', 'Kaleidoscope')}
          {s('mirrorSplit',  'Mirror Split')}
        </EffectGroup>

        <EffectGroup id="audioReactive" title="Audio Reactive" count={6} isOpen={openGroups.audioReactive} onToggle={toggleGroup}>
          {s('spectrumBars',     'Spectrum Bars')}
          {s('circularSpectrum', 'Circular Spectrum')}
          {s('oscilloscope',     'Oscilloscope')}
          {s('beatRing',         'Beat Ring')}
          {s('particleBurst',    'Particle Burst')}
          {s('reactiveGrid',     'Reactive Grid')}
        </EffectGroup>

        <EffectGroup id="distortion" title="Distortion" count={5} isOpen={openGroups.distortion} onToggle={toggleGroup}>
          {s('glitchAmount',  'Glitch Amount')}
          {s('rgbSplit',      'RGB Split')}
          {s('vhsStatic',     'VHS Static')}
          {s('datamoshSmear', 'Datamosh Smear')}
          {s('scanlines',     'Scanlines')}
        </EffectGroup>

        <EffectGroup id="lighting" title="Lighting / Atmosphere" count={8} isOpen={openGroups.lighting} onToggle={toggleGroup}>
          {s('bloom',          'Bloom')}
          {s('strobe',         'Strobe')}
          {s('feedbackTrails', 'Feedback Trails')}
          {s('edgeGlow',       'Edge Glow')}
          {s('colorCycle',     'Color Cycle')}
          {s('beatFlash',      'Beat Flash')}
          {s('edgeFlicker',    'Edge Flicker')}
          {s('noiseFog',       'Noise Fog')}
        </EffectGroup>
      </div>
    </div>
  )
}

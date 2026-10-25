import { Collapsible, SelectRow, SliderRow } from '../../../components/vyzualz/react/ReactControlRows'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { IconMorphCheckbox } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import type {
  BrandKit,
  BrandKitEngineRule,
  BrandKitEngineTarget,
  BrandPersonalizationMode,
} from '../BrandKitTypes'
import { BRAND_PERSONALIZATION_MODES } from '../BrandKitTypes'
import { BrandKitPaletteEditor } from './BrandKitPaletteEditor'

const ENGINES: ReadonlyArray<{
  id: BrandKitEngineTarget
  label: string
  description: string
}> = [
  { id: 'oscilloscope', label: 'Sound Drawing', description: 'Waveforms, text, shapes, and palette-enabled SVG artwork.' },
  { id: 'laserDmx', label: 'LaserDMX', description: 'Transient virtual RGBW adaptation for Beam Matrix.' },
]

const MODE_LABELS: Record<BrandPersonalizationMode, string> = {
  original: 'Original',
  hybrid: 'Hybrid',
  brand: 'Brand',
  custom: 'Custom',
}

const MODE_DESCRIPTIONS: Record<BrandPersonalizationMode, string> = {
  original: 'Keep each preset exactly as designed.',
  hybrid: 'Blend your identity into the preset while retaining its character.',
  brand: 'Map the Brand Kit semantic colors directly.',
  custom: 'Use an engine-specific semantic palette.',
}

function effectiveRule(kit: BrandKit, engineId: BrandKitEngineTarget): BrandKitEngineRule {
  return kit.engineRules[engineId] ?? {
    mode: 'hybrid',
    strength: kit.defaultStrength,
    ...(engineId === 'laserDmx' ? { preserveTriggerSemantics: true } : {}),
  }
}

export function BrandKitEngineControls({ kit, onChange }: {
  kit: BrandKit
  onChange: (engineRules: BrandKit['engineRules']) => void
}) {
  function updateRule(engineId: BrandKitEngineTarget, patch: Partial<BrandKitEngineRule>) {
    const current = effectiveRule(kit, engineId)
    onChange({
      ...kit.engineRules,
      [engineId]: { ...current, ...patch },
    })
  }

  function resetRule(engineId: BrandKitEngineTarget) {
    const next = { ...kit.engineRules }
    delete next[engineId]
    onChange(next)
  }

  return (
    <div className="bk-engine-list">
      {ENGINES.map(engine => {
        const rule = effectiveRule(kit, engine.id)
        const customPalette = rule.customPalette ?? kit.palette
        return (
          <Collapsible key={engine.id} label={engine.label}>
            <div className="bk-engine-heading">
              <div>

                <p>{engine.description}</p>
              </div>
              <IconChipButton type="button" onClick={() => resetRule(engine.id)}>
                Reset to Brand Kit default
              </IconChipButton>
            </div>
            <SelectRow label={`${engine.label} personalization mode`} value={rule.mode} onChange={value => updateRule(engine.id, {mode:value as BrandPersonalizationMode, ...(value === 'custom' && !rule.customPalette ? {customPalette:{...kit.palette}} : {})})} options={BRAND_PERSONALIZATION_MODES.map(value=>({value,label:MODE_LABELS[value]}))} />
            <p className="bk-mode-description">{MODE_DESCRIPTIONS[rule.mode]}</p>
            <SliderRow id={`bk-strength-${engine.id}`} label="Strength" value={rule.strength} disabled={rule.mode === 'original'} onChange={strength => updateRule(engine.id, {strength})} />
            {engine.id === 'laserDmx' && (
              <div className="bk-laser-personalization">
                <label className="bk-inline-toggle">
                  <IconMorphCheckbox
                    checked={rule.preserveTriggerSemantics !== false}
                    disabled={rule.mode === 'original'}
                    onChange={event => updateRule(engine.id, { preserveTriggerSemantics: event.target.checked })}
                  />
                  <span>Preserve trigger semantics</span>
                </label>
                <div className="bk-laser-swatches" aria-label="LaserDMX semantic role preview">
                  {([
                    ['Kick / bass', customPalette.primary],
                    ['Snare / clap', customPalette.secondary],
                    ['Beat / pulse', customPalette.accent],
                    ['Fill / flash', customPalette.highlight],
                  ] as const).map(([label, color]) => (
                    <span key={label} title={label}><i style={{ background: color }} aria-hidden="true" />{label}</span>
                  ))}
                </div>
                <p className="bk-mode-description">Color personalization is applied before virtual compilation. Blackout, safety clamp, shutter, dimmer, strobe, and playback gates always retain authority.</p>
              </div>
            )}
            {rule.mode === 'custom' && (
              <div className="bk-custom-palette">
                <BrandKitPaletteEditor
                  palette={customPalette}
                  resetPalette={kit.palette}
                  compact
                  onChange={palette => updateRule(engine.id, { customPalette: palette })}
                />
                {rule.customPalette && (
                  <IconChipButton type="button" onClick={() => {
                    const { customPalette: _removed, ...withoutCustom } = rule
                    onChange({ ...kit.engineRules, [engine.id]: withoutCustom })
                  }}>Remove custom engine palette</IconChipButton>
                )}
              </div>
            )}
          </Collapsible>
        )
      })}
    </div>
  )
}

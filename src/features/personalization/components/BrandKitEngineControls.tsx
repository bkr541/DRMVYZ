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
  { id: 'cinematicPortal', label: 'Cinematic Worlds', description: 'All Cinematic Worlds, including Reactive Constellation.' },
  { id: 'laserDmx', label: 'LaserDMX', description: 'Transient virtual RGBW adaptation for Spatial Fixtures and Beam Matrix.' },
  { id: 'shaderPads', label: 'Shader ENGINE', description: 'Semantic shader colors, gradients, and optional in-shader Brand Kit assets.' },
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
          <section key={engine.id} className="bk-engine-card" aria-labelledby={`bk-engine-${engine.id}`}>
            <div className="bk-engine-heading">
              <div>
                <h4 id={`bk-engine-${engine.id}`}>{engine.label}</h4>
                <p>{engine.description}</p>
              </div>
              <button type="button" className="bk-text-button" onClick={() => resetRule(engine.id)}>
                Reset to Brand Kit default
              </button>
            </div>
            <div className="bk-mode-row" role="group" aria-label={`${engine.label} personalization mode`}>
              {BRAND_PERSONALIZATION_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={`bk-mode-button${rule.mode === mode ? ' bk-mode-button--active' : ''}`}
                  aria-pressed={rule.mode === mode}
                  onClick={() => updateRule(engine.id, {
                    mode,
                    ...(mode === 'custom' && !rule.customPalette ? { customPalette: { ...kit.palette } } : {}),
                  })}
                >{MODE_LABELS[mode]}</button>
              ))}
            </div>
            <p className="bk-mode-description">{MODE_DESCRIPTIONS[rule.mode]}</p>
            <label className="bk-strength-label" htmlFor={`bk-strength-${engine.id}`}>
              Strength <output>{Math.round(rule.strength * 100)}%</output>
            </label>
            <input
              id={`bk-strength-${engine.id}`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rule.strength}
              disabled={rule.mode === 'original'}
              onChange={event => updateRule(engine.id, { strength: Number(event.target.value) })}
            />
            {engine.id === 'laserDmx' && (
              <div className="bk-laser-personalization">
                <label className="bk-inline-toggle">
                  <input
                    type="checkbox"
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
                  <button type="button" className="bk-text-button" onClick={() => {
                    const { customPalette: _removed, ...withoutCustom } = rule
                    onChange({ ...kit.engineRules, [engine.id]: withoutCustom })
                  }}>Remove custom engine palette</button>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

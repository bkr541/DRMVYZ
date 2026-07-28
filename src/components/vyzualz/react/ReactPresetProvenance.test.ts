import { describe, expect, it } from 'vitest'
import { DEFAULT_OSCILLATOR_SETTINGS, type ReactPreset, type ReactPresetControlValues } from './ReactTypes'
import { resolveReactPresetProvenance } from './ReactPresetProvenance'

const preset: ReactPreset = {
  id: 'test-preset',
  name: 'Test Preset',
  description: 'Fixture',
  engine: 'oscilloscope',
  palette: { primary: '#fff', secondary: '#fff', accent: '#fff', background: '#000', highlight: '#fff', text: '#fff' },
  params: { intensity: 0.7, motion: 0.4, glow: 0.6, bassReactivity: 0.8 },
  renderSettings: { trailDecay: 0.2, fogDensity: 0.3, particleDensity: 0.4 },
  oscillatorSettings: { pathScale: 1.25 },
  scenes: [],
  sectionMappings: [],
}
const exactControls: ReactPresetControlValues = {
  ...preset.params,
  trailDecay: 0.2,
  fogDensity: 0.3,
  particleDensity: 0.4,
}

function resolve(controls = exactControls, oscillatorSettings = { ...DEFAULT_OSCILLATOR_SETTINGS, pathScale: 1.25 }) {
  return resolveReactPresetProvenance({
    presets: [preset],
    activePresetId: preset.id,
    activeEngineId: 'oscilloscope',
    controls,
    oscillatorSettings,
  })
}

describe('engine-neutral React preset provenance', () => {
  it('marks every generic master divergence as modified without clearing provenance', () => {
    for (const key of Object.keys(exactControls) as (keyof ReactPresetControlValues)[]) {
      const result = resolve({ ...exactControls, [key]: exactControls[key] + 0.01 })
      expect(result.status, key).toBe('modified')
      expect(result.preset?.id, key).toBe(preset.id)
      expect(result.changedFields, key).toContain(key)
    }
  })

  it('returns to exact when all preset-owned values are restored', () => {
    expect(resolve().status).toBe('exact')
    expect(resolve({ ...exactControls, glow: 0.2 }).status).toBe('modified')
    expect(resolve({ ...exactControls }).status).toBe('exact')
  })

  it('supports engine-specific authored fields and legacy IDs', () => {
    expect(resolve(exactControls, { ...DEFAULT_OSCILLATOR_SETTINGS, pathScale: 1.1 }).changedFields).toContain('oscillatorSettings')
    expect(resolveReactPresetProvenance({
      presets: [preset],
      activePresetId: 'missing-preset',
      activeEngineId: 'oscilloscope',
      controls: exactControls,
    }).status).toBe('unknownLegacy')
  })
})

import { describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, DEFAULT_CANVAS_PRESET_ID } from '../ReactTypes'
import { normalizeCanvasPresetSettings } from '../../../../stores/reactStore'
import { resolveCanvasPresetProvenance } from './CanvasPresetProvenance'

describe('CANVAS preset provenance', () => {
  it('preserves the stable preset ID across manual edits and exact restoration', () => {
    const preset = CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
    const exact = normalizeCanvasPresetSettings(preset.settings)
    const modified = normalizeCanvasPresetSettings({ ...exact, glow: exact.glow + 0.01 })

    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, modified).status).toBe('modified')
    expect(resolveCanvasPresetProvenance(preset, exact).label).toBe(preset.name)
  })

  it('tracks Fractures-owned settings without leaking them into another preset identity', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-fractures']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    const modified = normalizeCanvasPresetSettings({
      ...exact,
      fractureMode: 'angledQuads',
      fractureEffectRoleWeights: {
        ...exact.fractureEffectRoleWeights,
        accent: exact.fractureEffectRoleWeights.accent + 0.1,
      },
    })

    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, modified).status).toBe('modified')
  })

  it('ignores the synchronized legacy alias when canonical values match', () => {
    const preset = CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
    const exact = normalizeCanvasPresetSettings(preset.settings)
    const legacyAliasOnly = { ...exact, sourceVisibility: exact.drySourceMix === 1 ? 0 : 1 }
    expect(resolveCanvasPresetProvenance(preset, legacyAliasOnly).status).toBe('exact')
  })
})

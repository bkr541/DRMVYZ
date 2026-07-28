import {
  DEFAULT_CANVAS_PRESET_SETTINGS,
  type CanvasPresetDefinition,
  type CanvasPresetSettings,
} from '../ReactTypes'
import { resolveEnginePresetProvenance } from '../ReactPresetProvenance'

const CANONICAL_CANVAS_PRESET_FIELDS: ReadonlyArray<keyof CanvasPresetSettings> = [
  'sourceMixMode', 'drySourceMix', 'intensity', 'bassReactivity', 'beatPulse', 'glow', 'trailAmount',
  'rgbSplit', 'glitchAmount', 'stutterRate', 'lumaThreshold', 'motionAmount',
  'turbulence', 'particleDensity', 'particleSize', 'particleColorMode', 'particleQuality',
]

function canonicalValues(value: Partial<CanvasPresetSettings>): Record<string, unknown> {
  const merged = { ...DEFAULT_CANVAS_PRESET_SETTINGS, ...value }
  return Object.fromEntries(CANONICAL_CANVAS_PRESET_FIELDS.map(key => [key, merged[key]]))
}

export function resolveCanvasPresetProvenance(
  preset: CanvasPresetDefinition,
  actual: CanvasPresetSettings,
) {
  return resolveEnginePresetProvenance({
    presetId: preset.id,
    presetName: preset.name,
    expectedValues: canonicalValues(preset.settings),
    actualValues: canonicalValues(actual),
  })
}

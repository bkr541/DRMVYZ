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
  'fractureIntensity', 'fractureMode', 'fractureAnchorMode', 'fractureFocusProtection',
  'fractureFocusX', 'fractureFocusY', 'fractureComposition', 'fracturePlacementMode',
  'fractureTopologyInterval', 'fractureLayoutInterval', 'fractureVariationSeed', 'fractureQuality',
  'fractureMotionAmount', 'fractureTransitionMode', 'fractureTransitionSpeed', 'fractureStaggerAmount',
  'fractureZoomAmount', 'fractureFreezeLayout', 'fractureReturnToAnchor', 'fractureTopologyRevision',
  'fractureLayoutRevision', 'fractureEffectsIntensity', 'fractureGlowAmount', 'fractureOutlineAmount',
  'fractureOutlineThickness', 'fractureRgbSplitAmount', 'fractureLumaMode', 'fractureLumaThreshold',
  'fractureSliceDisplacementAmount', 'fracturePixelationAmount', 'fractureScanlineAmount',
  'fractureNoiseAmount', 'fractureGlitchAmount',
  'fractureTextureAmount', 'fractureTrailsAmount', 'fractureDepthAmount', 'fractureDuplicationAmount',
  'fractureColorTreatmentAmount', 'fractureEffectRoleWeights', 'fractureColorSourceMode',
  'fractureManualPrimaryColor', 'fractureManualSupportingColor', 'fractureAudioResponse',
  'fractureBassMotion', 'fractureTransientGlitch', 'fractureStructuralResponse',
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

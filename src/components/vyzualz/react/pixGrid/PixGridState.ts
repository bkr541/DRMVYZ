import { createDefaultPixGridState } from './PixGridDefaults'
import type { PixGridPresetSettings, PixGridState } from './PixGridTypes'
import { normalizePixGridState } from './PixGridValidation'

export function applyPixGridPresetSettings(
  currentState: PixGridState,
  presetId: string,
  settings: PixGridPresetSettings | undefined,
): PixGridState {
  const safeCurrent = normalizePixGridState(currentState)
  if (!settings) {
    return normalizePixGridState({
      ...safeCurrent,
      selectedPresetId: presetId,
    })
  }
  return normalizePixGridState({
    ...safeCurrent,
    quality: settings.quality ?? safeCurrent.quality,
    backgroundMode: settings.backgroundMode ?? safeCurrent.backgroundMode,
    backgroundColor: settings.backgroundColor ?? safeCurrent.backgroundColor,
    cellGap: settings.cellGap ?? safeCurrent.cellGap,
    cellRoundness: settings.cellRoundness ?? safeCurrent.cellRoundness,
    cellBrightness: settings.cellBrightness ?? safeCurrent.cellBrightness,
    globalIntensity: settings.globalIntensity ?? safeCurrent.globalIntensity,
    glowAmount: settings.glowAmount ?? safeCurrent.glowAmount,
    selectedPresetId: presetId,
    selectedSceneId: settings.selectedSceneId ?? safeCurrent.selectedSceneId,
  })
}

export function resetPixGridStatePreservingSelection(currentState: PixGridState): PixGridState {
  const defaults = createDefaultPixGridState()
  return normalizePixGridState({
    ...defaults,
    selectedPresetId: currentState.selectedPresetId ?? defaults.selectedPresetId,
    selectedSceneId: currentState.selectedSceneId ?? defaults.selectedSceneId,
  })
}

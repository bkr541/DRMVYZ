import { createDefaultPixGridState } from './PixGridDefaults'
import type { PixGridPresetSettings, PixGridState } from './PixGridTypes'
import { clonePixGridLayer } from './PixGridDefaults'
import { normalizePixGridState } from './PixGridValidation'

function pixGridSceneNameFromId(id: string, index: number): string {
  const parts = id.split('-')
  const suffix = parts[parts.length - 1]
  return suffix ? suffix.replace(/^./, value => value.toUpperCase()) : `Scene ${index + 1}`
}

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
  const presetLayers = settings.layers?.map(clonePixGridLayer) ?? safeCurrent.layers
  const sceneIds = Object.keys(settings.sceneSettings ?? {})
  const selectedSceneId = settings.selectedSceneId ?? sceneIds[0] ?? safeCurrent.selectedSceneId ?? 'pix-grid-scene-1'
  const scenes = (sceneIds.length > 0 ? sceneIds : [selectedSceneId]).map((id, index) => ({
    id,
    name: pixGridSceneNameFromId(id, index),
    layerIds: presetLayers.map(layer => layer.id),
    pixelOverrides: [],
  }))
  return normalizePixGridState({
    ...safeCurrent,
    quality: settings.quality ?? safeCurrent.quality,
    backgroundMode: settings.backgroundMode ?? safeCurrent.backgroundMode,
    backgroundColor: settings.backgroundColor ?? safeCurrent.backgroundColor,
    backgroundBrightness: settings.backgroundBrightness ?? safeCurrent.backgroundBrightness,
    cellGap: settings.cellGap ?? safeCurrent.cellGap,
    cellRoundness: settings.cellRoundness ?? safeCurrent.cellRoundness,
    cellBrightness: settings.cellBrightness ?? safeCurrent.cellBrightness,
    globalIntensity: settings.globalIntensity ?? safeCurrent.globalIntensity,
    glowAmount: settings.glowAmount ?? safeCurrent.glowAmount,
    diffusion: settings.diffusion ?? safeCurrent.diffusion,
    rgbSubpixelMode: settings.rgbSubpixelMode ?? safeCurrent.rgbSubpixelMode,
    selectedPresetId: presetId,
    selectedSceneId,
    layers: presetLayers,
    scenes,
    pixelOverrides: [],
    editor: { ...safeCurrent.editor, selectedLayerId: presetLayers[0]?.id ?? null, selection: null },
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

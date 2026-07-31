import { clonePixGridLayer, createDefaultPixGridState } from './PixGridDefaults'
import {
  PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
  PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
  PIX_GRID_CONFIGURATION_METADATA_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
  PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
  type PixGridPresetSettings,
  type PixGridState,
} from './PixGridTypes'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'
import { normalizePixGridState } from './PixGridValidation'
import { createPixGridCanonicalSignatures } from './PixGridConfiguration'

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
  const presetGroups = settings.groups?.map(group => ({ ...group, cellRuns: [...group.cellRuns], layerScope: group.layerScope ? [...group.layerScope] : null, reactions: group.reactions.map(reaction => ({ ...reaction, clamp: [...reaction.clamp] as [number, number] })), mask: group.mask.kind === 'runs' ? { kind: 'runs' as const, runs: [...group.mask.runs] } : { ...group.mask } })) ?? safeCurrent.groups
  const presetAssignments = settings.audioAssignments?.map(reaction => ({
    ...reaction,
    clamp: [...reaction.clamp] as [number, number],
    ...(reaction.inputRange ? { inputRange: [...reaction.inputRange] as [number, number] } : {}),
    ...(reaction.outputRange ? { outputRange: [...reaction.outputRange] as [number, number] } : {}),
    ...(reaction.conditions ? { conditions: { ...reaction.conditions } } : {}),
  })) ?? []
  const sceneIds = Object.keys(settings.sceneSettings ?? {})
  const selectedSceneId = settings.selectedSceneId ?? sceneIds[0] ?? safeCurrent.selectedSceneId ?? 'pix-grid-scene-1'
  const explicitlyClearsPerformanceProgram = settings.performanceProgramId === null
  const scenes = (sceneIds.length > 0 ? sceneIds : [selectedSceneId]).map((id, index) => ({
    id,
    name: pixGridSceneNameFromId(id, index),
    layerIds: presetLayers.map(layer => layer.id),
    pixelOverrides: [],
  }))
  return normalizePixGridState({
    ...safeCurrent,
    quality: settings.quality ?? safeCurrent.quality,
    qualityMode: settings.qualityMode ?? safeCurrent.qualityMode,
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
    configuration: {
      metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
      origin: 'builtInPreset',
      sourcePresetId: presetId,
      presetConfigurationVersion: settings.authoredConfigurationVersion ?? 1,
      layerGraphVersion: PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
      smartGroupConfigurationVersion: PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
      audioRouteConfigurationVersion: PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
      performanceProgramConfigurationVersion: PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
      musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
      userCustomized: false,
      legacyOfficialLayerGraph: false,
      genuineUserLayers: false,
      canonicalMigrationCompleted: true,
      canonicalSignatures: createPixGridCanonicalSignatures(settings),
      lastMigration: null,
    },
    selectedSceneId,
    layers: presetLayers,
    groups: presetGroups,
    audioAssignments: presetAssignments,
    performance: {
      ...safeCurrent.performance,
      enabled: settings.performanceEnabled ?? (settings.performanceProgramId ? true : safeCurrent.performance.enabled),
      sharedPerformanceProgramId: explicitlyClearsPerformanceProgram
        ? null
        : settings.performanceEnabled === false && !settings.performanceProgramId
        ? null
        : settings.performanceProgramId ?? safeCurrent.performance.sharedPerformanceProgramId,
      programOverrides: { routes: {}, sections: {} },
      lockedRoutes: [],
    },
    scenes,
    pixelOverrides: [],
    editor: { ...safeCurrent.editor, scenePreviewMode: 'followTrack', selectedLayerId: presetLayers[0]?.id ?? null, selection: null },
  })
}

export function resetPixGridStatePreservingSelection(currentState: PixGridState): PixGridState {
  const defaults = createDefaultPixGridState()
  const selectedPresetId = currentState.selectedPresetId ?? defaults.selectedPresetId
  const presetSettings = selectedPresetId ? PIX_GRID_PRESET_BY_ID.get(selectedPresetId)?.pixGridSettings : undefined
  const reset = applyPixGridPresetSettings(defaults, selectedPresetId ?? defaults.selectedPresetId ?? 'pix-grid-bass-beacon', presetSettings)
  return currentState.selectedSceneId && reset.scenes.some(scene => scene.id === currentState.selectedSceneId)
    ? normalizePixGridState({ ...reset, selectedSceneId: currentState.selectedSceneId })
    : reset
}

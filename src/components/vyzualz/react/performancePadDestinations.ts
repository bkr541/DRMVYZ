import type { ReactEngineDestination } from './ReactTypes'
import { CANVAS_PRESET_BY_ID, isCanvasLegacyEffectPresetId } from './ReactTypes'
import { isHeadlinerPresetId } from './headliner/HeadlinerEffectCatalog'
import { getXyScopePreset, applyXyScopePreset } from './xyScope/XyScopeSettings'
import { getLaserDmxBeamMatrixPreset } from './laserDmxBeamMatrixPresets'
import { getLaserDmxShowDirectorPerformancePreset } from './LaserDmxShowDirectorPerformancePresets'
import { getLaserDmxShowDirectorTemplate } from './laserDmxShowDirectorTemplates'
import type { ReactStoreState } from '../../../stores/reactStore'

/** Native presets that do not live in the legacy reactPresets array. */
export function isNativePadDestination(destination: ReactEngineDestination): boolean {
  const { engineId, presetId } = destination
  if (destination.schemaVersion !== 1) return false
  if (engineId === 'canvas') return Object.hasOwn(CANVAS_PRESET_BY_ID, presetId) && !isCanvasLegacyEffectPresetId(presetId as keyof typeof CANVAS_PRESET_BY_ID)
  if (engineId === 'headliner') return isHeadlinerPresetId(presetId)
  if (engineId === 'xyScope') return Boolean(getXyScopePreset(presetId))
  if (engineId === 'laserDmx') return Boolean(getLaserDmxBeamMatrixPreset(presetId) || getLaserDmxShowDirectorPerformancePreset(presetId) || getLaserDmxShowDirectorTemplate(presetId))
  return false
}

export function activateNativePadDestination(state: ReactStoreState, destination: ReactEngineDestination): void {
  if (!isNativePadDestination(destination)) return
  const { engineId, presetId } = destination
  state.selectReactEngine(engineId)
  if (engineId === 'canvas') state.selectCanvasPreset(presetId as Parameters<typeof state.selectCanvasPreset>[0])
  if (engineId === 'headliner' && isHeadlinerPresetId(presetId)) state.setHeadlinerSettings({ presetId })
  if (engineId === 'xyScope') state.setXyScopeSettings(applyXyScopePreset(state.xyScopeSettings, presetId))
  if (engineId === 'laserDmx') {
    const performance = getLaserDmxShowDirectorPerformancePreset(presetId)
    if (performance) state.applyLaserDmxShowDirectorPerformancePreset(performance)
    else if (getLaserDmxBeamMatrixPreset(presetId)) state.applyLaserDmxBeamMatrixPreset(presetId)
    else state.applyLaserDmxShowDirectorTemplate(presetId)
  }
}

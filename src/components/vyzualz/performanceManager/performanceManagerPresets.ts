import type { ReactPerformancePad, ReactPreset } from '../react/ReactTypes'
import { REACT_ENGINE_IDS, type ReactLiveEngineId } from '../react/reactEngineCatalog'
import { PRESET_MANAGER_PRESETS } from '../presetManager/presetManagerCatalog'
import { XY_SCOPE_PRESETS } from '../react/xyScope/XyScopeSettings'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import { filterReactPresetLibrary } from '../react/reactPresetLibraryState'
import { useReactStore } from '../../../stores/reactStore'

const ARTWORK_ENGINE = { cinema2: 'cinema2', soundDrawing: 'oscilloscope', canvas: 'canvas', laserDmx: 'laserDmx', pixGrid: 'pixGrid', headliner: 'headliner' } as const
export type PerformancePreset = { id: string; name: string; description: string; tags: readonly string[]; engineId: ReactLiveEngineId }

export function getPerformanceManagerPresets(engineId: ReactLiveEngineId, livePresets: ReactPreset[], laserMode?: string): PerformancePreset[] {
  const entries = (() => {
    if (engineId === 'cinema2') return cinema2NativePresetRegistry.list().filter(p => !p.metadata.tags?.includes('internal')).map(p => ({ id: p.id, name: p.metadata.name, description: p.metadata.description ?? p.metadata.name, tags: p.metadata.tags ?? [] }))
    if (engineId === 'xyScope') return XY_SCOPE_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description, tags: [] as readonly string[] }))
    if (engineId === 'oscilloscope' || engineId === 'pixGrid') return filterReactPresetLibrary(livePresets, engineId, 'current', new Set()).map(p => ({ id: p.id, name: p.name, description: p.description, tags: p.tags ?? [] }))
    return PRESET_MANAGER_PRESETS.filter(p => ARTWORK_ENGINE[p.artwork] === engineId && (engineId !== 'laserDmx' || !laserMode || (laserMode === 'showDirector' ? p.activation !== 'laserDmxBeamMatrix' : p.activation === 'laserDmxBeamMatrix'))).map(p => ({ id: p.sourceId, name: p.name, description: p.description, tags: p.tags }))
  })()
  return entries.map(p => ({ ...p, engineId }))
}

export function getAllPerformancePresets(livePresets: ReactPreset[]): PerformancePreset[] {
  return [...new Map(REACT_ENGINE_IDS.flatMap(engine => getPerformanceManagerPresets(engine, livePresets)).map(p => [`${p.engineId}:${p.id}`, p])).values()]
}

export function isPadPreset(pad: ReactPerformancePad, preset: Pick<PerformancePreset, 'id' | 'engineId'>): boolean {
  if (pad.destination) return pad.destination.engineId === preset.engineId && pad.destination.presetId === preset.id
  const live = useReactStore.getState().reactPresets.find(p => p.id === pad.presetId)
  return pad.presetId === preset.id && live?.engine === preset.engineId
}

/** Uses the store's existing validation and persistence without performing the pad. */
export function assignPerformancePreset(padId: string, preset: Pick<PerformancePreset, 'id' | 'name' | 'engineId'>): boolean {
  const state = useReactStore.getState()
  if (!state.performancePads.some(p => p.id === padId)) return false
  const live = state.reactPresets.some(p => p.id === preset.id && p.engine === preset.engineId)
  state.updatePerformancePad(padId, { label: preset.name, assignmentOverridesAction: true,
    ...(live ? { presetId: preset.id, destination: null } : { presetId: null, destination: { schemaVersion: 1, engineId: preset.engineId, presetId: preset.id } }) })
  const saved = useReactStore.getState().performancePads.find(p => p.id === padId)
  return Boolean(saved && isPadPreset(saved, preset))
}

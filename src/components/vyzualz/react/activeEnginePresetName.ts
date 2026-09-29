import { useShallow } from 'zustand/react/shallow'
import { useCinemaStore } from '../cinema'
import { cinema2NativePresetRegistry, type Cinema2PresetId } from '../cinema2'
import { useReactStore } from '../../../stores/reactStore'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from './laserDmxBeamMatrixPresets'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from './laserDmxShowDirectorTemplates'
import { CANVAS_PRESET_BY_ID, type CanvasPresetId } from './ReactTypes'
import type { LaserDmxBeamMatrixAuthoringMode, ReactEngineId } from './ReactTypes'

/**
 * The name of the preset currently selected in an engine's PRESETS tab, shown under the engine name in the Engine dropdown. Null when the
 * engine has nothing selected, or has no presets to select (Headliner's preset library is not built yet).
 *
 * Where each engine keeps its selection (the same value its PRESETS tab highlights):
 * - Cinema 2.0: the workspace's preset id (a local state of ReactView), named by the native preset registry.
 * - CANVAS: `selectedCanvasPresetId`.
 * - Cinema: the active composition.
 * - Sound Drawing and PixGrid: `activeReactPresetId`, if that preset belongs to the engine.
 * - LaserDMX: in Beam Matrix (manual) mode the active Beam Matrix preset; in Show Director mode the active Performance Show if one is applied, otherwise
 *   the Rig Layout it was built from.
 */
export interface ActiveEnginePresetInput {
  engineId: ReactEngineId
  cinema2PresetId: Cinema2PresetId | null
  selectedCanvasPresetId: CanvasPresetId | null
  activeCinemaCompositionName: string | null
  activeReactPresetId: string | null
  reactPresets: readonly { id: string; engine: string; name: string }[]
  laserDmxMode: LaserDmxBeamMatrixAuthoringMode
  activeLaserDmxBeamMatrixPresetId: string | null
  laserDmxPerformancePresetId: string | null
  laserDmxRigTemplateId: string | null
}

export function resolveActiveEnginePresetName(input: Readonly<ActiveEnginePresetInput>): string | null {
  switch (input.engineId) {
    case 'cinema2':
      return input.cinema2PresetId ? cinema2NativePresetRegistry.get(input.cinema2PresetId)?.metadata.name ?? null : null
    case 'canvas':
      return input.selectedCanvasPresetId ? CANVAS_PRESET_BY_ID[input.selectedCanvasPresetId]?.name ?? null : null
    case 'cinema':
      return input.activeCinemaCompositionName
    case 'oscilloscope':
    case 'pixGrid': {
      const active = input.activeReactPresetId
        ? input.reactPresets.find(preset => preset.id === input.activeReactPresetId && preset.engine === input.engineId)
        : null
      return active?.name ?? null
    }
    case 'laserDmx': {
      if (input.laserDmxMode !== 'showDirector') {
        return LASER_DMX_BEAM_MATRIX_PRESETS.find(preset => preset.id === input.activeLaserDmxBeamMatrixPresetId)?.name ?? null
      }
      return LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(preset => preset.id === input.laserDmxPerformancePresetId)?.name
        ?? LASER_DMX_SHOW_DIRECTOR_TEMPLATES.find(template => template.id === input.laserDmxRigTemplateId)?.name
        ?? null
    }
    default:
      return null // Headliner (no presets yet) and the legacy engine ids
  }
}

/** Subscribes to every store the lookup reads, so the Engine dropdown follows the selection live. */
export function useActiveEnginePresetName(engineId: ReactEngineId, cinema2PresetId: Cinema2PresetId | null): string | null {
  const react = useReactStore(useShallow(state => ({
    selectedCanvasPresetId: state.selectedCanvasPresetId,
    activeReactPresetId: state.activeReactPresetId,
    reactPresets: state.reactPresets,
    laserDmxMode: state.laserDmxBeamMatrixAuthoringMode,
    activeLaserDmxBeamMatrixPresetId: typeof state.activeLaserDmxBeamMatrixPresetId === 'string' ? state.activeLaserDmxBeamMatrixPresetId : null,
    laserDmxPerformancePresetId: state.laserDmxShowDirectorPerformance?.activePresetId ?? null,
    laserDmxRigTemplateId: state.laserDmxShowDirector?.sourceTemplateId ?? null,
  })))
  const activeCinemaCompositionName = useCinemaStore(state => state.compositions.find(candidate => candidate.id === state.activeCompositionId)?.metadata.name ?? null)
  return resolveActiveEnginePresetName({ engineId, cinema2PresetId, activeCinemaCompositionName, ...react })
}

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
} from '../ReactTypes'
import {
  REACT_ENGINE_CATALOG,
  REACT_ENGINE_IDS,
  REACT_KNOWN_ENGINE_IDS,
  isSelectableReactEngineId,
} from '../reactEngineCatalog'
import { migrateLegacyPerformancePadsToCinema } from '../../cinema/CinemaLegacyRetirement'
import { CINEMA_LEGACY_PRESET_CATALOG } from '../../cinema/CinemaFoundation'
import { sanitizeReactPresetFavorites, writeReactPresetFavorites } from '../reactPresetLibraryState'
import {
  REACT_VISUAL_PERFORMANCE_ACTIONS,
  validateReactPerformanceActionRegistry,
} from '../ReactPerformanceActions'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('React engine final integrity audit', () => {
  it('keeps the live engine catalog exact and fully described', () => {
    expect(Object.keys(REACT_ENGINE_CATALOG).sort()).toEqual([...REACT_KNOWN_ENGINE_IDS].sort())
    expect(REACT_ENGINE_IDS.every(isSelectableReactEngineId)).toBe(true)
    expect(isSelectableReactEngineId('shaderPads')).toBe(false)
    expect(isSelectableReactEngineId('cinematicPortal')).toBe(false)
    for (const engineId of REACT_KNOWN_ENGINE_IDS) {
      const entry = REACT_ENGINE_CATALOG[engineId]
      expect(entry.id).toBe(engineId)
      expect(entry.label.trim()).not.toBe('')
      expect(entry.shortLabel.trim()).not.toBe('')
      expect(entry.description.trim()).not.toBe('')
    }
  })

  it('keeps every built-in preset on a current engine with valid scene mappings', () => {
    const engineIds = new Set(REACT_KNOWN_ENGINE_IDS)
    const presetIds = new Set<string>()

    for (const preset of DEFAULT_REACT_PRESETS) {
      expect(presetIds.has(preset.id), `duplicate built-in preset id: ${preset.id}`).toBe(false)
      presetIds.add(preset.id)
      expect(engineIds.has(preset.engine), `preset ${preset.id} has invalid engine ${preset.engine}`).toBe(true)

      const sceneIds = new Set(preset.scenes.map(scene => scene.id))
      for (const scene of preset.scenes) {
        expect(engineIds.has(scene.engineId), `preset ${preset.id} scene ${scene.id} has invalid engine ${scene.engineId}`).toBe(true)
      }
      for (const mapping of preset.sectionMappings) {
        expect(sceneIds.has(mapping.sceneId), `preset ${preset.id} maps to missing scene ${mapping.sceneId}`).toBe(true)
      }
    }
  })

  it('keeps migrated default pads and compatibility performance actions pointed at valid targets', () => {
    const engineIds = new Set(REACT_KNOWN_ENGINE_IDS)
    const presetIds = new Set(DEFAULT_REACT_PRESETS.map(preset => preset.id))
    const cinemaIds = new Set<string>(CINEMA_LEGACY_PRESET_CATALOG.compositions.map(composition => composition.id))
    const actionIds = new Set<string>()

    for (const pad of migrateLegacyPerformancePadsToCinema(DEFAULT_PERFORMANCE_PADS)) {
      if (pad.presetId != null) {
        expect(presetIds.has(pad.presetId), `pad ${pad.id} references missing preset ${pad.presetId}`).toBe(true)
        expect(DEFAULT_REACT_PRESETS.find(preset => preset.id === pad.presetId)?.engine).not.toBe('cinematicPortal')
      }
      if (pad.cinemaCompositionId != null) {
        expect(cinemaIds.has(pad.cinemaCompositionId), `pad ${pad.id} references missing Cinema composition`).toBe(true)
      }
    }

    expect(validateReactPerformanceActionRegistry()).toEqual([])
    for (const action of REACT_VISUAL_PERFORMANCE_ACTIONS) {
      expect(actionIds.has(action.id), `duplicate performance action id: ${action.id}`).toBe(false)
      actionIds.add(action.id)
      expect(engineIds.has(action.target.engineId), `action ${action.id} targets invalid engine ${action.target.engineId}`).toBe(true)
    }
  })

  it('filters persisted favorites to current preset IDs without changing their order', () => {
    const storage = memoryStorage()
    const valid = DEFAULT_REACT_PRESETS.map(preset => preset.id)
    writeReactPresetFavorites(['missing-a', valid[2], valid[0], valid[2], 'missing-b'], storage)
    expect(sanitizeReactPresetFavorites(valid, storage)).toEqual([valid[2], valid[0]])
  })
})

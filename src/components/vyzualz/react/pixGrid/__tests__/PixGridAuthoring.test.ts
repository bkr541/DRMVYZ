import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  addPixGridBuiltInLayer,
  addPixGridScene,
  applyPixGridOverride,
  createPixGridSelection,
  deletePixGridScene,
  fillPixGridRegion,
  getPixGridActiveScene,
  movePixGridSelection,
  pixGridViewPointToCell,
  reorderPixGridLayer,
  resolvePixGridOutputRect,
  selectPixGridScene,
} from '../PixGridAuthoring'
import { normalizePixGridState } from '../PixGridValidation'

describe('PixGrid authoring model', () => {
  it('maps logical coordinates consistently across viewport sizes, pan, and zoom', () => {
    const base = { matrixWidth: 160, matrixHeight: 90, zoom: 1, panX: 0, panY: 0 }
    expect(resolvePixGridOutputRect({ ...base, viewportWidth: 800, viewportHeight: 800 })).toEqual({
      left: 0, top: 175, width: 800, height: 450,
    })
    expect(pixGridViewPointToCell(400, 400, { ...base, viewportWidth: 800, viewportHeight: 800 })).toEqual({ x: 80, y: 45 })

    const zoomed = { ...base, viewportWidth: 640, viewportHeight: 360, zoom: 2, panX: 0.1, panY: -0.1 }
    const rect = resolvePixGridOutputRect(zoomed)
    expect(rect).toEqual({ left: -192, top: -252, width: 1280, height: 720 })
    expect(pixGridViewPointToCell(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5, zoomed)).toEqual({ x: 80, y: 45 })
  })

  it('paints, turns off, and restores inherited cells with compact sparse tuples', () => {
    let state = createDefaultPixGridState()
    state = applyPixGridOverride(state, 4, 5, { kind: 'paint', color: '#12abef', opacity: 0.6 })
    expect(state.pixelOverrides).toEqual([[4, 5, 1, '#12abef', 0.6]])
    state = applyPixGridOverride(state, 4, 5, { kind: 'off' })
    expect(state.pixelOverrides).toEqual([[4, 5, 0, '#000000', 1]])
    state = applyPixGridOverride(state, 4, 5, { kind: 'restore' })
    expect(state.pixelOverrides).toEqual([])
    expect(Array.isArray(state.pixelOverrides[0])).toBe(false)
  })

  it('normalizes duplicate and legacy sparse entries without materializing the grid', () => {
    const { scenes: _legacyScenes, ...legacyState } = createDefaultPixGridState()
    void _legacyScenes
    const state = normalizePixGridState({
      ...legacyState,
      version: 4,
      pixelOverrides: [
        [2, 3, '#ffffff', 1],
        [2, 3, 0, '#000000', 1],
        [159, 89, 1, '#abcdef', 0.25],
      ],
    })
    expect(state.pixelOverrides).toEqual([
      [2, 3, 0, '#000000', 1],
      [159, 89, 1, '#abcdef', 0.25],
    ])
    expect(state.pixelOverrides.length).toBeLessThan(state.matrixWidth * state.matrixHeight)
  })

  it('bounds flood fill to the connected override signature', () => {
    let state = normalizePixGridState({ ...createDefaultPixGridState(), quality: 'draft' })
    for (let y = 0; y < state.matrixHeight; y += 1) {
      state = applyPixGridOverride(state, 2, y, { kind: 'off' })
    }
    state = fillPixGridRegion(state, { x: 0, y: 0 }, { kind: 'paint', color: '#ff00ff', opacity: 1 })
    const painted = state.pixelOverrides.filter(tuple => tuple[2] === 1)
    expect(painted).toHaveLength(2 * state.matrixHeight)
    expect(painted.every(tuple => tuple[0] < 2)).toBe(true)
  })

  it('creates marquee selections and moves only selected overrides within bounds', () => {
    let state = createDefaultPixGridState()
    state = applyPixGridOverride(state, 2, 2, { kind: 'paint', color: '#ffffff', opacity: 1 })
    state = applyPixGridOverride(state, 8, 8, { kind: 'paint', color: '#00ffff', opacity: 1 })
    const selection = createPixGridSelection({ x: 1, y: 1 }, { x: 3, y: 3 })
    expect(selection).toEqual({ x: 1, y: 1, width: 3, height: 3 })
    state = movePixGridSelection(state, selection, 2, 1)
    expect(state.pixelOverrides).toEqual([
      [4, 3, 1, '#ffffff', 1],
      [8, 8, 1, '#00ffff', 1],
    ])
    expect(state.editor.selection).toEqual({ x: 3, y: 2, width: 3, height: 3 })

    state = movePixGridSelection(state, state.editor.selection!, 999, 999)
    expect(state.pixelOverrides).toContainEqual([state.matrixWidth - 2, state.matrixHeight - 2, 1, '#ffffff', 1])
    expect(state.editor.selection).toEqual({
      x: state.matrixWidth - 3,
      y: state.matrixHeight - 3,
      width: 3,
      height: 3,
    })
  })

  it('reorders layers and safely falls back after deleting the active scene', () => {
    let state = createDefaultPixGridState()
    const firstScene = state.scenes[0]
    state = normalizePixGridState({
      ...state,
      scenes: [firstScene],
      selectedSceneId: firstScene.id,
      pixelOverrides: firstScene.pixelOverrides,
    })
    state = addPixGridBuiltInLayer(state, 'pix-five-point-star')
    const scene = getPixGridActiveScene(state)
    const addedLayerId = scene.layerIds[scene.layerIds.length - 1]!
    state = reorderPixGridLayer(state, addedLayerId, -1)
    const reorderedIds = getPixGridActiveScene(state).layerIds
    expect(reorderedIds[reorderedIds.length - 2]).toBe(addedLayerId)

    const originalSceneId = state.selectedSceneId!
    state = addPixGridScene(state, 'Second')
    const secondSceneId = state.selectedSceneId!
    state = selectPixGridScene(state, originalSceneId)
    state = deletePixGridScene(state, originalSceneId)
    expect(state.scenes).toHaveLength(1)
    expect(state.selectedSceneId).toBe(secondSceneId)
  })

  it('preserves Scene Pixels as the edit target when switching scenes', () => {
    let state = createDefaultPixGridState()
    const originalSceneId = state.selectedSceneId!
    state = addPixGridScene(state, 'Alternate')
    const alternateSceneId = state.selectedSceneId!
    state = {
      ...state,
      selectedSceneId: originalSceneId,
      editor: { ...state.editor, selectedLayerId: null },
    }

    state = selectPixGridScene(state, alternateSceneId)

    expect(state.selectedSceneId).toBe(alternateSceneId)
    expect(state.editor.selectedLayerId).toBeNull()
  })

  it('round-trips scenes, layers, and compact edits through persistence normalization', () => {
    let state = createDefaultPixGridState()
    state = applyPixGridOverride(state, 9, 7, { kind: 'paint', color: '#12abef', opacity: 0.75 })
    state = addPixGridScene(state, 'Alternate')
    const roundTrip = normalizePixGridState(JSON.parse(JSON.stringify(state)))
    expect(roundTrip).toEqual(state)
  })
})

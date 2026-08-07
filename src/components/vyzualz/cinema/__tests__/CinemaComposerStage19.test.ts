import { describe, expect, it } from 'vitest'
import {
  CINEMA_MODULATION_SOURCE_IDS,
  CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  addCinemaComposerCameraShot,
  addCinemaComposerPerformanceAction,
  applyCinemaComposerPerformancePreview,
  buildCinemaComposerDestinations,
  buildCinemaComposerTimelineModel,
  cinemaStableId,
  createCinemaComposerCamera,
  createCinemaComposerComposition,
  createCinemaComposerModulationRoute,
  createCinemaComposerPerformanceRule,
  getCinemaComposerCameraAssignedNodeIds,
  removeCinemaComposerCamera,
  setCinemaComposerCameraNodeAssignment,
  snapshotCinemaPersistedState,
  updateCinemaComposerModulationRoute,
  updateCinemaComposerPerformanceRule,
  type CinemaCompositionId,
  type CinemaModulationRouteId,
  type CinemaPerformanceRuleId,
} from '..'
import { createCinemaFoundationPersistedState } from '../CinemaFoundation'
import { createCinemaStore } from '../CinemaStore'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'

const definitions = CINEMA_PRODUCTION_PERSISTED_DEFINITIONS

function composer() {
  return createCinemaComposerComposition({
    id: cinemaStableId<CinemaCompositionId>('stage19-composer', 'composition'),
    name: 'Stage 19 Composer',
  })
}

describe('Cinema Composer Stage 19 authoring', () => {
  it('builds modulation destinations from canonical parameter schemas and persists musical units through undo/redo', () => {
    const initial = composer()
    const destinations = buildCinemaComposerDestinations(initial, definitions)
    const opacity = destinations.find(destination => destination.modulatable && destination.path.includes('.opacity'))
    expect(opacity).toBeTruthy()

    const added = createCinemaComposerModulationRoute(initial, {
      sourceId: CINEMA_MODULATION_SOURCE_IDS.impulseSnare,
      destination: opacity!.path,
    }).composition
    const routeId = added.modulationRoutes[0].id
    const authored = updateCinemaComposerModulationRoute(added, routeId, {
      quantization: '8-bars',
      attackMs: 25,
      releaseMs: 120,
      condition: { vocalsActive: true, buildActive: true },
    }).composition

    expect(authored.modulationRoutes[0]).toMatchObject({
      sourceId: CINEMA_MODULATION_SOURCE_IDS.impulseSnare,
      quantization: '8-bars',
      attackMs: 25,
      releaseMs: 120,
    })

    const store = createCinemaStore({ initialState: createCinemaFoundationPersistedState() })
    expect(store.getState().upsertCinemaComposition(initial).ok).toBe(true)
    expect(store.getState().editCinemaComposition(initial.id, 'Author 8-bar modulation', () => ({ composition: authored })).ok).toBe(true)
    expect(store.getState().compositions.find(candidate => candidate.id === initial.id)?.modulationRoutes[0].quantization).toBe('8-bars')
    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(store.getState().compositions.find(candidate => candidate.id === initial.id)?.modulationRoutes).toHaveLength(0)
    expect(store.getState().redoCinemaEdit().ok).toBe(true)
    expect(store.getState().compositions.find(candidate => candidate.id === initial.id)?.modulationRoutes[0].quantization).toBe('8-bars')
  })

  it('authors manual performance rules and keeps Composer preview commands outside persisted state and history', () => {
    const initial = composer()
    const destination = buildCinemaComposerDestinations(initial, definitions).find(candidate => candidate.modulatable)!.path
    const withRule = createCinemaComposerPerformanceRule(initial, destination).composition
    const rule = withRule.performanceRules[0]
    const manualActionId = rule.condition.manualActionIds?.[0]
    expect(rule.condition.event).toBe('manual')
    expect(manualActionId).toBeTruthy()

    const store = createCinemaStore({ initialState: createCinemaFoundationPersistedState() })
    expect(store.getState().upsertCinemaComposition(withRule).ok).toBe(true)
    expect(store.getState().setActiveCinemaComposition(withRule.id).ok).toBe(true)
    const historyBeforePreview = store.getState().undoStack.length
    store.getState().triggerCinemaComposerManualAction(withRule.id, manualActionId!)
    store.getState().setCinemaComposerModulationPreview(withRule.id, cinemaStableId<CinemaModulationRouteId>('preview-route', 'modulation route'))

    expect(store.getState().composerRuntimePreview).toMatchObject({
      compositionId: String(withRule.id),
      manualActionId,
      manualActionSequence: 1,
    })
    expect(store.getState().undoStack).toHaveLength(historyBeforePreview)
    expect(snapshotCinemaPersistedState(store.getState())).not.toHaveProperty('composerRuntimePreview')
    expect(store.getState().exportCinemaPackage()).not.toHaveProperty('composerRuntimePreview')

    const frame = buildCinemaWorkspaceFrameBridge({
      width: 1,
      height: 1,
      dpr: 1,
      audioTimeSec: 1,
      durationSec: 10,
      trackId: 'preview-track',
      playing: true,
      paused: false,
      bpm: 120,
    }).frame
    const previewed = applyCinemaComposerPerformancePreview(frame, store.getState().composerRuntimePreview, String(withRule.id))
    expect(previewed.performance.events).toContainEqual({ actionId: manualActionId, sequence: 1 })
    expect(applyCinemaComposerPerformancePreview(frame, store.getState().composerRuntimePreview, String(withRule.id), 1)).toBe(frame)
    expect(frame.performance.events ?? []).toHaveLength(0)
    expect(store.getState().setActiveCinemaComposition(null).ok).toBe(true)
    expect(store.getState().composerRuntimePreview).toEqual(expect.objectContaining({ compositionId: null, modulationRouteId: null, manualActionId: null }))
  })

  it('authors camera safe resources, explicit node assignment, Auto Director shots, and repairs camera actions on deletion', () => {
    let composition = createCinemaComposerCamera(composer()).composition
    const camera = composition.cameras[0]
    const nodeId = composition.nodes[0].id
    composition = setCinemaComposerCameraNodeAssignment(composition, camera.id, nodeId, true, [nodeId]).composition
    composition = addCinemaComposerCameraShot(composition, camera.id).composition
    const destination = buildCinemaComposerDestinations(composition, definitions).find(candidate => candidate.modulatable)!.path
    composition = createCinemaComposerPerformanceRule(composition, destination).composition
    const ruleId = composition.performanceRules[0].id
    composition = addCinemaComposerPerformanceAction(composition, ruleId, 'select-camera').composition

    expect(getCinemaComposerCameraAssignedNodeIds(composition.cameras[0])).toEqual([nodeId])
    expect(composition.cameras[0].safeRange).toMatchObject({ minFovDegrees: 10, maxFovDegrees: 140 })
    expect(composition.cameras[0].authoredShots).toHaveLength(1)
    expect(composition.performanceRules[0].actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'select-camera', cameraId: camera.id }),
    ]))

    const removed = removeCinemaComposerCamera(composition, camera.id).composition
    expect(removed.cameras).toHaveLength(0)
    expect(removed.performanceRules[0].actions.some(action => action.type === 'select-camera')).toBe(false)
  })

  it('aligns track sections, lyrics, beats, 8-bar modulation markers, performance cues, and playhead to one canonical time axis', () => {
    let composition = composer()
    const destination = buildCinemaComposerDestinations(composition, definitions).find(candidate => candidate.modulatable)!.path
    composition = createCinemaComposerModulationRoute(composition, { destination }).composition
    const routeId = composition.modulationRoutes[0].id as CinemaModulationRouteId
    composition = updateCinemaComposerModulationRoute(composition, routeId, { quantization: '8-bars' }).composition
    composition = createCinemaComposerPerformanceRule(composition, destination).composition
    const ruleId = composition.performanceRules[0].id as CinemaPerformanceRuleId
    composition = updateCinemaComposerPerformanceRule(composition, ruleId, {
      condition: { ...composition.performanceRules[0].condition, event: 'dropStart', manualActionIds: undefined },
    }).composition

    const beatGrid = Array.from({ length: 40 }, (_, index) => ({
      timeSec: index * 0.5,
      isDownbeat: index % 4 === 0,
      beatIndex: index + 1,
      barIndex: Math.floor(index / 4) + 1,
    }))
    const model = buildCinemaComposerTimelineModel(composition, {
      trackId: 'track-a',
      durationSec: 20,
      beatGrid,
      phrases: [{ id: 'phrase-a', timeSec: 8, lengthBars: 8 }],
      sections: [
        { id: 'intro', type: 'intro', startSec: 0, endSec: 4 },
        { id: 'drop', type: 'drop', startSec: 4, endSec: 12 },
      ],
      lyrics: [{ id: 'lyric-a', text: 'Hello', startSec: 2, endSec: 3 }],
    }, 4.25)

    expect(model.available).toBe(true)
    expect(model.playheadSec).toBe(4.25)
    expect(model.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'section', timeSec: 4, label: 'drop' }),
      expect.objectContaining({ kind: 'lyric', timeSec: 2, label: 'Hello' }),
      expect.objectContaining({ kind: 'phrase', timeSec: 8, label: 'Phrase · 8 bars' }),
      expect.objectContaining({ kind: 'performance', timeSec: 4 }),
      expect.objectContaining({ kind: 'modulation', timeSec: 0 }),
    ]))
    expect(buildCinemaComposerTimelineModel(composition, null, 0)).toMatchObject({ available: false })
  })
})

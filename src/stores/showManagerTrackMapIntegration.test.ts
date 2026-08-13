import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addLaserDmxShowManagerFixtureToSection,
  createLaserDmxShowManagerShow,
  updateLaserDmxShowManagerSection,
} from '../components/vyzualz/showManager/LaserDmxShowManagerDomain'
import { createShowManagerShow } from '../components/vyzualz/showManager/ShowManagerDomain'
import type { ReactTrackSection } from '../components/vyzualz/react/ReactTypes'
import { adaptMIAnalysis } from '../features/trackIntelligence/trackMapAdapter'
import type { TrackIntelligenceAnalysis } from '../features/musicIntelligence/types'
import { mergeReactStoreState, reactPersistStorage, reactStorePartialize, useReactStore } from './reactStore'
import { useReactPersistenceStatusStore } from './reactPersistenceStatusStore'

const canonicalSections: ReactTrackSection[] = [
  { id: 'analysis-intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 12, intensity: 0.4, source: 'auto' },
  { id: 'analysis-build', label: 'Build', type: 'build', startSec: 12, endSec: 24, intensity: 0.75, source: 'auto' },
  { id: 'analysis-drop', label: 'Drop', type: 'drop', startSec: 24, endSec: 48, intensity: 1, source: 'auto' },
]

function reconcile(showId: string) {
  useReactStore.getState().reconcileShowManagerTrackMapFromAnalysis({
    showId,
    linkedAudioTrackId: 'audio-db-shared',
    analysisVersion: 'analysis-v3',
    durationSec: 48,
    canonicalSections,
  })
}

describe('Show Manager linked-track Track Map integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()
    useReactPersistenceStatusStore.getState().reset()
    useReactStore.setState({
      showManagerShows: [],
      showManagerEditingShowId: null,
      canvasShowManagerShows: [],
      canvasShowManagerActiveShowId: null,
      canvasShowManagerEditingShowId: null,
      canvasShowManagerEditingSectionId: null,
      canvasShowManagerEditingElementId: null,
      canvasShowManagerUndoStack: [],
      canvasShowManagerRedoStack: [],
      canvasShowManagerHistoryTransaction: null,
      laserDmxShowManagerShows: [],
      laserDmxShowManagerActiveShowId: null,
      laserDmxShowManagerEditingShowId: null,
      laserDmxShowManagerEditingSectionId: null,
      laserDmxShowManagerPlaybackSectionId: null,
      showManagerUndoStack: [],
      showManagerRedoStack: [],
    })
  })

  it('waits for canonical analysis instead of persisting generated section placeholders', async () => {
    const showId = await useReactStore.getState().createShowManagerShow({
      name: 'Analysis Pending',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'laserDmx',
    })
    expect(showId).toBeTruthy()

    let state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap).toBeNull()
    expect(state.laserDmxShowManagerShows.find(show => show.id === showId)?.sections).toEqual([])

    reconcile(showId!)
    state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.sections.map(section => section.endSec)).toEqual([12, 24, 48])
    expect(state.laserDmxShowManagerShows.find(show => show.id === showId)?.sections.map(section => section.endSec)).toEqual([12, 24, 48])
  })


  it('feeds real Music Intelligence section output through the production adapter into the Show-owned Track Map', async () => {
    const showId = await useReactStore.getState().createShowManagerShow({
      name: 'Adapter Integration',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'canvas',
    })
    expect(showId).toBeTruthy()

    const analysis = {
      analysisVersion: 'analysis-adapter-v1',
      durationMs: 48_000,
      sections: [
        { id: 'mi-intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 15, intensity: 0.35, confidence: 0.9 },
        { id: 'mi-drop', label: 'Drop', type: 'drop', startSec: 15, endSec: 48, intensity: 1, confidence: 0.96 },
      ],
    } as TrackIntelligenceAnalysis
    const adapted = adaptMIAnalysis(analysis)
    useReactStore.getState().reconcileShowManagerTrackMapFromAnalysis({
      showId: showId!,
      linkedAudioTrackId: 'audio-db-shared',
      analysisVersion: analysis.analysisVersion,
      durationSec: analysis.durationMs / 1000,
      canonicalSections: adapted,
    })

    const state = useReactStore.getState()
    const map = state.showManagerShows.find(show => show.id === showId)!.trackMap!
    expect(map.baseAnalysisVersion).toBe('analysis-adapter-v1')
    expect(map.sections.map(section => [section.id, section.startSec, section.endSec, section.source])).toEqual([
      ['mi-intro', 0, 15, 'auto'],
      ['mi-drop', 15, 48, 'auto'],
    ])
    expect(state.canvasShowManagerShows.find(show => show.id === showId)?.sections.map(section => [section.id, section.startSec, section.endSec])).toEqual([
      ['mi-intro', 0, 15],
      ['mi-drop', 15, 48],
    ])
  })

  it('keeps two Shows on the same track independent, preserves Copy authoring, and never mutates canonical analysis', async () => {
    const canonicalBefore = JSON.stringify(canonicalSections)
    const showA = await useReactStore.getState().createShowManagerShow({
      name: 'Show A',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'laserDmx',
    })
    const showB = await useReactStore.getState().createShowManagerShow({
      name: 'Show B',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'canvas',
    })
    expect(showA).toBeTruthy()
    expect(showB).toBeTruthy()

    reconcile(showA!)
    reconcile(showB!)
    useReactStore.getState().updateShowManagerTrackMapBoundary(showA!, 'analysis-build', 'start', 14, 'analysis-intro', 14)

    let state = useReactStore.getState()
    const mapA = state.showManagerShows.find(show => show.id === showA)!.trackMap!
    const mapB = state.showManagerShows.find(show => show.id === showB)!.trackMap!
    expect(mapA.sections[0]!.endSec).toBe(14)
    expect(mapA.sections[1]!.startSec).toBe(14)
    expect(mapA.edited).toBe(true)
    expect(mapB.sections[0]!.endSec).toBe(12)
    expect(mapB.edited).toBe(false)
    expect(state.canvasShowManagerShows.find(show => show.id === showB)?.sections.map(section => section.durationSec)).toEqual([12, 12, 24])
    expect(JSON.stringify(canonicalSections)).toBe(canonicalBefore)

    useReactStore.getState().reconcileShowManagerTrackMapFromAnalysis({
      showId: showA!,
      linkedAudioTrackId: 'audio-db-shared',
      analysisVersion: 'analysis-v4',
      durationSec: 48,
      canonicalSections: canonicalSections.map(section => section.id === 'analysis-intro'
        ? { ...section, endSec: 10 }
        : section.id === 'analysis-build'
          ? { ...section, startSec: 10 }
          : section),
    })
    state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === showA)?.trackMap?.sections[0]!.endSec).toBe(14)
    expect(state.showManagerShows.find(show => show.id === showA)?.trackMap?.baseAnalysisVersion).toBe('analysis-v3')

    const copyId = await useReactStore.getState().duplicateShowManagerShow(showA!, { name: 'Show A Copy' })
    expect(copyId).toBeTruthy()
    state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === copyId)?.trackMap?.sections.map(section => [section.startSec, section.endSec]))
      .toEqual(mapA.sections.map(section => [section.startSec, section.endSec]))

    useReactStore.getState().updateShowManagerTrackMapSection(copyId!, 'analysis-build', { label: 'Copy Build' })
    state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === copyId)?.trackMap?.sections[1]!.label).toBe('Copy Build')
    expect(state.showManagerShows.find(show => show.id === showA)?.trackMap?.sections[1]!.label).toBe('Build')

    const persisted = reactStorePartialize(state) as Record<string, unknown>
    const reloaded = mergeReactStoreState(persisted, state)
    expect(reloaded.showManagerShows.find(show => show.id === showA)?.trackMap?.sections[0]!.endSec).toBe(14)
    expect(reloaded.showManagerShows.find(show => show.id === showB)?.trackMap?.sections[0]!.endSec).toBe(12)
  })

  it('migrates provable generated LaserDMX timing to canonical sections while preserving fixtures', () => {
    const shared = createShowManagerShow({
      name: 'Legacy Generated',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'laserDmx',
    })!
    let laser = createLaserDmxShowManagerShow(shared.name, shared.id)
    const introId = laser.sections[0]!.id
    const outroId = laser.sections[laser.sections.length - 1]!.id
    laser = addLaserDmxShowManagerFixtureToSection(laser, introId, 'laser', { label: 'Legacy Laser' }).show
    laser = addLaserDmxShowManagerFixtureToSection(laser, outroId, 'laser', { label: 'Legacy Outro Laser' }).show
    useReactStore.setState({ showManagerShows: [shared], laserDmxShowManagerShows: [laser] })

    reconcile(shared.id)
    const state = useReactStore.getState()
    const migrated = state.showManagerShows[0]!.trackMap!
    const laserMigrated = state.laserDmxShowManagerShows[0]!
    expect(migrated.edited).toBe(false)
    expect(migrated.sections.map(section => section.endSec)).toEqual([12, 24, 48])
    expect(laserMigrated.sections[0]!.fixtures[0]!.label).toBe('Legacy Laser')
    expect(laserMigrated.sections.flatMap(section => section.fixtures).map(fixture => fixture.label)).toContain('Legacy Outro Laser')
  })

  it('does not overwrite ambiguous legacy-authored timing when canonical analysis arrives', () => {
    const shared = createShowManagerShow({
      name: 'Legacy Authored',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'laserDmx',
    })!
    let laser = createLaserDmxShowManagerShow(shared.name, shared.id)
    const first = laser.sections[0]!
    const second = laser.sections[1]!
    laser = updateLaserDmxShowManagerSection(laser, first.id, { endSec: 1.5 })
    laser = updateLaserDmxShowManagerSection(laser, second.id, { startSec: 1.5 })
    useReactStore.setState({ showManagerShows: [shared], laserDmxShowManagerShows: [laser] })

    reconcile(shared.id)
    const map = useReactStore.getState().showManagerShows[0]!.trackMap!
    expect(map.edited).toBe(true)
    expect(map.sections[0]!.endSec).toBe(1.5)
    expect(map.sections[1]!.startSec).toBe(1.5)
  })

  it('assigns section ownership only on the first LaserDMX authoring action and keeps display settings section-local', () => {
    const shared = createShowManagerShow({
      name: 'Section Ownership',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: null,
    })!
    const showId = shared.id
    useReactStore.setState({ showManagerShows: [shared], showManagerEditingShowId: showId })
    useReactStore.getState().ensureShowManagerAuthoringMirrors(showId)
    reconcile(showId)

    let state = useReactStore.getState()
    const sharedBefore = state.showManagerShows.find(show => show.id === showId)!
    expect(sharedBefore.engineIds).toEqual([])
    expect(sharedBefore.trackMap?.sections.every(section => section.engineId == null)).toBe(true)
    expect(state.canvasShowManagerShows.some(show => show.id === showId)).toBe(true)
    expect(state.laserDmxShowManagerShows.some(show => show.id === showId)).toBe(true)

    state.updateLaserDmxShowManagerSectionWorkspaceSettings(showId, 'analysis-intro', { showGrid: false })
    state = useReactStore.getState()
    expect(state.laserDmxShowManagerShows.find(show => show.id === showId)?.sections[0]?.settings.showGrid).toBe(false)
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.sections[0]?.engineId).toBeUndefined()

    const fixtureId = state.addLaserDmxShowManagerFixture(showId, 'analysis-intro', 'movingHead', { x: 3, y: 4 })
    expect(fixtureId).toBeTruthy()

    state = useReactStore.getState()
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.sections[0]?.engineId).toBe('laserDmx')
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.edited).toBe(false)
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.sections[0]?.source).toBe('auto')
    expect(state.showManagerShows.find(show => show.id === showId)?.engineIds).toEqual(['laserDmx'])
    expect(state.laserDmxShowManagerShows.find(show => show.id === showId)?.sections[0]?.fixtures[0]).toMatchObject({
      id: fixtureId,
      kind: 'movingHead',
      x: 3,
      y: 4,
    })

    state.updateLaserDmxShowManagerSectionWorkspaceSettings(showId, 'analysis-intro', { showLabels: false })
    state = useReactStore.getState()
    const laser = state.laserDmxShowManagerShows.find(show => show.id === showId)!
    expect(laser.sections.find(section => section.id === 'analysis-intro')?.settings.showGrid).toBe(false)
    expect(laser.sections.find(section => section.id === 'analysis-intro')?.settings.showLabels).toBe(false)
    expect(laser.sections.find(section => section.id === 'analysis-build')?.settings.showGrid).toBe(true)
    expect(state.showManagerShows.find(show => show.id === showId)?.trackMap?.sections[1]?.engineId).toBeUndefined()

    const persisted = reactStorePartialize(state) as Record<string, unknown>
    const reloaded = mergeReactStoreState(persisted, state)
    expect(reloaded.showManagerShows.find(show => show.id === showId)?.trackMap?.sections[0]?.engineId).toBe('laserDmx')
  })

  it('clears the current section before changing its authoring engine and leaves neighboring sections intact', () => {
    const sharedShow = createShowManagerShow({
      name: 'Engine Replacement',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: null,
    })!
    const showId = sharedShow.id
    useReactStore.setState({ showManagerShows: [sharedShow], showManagerEditingShowId: showId })
    useReactStore.getState().ensureShowManagerAuthoringMirrors(showId)
    reconcile(showId)

    const introFixture = useReactStore.getState().addLaserDmxShowManagerFixture(showId, 'analysis-intro', 'laser', { label: 'Intro Laser' })
    const buildFixture = useReactStore.getState().addLaserDmxShowManagerFixture(showId, 'analysis-build', 'strobe', { label: 'Build Strobe' })
    expect(introFixture).toBeTruthy()
    expect(buildFixture).toBeTruthy()
    useReactStore.getState().updateLaserDmxShowManagerSectionWorkspaceSettings(showId, 'analysis-intro', { showLabels: false })

    expect(useReactStore.getState().replaceShowManagerSectionEngine(showId, 'analysis-intro', 'canvas')).toBe(true)

    const state = useReactStore.getState()
    const shared = state.showManagerShows.find(show => show.id === showId)!
    const laser = state.laserDmxShowManagerShows.find(show => show.id === showId)!
    expect(shared.trackMap?.sections.find(section => section.id === 'analysis-intro')?.engineId).toBe('canvas')
    expect(shared.trackMap?.sections.find(section => section.id === 'analysis-build')?.engineId).toBe('laserDmx')
    expect(shared.engineIds).toEqual(['canvas', 'laserDmx'])
    expect(laser.sections.find(section => section.id === 'analysis-intro')?.fixtures).toEqual([])
    expect(laser.sections.find(section => section.id === 'analysis-intro')?.settings.showLabels).toBe(true)
    expect(laser.sections.find(section => section.id === 'analysis-build')?.fixtures.map(fixture => fixture.label)).toEqual(['Build Strobe'])
    expect(useReactStore.getState().addLaserDmxShowManagerFixture(showId, 'analysis-intro', 'movingHead')).toBeNull()
  })

  it('blocks legacy engine timing mutation APIs while an audio-bound Show is waiting for analysis', async () => {
    const canvasId = await useReactStore.getState().createShowManagerShow({
      name: 'Pending Canvas',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'canvas',
    })
    const laserId = await useReactStore.getState().createShowManagerShow({
      name: 'Pending Laser',
      linkedAudioTrackId: 'audio-db-shared',
      initialEngineId: 'laserDmx',
    })
    expect(canvasId).toBeTruthy()
    expect(laserId).toBeTruthy()
    expect(useReactStore.getState().updateCanvasShowManagerSectionDuration(canvasId!, 'made-up', 9)).toBeNull()
    expect(useReactStore.getState().addLaserDmxShowManagerSection(laserId!, { startSec: 0, endSec: 1 })).toBeNull()
    useReactStore.getState().removeLaserDmxShowManagerSection(laserId!, 'made-up')
    useReactStore.getState().reorderLaserDmxShowManagerSection(laserId!, 'made-up', 1)
    useReactStore.getState().updateLaserDmxShowManagerSectionBoundary(laserId!, 'made-up', 'end', 1, null, null)
    const state = useReactStore.getState()
    expect(state.canvasShowManagerShows.find(show => show.id === canvasId)?.sections).toEqual([])
    expect(state.laserDmxShowManagerShows.find(show => show.id === laserId)?.sections).toEqual([])
  })
})

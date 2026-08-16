import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeReactStoreState, migrateReactStore, reactPersistStorage, reactStorePartialize, useReactStore } from './reactStore'

describe('LaserDMX Show Manager Part 1 store integration', () => {
  beforeEach(() => {
    useReactStore.setState({
      laserDmxShowManagerShows: [],
      laserDmxShowManagerActiveShowId: null,
      laserDmxShowManagerEditingShowId: null,
      laserDmxShowManagerEditingSectionId: null,
      laserDmxShowManagerPlaybackSectionId: null,
      showManagerUndoStack: [],
      showManagerRedoStack: [],
      laserDmxShowManagerHistoryTransaction: null,
    })
  })

  it('creates a new Show through the canonical store path without audio state', () => {
    const beforePixGrid = useReactStore.getState().pixGridState
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Stage 1')
    const state = useReactStore.getState()
    const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)

    expect(show?.sections.map(section => section.label)).toEqual([
      'Intro', 'Verse', 'Build', 'Pre-Drop', 'Drop', 'Breakdown', 'Outro',
    ])
    expect(state.laserDmxShowManagerEditingShowId).toBe(showId)
    expect(state.laserDmxShowManagerEditingSectionId).toBe(show?.sections[0]?.id)
    expect(state.pixGridState).toBe(beforePixGrid)
  })

  it('preserves working edits across section navigation and reconciles stale selection after delete', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow()
    let state = useReactStore.getState()
    const introId = state.laserDmxShowManagerShows[0]!.sections[0]!.id
    const verseId = state.laserDmxShowManagerShows[0]!.sections[1]!.id

    state.updateLaserDmxShowManagerSection(showId, introId, { label: 'Opening' })
    useReactStore.getState().selectLaserDmxShowManagerSection(verseId)
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.label).toBe('Opening')

    useReactStore.getState().removeLaserDmxShowManagerSection(showId, verseId)
    state = useReactStore.getState()
    expect(state.laserDmxShowManagerEditingSectionId).toBe(state.laserDmxShowManagerShows[0]!.sections[0]!.id)
  })

  it('stores Stage 2 workspace settings on the canonical Show and leaves PixGrid untouched', () => {
    const beforePixGrid = useReactStore.getState().pixGridState
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Workspace')

    useReactStore.getState().updateLaserDmxShowManagerWorkspaceSettings(showId, {
      showGrid: false,
      showLabels: false,
      rendererMode: 'webgl',
    })

    const state = useReactStore.getState()
    const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)
    expect(show?.settings).toEqual({
      showGrid: false,
      showLabels: false,
      showBeams: true,
      highlightGrid: true,
      rendererMode: 'webgl',
    })
    expect(state.pixGridState).toBe(beforePixGrid)

    const persisted = reactStorePartialize(state) as Record<string, unknown>
    const persistedShows = persisted.laserDmxShowManagerShows as Array<{ settings?: unknown }>
    expect(persistedShows[0]?.settings).toEqual(show?.settings)
  })

  it('persists canonical Shows and active identity while keeping editing, playback, and history runtime-only', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Persisted')
    const state = useReactStore.getState()
    const secondSectionId = state.laserDmxShowManagerShows[0]!.sections[1]!.id
    useReactStore.setState({
      laserDmxShowManagerActiveShowId: showId,
      laserDmxShowManagerEditingShowId: showId,
      laserDmxShowManagerEditingSectionId: secondSectionId,
      laserDmxShowManagerPlaybackSectionId: state.laserDmxShowManagerShows[0]!.sections[4]!.id,
    })
    useReactStore.getState().updateLaserDmxShowManagerSection(showId, secondSectionId, { label: 'Verse Edit' })

    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(persisted.laserDmxShowManagerShows).toHaveLength(1)
    expect(persisted.laserDmxShowManagerActiveShowId).toBe(showId)
    expect(persisted).not.toHaveProperty('laserDmxShowManagerEditingShowId')
    expect(persisted).not.toHaveProperty('laserDmxShowManagerEditingSectionId')
    expect(persisted).not.toHaveProperty('laserDmxShowManagerPlaybackSectionId')
    expect(persisted).not.toHaveProperty('showManagerUndoStack')
    expect(persisted).not.toHaveProperty('showManagerRedoStack')
    expect(persisted).not.toHaveProperty('laserDmxShowManagerHistoryTransaction')

    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    expect(merged.laserDmxShowManagerShows).toHaveLength(1)
    expect(merged.laserDmxShowManagerActiveShowId).toBe(showId)
    expect(merged.laserDmxShowManagerEditingShowId).toBeNull()
    expect(merged.laserDmxShowManagerEditingSectionId).toBeNull()
    expect(merged.laserDmxShowManagerPlaybackSectionId).toBeNull()
    expect(merged.showManagerUndoStack).toEqual([])
    expect(merged.showManagerRedoStack).toEqual([])
    expect(merged.laserDmxShowManagerHistoryTransaction).toBeNull()
  })

  it('migrates missing Stage 1 state safely without auto-creating a Show', () => {
    const migrated = migrateReactStore({ activeReactEngineId: 'laserDmx' }, 67)
    expect(migrated.laserDmxShowManagerShows).toEqual([])
  })

  it('migrates Stage 7 active identity idempotently and rejects stale active IDs', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Migrated')
    const show = useReactStore.getState().laserDmxShowManagerShows[0]!
    const valid = migrateReactStore({
      laserDmxShowManagerShows: [show],
      laserDmxShowManagerActiveShowId: showId,
    }, 68)
    expect(valid.laserDmxShowManagerActiveShowId).toBe(showId)
    expect(migrateReactStore(valid, 69).laserDmxShowManagerActiveShowId).toBe(showId)

    const stale = migrateReactStore({
      laserDmxShowManagerShows: [show],
      laserDmxShowManagerActiveShowId: 'missing-show',
    }, 68)
    expect(stale.laserDmxShowManagerActiveShowId).toBeNull()
  })

  it('rejects disabled fixture activation through the store action and keeps section fixtures unchanged', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow()
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.id
    const result = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'co2Jet')
    expect(result).toBeNull()
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.fixtures).toEqual([])
  })

  it('creates independent section-local fixtures through the canonical store action and persists them', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Placement')
    const initial = useReactStore.getState().laserDmxShowManagerShows[0]!
    const introId = initial.sections[0]!.id
    const verseId = initial.sections[1]!.id

    const firstId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'laser', { x: 17, y: 11 })
    const secondId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'laser', { x: 17, y: 11 })
    const verseFixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, verseId, 'strobe', { x: 0, y: 0 })

    const state = useReactStore.getState()
    const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)!
    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()
    expect(verseFixtureId).toBeTruthy()
    expect(new Set([firstId, secondId, verseFixtureId]).size).toBe(3)
    expect(show.sections[0]!.fixtures.map(fixture => [fixture.label, fixture.x, fixture.y])).toEqual([
      ['Laser 1', 17, 11],
      ['Laser 2', 17, 11],
    ])
    expect(show.sections[1]!.fixtures.map(fixture => [fixture.label, fixture.x, fixture.y])).toEqual([
      ['Strobe 1', 0, 0],
    ])

    const persisted = reactStorePartialize(state) as Record<string, unknown>
    const persistedShows = persisted.laserDmxShowManagerShows as typeof state.laserDmxShowManagerShows
    expect(persistedShows[0]!.sections[0]!.fixtures.map(fixture => fixture.id)).toEqual([firstId, secondId])
    expect(persistedShows[0]!.sections[1]!.fixtures.map(fixture => fixture.id)).toEqual([verseFixtureId])
  })

  it('updates and removes one fixture through the canonical Show store without touching PixGrid or colocated fixtures', () => {
    const beforePixGrid = useReactStore.getState().pixGridState
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Inspector')
    const created = useReactStore.getState().laserDmxShowManagerShows[0]!
    const introId = created.sections[0]!.id
    const verseId = created.sections[1]!.id
    const selectedId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'laser', { x: 4, y: 5 })!
    const colocatedId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'strobe', { x: 4, y: 5 })!
    const otherSectionId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, verseId, 'laser', { x: 4, y: 5 })!

    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, introId, selectedId, {
      x: 99,
      y: -1,
      brightness: 0.42,
      color: '#ff00aa',
    })

    let state = useReactStore.getState()
    let show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)!
    expect(show.sections[0]!.fixtures.find(fixture => fixture.id === selectedId)).toMatchObject({
      x: 17,
      y: 0,
      brightness: 0.42,
      color: '#ff00aa',
      colorMode: 'fixed',
    })
    expect(show.sections[0]!.fixtures.find(fixture => fixture.id === colocatedId)).toMatchObject({ x: 4, y: 5 })
    expect(show.sections[1]!.fixtures.find(fixture => fixture.id === otherSectionId)).toMatchObject({ x: 4, y: 5 })

    useReactStore.getState().removeLaserDmxShowManagerFixture(showId, introId, selectedId)
    state = useReactStore.getState()
    show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)!
    expect(show.sections[0]!.fixtures.map(fixture => fixture.id)).toEqual([colocatedId])
    expect(show.sections[1]!.fixtures.map(fixture => fixture.id)).toEqual([otherSectionId])
    expect(state.pixGridState).toBe(beforePixGrid)

    const persisted = reactStorePartialize(state) as Record<string, unknown>
    const persistedShows = persisted.laserDmxShowManagerShows as typeof state.laserDmxShowManagerShows
    expect(persistedShows[0]!.sections[0]!.fixtures.map(fixture => fixture.id)).toEqual([colocatedId])
  })
  it('batches a continuous fixture reposition into one LaserDMX Show Manager undo transaction', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Drag Transaction')
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.id
    const fixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'movingHead', { x: 2, y: 3 })!
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().beginLaserDmxShowManagerHistoryTransaction()
    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, sectionId, fixtureId, { x: 5, y: 4 })
    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, sectionId, fixtureId, { x: 11, y: 8 })
    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, sectionId, fixtureId, { x: 17, y: 11 })

    let state = useReactStore.getState()
    expect(state.showManagerUndoStack).toHaveLength(0)
    expect(state.laserDmxShowManagerHistoryTransaction).not.toBeNull()
    expect(state.laserDmxShowManagerShows[0]!.sections[0]!.fixtures[0]).toMatchObject({ x: 17, y: 11 })

    useReactStore.getState().commitLaserDmxShowManagerHistoryTransaction()
    state = useReactStore.getState()
    expect(state.showManagerUndoStack).toHaveLength(1)
    expect(state.showManagerRedoStack).toHaveLength(0)
    expect(state.laserDmxShowManagerHistoryTransaction).toBeNull()

    useReactStore.getState().undoLaserDmxShowManagerEdit()
    state = useReactStore.getState()
    expect(state.laserDmxShowManagerShows[0]!.sections[0]!.fixtures[0]).toMatchObject({ x: 2, y: 3 })
    expect(state.showManagerRedoStack).toHaveLength(1)

    useReactStore.getState().redoLaserDmxShowManagerEdit()
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.fixtures[0]).toMatchObject({ x: 17, y: 11 })
  })

  it('rolls back an aborted fixture reposition transaction without adding history', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Cancelled Drag')
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.id
    const fixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'strobe', { x: 6, y: 7 })!
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().beginLaserDmxShowManagerHistoryTransaction()
    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, sectionId, fixtureId, { x: 13, y: 10 })
    useReactStore.getState().cancelLaserDmxShowManagerHistoryTransaction()

    const state = useReactStore.getState()
    expect(state.laserDmxShowManagerShows[0]!.sections[0]!.fixtures[0]).toMatchObject({ x: 6, y: 7 })
    expect(state.showManagerUndoStack).toHaveLength(0)
    expect(state.showManagerRedoStack).toHaveLength(0)
    expect(state.laserDmxShowManagerHistoryTransaction).toBeNull()
  })

  it('copies section fixtures atomically through the canonical store and persists independent appended clones', () => {
    const beforePixGrid = useReactStore.getState().pixGridState
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Copy')
    const initial = useReactStore.getState().laserDmxShowManagerShows[0]!
    const introId = initial.sections[0]!.id
    const verseId = initial.sections[1]!.id

    const sourceId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'laser', {
      label: 'Hero Laser',
      x: 9,
      y: 6,
      brightness: 0.37,
      beam: { beamSpread: 64 },
    })!
    const destinationId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, verseId, 'strobe', { x: 9, y: 6 })!

    const copiedIds = useReactStore.getState().copyLaserDmxShowManagerFixturesFromSection(showId, introId, verseId)
    expect(copiedIds).toHaveLength(1)
    expect(copiedIds[0]).not.toBe(sourceId)

    let state = useReactStore.getState()
    let show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)!
    expect(show.sections[1]!.fixtures.map(fixture => fixture.id)).toEqual([destinationId, copiedIds[0]])
    expect(show.sections[1]!.fixtures[1]).toMatchObject({ label: 'Hero Laser', x: 9, y: 6, brightness: 0.37 })
    expect(show.sections[1]!.fixtures[1]!.beam).not.toBe(show.sections[0]!.fixtures[0]!.beam)
    expect(state.pixGridState).toBe(beforePixGrid)

    useReactStore.getState().updateLaserDmxShowManagerFixture(showId, verseId, copiedIds[0]!, { brightness: 0.8 })
    state = useReactStore.getState()
    show = state.laserDmxShowManagerShows.find(candidate => candidate.id === showId)!
    expect(show.sections[0]!.fixtures.find(fixture => fixture.id === sourceId)?.brightness).toBe(0.37)

    const beforeFailedCopy = show
    expect(useReactStore.getState().copyLaserDmxShowManagerFixturesFromSection(showId, verseId, verseId)).toEqual([])
    expect(useReactStore.getState().laserDmxShowManagerShows.find(candidate => candidate.id === showId)).toBe(beforeFailedCopy)

    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const persistedShows = persisted.laserDmxShowManagerShows as typeof state.laserDmxShowManagerShows
    expect(persistedShows[0]!.sections[1]!.fixtures.map(fixture => fixture.id)).toEqual([destinationId, copiedIds[0]])
  })

  it('round-trips every approved Part 1 fixture field through canonical persistence', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Round Trip')
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.id
    const fixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'movingHead', {
      x: 17,
      y: 11,
      z: 0.5,
      rotation: 225,
      color: '#12abef',
      colorMode: 'fixed',
      brightness: 0.63,
      beam: {
        targetMode: 'fan',
        targetX: 6,
        targetY: 4,
        targetZ: 0.25,
        beamSpread: 38,
        focus: 0.77,
      },
      optics: { zoom: 0.42 },
      trigger: { mode: 'bar', quantize: 'bar', barInterval: 8 },
    })!
    useReactStore.setState({ laserDmxShowManagerActiveShowId: showId })

    const persisted = reactStorePartialize(useReactStore.getState())
    const rehydrated = mergeReactStoreState(persisted, useReactStore.getState())
    const fixture = rehydrated.laserDmxShowManagerShows[0]!.sections[0]!.fixtures.find(candidate => candidate.id === fixtureId)

    expect(fixture).toMatchObject({
      id: fixtureId,
      kind: 'movingHead',
      x: 17,
      y: 11,
      z: 0.5,
      rotation: 225,
      color: '#12abef',
      colorMode: 'fixed',
      brightness: 0.63,
      trigger: { mode: 'bar', quantize: 'bar', barInterval: 8 },
    })
    expect(fixture?.beam).toMatchObject({
      targetMode: 'fan',
      targetX: 6,
      targetY: 4,
      targetZ: 0.25,
      beamSpread: 38,
      focus: 0.77,
    })
    expect(fixture?.optics.zoom).toBe(0.42)
    expect(rehydrated.laserDmxShowManagerActiveShowId).toBe(showId)
  })

  it('keeps canonical history empty for no-op authoring mutations', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('No-op History')
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().updateLaserDmxShowManagerWorkspaceSettings(showId, { showGrid: true })
    expect(useReactStore.getState().showManagerUndoStack).toEqual([])
    expect(useReactStore.getState().showManagerRedoStack).toEqual([])

    useReactStore.getState().updateLaserDmxShowManagerWorkspaceSettings(showId, { showGrid: false })
    expect(useReactStore.getState().showManagerUndoStack).toHaveLength(1)
  })

  it('restores fixture deletion with the same ID/config and invalidates redo after a new edit', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('History')
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.id
    const fixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'laser', {
      x: 7, y: 5, brightness: 0.31, color: '#22ffaa', beam: { beamSpread: 71 },
    })!
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().removeLaserDmxShowManagerFixture(showId, sectionId, fixtureId)
    expect(useReactStore.getState().showManagerUndoStack).toHaveLength(1)
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.fixtures).toHaveLength(0)

    useReactStore.getState().undoLaserDmxShowManagerEdit()
    const restored = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.fixtures[0]
    expect(restored).toMatchObject({ id: fixtureId, x: 7, y: 5, brightness: 0.31, color: '#22ffaa' })
    expect(restored?.beam.beamSpread).toBe(71)
    expect(useReactStore.getState().showManagerRedoStack).toHaveLength(1)

    useReactStore.getState().redoLaserDmxShowManagerEdit()
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections[0]!.fixtures).toHaveLength(0)
    useReactStore.getState().undoLaserDmxShowManagerEdit()
    useReactStore.getState().updateLaserDmxShowManagerWorkspaceSettings(showId, { showGrid: false })
    expect(useReactStore.getState().showManagerRedoStack).toEqual([])
  })

  it('restores a deleted section with its fixtures and treats a fixture copy as one deterministic history action', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('History Sections')
    let show = useReactStore.getState().laserDmxShowManagerShows[0]!
    const introId = show.sections[0]!.id
    const verseId = show.sections[1]!.id
    const sourceId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, introId, 'laser', { x: 2, y: 3 })!
    useReactStore.getState().addLaserDmxShowManagerFixture(showId, verseId, 'strobe', { x: 4, y: 5 })
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().removeLaserDmxShowManagerSection(showId, introId)
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections.some(section => section.id === introId)).toBe(false)
    useReactStore.getState().undoLaserDmxShowManagerEdit()
    show = useReactStore.getState().laserDmxShowManagerShows[0]!
    expect(show.sections.find(section => section.id === introId)?.fixtures[0]?.id).toBe(sourceId)

    useReactStore.getState().clearShowManagerHistory()
    const copiedIds = useReactStore.getState().copyLaserDmxShowManagerFixturesFromSection(showId, introId, verseId)
    expect(copiedIds).toHaveLength(1)
    expect(useReactStore.getState().showManagerUndoStack).toHaveLength(1)
    useReactStore.getState().undoLaserDmxShowManagerEdit()
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections.find(section => section.id === verseId)!.fixtures).toHaveLength(1)
    useReactStore.getState().redoLaserDmxShowManagerEdit()
    expect(useReactStore.getState().laserDmxShowManagerShows[0]!.sections.find(section => section.id === verseId)!.fixtures.map(fixture => fixture.id)).toContain(copiedIds[0])
  })

  it('commits a shared section boundary as one reversible history transaction', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Boundary')
    const initial = useReactStore.getState().laserDmxShowManagerShows[0]!
    const intro = initial.sections[0]!
    const verse = initial.sections[1]!
    useReactStore.getState().clearShowManagerHistory()

    useReactStore.getState().updateLaserDmxShowManagerSectionBoundary(
      showId, intro.id, 'end', 1.5, verse.id, 1.5,
    )
    expect(useReactStore.getState().showManagerUndoStack).toHaveLength(1)
    let show = useReactStore.getState().laserDmxShowManagerShows[0]!
    expect(show.sections[0]!.endSec).toBe(1.5)
    expect(show.sections[1]!.startSec).toBe(1.5)

    useReactStore.getState().undoLaserDmxShowManagerEdit()
    show = useReactStore.getState().laserDmxShowManagerShows[0]!
    expect(show.sections[0]!.endSec).toBe(intro.endSec)
    expect(show.sections[1]!.startSec).toBe(verse.startSec)
  })

  it('persists the complete activation candidate before mutating live engine state', async () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Atomic Activation')
    useReactStore.setState({
      activeReactEngineId: 'cinema',
      activeReactPresetId: null,
      laserDmxShowManagerActiveShowId: null,
    })

    const originalSetItem = reactPersistStorage.setItem.bind(reactPersistStorage)
    const persistedStates: Array<ReturnType<typeof reactStorePartialize>> = []
    type PersistEnvelope = Parameters<typeof reactPersistStorage.setItem>[1]
    const persistSpy = vi.spyOn(reactPersistStorage, 'setItem').mockImplementation(async (name: string, envelope: PersistEnvelope) => {
      if (persistedStates.length === 0) {
        persistedStates.push(envelope.state as ReturnType<typeof reactStorePartialize>)
        expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
        expect(useReactStore.getState().laserDmxShowManagerActiveShowId).toBeNull()
      }
      await originalSetItem(name, envelope)
    })

    try {
      const saved = await useReactStore.getState().saveLaserDmxShowManagerShow(showId, { makeActive: true })
      expect(saved).toBe(true)
      expect(persistedStates[0]?.activeReactEngineId).toBe('laserDmx')
      expect(persistedStates[0]?.laserDmxShowManagerActiveShowId).toBe(showId)
      expect(useReactStore.getState().activeReactEngineId).toBe('laserDmx')
      expect(useReactStore.getState().laserDmxShowManagerActiveShowId).toBe(showId)
    } finally {
      persistSpy.mockRestore()
    }
  })

  it('leaves live activation state untouched when Save + Make Active persistence fails', async () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Failed Activation')
    useReactStore.setState({
      activeReactEngineId: 'cinema',
      activeReactPresetId: null,
      laserDmxShowManagerActiveShowId: null,
    })
    const before = useReactStore.getState()
    const persistSpy = vi.spyOn(reactPersistStorage, 'setItem').mockRejectedValueOnce(new Error('forced persistence failure'))

    try {
      const saved = await useReactStore.getState().saveLaserDmxShowManagerShow(showId, { makeActive: true })
      expect(saved).toBe(false)
      expect(useReactStore.getState().activeReactEngineId).toBe(before.activeReactEngineId)
      expect(useReactStore.getState().activeReactPresetId).toBe(before.activeReactPresetId)
      expect(useReactStore.getState().laserDmxShowManagerActiveShowId).toBe(before.laserDmxShowManagerActiveShowId)
    } finally {
      persistSpy.mockRestore()
    }
  })

  it('Save + Make Active persists the working Show before exposing it as the live LaserDMX Show', async () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Live Show')
    const sectionId = useReactStore.getState().laserDmxShowManagerShows[0]!.sections[4]!.id
    const fixtureId = useReactStore.getState().addLaserDmxShowManagerFixture(showId, sectionId, 'ledBar', {
      x: 12, y: 9, color: '#00ffaa', brightness: 0.54,
    })!

    const saved = await useReactStore.getState().saveLaserDmxShowManagerShow(showId, { makeActive: true })
    expect(saved).toBe(true)
    expect(useReactStore.getState().activeReactEngineId).toBe('laserDmx')
    expect(useReactStore.getState().laserDmxShowManagerActiveShowId).toBe(showId)

    const envelope = await reactPersistStorage.getItem('drmvyz:react-store')
    const persisted = envelope?.state as ReturnType<typeof reactStorePartialize> | undefined
    expect(persisted?.laserDmxShowManagerActiveShowId).toBe(showId)
    expect(persisted?.laserDmxShowManagerShows.find(show => show.id === showId)
      ?.sections.find(section => section.id === sectionId)?.fixtures.find(fixture => fixture.id === fixtureId))
      .toMatchObject({ id: fixtureId, x: 12, y: 9, color: '#00ffaa', brightness: 0.54 })
  })

})

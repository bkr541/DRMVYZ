import { beforeEach, describe, expect, it } from 'vitest'
import { mergeReactStoreState, migrateReactStore, reactStorePartialize, useReactStore } from './reactStore'

describe('LaserDMX Show Manager Part 1 store integration', () => {
  beforeEach(() => {
    useReactStore.setState({
      laserDmxShowManagerShows: [],
      laserDmxShowManagerEditingShowId: null,
      laserDmxShowManagerEditingSectionId: null,
      laserDmxShowManagerPlaybackSectionId: null,
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

  it('persists canonical Shows but keeps editing and playback section identity runtime-only', () => {
    const showId = useReactStore.getState().createLaserDmxShowManagerShow('Persisted')
    const state = useReactStore.getState()
    const secondSectionId = state.laserDmxShowManagerShows[0]!.sections[1]!.id
    useReactStore.setState({
      laserDmxShowManagerEditingShowId: showId,
      laserDmxShowManagerEditingSectionId: secondSectionId,
      laserDmxShowManagerPlaybackSectionId: state.laserDmxShowManagerShows[0]!.sections[4]!.id,
    })

    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(persisted.laserDmxShowManagerShows).toHaveLength(1)
    expect(persisted).not.toHaveProperty('laserDmxShowManagerEditingShowId')
    expect(persisted).not.toHaveProperty('laserDmxShowManagerEditingSectionId')
    expect(persisted).not.toHaveProperty('laserDmxShowManagerPlaybackSectionId')

    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    expect(merged.laserDmxShowManagerShows).toHaveLength(1)
    expect(merged.laserDmxShowManagerEditingShowId).toBeNull()
    expect(merged.laserDmxShowManagerEditingSectionId).toBeNull()
    expect(merged.laserDmxShowManagerPlaybackSectionId).toBeNull()
  })

  it('migrates missing Stage 1 state safely without auto-creating a Show', () => {
    const migrated = migrateReactStore({ activeReactEngineId: 'laserDmx' }, 67)
    expect(migrated.laserDmxShowManagerShows).toEqual([])
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

})

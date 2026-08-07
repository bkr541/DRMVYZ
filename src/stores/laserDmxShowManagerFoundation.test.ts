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
})

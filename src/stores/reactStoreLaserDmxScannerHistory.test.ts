import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from '../components/vyzualz/react/ReactTypes'
import {
  createLaserDmxScannerPattern,
  previewLaserDmxLegacyScannerMigration,
  updateLaserDmxScannerPoint,
} from '../components/vyzualz/react/laserDmxScannerAuthoring'
import { useReactStore } from './reactStore'

function legacyRig() {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'scanner-history', 0)
  fixture.beam.targets = [
    { id: 'legacy-a', x: 3, y: 4 },
    { id: 'legacy-b', x: 11, y: 4 },
  ]
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    fixtures: [fixture],
    selectedFixtureId: fixture.id,
    selectedFixtureIds: [fixture.id],
  })
}

describe('LaserDMX scanner authoring history', () => {
  beforeEach(() => {
    useReactStore.setState(useReactStore.getInitialState(), true)
    useReactStore.setState({
      laserDmxShowDirector: legacyRig(),
      laserDmxShowDirectorUndoStack: [],
      laserDmxShowDirectorRedoStack: [],
      laserDmxShowDirectorHistoryTransaction: null,
    })
  })

  it('makes an applied legacy migration undoable and redoable with its backup intact', () => {
    const before = useReactStore.getState().laserDmxShowDirector.fixtures[0]!
    const preview = previewLaserDmxLegacyScannerMigration(before, { columns: 15, rows: 10 })
    const migrated = {
      ...preview.scanner,
      migration: { ...preview.scanner.migration, status: 'migrated' as const },
    }

    useReactStore.getState().updateLaserDmxShowDirectorFixture(before.id, { scanner: migrated })
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner?.migration.status).toBe('migrated')
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner?.migration.backupTargets).toEqual(before.beam.targets)

    useReactStore.getState().undoLaserDmxShowDirectorEdit()
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner).toBeUndefined()

    useReactStore.getState().redoLaserDmxShowDirectorEdit()
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner?.migration.backupTargets).toEqual(before.beam.targets)
  })

  it('coalesces dragged scanner point movement into one history transaction', () => {
    const fixture = useReactStore.getState().laserDmxShowDirector.fixtures[0]!
    const scanner = createLaserDmxScannerPattern(fixture, 'customPath', { columns: 15, rows: 10 })
    useReactStore.getState().updateLaserDmxShowDirectorFixture(fixture.id, { scanner })
    useReactStore.getState().clearLaserDmxShowDirectorHistory()

    const point = scanner.path.points[0]!
    useReactStore.getState().beginLaserDmxShowDirectorHistoryTransaction()
    useReactStore.getState().updateLaserDmxShowDirectorFixture(fixture.id, {
      scanner: updateLaserDmxScannerPoint(scanner, point.id, { x: point.x + 1 }),
    })
    const onceMoved = useReactStore.getState().laserDmxShowDirector.fixtures[0]!.scanner!
    useReactStore.getState().updateLaserDmxShowDirectorFixture(fixture.id, {
      scanner: updateLaserDmxScannerPoint(onceMoved, point.id, { x: point.x + 2 }),
    })
    useReactStore.getState().commitLaserDmxShowDirectorHistoryTransaction()

    expect(useReactStore.getState().laserDmxShowDirectorUndoStack).toHaveLength(1)
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner?.path.points[0]?.x).toBe(point.x + 2)

    useReactStore.getState().undoLaserDmxShowDirectorEdit()
    expect(useReactStore.getState().laserDmxShowDirector.fixtures[0]?.scanner?.path.points[0]?.x).toBe(point.x)
  })
})

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxShowDirectorCanvas } from './LaserDmxShowDirectorCanvas'
import { LaserDmxShowDirectorInspector } from './LaserDmxShowDirectorInspector'
import { LaserDmxShowDirectorPalette } from './LaserDmxShowDirectorPalette'

export function LaserDmxShowDirector() {
  const {
    fixtures,
    selectedFixtureId,
    settings,
    clearFixtures,
  } = useReactStore(useShallow(s => ({
    fixtures:          s.laserDmxShowDirector.fixtures,
    selectedFixtureId: s.laserDmxShowDirector.selectedFixtureId,
    settings:          s.laserDmxShowDirector.settings,
    clearFixtures:     s.clearLaserDmxShowDirectorFixtures,
  })))

  const selectedFixture = useMemo(
    () => fixtures.find(fixture => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  )

  return (
    <div className="rv-show-director-builder">
      <header className="rv-show-director-builder__header">
        <div>
          <span className="rv-show-director-kicker">LaserDMX</span>
          <h3>Show Director</h3>
          <p>Drag DJ lighting components onto a 2D stage. This shell authors fixture layout data only, so Beam Matrix stays isolated and unchanged.</p>
        </div>
        <div className="rv-show-director-builder__stats" aria-label="Show Director summary">
          <span><strong>{fixtures.length}</strong> fixtures</span>
          <span><strong>{settings.gridSize.columns}×{settings.gridSize.rows}</strong> grid</span>
          <span><strong>{selectedFixture ? '1' : '0'}</strong> selected</span>
        </div>
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          onClick={clearFixtures}
          disabled={fixtures.length === 0}
        >
          Clear Rig
        </button>
      </header>

      <div className="rv-show-director-builder__layout">
        <LaserDmxShowDirectorPalette />
        <LaserDmxShowDirectorCanvas fixtures={fixtures} selectedFixtureId={selectedFixtureId} settings={settings} />
        <LaserDmxShowDirectorInspector fixture={selectedFixture} />
      </div>
    </div>
  )
}

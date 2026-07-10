import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { LaserDmxShowDirectorInspector } from './LaserDmxShowDirectorInspector'
import type { LaserDmxShowDirectorSettings } from './ReactTypes'

const GRID_PRESETS = [
  { label: '10 × 6', value: '10x6', columns: 10, rows: 6 },
  { label: '12 × 8', value: '12x8', columns: 12, rows: 8 },
  { label: '15 × 10', value: '15x10', columns: 15, rows: 10 },
  { label: '18 × 12', value: '18x12', columns: 18, rows: 12 },
  { label: '24 × 14', value: '24x14', columns: 24, rows: 14 },
  { label: '30 × 18', value: '30x18', columns: 30, rows: 18 },
  { label: '36 × 20', value: '36x20', columns: 36, rows: 20 },
] as const

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function currentGridValue(settings: LaserDmxShowDirectorSettings): string {
  return `${Math.max(1, Math.round(settings.gridSize.columns || 1))}x${Math.max(1, Math.round(settings.gridSize.rows || 1))}`
}

/**
 * Stage-wide Show Director preferences and rig layout actions belong beside the
 * component palette in the left workspace. Fixture-specific editing remains in
 * the right DESIGN rail through LaserDmxShowDirectorControls below.
 */
export function LaserDmxShowDirectorGlobalControls() {
  const {
    fixtures,
    settings,
    updateSettings,
    resetLayout,
    clearFixtures,
    duplicateLayout,
    mirrorLayout,
  } = useReactStore(useShallow(s => ({
    fixtures:        s.laserDmxShowDirector.fixtures,
    settings:        s.laserDmxShowDirector.settings,
    updateSettings:  s.updateLaserDmxShowDirectorSettings,
    resetLayout:     s.resetLaserDmxShowDirectorLayout,
    clearFixtures:   s.clearLaserDmxShowDirectorFixtures,
    duplicateLayout: s.duplicateLaserDmxShowDirectorLayout,
    mirrorLayout:    s.mirrorLaserDmxShowDirectorLayout,
  })))

  const gridValue = currentGridValue(settings)
  const gridOptions = useMemo(() => {
    const hasCurrent = GRID_PRESETS.some(option => option.value === gridValue)
    return hasCurrent
      ? GRID_PRESETS.map(option => ({ value: option.value, label: option.label }))
      : [
          { value: gridValue, label: `${settings.gridSize.columns} × ${settings.gridSize.rows}` },
          ...GRID_PRESETS.map(option => ({ value: option.value, label: option.label })),
        ]
  }, [gridValue, settings.gridSize.columns, settings.gridSize.rows])

  const hasFixtures = fixtures.length > 0
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  const applyGridPreset = (value: string) => {
    const option = GRID_PRESETS.find(item => item.value === value)
    if (!option) return
    updateSettings({ gridSize: { columns: option.columns, rows: option.rows } })
  }

  const requestResetLayout = () => {
    if (!isConfirmingReset) {
      setIsConfirmingReset(true)
      return
    }
    resetLayout()
    setIsConfirmingReset(false)
  }

  return (
    <div className="rv-show-director-design-panel rv-show-director-global-controls">
      <CtrlSection label="Show Director Design" />

      <Collapsible label="Canvas" defaultOpen>
        <ToggleRow
          label="Snap to Grid"
          value={settings.snapEnabled}
          onChange={value => updateSettings({ snapEnabled: value })}
        />
        <ToggleRow
          label="Show Grid"
          value={settings.showGrid}
          onChange={value => updateSettings({ showGrid: value })}
        />
        <ToggleRow
          label="Show Labels"
          value={settings.showLabels}
          onChange={value => updateSettings({ showLabels: value })}
        />
        <ToggleRow
          label="Show Beams"
          value={settings.showBeams}
          onChange={value => updateSettings({ showBeams: value })}
        />
        <ToggleRow
          label="Highlight Fixtures"
          value={settings.highlightFixtures}
          onChange={value => updateSettings({ highlightFixtures: value })}
        />
        <SelectRow
          label="Grid Size"
          value={gridValue}
          onChange={applyGridPreset}
          options={gridOptions}
        />
        <SliderRow
          label="Stage Zoom"
          value={settings.zoom}
          onChange={value => updateSettings({ zoom: roundTo(value, 2) })}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
        />
        <button type="button" className="rv-glyph-upload-btn" onClick={() => updateSettings({ zoom: 1 })}>Fit Stage</button>
      </Collapsible>

      <Collapsible label="Layout" defaultOpen={false}>
        <div className="rv-show-director-design-actions" aria-label="Show Director layout actions">
          <button type="button" className="rv-glyph-upload-btn" disabled={!hasFixtures} onClick={duplicateLayout}>Duplicate Rig</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!hasFixtures} onClick={() => mirrorLayout('horizontal')}>Mirror Rig H</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!hasFixtures} onClick={() => mirrorLayout('vertical')}>Mirror Rig V</button>
          <button
            type="button"
            className={`rv-glyph-upload-btn${isConfirmingReset ? ' rv-glyph-upload-btn--danger' : ''}`}
            onClick={requestResetLayout}
            aria-pressed={isConfirmingReset}
          >
            {isConfirmingReset ? 'Confirm Reset' : 'Reset Layout'}
          </button>
          {isConfirmingReset && (
            <button type="button" className="rv-glyph-upload-btn" onClick={() => setIsConfirmingReset(false)}>Cancel</button>
          )}
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!hasFixtures} onClick={clearFixtures}>Clear Rig</button>
        </div>
      </Collapsible>
    </div>
  )
}

/** Fixture-specific Show Director controls for the right DESIGN rail. */
export function LaserDmxShowDirectorControls() {
  const {
    fixtures,
    selectedFixtureId,
    selectedFixtureIds,
    duplicateFixture,
    deleteFixture,
    duplicateSelectedFixtures,
    deleteSelectedFixtures,
    mirrorFixture,
    updateFixture,
  } = useReactStore(useShallow(s => ({
    fixtures:                  s.laserDmxShowDirector.fixtures,
    selectedFixtureId:         s.laserDmxShowDirector.selectedFixtureId,
    selectedFixtureIds:        s.laserDmxShowDirector.selectedFixtureIds,
    duplicateFixture:          s.duplicateLaserDmxShowDirectorFixture,
    deleteFixture:             s.deleteLaserDmxShowDirectorFixture,
    duplicateSelectedFixtures: s.duplicateSelectedLaserDmxShowDirectorFixtures,
    deleteSelectedFixtures:    s.deleteSelectedLaserDmxShowDirectorFixtures,
    mirrorFixture:             s.mirrorLaserDmxShowDirectorFixture,
    updateFixture:             s.updateLaserDmxShowDirectorFixture,
  })))

  const selectedFixture = useMemo(
    () => fixtures.find(fixture => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  )
  const selectedFixtureCount = selectedFixtureIds.length

  const rotateSelected = () => {
    if (!selectedFixture) return
    updateFixture(selectedFixture.id, { rotation: normalizeDegrees(selectedFixture.rotation + 90) })
  }

  return (
    <div className="rv-ctrl-group rv-show-director-component-controls">
      <Collapsible label="Fixture Tools" defaultOpen>
        <div className="rv-show-director-design-actions" aria-label="Selected Show Director fixture actions">
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixtureCount > 1 ? duplicateSelectedFixtures() : selectedFixture && duplicateFixture(selectedFixture.id)}>{selectedFixtureCount > 1 ? 'Duplicate Selected' : 'Duplicate'}</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={rotateSelected}>Rotate 90°</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'horizontal')}>Mirror H</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'vertical')}>Mirror V</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!selectedFixture} onClick={() => selectedFixtureCount > 1 ? deleteSelectedFixtures() : selectedFixture && deleteFixture(selectedFixture.id)}>{selectedFixtureCount > 1 ? 'Delete Selected' : 'Delete'}</button>
        </div>
      </Collapsible>

      <LaserDmxShowDirectorInspector fixture={selectedFixture} />
    </div>
  )
}

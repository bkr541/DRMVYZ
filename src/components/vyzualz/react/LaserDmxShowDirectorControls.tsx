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

export function LaserDmxShowDirectorControls() {
  const {
    fixtures,
    selectedFixtureId,
    settings,
    updateSettings,
    duplicateFixture,
    deleteFixture,
    mirrorFixture,
    updateFixture,
    resetLayout,
    clearFixtures,
    duplicateLayout,
    mirrorLayout,
  } = useReactStore(useShallow(s => ({
    fixtures:          s.laserDmxShowDirector.fixtures,
    selectedFixtureId: s.laserDmxShowDirector.selectedFixtureId,
    settings:          s.laserDmxShowDirector.settings,
    updateSettings:    s.updateLaserDmxShowDirectorSettings,
    duplicateFixture:  s.duplicateLaserDmxShowDirectorFixture,
    deleteFixture:     s.deleteLaserDmxShowDirectorFixture,
    mirrorFixture:     s.mirrorLaserDmxShowDirectorFixture,
    updateFixture:     s.updateLaserDmxShowDirectorFixture,
    resetLayout:       s.resetLaserDmxShowDirectorLayout,
    clearFixtures:     s.clearLaserDmxShowDirectorFixtures,
    duplicateLayout:   s.duplicateLaserDmxShowDirectorLayout,
    mirrorLayout:      s.mirrorLaserDmxShowDirectorLayout,
  })))

  const selectedFixture = useMemo(
    () => fixtures.find(fixture => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  )
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

  const rotateSelected = () => {
    if (!selectedFixture) return
    updateFixture(selectedFixture.id, { rotation: normalizeDegrees(selectedFixture.rotation + 90) })
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
    <div className="rv-ctrl-group rv-show-director-design-panel">
      <CtrlSection label="Show Director Design" />

      <Collapsible label="Canvas" defaultOpen>
        <div className="rv-ctrl-info rv-show-director-tool-mode" role="status">
          <strong>Select / Move</strong>
          <span>Click or drag fixtures directly on the center visualizer stage.</span>
        </div>
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

      <Collapsible label="Fixture Tools" defaultOpen>
        <div className="rv-show-director-design-actions" aria-label="Selected Show Director fixture actions">
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixture && duplicateFixture(selectedFixture.id)}>Duplicate</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={rotateSelected}>Rotate 90°</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'horizontal')}>Mirror H</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'vertical')}>Mirror V</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!selectedFixture} onClick={() => selectedFixture && deleteFixture(selectedFixture.id)}>Delete</button>
        </div>
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

      <LaserDmxShowDirectorInspector fixture={selectedFixture} />
    </div>
  )
}

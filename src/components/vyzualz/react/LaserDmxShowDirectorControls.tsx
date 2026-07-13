import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { LaserDmxShowDirectorInspector } from './LaserDmxShowDirectorInspector'
import type { LaserDmxShowDirectorSettings } from './ReactTypes'
import type { LaserDmxShowDirectorPerformanceFallbackBehavior } from './LaserDmxShowDirectorPerformanceProgram'
import { useLaserDmxShowDirectorPerformanceRuntimeStatus } from './LaserDmxShowDirectorPerformanceRuntimeStatus'

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

function PerformanceProgramControls() {
  const {
    performance,
    setEnabled,
    updateTuning,
    setAudioIntelligenceEnabled,
    setFallbackBehavior,
    setSeed,
  } = useReactStore(useShallow(state => ({
    performance: state.laserDmxShowDirectorPerformance,
    setEnabled: state.setLaserDmxShowDirectorPerformanceEnabled,
    updateTuning: state.updateLaserDmxShowDirectorPerformanceTuning,
    setAudioIntelligenceEnabled: state.setLaserDmxShowDirectorPerformanceAudioIntelligenceEnabled,
    setFallbackBehavior: state.setLaserDmxShowDirectorPerformanceFallbackBehavior,
    setSeed: state.setLaserDmxShowDirectorPerformanceSeed,
  })))
  const status = useLaserDmxShowDirectorPerformanceRuntimeStatus()
  const program = performance.activeProgramDefinition
  const supportsVariation = Boolean(program?.scenes.some(scene => (
    (scene.variations?.length ?? 0) > 0
    || (scene.fourBarVariations?.length ?? 0) > 0
    || (scene.eightBarRecruitment?.length ?? 0) > 0
    || (scene.sixteenBarEvolution?.length ?? 0) > 0
  )))
  const statusReason = status.fallbackOrSuppressionReason
    ?? (!program ? 'Load a Performance Show or authored performance program.' : null)

  return (
    <Collapsible label="Performance Program" defaultOpen>
      <ToggleRow
        label="Performance Program"
        value={performance.enabled}
        onChange={setEnabled}
        disabled={!program}
        description="Disabling reveals the immutable authored rig without deleting the program."
      />
      <SliderRow
        label="Program Intensity"
        value={performance.tuning.intensity}
        onChange={value => updateTuning({ intensity: value })}
        min={0}
        max={2}
        step={0.05}
        disabled={!program}
      />
      <SliderRow
        label="Variation Amount"
        value={performance.tuning.variation}
        onChange={value => updateTuning({ variation: value })}
        min={0}
        max={2}
        step={0.05}
        disabled={!program || !supportsVariation}
      />
      <ToggleRow
        label="Audio Intelligence Response"
        value={performance.audioIntelligenceEnabled}
        onChange={setAudioIntelligenceEnabled}
        disabled={!program}
      />
      <NumberInputRow
        label="Variation Seed"
        value={performance.deterministicSeed}
        onChange={setSeed}
        min={0}
        max={0x7fffffff}
        step={1}
        disabled={!program}
      />
      <SelectRow
        label="Analysis Fallback"
        value={performance.fallbackBehavior}
        onChange={value => setFallbackBehavior(value as LaserDmxShowDirectorPerformanceFallbackBehavior)}
        disabled={!program}
        options={[
          { value: 'authoredRig', label: 'Authored Rig Only' },
          { value: 'basicTiming', label: 'Basic Timing' },
          { value: 'programDefault', label: 'Program Default Scene' },
        ]}
      />
      <div className="rv-show-director-performance-status" aria-live="polite" data-performance-runtime-status>
        <div className="rv-show-director-performance-status__title">Runtime Status</div>
        <dl className="rv-show-director-performance-status__grid">
          <div><dt>Show</dt><dd>{status.performanceShowName ?? program?.name ?? 'None'}</dd></div>
          <div><dt>Section</dt><dd>{status.section}{status.sectionOccurrence > 0 ? ` ${status.sectionOccurrence}` : ''}</dd></div>
          <div><dt>Scene</dt><dd>{status.scene ?? 'Authored rig'}</dd></div>
          <div><dt>Variation</dt><dd>{status.fourBarVariation ?? status.variation ?? 'Base'}</dd></div>
          <div><dt>8-bar Stage</dt><dd>{status.eightBarRecruitmentStage || 0}</dd></div>
          <div><dt>Fixture Groups</dt><dd>{status.activeFixtureGroupCount}</dd></div>
          <div><dt>Beam Demand</dt><dd>{status.estimatedBeamDemand}{status.boundedBeamDemand !== status.estimatedBeamDemand ? ` → ${status.boundedBeamDemand}` : ''}</dd></div>
          <div><dt>Analysis</dt><dd>{status.analysisStatus === 'ready' ? 'Ready' : status.analysisStatus === 'partial' ? 'Partial' : 'Fallback'}</dd></div>
        </dl>
        {status.missingCapabilities.length > 0 && (
          <p className="rv-show-director-performance-status__notice">
            Optional intelligence unavailable: {status.missingCapabilities.join(', ')}
          </p>
        )}
        {statusReason && <p className="rv-show-director-performance-status__notice">{statusReason}</p>}
        {status.beamBudgetWarning && <p className="rv-show-director-performance-status__warning">{status.beamBudgetWarning}</p>}
      </div>
    </Collapsible>
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
      <PerformanceProgramControls />
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

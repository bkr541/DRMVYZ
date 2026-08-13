import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { IconChipButton } from './controls/IconChipButton'
import { LaserDmxShowDirectorInspector } from './LaserDmxShowDirectorInspector'
import {
  LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS,
  type LaserDmxShowDirectorPresentationMode,
  type LaserDmxShowDirectorRendererMode,
  type LaserDmxShowDirectorSettings,
  type LaserDmxShowDirectorWebGLQuality,
} from './ReactTypes'
import type { LaserDmxShowDirectorPerformanceFallbackBehavior } from './LaserDmxShowDirectorPerformanceProgram'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

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
      <Collapsible label="Canvas" defaultOpen>
        <div className="rv-laser-canvas-toggle-grid">
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
        </div>
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
        <IconChipButton onClick={() => updateSettings({ zoom: 1 })}>Fit Stage</IconChipButton>
      </Collapsible>

      <Collapsible label="Presentation & Renderer" defaultOpen>
        <SelectRow
          label="Presentation Mode"
          value={settings.presentationMode}
          onChange={value => updateSettings({ presentationMode: value as LaserDmxShowDirectorPresentationMode })}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'live', label: 'Live' },
            { value: 'capture', label: 'Capture' },
          ]}
          description="Live and Capture remove authoring graphics from the visualizer output."
        />
        <SelectRow
          label="Lighting Renderer"
          value={settings.rendererMode}
          onChange={value => updateSettings({ rendererMode: value as LaserDmxShowDirectorRendererMode })}
          options={LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS.map(option => ({ ...option }))}
          description="WebGL2 receives the resolved scene directly. Unsupported contexts fall back to Canvas2D."
        />
        <SelectRow
          label="WebGL Quality"
          value={settings.webglQuality}
          onChange={value => updateSettings({ webglQuality: value as LaserDmxShowDirectorWebGLQuality })}
          disabled={settings.rendererMode === 'canvas2d'}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'ultra', label: 'Ultra' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <SelectRow
          label="Atmosphere Quality"
          value={settings.webglAtmosphereQuality ?? 'auto'}
          onChange={value => updateSettings({ webglAtmosphereQuality: value as LaserDmxShowDirectorWebGLQuality })}
          disabled={settings.rendererMode === 'canvas2d'}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'ultra', label: 'Ultra' },
            { value: 'auto', label: 'Auto' },
          ]}
          description="Scales only volumetric haze; sharp beam cores remain at the WebGL render resolution."
        />
        <SliderRow
          label="WebGL Render Scale"
          value={settings.webglRenderScale}
          onChange={value => updateSettings({ webglRenderScale: roundTo(value, 2) })}
          min={0.25}
          max={1}
          step={0.05}
          disabled={settings.rendererMode === 'canvas2d'}
        />
      </Collapsible>

      <Collapsible label="Layout" defaultOpen={false}>
        <div className="rv-show-director-design-actions" aria-label="Show Director layout actions">
          <IconChipButton disabled={!hasFixtures} onClick={duplicateLayout}>Duplicate Rig</IconChipButton>
          <IconChipButton disabled={!hasFixtures} onClick={() => mirrorLayout('horizontal')}>Mirror Rig H</IconChipButton>
          <IconChipButton disabled={!hasFixtures} onClick={() => mirrorLayout('vertical')}>Mirror Rig V</IconChipButton>
          <IconChipButton
            className={isConfirmingReset ? 'rv-glyph-upload-btn--danger' : undefined}
            onClick={requestResetLayout}
            aria-pressed={isConfirmingReset}
          >
            {isConfirmingReset ? 'Confirm Reset' : 'Reset Layout'}
          </IconChipButton>
          {isConfirmingReset && (
            <IconChipButton onClick={() => setIsConfirmingReset(false)}>Cancel</IconChipButton>
          )}
          <IconChipButton className="rv-glyph-upload-btn--danger" disabled={!hasFixtures} onClick={clearFixtures}>Clear Rig</IconChipButton>
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
    presentationMode,
  } = useReactStore(useShallow(state => ({
    performance: state.laserDmxShowDirectorPerformance,
    setEnabled: state.setLaserDmxShowDirectorPerformanceEnabled,
    updateTuning: state.updateLaserDmxShowDirectorPerformanceTuning,
    setAudioIntelligenceEnabled: state.setLaserDmxShowDirectorPerformanceAudioIntelligenceEnabled,
    setFallbackBehavior: state.setLaserDmxShowDirectorPerformanceFallbackBehavior,
    setSeed: state.setLaserDmxShowDirectorPerformanceSeed,
    presentationMode: state.laserDmxShowDirector.settings.presentationMode,
  })))
  const program = performance.activeProgramDefinition
  const supportsVariation = Boolean(program?.scenes.some(scene => (
    (scene.variations?.length ?? 0) > 0
    || (scene.fourBarVariations?.length ?? 0) > 0
    || (scene.eightBarRecruitment?.length ?? 0) > 0
    || (scene.sixteenBarEvolution?.length ?? 0) > 0
  )))

  return (
    <Collapsible label="Performance Program" defaultOpen>
      <div className="rv-laser-performance-control-help drm-help-overlay-anchor">
        <ToggleRow
          label="Performance Program"
          value={performance.enabled}
          onChange={setEnabled}
          disabled={!program}
          description="Disabling reveals the immutable authored rig without deleting the program."
        />
        <HelpInfoTrigger
          helpId="react.laserDmx.showDirector.performanceProgram.enabled"
          currentValue={performance.enabled ? 'On' : 'Off'}
          currentValueLabel="Status"
          currentValueTone={performance.enabled ? 'accent' : 'default'}
          placement="left"
        />
      </div>
      <div className="rv-laser-performance-control-help drm-help-overlay-anchor">
        <SliderRow
          label="Program Intensity"
          value={performance.tuning.intensity}
          onChange={value => updateTuning({ intensity: value })}
          min={0}
          max={2}
          step={0.05}
          disabled={!program}
        />
        <HelpInfoTrigger
          helpId="react.laserDmx.showDirector.performanceProgram.programIntensity"
          currentValue={`${performance.tuning.intensity.toFixed(2)}×`}
          placement="left"
        />
      </div>
      <div className="rv-laser-performance-control-help drm-help-overlay-anchor">
        <SliderRow
          label="Variation Amount"
          value={performance.tuning.variation}
          onChange={value => updateTuning({ variation: value })}
          min={0}
          max={2}
          step={0.05}
          disabled={!program || !supportsVariation}
        />
        <HelpInfoTrigger
          helpId="react.laserDmx.showDirector.performanceProgram.variationAmount"
          currentValue={`${performance.tuning.variation.toFixed(2)}×`}
          placement="left"
        />
      </div>
      <div className="rv-laser-performance-control-help drm-help-overlay-anchor">
        <ToggleRow
          label="Audio Intelligence Response"
          value={performance.audioIntelligenceEnabled}
          onChange={setAudioIntelligenceEnabled}
          disabled={!program}
        />
        <HelpInfoTrigger
          helpId="react.laserDmx.showDirector.performanceProgram.audioIntelligenceResponse"
          currentValue={performance.audioIntelligenceEnabled ? 'On' : 'Off'}
          currentValueLabel="Status"
          currentValueTone={performance.audioIntelligenceEnabled ? 'accent' : 'default'}
          placement="left"
        />
      </div>
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
          <IconChipButton disabled={!selectedFixture} onClick={() => selectedFixtureCount > 1 ? duplicateSelectedFixtures() : selectedFixture && duplicateFixture(selectedFixture.id)}>{selectedFixtureCount > 1 ? 'Duplicate Selected' : 'Duplicate'}</IconChipButton>
          <IconChipButton disabled={!selectedFixture} onClick={rotateSelected}>Rotate 90°</IconChipButton>
          <IconChipButton disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'horizontal')}>Mirror H</IconChipButton>
          <IconChipButton disabled={!selectedFixture} onClick={() => selectedFixture && mirrorFixture(selectedFixture.id, 'vertical')}>Mirror V</IconChipButton>
          <IconChipButton className="rv-glyph-upload-btn--danger" disabled={!selectedFixture} onClick={() => selectedFixtureCount > 1 ? deleteSelectedFixtures() : selectedFixture && deleteFixture(selectedFixture.id)}>{selectedFixtureCount > 1 ? 'Delete Selected' : 'Delete'}</IconChipButton>
        </div>
      </Collapsible>

      <LaserDmxShowDirectorInspector fixture={selectedFixture} />
    </div>
  )
}

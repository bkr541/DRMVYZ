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
import { useLaserDmxShowDirectorPerformanceRuntimeStatus } from './LaserDmxShowDirectorPerformanceRuntimeStatus'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'
import { validateLaserDmxShowDirectorPresetRealism } from './LaserDmxShowDirectorPresetRealismValidation'
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
  const status = useLaserDmxShowDirectorPerformanceRuntimeStatus()
  const program = performance.activeProgramDefinition
  const activeCue = useMemo(() => {
    if (!program?.laserProgramming || !status.activePrimaryCueId) return null
    return program.laserProgramming.cueStacks
      .flatMap(stack => stack.cues)
      .find(cue => cue.id === status.activePrimaryCueId) ?? null
  }, [program, status.activePrimaryCueId])
  const activeMacro = useMemo(() => {
    if (!program?.laserProgramming || !activeCue) return null
    return program.laserProgramming.macros.find(macro => macro.id === activeCue.macroId) ?? null
  }, [activeCue, program])
  const realismIssues = useMemo(
    () => program ? validateLaserDmxShowDirectorPresetRealism(program) : [],
    [program],
  )
  const cueLifecycle = activeCue?.lifecycle
  const cueCommand = activeCue?.command ?? activeMacro?.defaultCommand
  const cueOwnership = activeCue?.ownership
  const fixtureMovement = cueOwnership?.parameters.filter(parameter => parameter === 'pan' || parameter === 'tilt') ?? []
  const patternMovement = cueOwnership?.parameters.filter(parameter => parameter === 'patternPhase' || parameter === 'patternScale' || parameter === 'patternPosition') ?? []
  const targetGroups = activeCue?.fixtureGroupAssignmentIds?.map(id => id.split(':').slice(-1)[0] ?? id) ?? []
  const commandStart = cueCommand?.startState ? JSON.stringify(cueCommand.startState) : 'Authored frame'
  const commandDestination = cueCommand?.destinationState ? JSON.stringify(cueCommand.destinationState) : cueCommand?.rotation ? `${cueCommand.rotation.turnCount ?? 0} turn` : 'Hold / release'
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
      <div className="rv-show-director-performance-status" aria-live="polite" data-performance-runtime-status>
        <div className="rv-show-director-performance-status__title">Runtime + Finite Cue Inspector</div>
        <dl className="rv-show-director-performance-status__grid">
          <div><dt>Show</dt><dd>{status.performanceShowName ?? program?.name ?? 'None'}</dd></div>
          <div><dt>Section</dt><dd>{status.section}{status.sectionOccurrence > 0 ? ` ${status.sectionOccurrence}` : ''}</dd></div>
          <div><dt>Scene</dt><dd>{status.scene ?? 'Authored rig'}</dd></div>
          <div><dt>Variation</dt><dd>{status.fourBarVariation ?? status.variation ?? 'Base'}</dd></div>
          <div><dt>8-bar Stage</dt><dd>{status.eightBarRecruitmentStage || 0}</dd></div>
          {status.effectCountReport?.mode === 'ledGrid' ? (
            <>
              <div><dt>Active LEDs</dt><dd>{status.effectCountReport.activeLedFixtureCount}</dd></div>
              <div><dt>Rows / Columns</dt><dd>{status.effectCountReport.activeRowCount} / {status.effectCountReport.activeColumnCount}</dd></div>
              <div><dt>Colors</dt><dd>{status.effectCountReport.simultaneousColorCount}</dd></div>
              <div><dt>Brightness Min / Avg / Max</dt><dd>{status.effectCountReport.brightnessHierarchy.minimum} / {status.effectCountReport.brightnessHierarchy.average} / {status.effectCountReport.brightnessHierarchy.maximum}</dd></div>
              <div><dt>Impact Duration</dt><dd>{status.effectCountReport.impactDurationBeats} beat</dd></div>
            </>
          ) : status.effectCountReport?.mode === 'movingHead' ? (
            <>
              <div><dt>Active Heads</dt><dd>{status.effectCountReport.activeMovingHeadCount}</dd></div>
              <div><dt>Movement Banks</dt><dd>{status.effectCountReport.activeMovementBankCount}</dd></div>
              <div><dt>Movement Spread</dt><dd>{status.effectCountReport.representativeMovementSpread}°</dd></div>
              <div><dt>Mirrored Participation</dt><dd>{status.effectCountReport.mirroredPairParticipation}</dd></div>
              <div><dt>Impact Duration</dt><dd>{status.effectCountReport.impactDurationBeats} beat</dd></div>
              <div><dt>Head Beam Count</dt><dd>{status.effectCountReport.legitimateBeamCount ?? 0}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Fixture Groups</dt><dd>{status.activeFixtureGroupCount}</dd></div>
              <div><dt>Beam Demand</dt><dd>{status.estimatedBeamDemand}{status.boundedBeamDemand !== status.estimatedBeamDemand ? ` → ${status.boundedBeamDemand}` : ''}</dd></div>
            </>
          )}
          <div><dt>Analysis</dt><dd>{status.analysisStatus === 'ready' ? 'Ready' : status.analysisStatus === 'partial' ? 'Partial' : 'Fallback'}</dd></div>
          {presentationMode !== 'capture' && (
            <>
              <div><dt>Primary Cue</dt><dd>{status.activePrimaryCueId ?? 'Inactive'}</dd></div>
              <div><dt>Accent Cues</dt><dd>{status.activeAccentCueIds.length ? status.activeAccentCueIds.join(', ') : 'None'}</dd></div>
              <div><dt>Macro</dt><dd>{status.activeMacroName ?? status.activeMacroId ?? 'Compatibility path'}</dd></div>
              <div><dt>Cue Start / Remaining</dt><dd>{status.cueStartBeat.toFixed(2)} / {status.cueRemainingBeats.toFixed(2)} beats</dd></div>
              <div><dt>Pattern Frame</dt><dd>{status.stablePatternFrameId ?? 'Inactive'}</dd></div>
              <div><dt>Frame Revision</dt><dd>{status.patternFrameRevisionCount}</dd></div>
              <div><dt>Transition</dt><dd>{status.macroTransitionState}</dd></div>
              <div><dt>Relationships</dt><dd>{status.fixtureGroupRelationships.length ? status.fixtureGroupRelationships.join(', ') : 'Explicitly independent'}</dd></div>
              <div><dt>Audio Modulation</dt><dd>{Object.entries(status.audioModulationValues).map(([key, value]) => `${key} ${value.toFixed(2)}`).join(', ') || 'None'}</dd></div>
              <div><dt>Geometry Rebuilds</dt><dd>{status.geometryRebuildCount}</dd></div>
              <div><dt>Pattern Cache</dt><dd>{status.patternFrameCacheHits} hits / {status.patternFrameCacheMisses} misses</dd></div>
              <div><dt>Ray Slots</dt><dd>{status.raySlotCount}</dd></div>
              <div><dt>Group Sync</dt><dd>{status.fixtureGroupSynchronizationStatus}</dd></div>
              <div><dt>Topology / Cue</dt><dd>{status.topologyChangesPerCue}</dd></div>
              <div><dt>Modulation Bounds</dt><dd>{status.audioModulationBoundaries.join(', ') || 'None'}</dd></div>
              <div><dt>Topology Changes</dt><dd>{status.unexpectedTopologyChanges}</dd></div>
              <div><dt>Compatibility</dt><dd>{status.programmingCompatibilitySource}</dd></div>
              <div><dt>Cue Trigger</dt><dd>{activeCue?.triggerSource ?? 'Inactive'}</dd></div>
              <div><dt>Quantization</dt><dd>{activeCue?.startQuantize ?? status.currentQuantizationBoundary ?? 'Inactive'}</dd></div>
              <div><dt>Lifecycle</dt><dd>{status.cueLifecycleState} · {(status.cueLifecycleProgress * 100).toFixed(0)}%</dd></div>
              <div><dt>Attack / Movement</dt><dd>{cueLifecycle ? `${cueLifecycle.attackBeats.toFixed(2)} / ${cueLifecycle.movementBeats.toFixed(2)} beats` : 'Inactive'}</dd></div>
              <div><dt>Hold / Release</dt><dd>{cueLifecycle ? `${cueLifecycle.holdBeats.toFixed(2)} / ${cueLifecycle.releaseBeats.toFixed(2)} beats` : 'Inactive'}</dd></div>
              <div><dt>Blackout</dt><dd>{cueLifecycle ? `${cueLifecycle.blackoutBeats.toFixed(2)} beats · ${cueLifecycle.blackoutAfterCompletion ? 'after completion' : 'manual'}` : 'Inactive'}</dd></div>
              <div><dt>Start → Destination</dt><dd>{activeCue ? `${commandStart} → ${commandDestination}` : 'Inactive'}</dd></div>
              <div><dt>Rotation</dt><dd>{cueCommand?.rotation ? `${cueCommand.rotation.target} · ${cueCommand.rotation.turnCount ?? 0} turn · ${cueCommand.rotation.durationBeats.toFixed(2)} beats` : 'None'}</dd></div>
              <div><dt>Repeat / Maximum</dt><dd>{cueCommand ? `${cueCommand.loopMode === 'bounded' ? `${cueCommand.repeatCount ?? 1}×` : 'No loop'} · ${cueLifecycle?.maximumRunBeats.toFixed(2) ?? cueCommand.durationBeats.toFixed(2)} beats max` : 'Inactive'}</dd></div>
              <div><dt>Target Groups</dt><dd>{targetGroups.join(', ') || 'None'}</dd></div>
              <div><dt>Parameter Ownership</dt><dd>{cueOwnership?.parameters.join(', ') || status.ownedParameters.join(', ') || 'None'}</dd></div>
              <div><dt>Completion</dt><dd>{cueLifecycle ? `${cueLifecycle.completionBehavior} · release ownership ${cueOwnership?.releaseOnCompletion === false ? 'no' : 'yes'}` : status.completionReason}</dd></div>
              <div><dt>Fixture Movement</dt><dd>{fixtureMovement.join(', ') || 'None'}</dd></div>
              <div><dt>Scanner-Frame Movement</dt><dd>{patternMovement.join(', ') || 'Stable frame'}</dd></div>
              <div><dt>Pattern Rotation</dt><dd>{cueCommand?.rotation?.target === 'patternRotation' || cueCommand?.rotation?.target === 'patternPhase' ? 'Finite' : 'None'}</dd></div>
              <div><dt>Pattern Scale</dt><dd>{patternMovement.includes('patternScale') ? 'Finite cue-owned' : 'Held'}</dd></div>
              <div><dt>Fixture Intensity</dt><dd>{cueOwnership?.parameters.includes('intensity') ? 'Cue-owned' : 'Unchanged'}</dd></div>
              <div><dt>Output / Shutter</dt><dd>{activeCue?.shutterClosed || activeCue?.blackout ? 'Closed' : status.cueLifecycleState === 'blackout' ? 'Closed' : 'Open while active'}</dd></div>
            </>
          )}
        </dl>
        {status.missingCapabilities.length > 0 && (
          <p className="rv-show-director-performance-status__notice">
            Optional intelligence unavailable: {status.missingCapabilities.join(', ')}
          </p>
        )}
        {statusReason && <p className="rv-show-director-performance-status__notice">{statusReason}</p>}
        {status.beamBudgetWarning && <p className="rv-show-director-performance-status__warning">{status.beamBudgetWarning}</p>}
        {presentationMode !== 'capture' && status.suppressedAudioGeometryMappings.length > 0 && (
          <p className="rv-show-director-performance-status__warning">
            Blocked audio geometry mappings: {status.suppressedAudioGeometryMappings.join(', ')}
          </p>
        )}
        {presentationMode !== 'capture' && status.conflictingOverrides.length > 0 && (
          <p className="rv-show-director-performance-status__warning">
            Macro authority replaced conflicting overrides: {status.conflictingOverrides.join(', ')}
          </p>
        )}
        {presentationMode !== 'capture' && status.programmingWarnings.map((warning, index) => (
          <p key={`${warning}-${index}`} className="rv-show-director-performance-status__warning">{warning}</p>
        ))}
        {presentationMode !== 'capture' && realismIssues.map((warning, index) => (
          <p key={`${warning.code}-${warning.sourceId ?? index}`} className="rv-show-director-performance-status__warning">
            {warning.severity === 'error' ? 'Realism error' : 'Realism warning'}: {warning.message}
          </p>
        ))}
      </div>
      <SharedPerformanceDiagnosticsPanel engine="laserDmx" label="Shared Core Diagnostics" />
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

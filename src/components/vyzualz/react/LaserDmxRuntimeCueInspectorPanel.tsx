import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible } from './ReactControlRows'
import { useLaserDmxShowDirectorPerformanceRuntimeStatus } from './LaserDmxShowDirectorPerformanceRuntimeStatus'
import { validateLaserDmxShowDirectorPresetRealism } from './LaserDmxShowDirectorPresetRealismValidation'

function KvRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vz-mi-kv-row">
      <span className="vz-mi-kv-label">{label}</span>
      <span className="vz-mi-kv-val">{value}</span>
    </div>
  )
}

/** Runtime + Finite Cue Inspector, restyled to match Audio Intelligence's key/value readout style. */
export function LaserDmxRuntimeCueInspectorPanel() {
  const { performance, presentationMode } = useReactStore(useShallow(state => ({
    performance: state.laserDmxShowDirectorPerformance,
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
  const statusReason = status.fallbackOrSuppressionReason
    ?? (!program ? 'Load a Performance Show or authored performance program.' : null)

  return (
    <Collapsible label="Runtime + Finite Cue Inspector" defaultOpen={false}>
      <div aria-live="polite" data-performance-runtime-status>
        <KvRow label="Show" value={status.performanceShowName ?? program?.name ?? 'None'} />
        <KvRow label="Section" value={`${status.section}${status.sectionOccurrence > 0 ? ` ${status.sectionOccurrence}` : ''}`} />
        <KvRow label="Scene" value={status.scene ?? 'Authored rig'} />
        <KvRow label="Variation" value={status.fourBarVariation ?? status.variation ?? 'Base'} />
        <KvRow label="8-bar Stage" value={status.eightBarRecruitmentStage || 0} />
        {status.effectCountReport?.mode === 'ledGrid' ? (
          <>
            <KvRow label="Active LEDs" value={status.effectCountReport.activeLedFixtureCount} />
            <KvRow label="Rows / Columns" value={`${status.effectCountReport.activeRowCount} / ${status.effectCountReport.activeColumnCount}`} />
            <KvRow label="Colors" value={status.effectCountReport.simultaneousColorCount} />
            <KvRow label="Brightness Min / Avg / Max" value={`${status.effectCountReport.brightnessHierarchy.minimum} / ${status.effectCountReport.brightnessHierarchy.average} / ${status.effectCountReport.brightnessHierarchy.maximum}`} />
            <KvRow label="Impact Duration" value={`${status.effectCountReport.impactDurationBeats} beat`} />
          </>
        ) : status.effectCountReport?.mode === 'movingHead' ? (
          <>
            <KvRow label="Active Heads" value={status.effectCountReport.activeMovingHeadCount} />
            <KvRow label="Movement Banks" value={status.effectCountReport.activeMovementBankCount} />
            <KvRow label="Movement Spread" value={`${status.effectCountReport.representativeMovementSpread}°`} />
            <KvRow label="Mirrored Participation" value={status.effectCountReport.mirroredPairParticipation} />
            <KvRow label="Impact Duration" value={`${status.effectCountReport.impactDurationBeats} beat`} />
            <KvRow label="Head Beam Count" value={status.effectCountReport.legitimateBeamCount ?? 0} />
          </>
        ) : (
          <>
            <KvRow label="Fixture Groups" value={status.activeFixtureGroupCount} />
            <KvRow label="Beam Demand" value={`${status.estimatedBeamDemand}${status.boundedBeamDemand !== status.estimatedBeamDemand ? ` → ${status.boundedBeamDemand}` : ''}`} />
          </>
        )}
        <KvRow label="Analysis" value={status.analysisStatus === 'ready' ? 'Ready' : status.analysisStatus === 'partial' ? 'Partial' : 'Fallback'} />
        {presentationMode !== 'capture' && (
          <>
            <KvRow label="Primary Cue" value={status.activePrimaryCueId ?? 'Inactive'} />
            <KvRow label="Accent Cues" value={status.activeAccentCueIds.length ? status.activeAccentCueIds.join(', ') : 'None'} />
            <KvRow label="Macro" value={status.activeMacroName ?? status.activeMacroId ?? 'Compatibility path'} />
            <KvRow label="Cue Start / Remaining" value={`${status.cueStartBeat.toFixed(2)} / ${status.cueRemainingBeats.toFixed(2)} beats`} />
            <KvRow label="Pattern Frame" value={status.stablePatternFrameId ?? 'Inactive'} />
            <KvRow label="Frame Revision" value={status.patternFrameRevisionCount} />
            <KvRow label="Transition" value={status.macroTransitionState} />
            <KvRow label="Relationships" value={status.fixtureGroupRelationships.length ? status.fixtureGroupRelationships.join(', ') : 'Explicitly independent'} />
            <KvRow label="Audio Modulation" value={Object.entries(status.audioModulationValues).map(([key, value]) => `${key} ${value.toFixed(2)}`).join(', ') || 'None'} />
            <KvRow label="Geometry Rebuilds" value={status.geometryRebuildCount} />
            <KvRow label="Pattern Cache" value={`${status.patternFrameCacheHits} hits / ${status.patternFrameCacheMisses} misses`} />
            <KvRow label="Ray Slots" value={status.raySlotCount} />
            <KvRow label="Group Sync" value={status.fixtureGroupSynchronizationStatus} />
            <KvRow label="Topology / Cue" value={status.topologyChangesPerCue} />
            <KvRow label="Modulation Bounds" value={status.audioModulationBoundaries.join(', ') || 'None'} />
            <KvRow label="Topology Changes" value={status.unexpectedTopologyChanges} />
            <KvRow label="Compatibility" value={status.programmingCompatibilitySource} />
            <KvRow label="Cue Trigger" value={activeCue?.triggerSource ?? 'Inactive'} />
            <KvRow label="Quantization" value={activeCue?.startQuantize ?? status.currentQuantizationBoundary ?? 'Inactive'} />
            <KvRow label="Lifecycle" value={`${status.cueLifecycleState} · ${(status.cueLifecycleProgress * 100).toFixed(0)}%`} />
            <KvRow label="Attack / Movement" value={cueLifecycle ? `${cueLifecycle.attackBeats.toFixed(2)} / ${cueLifecycle.movementBeats.toFixed(2)} beats` : 'Inactive'} />
            <KvRow label="Hold / Release" value={cueLifecycle ? `${cueLifecycle.holdBeats.toFixed(2)} / ${cueLifecycle.releaseBeats.toFixed(2)} beats` : 'Inactive'} />
            <KvRow label="Blackout" value={cueLifecycle ? `${cueLifecycle.blackoutBeats.toFixed(2)} beats · ${cueLifecycle.blackoutAfterCompletion ? 'after completion' : 'manual'}` : 'Inactive'} />
            <KvRow label="Start → Destination" value={activeCue ? `${commandStart} → ${commandDestination}` : 'Inactive'} />
            <KvRow label="Rotation" value={cueCommand?.rotation ? `${cueCommand.rotation.target} · ${cueCommand.rotation.turnCount ?? 0} turn · ${cueCommand.rotation.durationBeats.toFixed(2)} beats` : 'None'} />
            <KvRow label="Repeat / Maximum" value={cueCommand ? `${cueCommand.loopMode === 'bounded' ? `${cueCommand.repeatCount ?? 1}×` : 'No loop'} · ${cueLifecycle?.maximumRunBeats.toFixed(2) ?? cueCommand.durationBeats.toFixed(2)} beats max` : 'Inactive'} />
            <KvRow label="Target Groups" value={targetGroups.join(', ') || 'None'} />
            <KvRow label="Parameter Ownership" value={cueOwnership?.parameters.join(', ') || status.ownedParameters.join(', ') || 'None'} />
            <KvRow label="Completion" value={cueLifecycle ? `${cueLifecycle.completionBehavior} · release ownership ${cueOwnership?.releaseOnCompletion === false ? 'no' : 'yes'}` : status.completionReason} />
            <KvRow label="Fixture Movement" value={fixtureMovement.join(', ') || 'None'} />
            <KvRow label="Scanner-Frame Movement" value={patternMovement.join(', ') || 'Stable frame'} />
            <KvRow label="Pattern Rotation" value={cueCommand?.rotation?.target === 'patternRotation' || cueCommand?.rotation?.target === 'patternPhase' ? 'Finite' : 'None'} />
            <KvRow label="Pattern Scale" value={patternMovement.includes('patternScale') ? 'Finite cue-owned' : 'Held'} />
            <KvRow label="Fixture Intensity" value={cueOwnership?.parameters.includes('intensity') ? 'Cue-owned' : 'Unchanged'} />
            <KvRow label="Output / Shutter" value={activeCue?.shutterClosed || activeCue?.blackout ? 'Closed' : status.cueLifecycleState === 'blackout' ? 'Closed' : 'Open while active'} />
          </>
        )}
      </div>
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
    </Collapsible>
  )
}

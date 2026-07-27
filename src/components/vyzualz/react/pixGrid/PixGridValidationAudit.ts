import type { ReactPreset } from '../ReactTypes'
import { PixGridAssignmentCompiler } from './PixGridAssignmentCompiler'
import { getPixGridAudioIntelligenceSource } from './PixGridAudioIntelligenceRegistry'
import type { PixGridRouteActivity } from './PixGridAudioRouting'
import { compilePixGridGroupMask, pixGridMaskHasCell } from './PixGridGroups'
import { inspectPixGridGroupTarget, type PixGridGroupTargetStatus } from './PixGridCanonicalGraph'
import { PIX_GRID_PERFORMANCE_PROGRAM_BY_ID } from './PixGridPerformancePrograms'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'
import { PixGridPerformanceProgramCompiler, validatePixGridPerformanceProgram } from './PixGridPerformanceProgramCompiler'
import { isPixGridBassReactivitySource } from './PixGridRuntimeControls'
import type { PixGridUnifiedRuntimeDiagnostics } from './PixGridUnifiedPerformanceRuntime'
import {
  PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS,
  isPixGridAudioAssignmentEffective,
} from './PixGridStateMigration'
import {
  PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
  PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
  PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridAudioFrame,
  type PixGridGroup,
  type PixGridReactionAssignment,
  type PixGridReactionSource,
  type PixGridReactionTargetScope,
  type PixGridState,
} from './PixGridTypes'

export type PixGridValidationSeverity = 'error' | 'warning'

export interface PixGridValidationIssue {
  severity: PixGridValidationSeverity
  code: string
  message: string
  path: string
  remediation: string
}

export interface PixGridRendererSemanticPlan {
  sceneId: string | null
  visibleLayerIds: readonly string[]
  activeGroupIds: readonly string[]
  routeEnvelopeValues: Readonly<Record<string, number>>
  affectedCellIds: readonly number[]
  paletteIntent: readonly string[]
  frameSelection: Readonly<Record<string, number>>
  motionMultiplier: number
  bassReactivityGain: number
  sectionType: string | null
  phraseIndex: number
}

export interface PixGridValidationOptions {
  builtInPresetId?: string | null
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>
  canvasPlan?: PixGridRendererSemanticPlan | null
  gpuPlan?: PixGridRendererSemanticPlan | null
}

export interface PixGridValidationReport {
  valid: boolean
  errors: readonly PixGridValidationIssue[]
  warnings: readonly PixGridValidationIssue[]
  issues: readonly PixGridValidationIssue[]
  summary: string
}

export interface PixGridGroupInspection {
  groupId: string
  name: string
  source: PixGridGroup['source']
  maskKind: PixGridGroup['mask']['kind']
  sourceLayerIds: readonly string[]
  missingLayerIds: readonly string[]
  maskBounds: { x: number; y: number; width: number; height: number } | null
  compiledCellCount: number
  maskValid: boolean
  maskStatus: 'valid' | 'invalid' | 'pending-source'
  activeRouteIds: readonly string[]
  reactionIntensity: number
  overlappingGroupIds: readonly string[]
  renderedContribution: number
  visibleCellCount: number
  effectiveRenderedCellCount: number
  targetStatus: PixGridGroupTargetStatus
}

interface AssignmentLocation {
  assignment: PixGridReactionAssignment
  path: string
  ownerGroupId: string | null
  defaultScope: PixGridReactionTargetScope
}

const COMMON_LIVE_SOURCES = new Set<PixGridReactionSource>(['kick', 'snare', 'bass', 'beat', 'energy'])
const AUTONOMOUS_ANIMATION_MODES = new Set([
  'horizontalScroll', 'verticalScroll', 'rotation', 'pulse', 'bounce', 'wave', 'revealRows', 'revealColumns',
  'checkerAlternate', 'paletteCycle', 'frameSequence',
])

function issue(
  severity: PixGridValidationSeverity,
  code: string,
  message: string,
  path: string,
  remediation: string,
): PixGridValidationIssue {
  return { severity, code, message, path, remediation }
}

function assignmentLocations(state: PixGridState): AssignmentLocation[] {
  const routes: AssignmentLocation[] = state.audioAssignments.map((assignment, index) => ({
    assignment,
    path: `audioAssignments[${index}]`,
    ownerGroupId: null,
    defaultScope: 'output' as const,
  }))
  for (const [groupIndex, group] of state.groups.entries()) {
    group.reactions.forEach((assignment, assignmentIndex) => routes.push({
      assignment,
      path: `groups[${groupIndex}].reactions[${assignmentIndex}]`,
      ownerGroupId: group.id,
      defaultScope: 'group',
    }))
  }
  return routes
}

function targetExists(state: PixGridState, location: AssignmentLocation): boolean {
  const scope = location.assignment.targetScope ?? location.defaultScope
  const targetId = location.assignment.targetId ?? ((scope === 'group' || scope === 'pixels') ? location.ownerGroupId : null)
  if (!targetId) return true
  if (scope === 'scene') return state.scenes.some(scene => scene.id === targetId)
  if (scope === 'layer' || scope === 'animation') return targetId == null || state.layers.some(layer => layer.id === targetId)
  if (scope === 'group' || scope === 'pixels') return state.groups.some(group => group.id === targetId)
  return true
}

function finiteInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function semanticPlanSignature(plan: PixGridRendererSemanticPlan): string {
  return JSON.stringify({
    ...plan,
    visibleLayerIds: [...plan.visibleLayerIds].sort(),
    activeGroupIds: [...plan.activeGroupIds].sort(),
    affectedCellIds: [...plan.affectedCellIds].sort((a, b) => a - b),
    paletteIntent: [...plan.paletteIntent],
    routeEnvelopeValues: Object.fromEntries(Object.entries(plan.routeEnvelopeValues).sort(([a], [b]) => a.localeCompare(b))),
    frameSelection: Object.fromEntries(Object.entries(plan.frameSelection).sort(([a], [b]) => a.localeCompare(b))),
  })
}

export function comparePixGridRendererSemanticPlans(
  canvas: PixGridRendererSemanticPlan,
  gpu: PixGridRendererSemanticPlan,
): PixGridValidationIssue[] {
  if (semanticPlanSignature(canvas) === semanticPlanSignature(gpu)) return []
  return [issue(
    'error',
    'renderer-action-plan-mismatch',
    'Canvas and GPU resolved different PixGrid semantics for the same frame.',
    'renderers',
    'Keep audio routing in the shared runtime and pass the same resolved scene, routes, masks, controls, and musical position to both renderers.',
  )]
}


export function buildPixGridRendererSemanticPlan(
  state: PixGridState,
  audioFrame: PixGridAudioFrame,
  runtime: PixGridUnifiedRuntimeDiagnostics,
): PixGridRendererSemanticPlan {
  const scene = state.scenes.find(candidate => candidate.id === runtime.currentSceneId)
    ?? state.scenes.find(candidate => candidate.id === state.selectedSceneId)
    ?? state.scenes[0]
    ?? null
  const sceneLayerIds = new Set(scene?.layerIds ?? state.layers.map(layer => layer.id))
  const visibleLayerIds = state.layers
    .filter(layer => layer.visible && layer.opacity > 0.001 && sceneLayerIds.has(layer.id))
    .sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id))
    .map(layer => layer.id)
  const activeRoutes = runtime.routeActivity.filter(route => route.state === 'active' || route.state === 'fallback')
  const activeGroupIds = [...new Set(activeRoutes.flatMap(route => route.affectedGroupIds))].sort()
  const affectedCells = new Set<number>()
  const wholeFrameActive = activeRoutes.some(route => route.targetScope !== 'group' && route.targetScope !== 'pixels')
  if (wholeFrameActive) {
    for (let cell = 0; cell < state.matrixWidth * state.matrixHeight; cell += 1) affectedCells.add(cell)
  } else {
    for (const groupId of activeGroupIds) {
      const group = state.groups.find(candidate => candidate.id === groupId)
      if (!group) continue
      const mask = compilePixGridGroupMask(group, state.matrixWidth, state.matrixHeight)
      for (let cell = 0; cell < state.matrixWidth * state.matrixHeight; cell += 1) {
        if (pixGridMaskHasCell(mask.bits, cell)) affectedCells.add(cell)
      }
    }
  }
  const paletteTargets = new Set(['paletteRole', 'paletteIndex', 'paletteCycle', 'hueOffset', 'highlightColor', 'backgroundColor', 'color', 'saturation', 'invert', 'posterize'])
  const paletteIntent = activeRoutes
    .filter(route => paletteTargets.has(route.target))
    .map(route => `${route.routeId}:${route.target}:${route.effectiveAmount.toFixed(6)}`)
  const frameSelection = Object.fromEntries(activeRoutes
    .filter(route => route.target === 'frameIndex' || route.target === 'frameAdvance')
    .map(route => [route.routeId, route.effectiveAmount]))
  return {
    sceneId: scene?.id ?? null,
    visibleLayerIds,
    activeGroupIds,
    routeEnvelopeValues: Object.fromEntries(activeRoutes.map(route => [route.routeId, route.effectiveAmount])),
    affectedCellIds: [...affectedCells].sort((left, right) => left - right),
    paletteIntent,
    frameSelection,
    motionMultiplier: audioFrame.motionMultiplier ?? runtime.effectiveMotionMultiplier,
    bassReactivityGain: audioFrame.bassReactivityGain ?? runtime.effectiveBassReactivityGain,
    sectionType: audioFrame.sectionType ?? runtime.sectionName ?? null,
    phraseIndex: audioFrame.phraseIndex ?? 0,
  }
}

export function inspectPixGridGroups(
  state: PixGridState,
  routeActivity: readonly PixGridRouteActivity[] = [],
): PixGridGroupInspection[] {
  const masks = state.groups.map(group => ({
    group,
    mask: compilePixGridGroupMask(group, state.matrixWidth, state.matrixHeight),
  }))
  return masks.map(({ group, mask }, index) => {
    const overlaps: string[] = []
    for (let otherIndex = 0; otherIndex < masks.length; otherIndex += 1) {
      if (otherIndex === index) continue
      const other = masks[otherIndex]!
      const words = Math.min(mask.bits.length, other.mask.bits.length)
      let intersects = false
      for (let word = 0; word < words; word += 1) {
        if ((mask.bits[word]! & other.mask.bits[word]!) !== 0) {
          intersects = true
          break
        }
      }
      if (intersects) overlaps.push(other.group.id)
    }
    const activeRoutes = routeActivity.filter(route => route.affectedGroupIds.includes(group.id) && (route.state === 'active' || route.state === 'fallback'))
    const intensity = activeRoutes.reduce((maximum, route) => Math.max(maximum, route.effectiveAmount), 0)
    const targetInspection = inspectPixGridGroupTarget(state, group)
    const sourceLayerIds = [...targetInspection.sourceLayerIds]
    const missingLayerIds = sourceLayerIds.filter(layerId => !state.layers.some(layer => layer.id === layerId))
    const requiresSource = ['layerAlpha', 'colorRange', 'luminanceRange', 'connectedRegion', 'svgMetadata'].includes(group.mask.kind)
    const maskStatus: PixGridGroupInspection['maskStatus'] = targetInspection.usable
      ? requiresSource && mask.cellCount === 0 ? 'pending-source' : 'valid'
      : 'invalid'
    return {
      groupId: group.id,
      name: group.name,
      source: group.source,
      maskKind: group.mask.kind,
      sourceLayerIds,
      missingLayerIds,
      maskBounds: mask.bounds ? { ...mask.bounds } : null,
      compiledCellCount: mask.cellCount,
      maskValid: maskStatus !== 'invalid',
      maskStatus,
      activeRouteIds: activeRoutes.map(route => route.routeId).sort(),
      reactionIntensity: intensity,
      overlappingGroupIds: overlaps.sort(),
      renderedContribution: (mask.cellCount || targetInspection.compiledCellCount) * intensity,
      visibleCellCount: targetInspection.visibleLayerCount > 0 ? (mask.cellCount || targetInspection.compiledCellCount) : 0,
      effectiveRenderedCellCount: targetInspection.usable ? (mask.cellCount || targetInspection.compiledCellCount) : 0,
      targetStatus: targetInspection.status,
    }
  })
}

export function validatePixGridState(
  state: PixGridState,
  options: PixGridValidationOptions = {},
): PixGridValidationReport {
  const issues: PixGridValidationIssue[] = []
  const builtIn = Boolean(options.builtInPresetId ?? (state.configuration.origin === 'builtInPreset' ? state.selectedPresetId : null))
  const severityForWeakConfig: PixGridValidationSeverity = builtIn ? 'error' : 'warning'
  const locations = assignmentLocations(state)
  const compiler = new PixGridAssignmentCompiler()
  const groupIdCounts = new Map<string, number>()
  const assignmentIdCounts = new Map<string, number>()

  for (const group of state.groups) groupIdCounts.set(group.id, (groupIdCounts.get(group.id) ?? 0) + 1)
  for (const location of locations) assignmentIdCounts.set(location.assignment.id, (assignmentIdCounts.get(location.assignment.id) ?? 0) + 1)

  if (builtIn && state.groups.length === 0) issues.push(issue('error', 'built-in-no-groups', 'Built-in PixGrid preset has no smart groups.', 'groups', 'Restore the canonical smart groups through preset migration.'))
  if (builtIn && locations.length === 0) issues.push(issue('error', 'built-in-no-routes', 'Built-in PixGrid preset has no audio assignments.', 'audioAssignments', 'Restore the canonical audio routes through preset migration.'))

  const fallbackIds = new Set(PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS.map(route => route.id))
  const effectiveAuthoredRoutes = locations.filter(location => (
    !fallbackIds.has(location.assignment.id)
    && isPixGridAudioAssignmentEffective(
      state,
      location.assignment,
      location.ownerGroupId ?? undefined,
      options.capabilities,
    )
  ))
  const activeFallbackRoutes = locations.filter(location => (
    fallbackIds.has(location.assignment.id)
    && isPixGridAudioAssignmentEffective(
      state,
      location.assignment,
      location.ownerGroupId ?? undefined,
      options.capabilities,
    )
  ))
  if (!builtIn && effectiveAuthoredRoutes.length === 0) {
    issues.push(issue(
      'warning',
      activeFallbackRoutes.length > 0 ? 'baseline-fallback-routing-active' : 'missing-effective-audio-routes',
      activeFallbackRoutes.length > 0
        ? 'No effective authored music routes are active; PixGrid is using its baseline fallback response.'
        : 'No effective authored music routes are available and baseline fallback routing is not installed.',
      'audioAssignments',
      activeFallbackRoutes.length > 0
        ? 'Author smart-group or global routes when you want behavior beyond the baseline kick, bass, and energy response.'
        : 'Run PixGrid state migration or add an enabled route with a visible amount, valid target, usable source, and satisfiable conditions.',
    ))
  }

  for (const [id, count] of groupIdCounts) if (count > 1) issues.push(issue('error', 'duplicate-group-id', `Stable group ID ${id} appears ${count} times.`, 'groups', 'Give every smart group a unique stable ID.'))
  for (const [id, count] of assignmentIdCounts) if (count > 1) issues.push(issue('error', 'duplicate-assignment-id', `Stable assignment ID ${id} appears ${count} times.`, 'audioAssignments', 'Give every authored assignment a unique stable ID across global and group-local routes.'))

  const groupInspections = inspectPixGridGroups(state)
  for (const [index, group] of groupInspections.entries()) {
    if (group.targetStatus === 'missing-layer') issues.push(issue(
      builtIn ? 'error' : 'warning',
      'group-missing-layer',
      `Group ${group.name} references a missing layer.`,
      `groups[${index}].layerScope`,
      'Repair the group layer scope through canonical layer-graph migration.',
    ))
    else if (group.targetStatus === 'empty-mask') issues.push(issue(
      builtIn ? 'error' : 'warning',
      'empty-group-mask',
      `Group ${group.name} compiles to zero cells.`,
      `groups[${index}].mask`,
      'Repair the mask source or select cells before assigning reactions.',
    ))
    else if (group.targetStatus === 'invisible-content') issues.push(issue(
      builtIn ? 'error' : 'warning',
      'group-invisible-content',
      `Group ${group.name} resolves only to invisible or fully transparent layers.`,
      `groups[${index}]`,
      'Restore a visible canonical source layer or intentionally disable the group.',
    ))
  }

  for (const location of locations) {
    const { assignment } = location
    const scope = assignment.targetScope ?? location.defaultScope
    if (!targetExists(state, location)) issues.push(issue('error', 'missing-assignment-target', `Assignment ${assignment.id} targets a missing ${scope}.`, `${location.path}.targetId`, 'Choose an existing target or recreate the missing scene, layer, or group.'))
    if (!finiteInRange(assignment.threshold, 0, 1)) issues.push(issue('error', 'invalid-threshold', `Assignment ${assignment.id} has a threshold outside 0 to 1.`, `${location.path}.threshold`, 'Set the threshold between 0 and 1.'))
    for (const [field, value, max] of [['attack', assignment.attack, 10], ['hold', assignment.hold, 10], ['release', assignment.release, 20], ['cooldown', assignment.cooldown ?? 0, 30]] as const) {
      if (!finiteInRange(value, 0, max)) issues.push(issue('error', `invalid-${field}`, `Assignment ${assignment.id} has an invalid ${field} duration.`, `${location.path}.${field}`, `Set ${field} to a finite non-negative value no greater than ${max} seconds.`))
    }
    const outputRange = assignment.outputRange ?? [0, 1]
    const ineffective = Math.abs(assignment.amount) <= 1e-6
      || Math.abs(outputRange[1] - outputRange[0]) <= 1e-6
      || (Math.abs(assignment.clamp[0]) <= 1e-6 && Math.abs(assignment.clamp[1]) <= 1e-6)
    if (ineffective) issues.push(issue('warning', 'ineffective-route-amount', `Assignment ${assignment.id} cannot produce a visible change with its current amount or output range.`, location.path, 'Increase Amount or widen Output Range and Clamp.'))
    const peakOutputSpan = Math.abs(outputRange[1] - outputRange[0])
      * Math.abs(assignment.amount)
      * Math.max(Math.abs(assignment.clamp[0]), Math.abs(assignment.clamp[1]))
    const targetGroupId = (scope === 'group' || scope === 'pixels')
      ? assignment.targetId ?? location.ownerGroupId
      : null
    const targetInspection = targetGroupId ? groupInspections.find(group => group.groupId === targetGroupId) : null
    const targetCoverage = targetInspection
      ? targetInspection.visibleCellCount / Math.max(1, state.matrixWidth * state.matrixHeight)
      : 1
    const estimatedPerceptibility = peakOutputSpan * Math.min(1, Math.sqrt(Math.max(0, targetCoverage) * 16))
    if (assignment.enabled && !ineffective && estimatedPerceptibility < 0.035) issues.push(issue(
      'warning',
      'assignment-below-perceptual-floor',
      `Assignment ${assignment.id} is structurally valid but is unlikely to exceed the PixGrid perceptual floor at its current amount and target coverage.`,
      location.path,
      'Increase the route amount, widen its output range, or target a larger visible group while preserving the intended choreography.',
    ))
    if (assignment.enabled && !isPixGridAudioAssignmentEffective(state, assignment, location.ownerGroupId ?? undefined, options.capabilities)) issues.push(issue(
      builtIn ? 'error' : 'warning',
      'ineffective-assignment-target',
      `Assignment ${assignment.id} cannot currently alter visible pixels.`,
      location.path,
      'Repair its layer/group target, mask, visibility, source fallback, amount, clamp, or conditions.',
    ))

    const sourceDefinition = getPixGridAudioIntelligenceSource(assignment.source)
    const unavailable = options.capabilities?.[assignment.source] === false
    if ((unavailable || sourceDefinition.optional) && assignment.capabilityFallback === 'disable') issues.push(issue(
      unavailable ? 'error' : 'warning',
      'unsupported-source-without-fallback',
      `Assignment ${assignment.id} can become unavailable without a capability fallback.`,
      `${location.path}.capabilityFallback`,
      'Choose an energy, beat, transient, or mid/high fallback.',
    ))
    if (isPixGridBassReactivitySource(assignment.source) && assignment.bassReactivityEnabled === false) issues.push(issue(
      'warning',
      'bass-route-bypasses-control',
      `Bass-sensitive assignment ${assignment.id} bypasses the Bass Reactivity control.`,
      `${location.path}.bassReactivityEnabled`,
      'Enable Bass Reactivity participation unless this route is intentionally independent.',
    ))

    const conditions = assignment.conditions
    if (conditions?.minimumEnergy != null && conditions.maximumEnergy != null && conditions.minimumEnergy > conditions.maximumEnergy) issues.push(issue('error', 'assignment-never-eligible', `Assignment ${assignment.id} has an impossible energy condition.`, `${location.path}.conditions`, 'Make minimum energy less than or equal to maximum energy.'))
    if (conditions?.activeLayerId && !state.layers.some(layer => layer.id === conditions.activeLayerId)) issues.push(issue('error', 'assignment-never-eligible', `Assignment ${assignment.id} requires a missing active layer.`, `${location.path}.conditions.activeLayerId`, 'Choose an existing layer or remove the condition.'))
    if (conditions?.activeGroupId && !state.groups.some(group => group.id === conditions.activeGroupId)) issues.push(issue('error', 'assignment-never-eligible', `Assignment ${assignment.id} requires a missing active group.`, `${location.path}.conditions.activeGroupId`, 'Choose an existing group or remove the condition.'))

    const compiled = compiler.compile(assignment, options.capabilities ?? {}, location.defaultScope, `${location.ownerGroupId ?? 'audio'}:${assignment.id}`)
    for (const warning of compiled.warnings) issues.push(issue(
      compiled.compatible ? 'warning' : 'error',
      'invalid-route-capability',
      `${assignment.id}: ${warning}`,
      location.path,
      'Choose an operation and target scope supported by this source and target capability.',
    ))
  }

  const autonomousAnimationCount = state.layers.reduce((count, layer) => count + layer.animations.filter(animation => AUTONOMOUS_ANIMATION_MODES.has(animation.mode) && animation.clock !== 'beat' && animation.clock !== 'cue').length, 0)
  const musicRouteCount = locations.filter(location => isPixGridAudioAssignmentEffective(
    state,
    location.assignment,
    location.ownerGroupId ?? undefined,
    options.capabilities,
  )).length
  const motionConsumerCount = state.layers.reduce((count, layer) => count + layer.animations.length, 0)
    + locations.filter(location => ['animationSpeed', 'frameAdvance', 'bounceAmount', 'scrollRate', 'pixelDisplacement', 'positionX', 'positionY', 'rotation', 'scale'].includes(location.assignment.target)).length
  if (builtIn && motionConsumerCount === 0) issues.push(issue(
    'error',
    'motion-control-ignored',
    'Built-in preset accepts the global Motion value but has no animation or motion-sensitive route that can consume it.',
    'layers',
    'Restore an authored animation or a motion-sensitive route so Motion 0, 0.5, and 1 have bounded, visible behavior.',
  ))
  if (builtIn && autonomousAnimationCount > 0 && musicRouteCount === 0) issues.push(issue('error', 'autonomous-only-built-in', 'Built-in preset only contains autonomous animation.', 'layers', 'Restore authored music routes and performance choreography.'))
  if (builtIn && !locations.some(location => COMMON_LIVE_SOURCES.has(location.assignment.source) || ['energy', 'beat', 'transient'].includes(location.assignment.capabilityFallback))) issues.push(issue(
    severityForWeakConfig,
    'missing-common-live-source-fallback',
    'Built-in preset has no kick, snare, bass, beat, or energy path.',
    'audioAssignments',
    'Add at least one common live source or a common capability fallback.',
  ))

  const duplicateFallbacks = locations.filter(location => fallbackIds.has(location.assignment.id)).length
  if (duplicateFallbacks > fallbackIds.size) issues.push(issue('error', 'duplicated-canonical-fallback-routes', 'Migration duplicated canonical fallback routes.', 'audioAssignments', 'Deduplicate by stable assignment ID and make migration idempotent.'))

  const stateMarkedCurrent = state.version >= PIX_GRID_STATE_VERSION
    && state.configuration.layerGraphVersion >= PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION
    && state.configuration.smartGroupConfigurationVersion >= PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION
    && state.configuration.audioRouteConfigurationVersion >= PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION
    && state.configuration.performanceProgramConfigurationVersion >= PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION
    && state.configuration.musicReactiveConfigurationVersion >= PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION
    && state.configuration.canonicalMigrationCompleted
  if (builtIn && state.configuration.legacyOfficialLayerGraph) issues.push(issue('error', 'built-in-legacy-layer-graph', 'Built-in PixGrid state still declares the legacy official layer graph after migration.', 'configuration.legacyOfficialLayerGraph', 'Run canonical layer-graph migration and clear the legacy marker only after layer, scene, group, and route references are repaired.'))
  if (builtIn && !state.configuration.canonicalMigrationCompleted) issues.push(issue('error', 'canonical-migration-incomplete', 'Built-in PixGrid state has not completed canonical graph and route integrity migration.', 'configuration.canonicalMigrationCompleted', 'Run canonical migration and keep the state incomplete until layers, scenes, groups, routes, and the performance program pass structural integrity.'))
  if (builtIn && stateMarkedCurrent && (state.groups.length === 0 || locations.length === 0)) issues.push(issue('error', 'current-state-missing-required-configuration', 'State is marked current but required built-in reaction configuration is missing.', 'configuration', 'Run built-in preset migration even when legacy layers are non-empty.'))
  const builtInPreset = options.builtInPresetId ? PIX_GRID_PRESET_BY_ID.get(options.builtInPresetId) : state.selectedPresetId ? PIX_GRID_PRESET_BY_ID.get(state.selectedPresetId) : null
  if (builtInPreset?.pixGridSettings) {
    const layerIds = new Set(state.layers.map(layer => layer.id))
    for (const requiredLayer of builtInPreset.pixGridSettings.layers ?? []) if (!layerIds.has(requiredLayer.id)) issues.push(issue('error', 'missing-canonical-layer', `Built-in preset is missing canonical layer ${requiredLayer.id}.`, 'layers', 'Restore the current canonical layer graph before marking migration complete.'))
  }
  if (!builtIn && stateMarkedCurrent && effectiveAuthoredRoutes.length === 0 && activeFallbackRoutes.length === 0) issues.push(issue(
    'warning',
    'current-custom-state-missing-fallback-routing',
    'Custom state is marked current but has neither an effective authored route nor the canonical baseline fallback routes.',
    'configuration.musicReactiveConfigurationVersion',
    'Re-run custom-state migration so fallback routing is persisted before marking the configuration current.',
  ))

  const programId = state.performance.sharedPerformanceProgramId
  const program = programId ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(programId) : null
  if (builtIn && !program) issues.push(issue('error', 'missing-performance-program', 'Built-in preset does not resolve a performance program.', 'performance.sharedPerformanceProgramId', 'Restore the preset performance-program binding.'))
  if (program) {
    for (const programIssue of validatePixGridPerformanceProgram(program)) issues.push(issue(
      programIssue.severity === 'error' ? 'error' : 'warning',
      `program-${programIssue.code}`,
      programIssue.message,
      programIssue.path ?? 'performance',
      'Repair the referenced performance-program scene, role, bank, route, or section plan.',
    ))
    if (!program.sectionPlans.some(plan => (plan.actions?.length ?? 0) + (plan.entryActions?.length ?? 0) + (plan.bodyActions?.length ?? 0) + (plan.exitActions?.length ?? 0) + (plan.continuousRouteIds?.length ?? 0) + (plan.eventRouteIds?.length ?? 0) > 0)) issues.push(issue('error', 'program-no-section-behavior', 'Performance program defines no section behavior.', 'performance', 'Author at least one section action or route binding.'))
    const sceneIds = new Set(state.scenes.map(scene => scene.id))
    for (const plan of program.sectionPlans) for (const sceneId of plan.scenePreference ?? []) if (!sceneIds.has(sceneId)) issues.push(issue('error', 'program-missing-scene', `Performance plan ${plan.id} references missing scene ${sceneId}.`, `performance.sectionPlans.${plan.id}`, 'Restore the scene or update the plan preference.'))
    const compiledProgram = new PixGridPerformanceProgramCompiler().compile(program, state, options.capabilities)
    for (const missingBinding of compiledProgram.missingBindings) issues.push(issue(
      builtIn ? 'error' : 'warning',
      'program-missing-state-target',
      `Performance program target ${missingBinding} does not resolve in the current PixGrid state.`,
      'performance.sharedPerformanceProgramId',
      'Restore the canonical scene, group, or layer graph, or update the custom performance-program binding.',
    ))
  }

  if (options.canvasPlan && options.gpuPlan) issues.push(...comparePixGridRendererSemanticPlans(options.canvasPlan, options.gpuPlan))

  const deduped = [...new Map(issues.map(item => [`${item.severity}:${item.code}:${item.path}:${item.message}`, item])).values()]
  const errors = deduped.filter(item => item.severity === 'error')
  const warnings = deduped.filter(item => item.severity === 'warning')
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues: deduped,
    summary: errors.length || warnings.length
      ? `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
      : 'Valid music-reactive configuration',
  }
}

export function validatePixGridPreset(preset: ReactPreset, state: PixGridState): PixGridValidationReport {
  return validatePixGridState(state, { builtInPresetId: preset.id })
}

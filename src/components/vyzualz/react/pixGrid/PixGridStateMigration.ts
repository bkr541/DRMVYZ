import type { ReactPreset } from '../ReactTypes'
import { PixGridAssignmentCompiler } from './PixGridAssignmentCompiler'
import {
  createEmptyPixGridCanonicalSignatures,
  createPixGridCanonicalSignatures,
  pixGridAssignmentSignature,
  pixGridGlobalAssignmentSignatureKey,
  pixGridGroupAssignmentSignatureKey,
  pixGridLegacyPerceptualAssignmentSignature,
  pixGridGroupSignature,
  pixGridLayerAnimationSignature,
} from './PixGridConfiguration'
import { clonePixGridLayer } from './PixGridDefaults'
import {
  detectPixGridPresetLineage,
  inspectPixGridGroupTarget,
  mergePixGridCanonicalLayerGraph,
  repairPixGridAccidentalCanonicalLayerCopies,
  repairPixGridLayerReferences,
} from './PixGridCanonicalGraph'
import { PixGridPerformanceProgramCompiler } from './PixGridPerformanceProgramCompiler'
import type { PixGridPerformanceProgram } from './PixGridPerformanceTypes'
import { PIX_GRID_PERFORMANCE_PROGRAM_BY_ID } from './PixGridPerformancePrograms'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'
import { resolvePixGridLayerFrameSource } from './PixGridFrameSources'
import {
  PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
  PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
  PIX_GRID_CONFIGURATION_METADATA_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
  PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridCanonicalSignatures,
  type PixGridGroup,
  type PixGridMigrationDiagnostics,
  type PixGridReactionAssignment,
  type PixGridReactionSource,
  type PixGridState,
} from './PixGridTypes'
import { normalizePixGridReactionAssignment, normalizePixGridState } from './PixGridValidation'

const PIX_GRID_EFFECTIVENESS_COMPILER = new PixGridAssignmentCompiler()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function finiteVersion(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function cloneAssignment(assignment: PixGridReactionAssignment): PixGridReactionAssignment {
  return {
    ...assignment,
    clamp: [...assignment.clamp] as [number, number],
    ...(assignment.inputRange ? { inputRange: [...assignment.inputRange] as [number, number] } : {}),
    ...(assignment.outputRange ? { outputRange: [...assignment.outputRange] as [number, number] } : {}),
    ...(assignment.conditions
      ? {
          conditions: {
            ...assignment.conditions,
            ...(assignment.conditions.includeSectionTypes ? { includeSectionTypes: [...assignment.conditions.includeSectionTypes] } : {}),
            ...(assignment.conditions.excludeSectionTypes ? { excludeSectionTypes: [...assignment.conditions.excludeSectionTypes] } : {}),
            ...(assignment.conditions.sectionPhases ? { sectionPhases: [...assignment.conditions.sectionPhases] } : {}),
            ...(assignment.conditions.sectionOccurrences ? { sectionOccurrences: [...assignment.conditions.sectionOccurrences] } : {}),
            ...(assignment.conditions.dropOccurrences ? { dropOccurrences: [...assignment.conditions.dropOccurrences] } : {}),
            ...(assignment.conditions.phraseSegments ? { phraseSegments: [...assignment.conditions.phraseSegments] } : {}),
          },
        }
      : {}),
  }
}

function cloneGroup(group: PixGridGroup): PixGridGroup {
  return {
    ...group,
    cellRuns: [...group.cellRuns],
    layerScope: group.layerScope ? [...group.layerScope] : null,
    reactions: group.reactions.map(cloneAssignment),
    mask: group.mask.kind === 'runs' ? { kind: 'runs', runs: [...group.mask.runs] } : { ...group.mask },
  }
}

function mergeCanonicalLayerAnimationMetadata(
  existing: PixGridState['layers'][number],
  canonical: PixGridState['layers'][number],
): PixGridState['layers'][number] {
  const authored = clonePixGridLayer(canonical)
  return {
    ...clonePixGridLayer(existing),
    animations: authored.animations,
    ...(authored.audioReactivity
      ? { audioReactivity: authored.audioReactivity }
      : { audioReactivity: undefined }),
    densityRank: authored.densityRank,
    seed: authored.seed,
  }
}

function strongLegacyCustomization(state: PixGridState, preset: ReactPreset): boolean {
  const canonicalLayerIds = new Set((preset.pixGridSettings?.layers ?? []).map(layer => layer.id))
  const canonicalGroupIds = new Set((preset.pixGridSettings?.groups ?? []).map(group => group.id))
  const canonicalAssignmentIds = new Set((preset.pixGridSettings?.audioAssignments ?? []).map(assignment => assignment.id))
  return state.layers.some(layer => resolvePixGridLayerFrameSource(layer).kind !== 'asset' || !canonicalLayerIds.has(layer.id))
    || state.scenes.some(scene => scene.pixelOverrides.length > 0)
    || state.groups.some(group => !canonicalGroupIds.has(group.id))
    || state.audioAssignments.some(assignment => !canonicalAssignmentIds.has(assignment.id))
    || state.performance.lockedRoutes.length > 0
    || Object.keys(state.performance.programOverrides.routes).length > 0
    || Object.keys(state.performance.programOverrides.sections).length > 0
    || state.conversion.selectedMediaId != null
}

function signatureRecordsEqual(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(key => left[key] === right[key])
}

function canonicalSignaturesEqual(
  left: PixGridCanonicalSignatures,
  right: PixGridCanonicalSignatures,
): boolean {
  return signatureRecordsEqual(left.groups, right.groups)
    && signatureRecordsEqual(left.assignments, right.assignments)
    && signatureRecordsEqual(left.layerAnimations, right.layerAnimations)
}

function shouldUpgradeCanonicalEntity(
  upgradeRequested: boolean,
  allowBlindUpgrade: boolean,
  previousSignature: string | undefined,
  existingSignature: string,
  compatibleSignatures: readonly string[] = [],
): boolean {
  if (!upgradeRequested) return false
  if (previousSignature === existingSignature || compatibleSignatures.includes(previousSignature ?? '')) return true
  // Untouched built-in states are safe to refresh even when a newer normalizer adds
  // neutral fields that could not have existed in the stored canonical signature.
  // Customized states still require a current or version-compatible signature match.
  return allowBlindUpgrade
}

function mergeCanonicalAssignments(
  existing: readonly PixGridReactionAssignment[],
  canonical: readonly PixGridReactionAssignment[],
  options: {
    upgradeRequested: boolean
    allowBlindUpgrade: boolean
    previousSignatures: Readonly<Record<string, string>>
    signatureKey: (assignmentId: string) => string
  },
): { assignments: PixGridReactionAssignment[]; added: number; preserved: number; upgraded: number } {
  const canonicalById = new Map(canonical.map(assignment => [assignment.id, assignment]))
  let added = 0
  let preserved = 0
  let upgraded = 0
  const merged = existing.map(assignment => {
    const authored = canonicalById.get(assignment.id)
    if (!authored) {
      preserved += 1
      return cloneAssignment(assignment)
    }
    canonicalById.delete(assignment.id)
    const signatureKey = options.signatureKey(assignment.id)
    if (shouldUpgradeCanonicalEntity(
      options.upgradeRequested,
      options.allowBlindUpgrade,
      options.previousSignatures[signatureKey],
      pixGridAssignmentSignature(assignment),
      [pixGridLegacyPerceptualAssignmentSignature(assignment)],
    )) {
      upgraded += 1
      return cloneAssignment(authored)
    }
    preserved += 1
    return cloneAssignment(assignment)
  })
  for (const assignment of canonical) {
    if (!canonicalById.has(assignment.id)) continue
    merged.push(cloneAssignment(assignment))
    canonicalById.delete(assignment.id)
    added += 1
  }
  return { assignments: merged, added, preserved, upgraded }
}

function mergeCanonicalGroups(
  existing: readonly PixGridGroup[],
  canonical: readonly PixGridGroup[],
  options: {
    upgradeRequested: boolean
    allowBlindUpgrade: boolean
    previousSignatures: PixGridCanonicalSignatures
  },
): {
  groups: PixGridGroup[]
  groupsAdded: number
  groupsPreserved: number
  groupsUpgraded: number
  assignmentsAdded: number
  assignmentsPreserved: number
  assignmentsUpgraded: number
} {
  const canonicalById = new Map(canonical.map(group => [group.id, group]))
  let groupsAdded = 0
  let groupsPreserved = 0
  let groupsUpgraded = 0
  let assignmentsAdded = 0
  let assignmentsPreserved = 0
  let assignmentsUpgraded = 0
  const groups = existing.map(group => {
    const authored = canonicalById.get(group.id)
    if (!authored) {
      groupsPreserved += 1
      assignmentsPreserved += group.reactions.length
      return cloneGroup(group)
    }
    canonicalById.delete(group.id)
    const upgradeGroup = shouldUpgradeCanonicalEntity(
      options.upgradeRequested,
      options.allowBlindUpgrade,
      options.previousSignatures.groups[group.id],
      pixGridGroupSignature(group),
    )
    if (upgradeGroup) {
      groupsUpgraded += 1
    } else {
      groupsPreserved += 1
    }
    const reactionMerge = mergeCanonicalAssignments(group.reactions, authored.reactions, {
      upgradeRequested: options.upgradeRequested,
      allowBlindUpgrade: options.allowBlindUpgrade,
      previousSignatures: options.previousSignatures.assignments,
      signatureKey: assignmentId => pixGridGroupAssignmentSignatureKey(group.id, assignmentId),
    })
    assignmentsAdded += reactionMerge.added
    assignmentsPreserved += reactionMerge.preserved
    assignmentsUpgraded += reactionMerge.upgraded
    return {
      ...(upgradeGroup ? cloneGroup(authored) : cloneGroup(group)),
      reactions: reactionMerge.assignments,
    }
  })
  for (const group of canonical) {
    if (!canonicalById.has(group.id)) continue
    groups.push(cloneGroup(group))
    canonicalById.delete(group.id)
    groupsAdded += 1
    assignmentsAdded += group.reactions.length
  }
  return {
    groups,
    groupsAdded,
    groupsPreserved,
    groupsUpgraded,
    assignmentsAdded,
    assignmentsPreserved,
    assignmentsUpgraded,
  }
}

function canonicalPresetFor(state: PixGridState, explicitPreset?: ReactPreset | null): ReactPreset | null {
  if (explicitPreset?.engine === 'pixGrid') {
    return PIX_GRID_PRESET_BY_ID.get(explicitPreset.id) ?? explicitPreset
  }
  if (!state.selectedPresetId) return null
  return PIX_GRID_PRESET_BY_ID.get(state.selectedPresetId) ?? null
}

function builtInMigrationIntegrity(
  state: PixGridState,
  preset: ReactPreset,
): {
  completed: boolean
  emptyGroups: string[]
  missingLayerGroups: string[]
  ineffectiveAssignments: string[]
  effectiveLiveRouteCount: number
  conflicts: string[]
} {
  const requiredLayerIds = new Set((preset.pixGridSettings?.layers ?? []).map(layer => layer.id))
  const requiredSceneIds = new Set(Object.keys(preset.pixGridSettings?.sceneSettings ?? {}))
  const requiredGroupIds = new Set((preset.pixGridSettings?.groups ?? []).map(group => group.id))
  const requiredAssignmentIds = new Set((preset.pixGridSettings?.audioAssignments ?? []).map(route => route.id))
  const layerIds = new Set(state.layers.map(layer => layer.id))
  const sceneById = new Map(state.scenes.map(scene => [scene.id, scene]))
  const groupById = new Map(state.groups.map(group => [group.id, group]))
  const assignmentById = new Map(state.audioAssignments.map(route => [route.id, route]))
  const conflicts: string[] = []
  const emptyGroups: string[] = []
  const missingLayerGroups: string[] = []
  const ineffectiveAssignments: string[] = []

  for (const layerId of requiredLayerIds) if (!layerIds.has(layerId)) conflicts.push(`Missing canonical layer ${layerId}.`)
  for (const sceneId of requiredSceneIds) {
    const scene = sceneById.get(sceneId)
    if (!scene || !scene.layerIds.some(layerId => layerIds.has(layerId))) conflicts.push(`Scene ${sceneId} has no valid visible layer reference.`)
  }
  for (const groupId of requiredGroupIds) {
    const group = groupById.get(groupId)
    if (!group) {
      conflicts.push(`Missing canonical group ${groupId}.`)
      continue
    }
    const inspection = inspectPixGridGroupTarget(state, group)
    if (inspection.status === 'missing-layer') missingLayerGroups.push(groupId)
    else if (inspection.status === 'empty-mask' || inspection.status === 'invisible-content') emptyGroups.push(groupId)
  }
  for (const assignmentId of requiredAssignmentIds) {
    const assignment = assignmentById.get(assignmentId)
    if (!assignment || !isPixGridAudioAssignmentEffective(state, assignment)) ineffectiveAssignments.push(assignmentId)
  }
  for (const groupId of requiredGroupIds) {
    const group = groupById.get(groupId)
    if (!group) continue
    for (const assignment of group.reactions) {
      if (!isPixGridAudioAssignmentEffective(state, assignment, group.id)) ineffectiveAssignments.push(`${group.id}:${assignment.id}`)
    }
  }
  let effectiveLiveRouteCount = [
    ...state.audioAssignments.map(assignment => ({ assignment, ownerGroupId: undefined as string | undefined })),
    ...state.groups.flatMap(group => group.reactions.map(assignment => ({ assignment, ownerGroupId: group.id }))),
  ].filter(({ assignment, ownerGroupId }) => (
    ['kick', 'snare', 'bass', 'beat', 'energy'].includes(assignment.source)
    && isPixGridAudioAssignmentEffective(state, assignment, ownerGroupId)
  )).length
  const canonicalProgramId = preset.pixGridSettings?.performanceProgramId
  if (canonicalProgramId !== undefined && state.performance.sharedPerformanceProgramId !== canonicalProgramId) {
    conflicts.push('Performance program binding is not canonical.')
  }
  const program = canonicalProgramId ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(canonicalProgramId) : null
  if (canonicalProgramId && !program) conflicts.push('Performance program does not resolve from the canonical registry.')
  else if (program) {
    const compiledProgram = new PixGridPerformanceProgramCompiler().compile(program, state)
    effectiveLiveRouteCount += compiledProgram.assignments.filter(assignment => (
      ['kick', 'snare', 'bass', 'beat', 'energy'].includes(assignment.source)
      && isPixGridAudioAssignmentEffective(state, assignment)
    )).length
    for (const missing of compiledProgram.missingBindings) conflicts.push(`Performance program target is missing: ${missing}.`)
    for (const validationIssue of compiledProgram.validationIssues) {
      if (validationIssue.severity === 'error') conflicts.push(`Performance program ${validationIssue.code}: ${validationIssue.message}`)
    }
  }
  const groupIds = state.groups.map(group => group.id)
  const routeIds = [
    ...state.audioAssignments.map(route => `audio:${route.id}`),
    ...state.groups.flatMap(group => group.reactions.map(route => `group:${group.id}:${route.id}`)),
  ]
  if (new Set(groupIds).size !== groupIds.length) conflicts.push('Duplicate smart-group IDs remain after migration.')
  if (new Set(routeIds).size !== routeIds.length) conflicts.push('Duplicate audio-route IDs remain after migration.')
  if (effectiveLiveRouteCount === 0) conflicts.push('No common live source can produce visible output.')
  return {
    completed: conflicts.length === 0 && emptyGroups.length === 0 && missingLayerGroups.length === 0 && ineffectiveAssignments.length === 0,
    emptyGroups: [...new Set(emptyGroups)].sort(),
    missingLayerGroups: [...new Set(missingLayerGroups)].sort(),
    ineffectiveAssignments: [...new Set(ineffectiveAssignments)].sort(),
    effectiveLiveRouteCount,
    conflicts,
  }
}

export function migratePixGridState(
  rawState: unknown,
  explicitPreset?: ReactPreset | null,
): PixGridState {
  const raw = isRecord(rawState) ? rawState : {}
  const fromStateVersion = finiteVersion(raw.version)
  const rawConfiguration = isRecord(raw.configuration) ? raw.configuration : null
  const rawPerformance = isRecord(raw.performance) ? raw.performance : null
  const fromPresetConfigurationVersion = finiteVersion(rawConfiguration?.presetConfigurationVersion)
  const fromLayerGraphVersion = finiteVersion(rawConfiguration?.layerGraphVersion)
  const fromSmartGroupConfigurationVersion = finiteVersion(rawConfiguration?.smartGroupConfigurationVersion)
  const fromAudioRouteConfigurationVersion = finiteVersion(rawConfiguration?.audioRouteConfigurationVersion)
  const fromPerformanceProgramConfigurationVersion = finiteVersion(rawConfiguration?.performanceProgramConfigurationVersion)
  const normalizedBeforeCopyRepair = normalizePixGridState(rawState)
  const preset = canonicalPresetFor(normalizedBeforeCopyRepair, explicitPreset)
  const accidentalCopyRepair = preset?.pixGridSettings
    ? repairPixGridAccidentalCanonicalLayerCopies(normalizedBeforeCopyRepair, preset)
    : { state: normalizedBeforeCopyRepair, removedLayerIds: [] as string[], mergedIntoCanonicalLayerIds: [] as string[] }
  const normalized = normalizePixGridState(accidentalCopyRepair.state)

  if (!preset?.pixGridSettings) {
    const emptyCanonicalSignatures = createEmptyPixGridCanonicalSignatures()
    const fallback = reconcilePixGridFallbackAssignments(normalized)
    if (
      fromStateVersion >= PIX_GRID_STATE_VERSION
      && normalized.configuration.origin === 'custom'
      && normalized.configuration.musicReactiveConfigurationVersion >= PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION
      && normalized.configuration.canonicalMigrationCompleted
      && canonicalSignaturesEqual(normalized.configuration.canonicalSignatures, emptyCanonicalSignatures)
      && fallback.state === normalized
    ) return normalized
    const report: PixGridMigrationDiagnostics = {
      applied: true,
      fromStateVersion,
      toStateVersion: PIX_GRID_STATE_VERSION,
      fromPresetConfigurationVersion,
      toPresetConfigurationVersion: 0,
      groupsAdded: 0,
      groupsPreserved: normalized.groups.length,
      groupsUpgraded: 0,
      assignmentsAdded: fallback.assignmentsAdded,
      assignmentsPreserved: normalized.audioAssignments.length + normalized.groups.reduce((sum, group) => sum + group.reactions.length, 0),
      assignmentsUpgraded: 0,
      layersAdded: 0,
      scenesAdded: 0,
      fallbackRoutesActive: fallback.fallbackActive,
      originalBuiltInPresetId: normalized.configuration.sourcePresetId,
      programsUpgraded: 0,
      customizationsPreserved: normalized.configuration.userCustomized,
      conflicts: [],
      skippedUpgrades: [],
      fallbackRoutingInstalled: fallback.assignmentsAdded > 0,
      detectedPresetLineage: 'fully-custom',
      fromLayerGraphVersion,
      toLayerGraphVersion: 0,
      fromSmartGroupConfigurationVersion,
      toSmartGroupConfigurationVersion: 0,
      fromAudioRouteConfigurationVersion,
      toAudioRouteConfigurationVersion: PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
      fromPerformanceProgramConfigurationVersion,
      toPerformanceProgramConfigurationVersion: 0,
      canonicalLayersAdded: [],
      legacyLayersMapped: [],
      legacyLayersPreservedAsOverlays: normalized.layers.map(layer => layer.id),
      obsoleteOfficialLayersRemoved: [],
      sceneReferencesRepaired: 0,
      groupsRepaired: [],
      emptyGroups: [],
      missingLayerGroups: [],
      assignmentsRepaired: [],
      ineffectiveAssignments: [],
      effectiveLiveRouteCount: fallback.validAssignmentCount,
      migrationCompleted: true,
      safeRecoveryUsed: false,
    }
    return normalizePixGridState({
      ...fallback.state,
      configuration: {
        metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
        origin: 'custom',
        sourcePresetId: normalized.configuration.sourcePresetId,
        presetConfigurationVersion: 0,
        layerGraphVersion: 0,
        smartGroupConfigurationVersion: 0,
        audioRouteConfigurationVersion: PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
        performanceProgramConfigurationVersion: 0,
        musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
        userCustomized: normalized.configuration.userCustomized,
        legacyOfficialLayerGraph: false,
        genuineUserLayers: normalized.layers.length > 0,
        canonicalMigrationCompleted: true,
        canonicalSignatures: emptyCanonicalSignatures,
        lastMigration: report,
      },
    })
  }

  const settings = preset.pixGridSettings
  const lineage = detectPixGridPresetLineage(normalized, preset)
  if (lineage.lineage === 'fully-custom' && normalized.configuration.origin === 'custom') {
    return migratePixGridState({ ...normalized, selectedPresetId: null }, null)
  }
  const targetPresetConfigurationVersion = settings.authoredConfigurationVersion ?? 1
  const explicitlyDisablesPerformance = settings.performanceEnabled === false && !settings.performanceProgramId
  const explicitlyClearsPerformanceProgram = settings.performanceProgramId === null
  const targetProgramId = explicitlyDisablesPerformance || explicitlyClearsPerformanceProgram
    ? null
    : settings.performanceProgramId ?? normalized.performance.sharedPerformanceProgramId
  const canonicalGroups = settings.groups ?? []
  const canonicalAssignments = settings.audioAssignments ?? []
  const targetCanonicalSignatures = createPixGridCanonicalSignatures(settings)
  const previousCanonicalSignatures = normalized.configuration.canonicalSignatures
  const hasTrustedConfigurationMetadata = finiteVersion(rawConfiguration?.metadataVersion) >= PIX_GRID_CONFIGURATION_METADATA_VERSION
  const userCustomized = hasTrustedConfigurationMetadata
    ? rawConfiguration?.userCustomized === true
    : strongLegacyCustomization(normalized, preset)
  const graphUpgradeRequested = lineage.lineage !== 'current-canonical-built-in'
    || fromLayerGraphVersion < PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION
    || normalized.configuration.canonicalMigrationCompleted !== true
  const presetUpgradeRequested = fromPresetConfigurationVersion < targetPresetConfigurationVersion
    || fromSmartGroupConfigurationVersion < PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION
    || fromAudioRouteConfigurationVersion < PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION
    || fromPerformanceProgramConfigurationVersion < PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION
  const allowBlindUpgrade = presetUpgradeRequested && (!userCustomized || lineage.legacyOfficialLayerGraph)
  const layerMerge = graphUpgradeRequested
    ? mergePixGridCanonicalLayerGraph(normalized, preset)
    : {
        layers: normalized.layers.map(clonePixGridLayer),
        layerIdMap: new Map(normalized.layers.map(layer => [layer.id, layer.id])),
        canonicalLayersAdded: [] as string[],
        legacyLayersMapped: [] as string[],
        legacyLayersPreservedAsOverlays: [] as string[],
        obsoleteOfficialLayersRemoved: [] as string[],
        safeRecoveryUsed: false,
      }

  const groupMerge = mergeCanonicalGroups(normalized.groups, canonicalGroups, {
    upgradeRequested: presetUpgradeRequested || graphUpgradeRequested,
    allowBlindUpgrade,
    previousSignatures: previousCanonicalSignatures,
  })
  const assignmentMerge = mergeCanonicalAssignments(normalized.audioAssignments, canonicalAssignments, {
    upgradeRequested: presetUpgradeRequested || graphUpgradeRequested,
    allowBlindUpgrade,
    previousSignatures: previousCanonicalSignatures.assignments,
    signatureKey: pixGridGlobalAssignmentSignatureKey,
  })
  const canonicalLayerById = new Map((settings.layers ?? []).map(layer => [layer.id, layer]))
  const layerAnimationUpgradeIds = new Set(layerMerge.layers.flatMap(layer => {
    const canonicalLayer = canonicalLayerById.get(layer.id)
    if (!canonicalLayer) return []
    return shouldUpgradeCanonicalEntity(
      presetUpgradeRequested,
      allowBlindUpgrade,
      previousCanonicalSignatures.layerAnimations[layer.id],
      pixGridLayerAnimationSignature(layer),
    ) ? [layer.id] : []
  }))
  const layers = layerMerge.layers.map(layer => {
    const canonicalLayer = canonicalLayerById.get(layer.id)
    const clonedLayer = clonePixGridLayer(layer)
    return canonicalLayer && layerAnimationUpgradeIds.has(layer.id)
      ? mergeCanonicalLayerAnimationMetadata(clonedLayer, canonicalLayer)
      : clonedLayer
  })
  const repaired = repairPixGridLayerReferences(
    normalized,
    preset,
    layers,
    layerMerge.layerIdMap,
    groupMerge.groups,
    assignmentMerge.assignments,
  )
  const programConfigurationMismatch = rawPerformance?.sharedPerformanceProgramId !== targetProgramId
    || (explicitlyDisablesPerformance && rawPerformance?.enabled !== false)
  const candidateBase = normalizePixGridState({
    ...normalized,
    selectedPresetId: preset.id,
    selectedSceneId: repaired.selectedSceneId,
    layers,
    scenes: repaired.scenes,
    groups: repaired.groups,
    audioAssignments: repaired.audioAssignments,
    editor: { ...normalized.editor, selectedLayerId: repaired.selectedLayerId },
    performance: {
      ...repaired.performance,
      enabled: explicitlyDisablesPerformance
        ? false
        : typeof rawPerformance?.enabled === 'boolean'
          ? rawPerformance.enabled
          : settings.performanceEnabled ?? (targetProgramId ? true : repaired.performance.enabled),
      sharedPerformanceProgramId: targetProgramId,
    },
  })
  const fallback = reconcilePixGridFallbackAssignments(candidateBase)
  const integrity = builtInMigrationIntegrity(fallback.state, preset)
  const completed = integrity.completed
  const migrationNeeded = fromStateVersion < PIX_GRID_STATE_VERSION
    || fromPresetConfigurationVersion < targetPresetConfigurationVersion
    || fromLayerGraphVersion < PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION
    || fromSmartGroupConfigurationVersion < PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION
    || fromAudioRouteConfigurationVersion < PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION
    || fromPerformanceProgramConfigurationVersion < PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION
    || normalized.configuration.musicReactiveConfigurationVersion < PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION
    || normalized.configuration.canonicalMigrationCompleted !== completed
    || layerMerge.canonicalLayersAdded.length > 0
    || layerMerge.legacyLayersMapped.length > 0
    || repaired.sceneReferencesRepaired > 0
    || repaired.groupsRepaired.length > 0
    || repaired.assignmentsRepaired.length > 0
    || groupMerge.groupsAdded > 0
    || groupMerge.groupsUpgraded > 0
    || groupMerge.assignmentsAdded > 0
    || groupMerge.assignmentsUpgraded > 0
    || assignmentMerge.added > 0
    || assignmentMerge.upgraded > 0
    || layerAnimationUpgradeIds.size > 0
    || accidentalCopyRepair.removedLayerIds.length > 0
    || programConfigurationMismatch
    || normalized.selectedPresetId !== preset.id
    || !canonicalSignaturesEqual(previousCanonicalSignatures, targetCanonicalSignatures)

  if (!migrationNeeded) return normalized

  const report: PixGridMigrationDiagnostics = {
    applied: true,
    fromStateVersion,
    toStateVersion: PIX_GRID_STATE_VERSION,
    fromPresetConfigurationVersion,
    toPresetConfigurationVersion: targetPresetConfigurationVersion,
    groupsAdded: groupMerge.groupsAdded,
    groupsPreserved: groupMerge.groupsPreserved,
    groupsUpgraded: groupMerge.groupsUpgraded,
    assignmentsAdded: groupMerge.assignmentsAdded + assignmentMerge.added + fallback.assignmentsAdded,
    assignmentsPreserved: groupMerge.assignmentsPreserved + assignmentMerge.preserved,
    assignmentsUpgraded: groupMerge.assignmentsUpgraded + assignmentMerge.upgraded,
    layersAdded: layerMerge.canonicalLayersAdded.length,
    scenesAdded: Math.max(0, repaired.scenes.length - normalized.scenes.length),
    fallbackRoutesActive: fallback.fallbackActive,
    originalBuiltInPresetId: normalized.configuration.sourcePresetId ?? preset.id,
    programsUpgraded: programConfigurationMismatch ? 1 : 0,
    customizationsPreserved: userCustomized || lineage.genuineUserLayers,
    conflicts: integrity.conflicts,
    skippedUpgrades: userCustomized && presetUpgradeRequested
      ? ['Customized canonical entities were preserved unless structurally invalid or their prior canonical signature still matched.']
      : [],
    fallbackRoutingInstalled: fallback.assignmentsAdded > 0,
    detectedPresetLineage: lineage.lineage,
    fromLayerGraphVersion,
    toLayerGraphVersion: PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
    fromSmartGroupConfigurationVersion,
    toSmartGroupConfigurationVersion: PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
    fromAudioRouteConfigurationVersion,
    toAudioRouteConfigurationVersion: PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
    fromPerformanceProgramConfigurationVersion,
    toPerformanceProgramConfigurationVersion: PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
    canonicalLayersAdded: layerMerge.canonicalLayersAdded,
    legacyLayersMapped: layerMerge.legacyLayersMapped,
    legacyLayersPreservedAsOverlays: layerMerge.legacyLayersPreservedAsOverlays,
    obsoleteOfficialLayersRemoved: [
      ...layerMerge.obsoleteOfficialLayersRemoved,
      ...accidentalCopyRepair.removedLayerIds,
    ],
    sceneReferencesRepaired: repaired.sceneReferencesRepaired,
    groupsRepaired: repaired.groupsRepaired,
    emptyGroups: integrity.emptyGroups,
    missingLayerGroups: integrity.missingLayerGroups,
    assignmentsRepaired: repaired.assignmentsRepaired,
    ineffectiveAssignments: integrity.ineffectiveAssignments,
    effectiveLiveRouteCount: integrity.effectiveLiveRouteCount,
    migrationCompleted: completed,
    safeRecoveryUsed: layerMerge.safeRecoveryUsed,
  }

  return normalizePixGridState({
    ...fallback.state,
    configuration: {
      metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
      origin: 'builtInPreset',
      sourcePresetId: normalized.configuration.sourcePresetId ?? preset.id,
      presetConfigurationVersion: targetPresetConfigurationVersion,
      layerGraphVersion: PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION,
      smartGroupConfigurationVersion: PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION,
      audioRouteConfigurationVersion: PIX_GRID_AUDIO_ROUTE_CONFIGURATION_VERSION,
      performanceProgramConfigurationVersion: PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION,
      musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
      userCustomized,
      legacyOfficialLayerGraph: !completed && lineage.legacyOfficialLayerGraph,
      genuineUserLayers: lineage.genuineUserLayers,
      canonicalMigrationCompleted: completed,
      canonicalSignatures: targetCanonicalSignatures,
      lastMigration: report,
    },
  })
}


export interface PixGridCanonicalPresetIntegrity {
  presetId: string | null
  complete: boolean
  canonicalLayerCount: number
  canonicalGroupCount: number
  requiredLayerCount: number
  requiredGroupCount: number
  missingLayerIds: string[]
  duplicateLayerIds: string[]
  missingGroupIds: string[]
  duplicateGroupIds: string[]
  missingSceneIds: string[]
  invalidSceneIds: string[]
  performanceProgramMatches: boolean
  selectedLayerReferenceValid: boolean
}

/**
 * Production-safe integrity inspection for the live PixGrid document. The
 * canonical contract comes only from the source registry, never from a
 * persisted React preset object that may predate the current application.
 */
export function inspectPixGridCanonicalPresetIntegrity(
  rawState: unknown,
  presetId?: string | null,
): PixGridCanonicalPresetIntegrity {
  const state = normalizePixGridState(rawState)
  const resolvedPresetId = presetId ?? state.selectedPresetId ?? state.configuration.sourcePresetId
  const preset = resolvedPresetId ? PIX_GRID_PRESET_BY_ID.get(resolvedPresetId) ?? null : null
  if (!preset?.pixGridSettings) {
    return {
      presetId: resolvedPresetId ?? null,
      complete: false,
      canonicalLayerCount: 0,
      canonicalGroupCount: 0,
      requiredLayerCount: 0,
      requiredGroupCount: 0,
      missingLayerIds: [],
      duplicateLayerIds: [],
      missingGroupIds: [],
      duplicateGroupIds: [],
      missingSceneIds: [],
      invalidSceneIds: [],
      performanceProgramMatches: false,
      selectedLayerReferenceValid: state.editor.selectedLayerId == null,
    }
  }

  const requiredLayerIds = (preset.pixGridSettings.layers ?? []).map(layer => layer.id)
  const requiredGroupIds = (preset.pixGridSettings.groups ?? []).map(group => group.id)
  const requiredSceneIds = Object.keys(preset.pixGridSettings.sceneSettings ?? {})
  const layerCounts = new Map<string, number>()
  const groupCounts = new Map<string, number>()
  for (const layer of state.layers) layerCounts.set(layer.id, (layerCounts.get(layer.id) ?? 0) + 1)
  for (const group of state.groups) groupCounts.set(group.id, (groupCounts.get(group.id) ?? 0) + 1)
  const missingLayerIds = requiredLayerIds.filter(id => (layerCounts.get(id) ?? 0) === 0)
  const duplicateLayerIds = requiredLayerIds.filter(id => (layerCounts.get(id) ?? 0) > 1)
  const missingGroupIds = requiredGroupIds.filter(id => (groupCounts.get(id) ?? 0) === 0)
  const duplicateGroupIds = requiredGroupIds.filter(id => (groupCounts.get(id) ?? 0) > 1)
  const liveLayerIds = new Set(state.layers.map(layer => layer.id))
  const sceneCounts = new Map<string, number>()
  const sceneById = new Map<string, PixGridState['scenes'][number]>()
  for (const scene of state.scenes) {
    sceneCounts.set(scene.id, (sceneCounts.get(scene.id) ?? 0) + 1)
    sceneById.set(scene.id, scene)
  }
  const missingSceneIds = requiredSceneIds.filter(id => (sceneCounts.get(id) ?? 0) === 0)
  const invalidSceneIds = requiredSceneIds.filter(id => {
    const scene = sceneById.get(id)
    return Boolean(
      scene
      && (
        (sceneCounts.get(id) ?? 0) !== 1
        || requiredLayerIds.some(layerId => !scene.layerIds.includes(layerId))
        || scene.layerIds.some(layerId => !liveLayerIds.has(layerId))
      )
    )
  })
  const expectedProgramId = preset.pixGridSettings.performanceProgramId ?? null
  const performanceProgramMatches = state.performance.sharedPerformanceProgramId === expectedProgramId
  const selectedLayerReferenceValid = state.editor.selectedLayerId == null
    || state.layers.some(layer => layer.id === state.editor.selectedLayerId)
  const canonicalLayerCount = requiredLayerIds.filter(id => (layerCounts.get(id) ?? 0) === 1).length
  const canonicalGroupCount = requiredGroupIds.filter(id => (groupCounts.get(id) ?? 0) === 1).length
  const complete = state.selectedPresetId === preset.id
    && canonicalLayerCount === requiredLayerIds.length
    && canonicalGroupCount === requiredGroupIds.length
    && missingLayerIds.length === 0
    && duplicateLayerIds.length === 0
    && missingGroupIds.length === 0
    && duplicateGroupIds.length === 0
    && missingSceneIds.length === 0
    && invalidSceneIds.length === 0
    && performanceProgramMatches
    && selectedLayerReferenceValid
    && state.configuration.canonicalMigrationCompleted
    && state.configuration.presetConfigurationVersion >= (preset.pixGridSettings.authoredConfigurationVersion ?? 1)
    && state.configuration.layerGraphVersion >= PIX_GRID_BUILT_IN_LAYER_GRAPH_VERSION
    && state.configuration.smartGroupConfigurationVersion >= PIX_GRID_SMART_GROUP_CONFIGURATION_VERSION
    && state.configuration.performanceProgramConfigurationVersion >= PIX_GRID_PERFORMANCE_PROGRAM_CONFIGURATION_VERSION

  return {
    presetId: preset.id,
    complete,
    canonicalLayerCount,
    canonicalGroupCount,
    requiredLayerCount: requiredLayerIds.length,
    requiredGroupCount: requiredGroupIds.length,
    missingLayerIds,
    duplicateLayerIds,
    missingGroupIds,
    duplicateGroupIds,
    missingSceneIds,
    invalidSceneIds,
    performanceProgramMatches,
    selectedLayerReferenceValid,
  }
}

/**
 * Canonical activation guard used by hydration, preset selection, project
 * restoration, history restoration, and persistence. It is deliberately
 * idempotent and preserves compatible user overlays through the normal graph
 * migration path.
 */
export function ensurePixGridCanonicalPresetIntegrity(
  rawState: unknown,
  presetId?: string | null,
): PixGridState {
  const normalized = normalizePixGridState(rawState)
  const resolvedPresetId = presetId ?? normalized.selectedPresetId ?? normalized.configuration.sourcePresetId
  const canonicalPreset = resolvedPresetId ? PIX_GRID_PRESET_BY_ID.get(resolvedPresetId) ?? null : null
  return canonicalPreset?.pixGridSettings
    ? migratePixGridState(normalized, canonicalPreset)
    : normalized
}

export function markPixGridStateCustomized(state: PixGridState): PixGridState {
  return normalizePixGridState({
    ...state,
    configuration: {
      ...state.configuration,
      userCustomized: true,
    },
  })
}

const FALLBACK_ASSIGNMENT_INPUTS = [
  {
    id: 'pix-grid-fallback-bass-brightness',
    name: 'Baseline Bass Brightness',
    source: 'bass',
    target: 'brightness',
    targetScope: 'output',
    amount: 0.34,
    threshold: 0.08,
    attack: 0.025,
    hold: 0,
    release: 0.16,
    curve: 'smoothstep',
    blend: 'add',
    clamp: [0, 1],
  },
  {
    id: 'pix-grid-fallback-kick-impact',
    name: 'Baseline Kick Impact',
    source: 'kick',
    target: 'brightness',
    targetScope: 'output',
    amount: 0.28,
    attack: 0.01,
    hold: 0.035,
    release: 0.14,
    curve: 'easeOut',
    blend: 'add',
    clamp: [0, 1],
  },
  {
    id: 'pix-grid-fallback-energy-saturation',
    name: 'Baseline Energy Saturation',
    source: 'energy',
    target: 'saturation',
    targetScope: 'output',
    amount: 0.18,
    threshold: 0.12,
    attack: 0.08,
    hold: 0,
    release: 0.24,
    curve: 'easeInOut',
    blend: 'add',
    clamp: [0, 1],
  },
] as const

export const PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS: readonly PixGridReactionAssignment[] = Object.freeze(
  FALLBACK_ASSIGNMENT_INPUTS.map((input, index) => normalizePixGridReactionAssignment(input, index, 'output')!),
)

const PIX_GRID_BASELINE_FALLBACK_IDS = new Set(
  PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS.map(assignment => assignment.id),
)

const FALLBACK_SOURCE_BY_MODE: Partial<Record<NonNullable<PixGridReactionAssignment['capabilityFallback']>, PixGridReactionSource>> = {
  energy: 'energy',
  beat: 'beat',
  midHighActivity: 'mid',
  transient: 'transient',
}

function assignmentTargetExists(state: PixGridState, assignment: PixGridReactionAssignment, ownerGroupId?: string): boolean {
  const scope = assignment.targetScope ?? (ownerGroupId ? 'group' : 'output')
  const targetId = assignment.targetId ?? ((scope === 'group' || scope === 'pixels') ? ownerGroupId : null) ?? null
  switch (scope) {
    case 'scene': return targetId == null || state.scenes.some(scene => scene.id === targetId)
    case 'layer':
    case 'animation': return targetId == null || state.layers.some(layer => layer.id === targetId)
    case 'group':
    case 'pixels': return targetId == null || state.groups.some(group => group.id === targetId)
    default: return true
  }
}

function assignmentTargetCanRender(state: PixGridState, assignment: PixGridReactionAssignment, ownerGroupId?: string): boolean {
  if (!assignmentTargetExists(state, assignment, ownerGroupId)) return false
  const scope = assignment.targetScope ?? (ownerGroupId ? 'group' : 'output')
  if (scope === 'layer' || scope === 'animation') {
    if (!assignment.targetId) return state.layers.some(layer => layer.visible && layer.opacity > 0)
    const layer = state.layers.find(candidate => candidate.id === assignment.targetId)
    return Boolean(layer?.visible && layer.opacity > 0)
  }
  if (scope === 'scene') {
    if (!assignment.targetId) return state.scenes.some(scene => scene.layerIds.length > 0)
    const scene = state.scenes.find(candidate => candidate.id === assignment.targetId)
    return Boolean(scene?.layerIds.some(layerId => state.layers.some(layer => layer.id === layerId && layer.visible && layer.opacity > 0)))
  }
  if (scope !== 'group' && scope !== 'pixels') return true
  const targetId = assignment.targetId ?? ownerGroupId ?? null
  if (!targetId) return true
  const group = state.groups.find(candidate => candidate.id === targetId)
  if (!group) return false
  if (group.smartRuleId?.startsWith('deck:')) {
    const layerIds = group.layerScope?.length ? group.layerScope : group.layerId ? [group.layerId] : []
    return group.enabled
      && group.visible !== false
      && group.contentVisible !== false
      && layerIds.some(layerId => state.layers.some(layer => layer.id === layerId && layer.visible && layer.opacity > 0))
  }
  return inspectPixGridGroupTarget(state, group).usable
}

function assignmentConditionsCanMatch(state: PixGridState, assignment: PixGridReactionAssignment): boolean {
  const conditions = assignment.conditions
  if (!conditions) return true
  if (
    conditions.minimumEnergy != null
    && conditions.maximumEnergy != null
    && conditions.minimumEnergy > conditions.maximumEnergy
  ) return false
  if (conditions.activeLayerId && !state.layers.some(layer => layer.id === conditions.activeLayerId)) return false
  if (conditions.activeGroupId && !state.groups.some(group => group.id === conditions.activeGroupId && group.enabled)) return false
  return true
}

function assignmentSourceCanResolve(
  assignment: PixGridReactionAssignment,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
): boolean {
  if (!capabilities || capabilities[assignment.source] !== false) return true
  const fallback = assignment.capabilityFallback ?? 'disable'
  if (fallback === 'disable' || fallback === 'zero') return false
  const fallbackSource = FALLBACK_SOURCE_BY_MODE[fallback]
  return fallbackSource == null || capabilities[fallbackSource] !== false
}

/**
 * Returns whether an authored route can produce a visible result for this state.
 * This intentionally goes beyond `enabled`: zero-output routes, impossible
 * conditions, missing targets, empty masks, and unavailable sources do not
 * prevent the baseline safety routes from activating.
 */
export function isPixGridAudioAssignmentEffective(
  state: PixGridState,
  assignment: PixGridReactionAssignment,
  ownerGroupId?: string,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
): boolean {
  if (!assignment.enabled) return false
  if (Math.abs(assignment.amount) <= 1e-6) return false
  const outputRange = assignment.outputRange ?? [0, 1]
  if (Math.abs(outputRange[1] - outputRange[0]) <= 1e-6) return false
  if (Math.abs(assignment.clamp[1] - assignment.clamp[0]) <= 1e-6) return false
  if (!assignmentConditionsCanMatch(state, assignment)) return false
  if (!assignmentTargetCanRender(state, assignment, ownerGroupId)) return false
  const defaultScope = ownerGroupId ? 'group' : 'output'
  const compiled = PIX_GRID_EFFECTIVENESS_COMPILER.compile(assignment, capabilities ?? {}, defaultScope, `${ownerGroupId ?? 'audio'}:${assignment.id}`)
  if (!compiled.compatible) return false
  return assignmentSourceCanResolve(assignment, capabilities)
}

function countEffectiveNonFallbackAssignments(
  state: PixGridState,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
  performanceProgram?: PixGridPerformanceProgram | null,
): number {
  let count = state.audioAssignments.filter(assignment => (
    !PIX_GRID_BASELINE_FALLBACK_IDS.has(assignment.id)
    && isPixGridAudioAssignmentEffective(state, assignment, undefined, capabilities)
  )).length
  for (const group of state.groups) {
    if (!group.enabled) continue
    count += group.reactions.filter(assignment => (
      !PIX_GRID_BASELINE_FALLBACK_IDS.has(assignment.id)
      && isPixGridAudioAssignmentEffective(state, assignment, group.id, capabilities)
    )).length
  }
  const programId = state.performance.sharedPerformanceProgramId
  const program = performanceProgram !== undefined
    ? performanceProgram
    : programId
      ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(programId)
      : null
  if (program) {
    const compiled = new PixGridPerformanceProgramCompiler().compile(program, state, capabilities)
    count += compiled.assignments.filter(assignment => (
      isPixGridAudioAssignmentEffective(state, assignment, undefined, capabilities)
    )).length
  }
  return count
}

interface PixGridFallbackReconciliation {
  state: PixGridState
  fallbackActive: boolean
  validAssignmentCount: number
  assignmentsAdded: number
}

function fallbackAssignmentsMatch(
  current: readonly PixGridReactionAssignment[],
  desired: readonly PixGridReactionAssignment[],
): boolean {
  if (current.length !== desired.length) return false
  return current.every((assignment, index) => pixGridAssignmentSignature(assignment) === pixGridAssignmentSignature(desired[index]!))
}

function reconcilePixGridFallbackAssignments(
  state: PixGridState,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
  performanceProgram?: PixGridPerformanceProgram | null,
): PixGridFallbackReconciliation {
  const validNonFallbackCount = countEffectiveNonFallbackAssignments(state, capabilities, performanceProgram)
  const fallbackActive = validNonFallbackCount === 0
  const existingNonFallback = state.audioAssignments.filter(assignment => !PIX_GRID_BASELINE_FALLBACK_IDS.has(assignment.id))
  const existingFallback = state.audioAssignments.filter(assignment => PIX_GRID_BASELINE_FALLBACK_IDS.has(assignment.id))
  const canonicalFallback = PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS.map(assignment => ({
    ...cloneAssignment(assignment),
    enabled: fallbackActive,
  }))
  const fallbackDefinitionsRequired = existingFallback.length > 0 || fallbackActive
  const desiredAssignments = fallbackDefinitionsRequired
    ? [...existingNonFallback, ...canonicalFallback]
    : state.audioAssignments
  const assignmentsAdded = fallbackDefinitionsRequired
    ? Math.max(0, canonicalFallback.length - existingFallback.length)
    : 0
  const unchanged = desiredAssignments === state.audioAssignments || (
    existingNonFallback.length + existingFallback.length === state.audioAssignments.length
    && fallbackAssignmentsMatch(state.audioAssignments, desiredAssignments)
  )
  const nextState = unchanged ? state : { ...state, audioAssignments: desiredAssignments }
  const validAssignmentCount = validNonFallbackCount + (fallbackActive
    ? canonicalFallback.filter(assignment => isPixGridAudioAssignmentEffective(nextState, assignment, undefined, capabilities)).length
    : 0)
  return { state: nextState, fallbackActive, validAssignmentCount, assignmentsAdded }
}

export function countValidPixGridAudioAssignments(
  state: PixGridState,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
): number {
  let count = state.audioAssignments.filter(assignment => isPixGridAudioAssignmentEffective(state, assignment, undefined, capabilities)).length
  for (const group of state.groups) {
    if (!group.enabled) continue
    count += group.reactions.filter(assignment => isPixGridAudioAssignmentEffective(state, assignment, group.id, capabilities)).length
  }
  return count
}

export function ensurePixGridRuntimeAudioRoutes(
  state: PixGridState,
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>,
  performanceProgram?: PixGridPerformanceProgram | null,
): {
  state: PixGridState
  fallbackActive: boolean
  validAssignmentCount: number
} {
  const reconciled = reconcilePixGridFallbackAssignments(state, capabilities, performanceProgram)
  if (!reconciled.fallbackActive && reconciled.state === state) {
    return { state, fallbackActive: false, validAssignmentCount: reconciled.validAssignmentCount }
  }
  return {
    state: {
      ...reconciled.state,
      configuration: {
        ...reconciled.state.configuration,
        lastMigration: reconciled.state.configuration.lastMigration
          ? {
              ...reconciled.state.configuration.lastMigration,
              fallbackRoutesActive: reconciled.fallbackActive,
              fallbackRoutingInstalled: reconciled.state.configuration.lastMigration.fallbackRoutingInstalled
                || reconciled.assignmentsAdded > 0,
            }
          : reconciled.state.configuration.lastMigration,
      },
    },
    fallbackActive: reconciled.fallbackActive,
    validAssignmentCount: reconciled.validAssignmentCount,
  }
}

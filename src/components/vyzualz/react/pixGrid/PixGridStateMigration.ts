import type { ReactPreset } from '../ReactTypes'
import {
  createEmptyPixGridCanonicalSignatures,
  createPixGridCanonicalSignatures,
  pixGridAssignmentSignature,
  pixGridGlobalAssignmentSignatureKey,
  pixGridGroupAssignmentSignatureKey,
  pixGridGroupSignature,
  pixGridLayerAnimationSignature,
} from './PixGridConfiguration'
import { clonePixGridLayer } from './PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'
import {
  PIX_GRID_CONFIGURATION_METADATA_VERSION,
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridCanonicalSignatures,
  type PixGridGroup,
  type PixGridMigrationDiagnostics,
  type PixGridReactionAssignment,
  type PixGridState,
} from './PixGridTypes'
import { normalizePixGridReactionAssignment, normalizePixGridState } from './PixGridValidation'

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
  return state.layers.some(layer => Boolean(layer.mediaId) || !canonicalLayerIds.has(layer.id))
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
): boolean {
  if (!upgradeRequested) return false
  if (previousSignature) return previousSignature === existingSignature
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
  if (explicitPreset?.engine === 'pixGrid') return explicitPreset
  if (!state.selectedPresetId) return null
  return PIX_GRID_PRESET_BY_ID.get(state.selectedPresetId) ?? null
}

export function migratePixGridState(
  rawState: unknown,
  explicitPreset?: ReactPreset | null,
): PixGridState {
  const raw = isRecord(rawState) ? rawState : {}
  const fromStateVersion = finiteVersion(raw.version)
  const rawConfiguration = isRecord(raw.configuration) ? raw.configuration : null
  const fromPresetConfigurationVersion = finiteVersion(rawConfiguration?.presetConfigurationVersion)
  const normalized = normalizePixGridState(rawState)
  const preset = canonicalPresetFor(normalized, explicitPreset)

  if (!preset?.pixGridSettings) {
    const emptyCanonicalSignatures = createEmptyPixGridCanonicalSignatures()
    if (
      fromStateVersion >= PIX_GRID_STATE_VERSION
      && normalized.configuration.origin === 'custom'
      && normalized.configuration.musicReactiveConfigurationVersion >= PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION
      && canonicalSignaturesEqual(normalized.configuration.canonicalSignatures, emptyCanonicalSignatures)
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
      assignmentsAdded: 0,
      assignmentsPreserved: normalized.audioAssignments.length + normalized.groups.reduce((sum, group) => sum + group.reactions.length, 0),
      assignmentsUpgraded: 0,
      layersAdded: 0,
      scenesAdded: 0,
      fallbackRoutesActive: false,
    }
    return normalizePixGridState({
      ...normalized,
      configuration: {
        metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
        origin: 'custom',
        sourcePresetId: normalized.configuration.sourcePresetId,
        presetConfigurationVersion: 0,
        musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
        userCustomized: normalized.configuration.userCustomized,
        canonicalSignatures: emptyCanonicalSignatures,
        lastMigration: report,
      },
    })
  }

  const settings = preset.pixGridSettings
  const targetPresetConfigurationVersion = settings.authoredConfigurationVersion ?? 1
  const targetProgramId = settings.performanceProgramId ?? normalized.performance.sharedPerformanceProgramId
  const canonicalLayers = settings.layers ?? []
  const canonicalGroups = settings.groups ?? []
  const canonicalAssignments = settings.audioAssignments ?? []
  const targetCanonicalSignatures = createPixGridCanonicalSignatures(settings)
  const previousCanonicalSignatures = normalized.configuration.canonicalSignatures
  const canonicalSceneIds = Object.keys(settings.sceneSettings ?? {})
  const existingLayerIds = new Set(normalized.layers.map(layer => layer.id))
  const existingSceneIds = new Set(normalized.scenes.map(scene => scene.id))
  const missingCanonicalLayers = canonicalLayers.filter(layer => !existingLayerIds.has(layer.id))
  const missingScenes = canonicalSceneIds.filter(sceneId => !existingSceneIds.has(sceneId))
  const hasTrustedConfigurationMetadata = finiteVersion(rawConfiguration?.metadataVersion)
    >= PIX_GRID_CONFIGURATION_METADATA_VERSION
  const userCustomized = hasTrustedConfigurationMetadata
    ? rawConfiguration?.userCustomized === true
    : strongLegacyCustomization(normalized, preset)
  const presetUpgradeRequested = hasTrustedConfigurationMetadata
    && rawConfiguration?.origin === 'builtInPreset'
    && fromPresetConfigurationVersion < targetPresetConfigurationVersion
  const allowBlindUpgrade = presetUpgradeRequested && !userCustomized
  const missingLayers = normalized.layers.length === 0 || (presetUpgradeRequested && !userCustomized)
    ? missingCanonicalLayers
    : []

  const groupMerge = mergeCanonicalGroups(normalized.groups, canonicalGroups, {
    upgradeRequested: presetUpgradeRequested,
    allowBlindUpgrade,
    previousSignatures: previousCanonicalSignatures,
  })
  const assignmentMerge = mergeCanonicalAssignments(normalized.audioAssignments, canonicalAssignments, {
    upgradeRequested: presetUpgradeRequested,
    allowBlindUpgrade,
    previousSignatures: previousCanonicalSignatures.assignments,
    signatureKey: pixGridGlobalAssignmentSignatureKey,
  })
  const canonicalLayerById = new Map(canonicalLayers.map(layer => [layer.id, layer]))
  const layerAnimationUpgradeIds = new Set(normalized.layers.flatMap(layer => {
    const canonicalLayer = canonicalLayerById.get(layer.id)
    if (!canonicalLayer) return []
    return shouldUpgradeCanonicalEntity(
      presetUpgradeRequested,
      allowBlindUpgrade,
      previousCanonicalSignatures.layerAnimations[layer.id],
      pixGridLayerAnimationSignature(layer),
    ) ? [layer.id] : []
  }))
  const programMissing = targetProgramId != null && normalized.performance.sharedPerformanceProgramId !== targetProgramId
  const migrationNeeded = fromStateVersion < PIX_GRID_STATE_VERSION
    || fromPresetConfigurationVersion < targetPresetConfigurationVersion
    || normalized.configuration.musicReactiveConfigurationVersion < PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION
    || missingLayers.length > 0
    || missingScenes.length > 0
    || groupMerge.groupsAdded > 0
    || groupMerge.groupsUpgraded > 0
    || groupMerge.assignmentsAdded > 0
    || groupMerge.assignmentsUpgraded > 0
    || assignmentMerge.added > 0
    || assignmentMerge.upgraded > 0
    || layerAnimationUpgradeIds.size > 0
    || programMissing
    || normalized.selectedPresetId !== preset.id
    || !canonicalSignaturesEqual(previousCanonicalSignatures, targetCanonicalSignatures)

  if (!migrationNeeded) return normalized

  const layers = [
    ...normalized.layers.map(layer => {
      const canonicalLayer = canonicalLayerById.get(layer.id)
      return canonicalLayer && layerAnimationUpgradeIds.has(layer.id)
        ? mergeCanonicalLayerAnimationMetadata(layer, canonicalLayer)
        : clonePixGridLayer(layer)
    }),
    ...missingLayers.map(clonePixGridLayer),
  ]
  const allLayerIds = layers.map(layer => layer.id)
  const scenes = [
    ...normalized.scenes.map(scene => ({ ...scene, layerIds: [...scene.layerIds], pixelOverrides: [...scene.pixelOverrides] })),
    ...missingScenes.map((sceneId, index) => ({
      id: sceneId,
      name: (sceneId.split('-').slice(-1)[0] ?? `scene-${normalized.scenes.length + index + 1}`).replace(/^./, (character: string) => character.toUpperCase()),
      layerIds: [...allLayerIds],
      pixelOverrides: [],
    })),
  ]
  const report: PixGridMigrationDiagnostics = {
    applied: true,
    fromStateVersion,
    toStateVersion: PIX_GRID_STATE_VERSION,
    fromPresetConfigurationVersion,
    toPresetConfigurationVersion: targetPresetConfigurationVersion,
    groupsAdded: groupMerge.groupsAdded,
    groupsPreserved: groupMerge.groupsPreserved,
    groupsUpgraded: groupMerge.groupsUpgraded,
    assignmentsAdded: groupMerge.assignmentsAdded + assignmentMerge.added,
    assignmentsPreserved: groupMerge.assignmentsPreserved + assignmentMerge.preserved,
    assignmentsUpgraded: groupMerge.assignmentsUpgraded + assignmentMerge.upgraded,
    layersAdded: missingLayers.length,
    scenesAdded: missingScenes.length,
    fallbackRoutesActive: false,
  }

  return normalizePixGridState({
    ...normalized,
    selectedPresetId: preset.id,
    layers,
    scenes,
    groups: groupMerge.groups,
    audioAssignments: assignmentMerge.assignments,
    performance: {
      ...normalized.performance,
      enabled: targetProgramId ? true : normalized.performance.enabled,
      sharedPerformanceProgramId: targetProgramId,
    },
    configuration: {
      metadataVersion: PIX_GRID_CONFIGURATION_METADATA_VERSION,
      origin: 'builtInPreset',
      sourcePresetId: normalized.configuration.sourcePresetId ?? preset.id,
      presetConfigurationVersion: targetPresetConfigurationVersion,
      musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
      userCustomized,
      canonicalSignatures: targetCanonicalSignatures,
      lastMigration: report,
    },
  })
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

function assignmentTargetExists(state: PixGridState, assignment: PixGridReactionAssignment, ownerGroupId?: string): boolean {
  const targetId = assignment.targetId ?? ownerGroupId ?? null
  switch (assignment.targetScope) {
    case 'scene': return targetId == null || state.scenes.some(scene => scene.id === targetId)
    case 'layer':
    case 'animation': return targetId == null || state.layers.some(layer => layer.id === targetId)
    case 'group':
    case 'pixels': return targetId == null || state.groups.some(group => group.id === targetId)
    default: return true
  }
}

export function countValidPixGridAudioAssignments(state: PixGridState): number {
  let count = state.audioAssignments.filter(assignment => assignment.enabled && assignmentTargetExists(state, assignment)).length
  for (const group of state.groups) {
    if (!group.enabled) continue
    count += group.reactions.filter(assignment => assignment.enabled && assignmentTargetExists(state, assignment, group.id)).length
  }
  return count
}

export function ensurePixGridRuntimeAudioRoutes(state: PixGridState): {
  state: PixGridState
  fallbackActive: boolean
  validAssignmentCount: number
} {
  const fallbackIds = new Set(PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS.map(assignment => assignment.id))
  const validAssignmentCount = countValidPixGridAudioAssignments(state)
  const validNonFallbackCount = state.audioAssignments.filter(assignment => (
    assignment.enabled
    && assignmentTargetExists(state, assignment)
    && !fallbackIds.has(assignment.id)
  )).length + state.groups.reduce((count, group) => (
    group.enabled
      ? count + group.reactions.filter(assignment => assignment.enabled && assignmentTargetExists(state, assignment, group.id)).length
      : count
  ), 0)
  if (validNonFallbackCount > 0) return { state, fallbackActive: false, validAssignmentCount }
  const existingIds = new Set(state.audioAssignments.map(assignment => assignment.id))
  const fallbackAssignments = PIX_GRID_BASELINE_FALLBACK_ASSIGNMENTS
    .filter(assignment => !existingIds.has(assignment.id))
    .map(cloneAssignment)
  const nextAssignments = fallbackAssignments.length > 0
    ? [...state.audioAssignments.map(cloneAssignment), ...fallbackAssignments]
    : state.audioAssignments
  const activeFallbackCount = nextAssignments.filter(assignment => (
    fallbackIds.has(assignment.id) && assignment.enabled && assignmentTargetExists(state, assignment)
  )).length
  return {
    state: {
      ...state,
      audioAssignments: nextAssignments,
      configuration: {
        ...state.configuration,
        lastMigration: state.configuration.lastMigration
          ? { ...state.configuration.lastMigration, fallbackRoutesActive: true }
          : state.configuration.lastMigration,
      },
    },
    fallbackActive: true,
    validAssignmentCount: activeFallbackCount,
  }
}

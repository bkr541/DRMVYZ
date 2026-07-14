import type { ReactSectionType } from '../musicIntelligence/types'
import type { SharedPerformanceContext } from './context'
import type { SharedPerformanceProgram, SharedPerformanceProgramScene } from './programRuntime'

export type SharedPerformanceEngineKind = 'laserDmx' | 'soundDrawing' | 'canvas'

/** Highest authority first. Engine adapters apply these in reverse construction order. */
export const SHARED_PERFORMANCE_PRECEDENCE = [
  'safetyAndResourceClamps',
  'explicitUserLocks',
  'requiredFallbackCorrections',
  'authoredSceneState',
  'phraseAndBarProgression',
  'discreteEventActions',
  'continuousModulation',
  'engineDefaults',
] as const

export type SharedPerformancePrecedenceStage = typeof SHARED_PERFORMANCE_PRECEDENCE[number]
export type SharedPerformanceValidationSeverity = 'error' | 'warning' | 'info'

export interface SharedPerformanceProgramMetadata {
  name: string
  description?: string
  engine: SharedPerformanceEngineKind
  version: number
  authoringRevision?: string
  visualIdentity?: string
}

export interface SharedPerformanceBarRange {
  startBar?: number
  endBar?: number
}

export interface SharedPerformanceCapabilityRequirement {
  capability: keyof SharedPerformanceContext['capabilities']
  optional?: boolean
}

export interface SharedPerformanceConfidenceRequirement {
  confidence: keyof SharedPerformanceContext['confidence']
  min: number
}

export interface SharedPerformanceProgramValidationIssue {
  severity: SharedPerformanceValidationSeverity
  code: string
  message: string
  programId: string
  sceneId?: string
  actionPath?: string
}

export interface SharedPerformanceActionValidationContext {
  programId: string
  sceneId: string
  actionPath: string
  knownSceneIds: ReadonlySet<string>
}

export interface SharedPerformanceActionValidationAdapter<TAction> {
  validate(action: TAction, context: SharedPerformanceActionValidationContext): readonly Omit<SharedPerformanceProgramValidationIssue, 'programId' | 'sceneId' | 'actionPath'>[]
  /** Identifies state-replacement actions that cannot safely overlap inside one action group. */
  exclusiveTargetKey?(action: TAction): string | null
  estimateResources?(action: TAction): Partial<Record<SharedPerformanceResourceKind, number>>
}

export type SharedPerformanceResourceKind = 'layers' | 'traces' | 'particles' | 'envelopes' | 'decoders' | 'textures' | 'feedbackPasses' | 'beams'

export interface SharedPerformanceProgramValidationOptions<TAction> {
  adapter?: SharedPerformanceActionValidationAdapter<TAction>
  resourceLimits?: Partial<Record<SharedPerformanceResourceKind, number>>
  requireFallbackScene?: boolean
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function matcherIdentity<TAction>(scene: SharedPerformanceProgramScene<TAction>): string {
  return JSON.stringify({
    sectionTypes: [...scene.sectionTypes].sort(),
    sectionFamilies: [...(scene.sectionFamilies ?? [])].sort(),
    occurrence: scene.occurrence ?? null,
    dropOccurrence: scene.dropOccurrence ?? null,
    barRange: scene.barRange ?? null,
    sectionPhases: [...(scene.sectionPhases ?? [])].sort(),
    capabilityRequirements: scene.capabilityRequirements ?? null,
    confidenceRequirements: scene.confidenceRequirements ?? null,
  })
}

function actionGroups<TAction>(scene: SharedPerformanceProgramScene<TAction>): Array<[string, readonly TAction[] | undefined]> {
  const groups: Array<[string, readonly TAction[] | undefined]> = [
    ['actions', scene.actions],
    ['entryActions', scene.entryActions],
    ['bodyActions', scene.bodyActions],
    ['exitActions', scene.exitActions],
  ]
  scene.fourBarActions?.forEach((actions, index) => groups.push([`fourBarActions[${index}]`, actions]))
  scene.eightBarRecruitment?.forEach((actions, index) => groups.push([`eightBarRecruitment[${index}]`, actions]))
  scene.sixteenBarEvolution?.forEach((actions, index) => groups.push([`sixteenBarEvolution[${index}]`, actions]))
  scene.variations?.forEach((variation, index) => groups.push([`variations[${index}:${variation.id}]`, variation.actions]))
  Object.entries(scene.eventActions ?? {}).forEach(([event, actions]) => groups.push([`eventActions.${event}`, actions]))
  return groups
}

function occurrenceIssues(
  programId: string,
  sceneId: string,
  label: string,
  match: SharedPerformanceProgramScene<unknown>['occurrence'],
): SharedPerformanceProgramValidationIssue[] {
  if (!match) return []
  const issues: SharedPerformanceProgramValidationIssue[] = []
  if (match.every != null && (!finite(match.every) || match.every <= 0 || !Number.isInteger(match.every))) {
    issues.push({ severity: 'error', code: 'invalid-occurrence-step', message: `${label}.every must be a positive integer.`, programId, sceneId })
  }
  if (match.minOccurrence != null && match.maxOccurrence != null && match.minOccurrence > match.maxOccurrence) {
    issues.push({ severity: 'error', code: 'invalid-occurrence-range', message: `${label} minimum exceeds maximum.`, programId, sceneId })
  }
  if (match.occurrences?.some(value => !finite(value) || value < 0 || !Number.isInteger(value))) {
    issues.push({ severity: 'error', code: 'invalid-occurrence-value', message: `${label}.occurrences contains a non-negative-integer violation.`, programId, sceneId })
  }
  return issues
}

export function validateSharedPerformanceProgram<TAction>(
  program: SharedPerformanceProgram<TAction>,
  options: SharedPerformanceProgramValidationOptions<TAction> = {},
): SharedPerformanceProgramValidationIssue[] {
  const issues: SharedPerformanceProgramValidationIssue[] = []
  const programId = program.id?.trim() || 'unknown-program'
  if (!program.id?.trim()) issues.push({ severity: 'error', code: 'missing-program-id', message: 'Program ID is required.', programId })
  if (!program.scenes.length) issues.push({ severity: 'error', code: 'missing-scenes', message: 'Program must contain at least one scene.', programId })
  if (program.metadata && (!program.metadata.name.trim() || program.metadata.version < 1)) {
    issues.push({ severity: 'error', code: 'invalid-program-metadata', message: 'Program metadata requires a name and version >= 1.', programId })
  }

  const sceneIds = new Set<string>()
  for (const scene of program.scenes) {
    if (!scene.id.trim()) issues.push({ severity: 'error', code: 'missing-scene-id', message: 'Scene ID is required.', programId })
    if (sceneIds.has(scene.id)) issues.push({ severity: 'error', code: 'duplicate-scene-id', message: `Duplicate scene ID “${scene.id}”.`, programId, sceneId: scene.id })
    sceneIds.add(scene.id)
  }

  const fallbackSceneId = program.fallbackSceneId
  if (fallbackSceneId && !sceneIds.has(fallbackSceneId)) {
    issues.push({ severity: 'error', code: 'missing-fallback-scene', message: `Fallback scene “${fallbackSceneId}” does not exist.`, programId })
  } else if (options.requireFallbackScene && !fallbackSceneId) {
    issues.push({ severity: 'warning', code: 'fallback-scene-not-declared', message: 'Program does not declare fallbackSceneId.', programId })
  }
  for (const fallbackType of program.fallbackOrder ?? []) {
    if (!program.scenes.some(scene => scene.sectionTypes.includes(fallbackType))) {
      issues.push({ severity: 'warning', code: 'unreachable-fallback-type', message: `Fallback section type “${fallbackType}” has no matching scene.`, programId })
    }
  }

  const firstMatcher = new Map<string, SharedPerformanceProgramScene<TAction>>()
  for (const scene of program.scenes) {
    if (!scene.sectionTypes.length) issues.push({ severity: 'error', code: 'missing-section-match', message: 'Scene must match at least one section type.', programId, sceneId: scene.id })
    if (scene.minConfidence != null && (!finite(scene.minConfidence) || scene.minConfidence < 0 || scene.minConfidence > 1)) {
      issues.push({ severity: 'error', code: 'invalid-min-confidence', message: 'minConfidence must be between 0 and 1.', programId, sceneId: scene.id })
    }
    for (const requirement of scene.confidenceRequirements ?? []) {
      if (!finite(requirement.min) || requirement.min < 0 || requirement.min > 1) {
        issues.push({ severity: 'error', code: 'invalid-confidence-requirement', message: `${requirement.confidence} confidence must be between 0 and 1.`, programId, sceneId: scene.id })
      }
    }
    if (scene.barRange) {
      const { startBar, endBar } = scene.barRange
      if (startBar != null && (!finite(startBar) || startBar < 0 || !Number.isInteger(startBar))) {
        issues.push({ severity: 'error', code: 'invalid-bar-range', message: 'barRange.startBar must be a non-negative integer.', programId, sceneId: scene.id })
      }
      if (endBar != null && (!finite(endBar) || endBar < 0 || !Number.isInteger(endBar))) {
        issues.push({ severity: 'error', code: 'invalid-bar-range', message: 'barRange.endBar must be a non-negative integer.', programId, sceneId: scene.id })
      }
      if (startBar != null && endBar != null && startBar > endBar) {
        issues.push({ severity: 'error', code: 'invalid-bar-range', message: 'barRange start exceeds end.', programId, sceneId: scene.id })
      }
    }
    issues.push(...occurrenceIssues(programId, scene.id, 'occurrence', scene.occurrence))
    issues.push(...occurrenceIssues(programId, scene.id, 'dropOccurrence', scene.dropOccurrence))

    const identity = matcherIdentity(scene)
    const previous = firstMatcher.get(identity)
    if (previous && (previous.priority ?? 0) >= (scene.priority ?? 0)) {
      issues.push({ severity: 'warning', code: 'unreachable-scene', message: `Scene is shadowed by “${previous.id}” with an identical matcher and equal or higher priority.`, programId, sceneId: scene.id })
    } else if (!previous || (scene.priority ?? 0) > (previous.priority ?? 0)) {
      firstMatcher.set(identity, scene)
    }

    const resourceTotals: Partial<Record<SharedPerformanceResourceKind, number>> = {}
    for (const [groupName, actions] of actionGroups(scene)) {
      const exclusiveTargets = new Map<string, number>()
      actions?.forEach((action, actionIndex) => {
        const actionPath = `${groupName}[${actionIndex}]`
        for (const issue of options.adapter?.validate(action, { programId, sceneId: scene.id, actionPath, knownSceneIds: sceneIds }) ?? []) {
          issues.push({ ...issue, programId, sceneId: scene.id, actionPath })
        }
        const exclusiveTarget = options.adapter?.exclusiveTargetKey?.(action)
        if (exclusiveTarget) {
          const previousIndex = exclusiveTargets.get(exclusiveTarget)
          if (previousIndex != null) {
            issues.push({
              severity: 'warning',
              code: 'overlapping-incompatible-actions',
              message: `Actions ${groupName}[${previousIndex}] and ${actionPath} both replace “${exclusiveTarget}”; the later action wins.`,
              programId,
              sceneId: scene.id,
              actionPath,
            })
          }
          exclusiveTargets.set(exclusiveTarget, actionIndex)
        }
        for (const [kind, value] of Object.entries(options.adapter?.estimateResources?.(action) ?? {}) as Array<[SharedPerformanceResourceKind, number]>) {
          resourceTotals[kind] = (resourceTotals[kind] ?? 0) + Math.max(0, Number.isFinite(value) ? value : 0)
        }
      })
    }
    for (const [kind, limit] of Object.entries(options.resourceLimits ?? {}) as Array<[SharedPerformanceResourceKind, number]>) {
      if ((resourceTotals[kind] ?? 0) > limit) {
        issues.push({ severity: 'warning', code: `resource-limit-${kind}`, message: `Authored ${kind} demand ${resourceTotals[kind]} exceeds limit ${limit}; runtime clamps will apply.`, programId, sceneId: scene.id })
      }
    }
  }
  return issues
}

export function validateSharedPerformanceProgramCollection<TAction>(
  programs: readonly SharedPerformanceProgram<TAction>[],
  options: SharedPerformanceProgramValidationOptions<TAction> = {},
): SharedPerformanceProgramValidationIssue[] {
  const issues = programs.flatMap(program => validateSharedPerformanceProgram(program, options))
  const ids = new Set<string>()
  for (const program of programs) {
    if (ids.has(program.id)) issues.push({ severity: 'error', code: 'duplicate-program-id', message: `Duplicate program ID “${program.id}”.`, programId: program.id })
    ids.add(program.id)
  }
  return issues
}

export const SHARED_PERFORMANCE_SECTION_TYPES: readonly ReactSectionType[] = [
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
]

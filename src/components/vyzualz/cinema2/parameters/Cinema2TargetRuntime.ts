import type {
  Cinema2CapabilityId,
  Cinema2ChoreographyActionId,
  Cinema2ChoreographyActionManifest,
  Cinema2JsonValue,
  Cinema2NativePresetManifest,
  Cinema2ParameterId,
  Cinema2PresetId,
  Cinema2WritableTargetRef,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2CompiledParameterDefinition,
  Cinema2CompiledParameterPlan,
} from './Cinema2ParameterSchema'

export const CINEMA2_TARGET_PLAN_VERSION = 1 as const

declare const CINEMA2_TARGET_ID: unique symbol
export type Cinema2TargetId = string & { readonly [CINEMA2_TARGET_ID]: 'cinema2-target' }

export type Cinema2TargetEntityKind =
  | 'preset'
  | 'parameter'
  | 'layer'
  | 'module'
  | 'scene-node'
  | 'effect'
  | 'camera'
  | 'light'
  | 'environment'
  | 'media'
  | 'action'
  | 'variation'

export type Cinema2TargetValueType =
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'vec2'
  | 'vec3'
  | 'string'
  | 'text'
  | 'media'
  | 'status'
  | 'action'

export type Cinema2TargetOperation = 'add' | 'multiply' | 'replace' | 'action'
export type Cinema2TargetUserAuthority = 'base' | 'scale' | 'lock'
export type Cinema2TargetCapabilityAvailability = 'unresolved' | 'available' | 'unavailable'

export interface Cinema2TargetDiagnostic {
  code: string
  message: string
  path: string
}

export interface Cinema2TargetEntityHandle {
  id: Cinema2TargetId
  kind: Cinema2TargetEntityKind
  ownerId: string
}

export interface Cinema2TargetHandle {
  id: Cinema2TargetId
  entityId: Cinema2TargetId
  kind: Cinema2TargetEntityKind
  ownerId: string
  property: string
  channel: 'value' | 'action'
  valueType: Cinema2TargetValueType
  operations: readonly Cinema2TargetOperation[]
  parameterId: Cinema2ParameterId | null
  authoredBaseValue: Cinema2JsonValue | undefined
  min: number | null
  max: number | null
  step: number | null
  options: readonly string[]
  capabilities: readonly Cinema2CapabilityId[]
  capabilityAvailability: Cinema2TargetCapabilityAvailability
}

export interface Cinema2CompiledChoreographyTargetHandle {
  actionId: Cinema2ChoreographyActionId
  target: Readonly<Cinema2TargetHandle>
  operation: Cinema2TargetOperation
}

export interface Cinema2CompiledTargetPlan {
  version: typeof CINEMA2_TARGET_PLAN_VERSION
  presetId: Cinema2PresetId
  entities: readonly Readonly<Cinema2TargetEntityHandle>[]
  targets: readonly Readonly<Cinema2TargetHandle>[]
  choreographyTargets: readonly Readonly<Cinema2CompiledChoreographyTargetHandle>[]
}

export interface Cinema2TargetPlanCompilationResult {
  plan: Readonly<Cinema2CompiledTargetPlan>
  diagnostics: readonly Cinema2TargetDiagnostic[]
}

export interface Cinema2TargetPlanCompileOptions {
  availableCapabilities?: Iterable<Cinema2CapabilityId>
}

export interface Cinema2TargetContribution {
  contributorId: string
  operation: Cinema2TargetOperation
  value?: Cinema2JsonValue
  priority?: number
  eventId?: string
}

/** One transient runtime contribution routed through the canonical resolver. */
export interface Cinema2TargetContributionSubmission {
  targetId: Cinema2TargetId
  contribution: Readonly<Cinema2TargetContribution>
}

export interface Cinema2TargetWriteBatchResult {
  ok: boolean
  /** True when the canonical transient set was atomically replaced (including fail-safe clear). */
  applied: boolean
  diagnostics: readonly Cinema2TargetDiagnostic[]
}

export interface Cinema2ResolvedTargetValue {
  ok: boolean
  target: Readonly<Cinema2TargetHandle> | null
  value: Cinema2JsonValue | undefined
  diagnostics: readonly Cinema2TargetDiagnostic[]
}

export interface Cinema2DispatchedTargetAction {
  targetId: Cinema2TargetId
  contributorId: string
  eventId: string
  priority: number
  payload: Cinema2JsonValue | undefined
}

export interface Cinema2ActionDispatchResult {
  ok: boolean
  target: Readonly<Cinema2TargetHandle> | null
  events: readonly Readonly<Cinema2DispatchedTargetAction>[]
  diagnostics: readonly Cinema2TargetDiagnostic[]
}

export interface Cinema2FinalValueResolverOptions {
  resolveBaseValue?: (target: Readonly<Cinema2TargetHandle>) => Cinema2JsonValue | undefined
  dispatchAction?: (event: Readonly<Cinema2DispatchedTargetAction>) => void
  /** Shared transient state is currently owned only by engine choreography. */
  authorizedTransientWriterIds?: readonly string[]
}

const NUMERIC_OPERATIONS = Object.freeze(['add', 'multiply', 'replace'] as const)
const REPLACE_ONLY = Object.freeze(['replace'] as const)
const ACTION_ONLY = Object.freeze(['action'] as const)

interface Cinema2TargetDefinitionOptions {
  operations?: readonly Cinema2TargetOperation[]
  parameterId?: Cinema2ParameterId | null
  min?: number | null
  max?: number | null
  step?: number | null
  values?: readonly string[]
  capabilities?: readonly Cinema2CapabilityId[]
}

type AddCinema2Target = (
  entity: Cinema2TargetEntityHandle,
  property: string,
  valueType: Cinema2TargetValueType,
  authoredBaseValue: Cinema2JsonValue | undefined,
  options?: Cinema2TargetDefinitionOptions,
) => Cinema2TargetHandle

export function compileCinema2TargetPlan(
  manifest: Readonly<Cinema2NativePresetManifest>,
  parameters: Readonly<Cinema2CompiledParameterPlan>,
  compileOptions: Cinema2TargetPlanCompileOptions = {},
): Cinema2TargetPlanCompilationResult {
  const diagnostics: Cinema2TargetDiagnostic[] = []
  const entities: Cinema2TargetEntityHandle[] = []
  const targets: Cinema2TargetHandle[] = []
  const targetByLookup = new Map<string, Cinema2TargetHandle>()
  const availableCapabilities = compileOptions.availableCapabilities == null
    ? null
    : new Set<Cinema2CapabilityId>(compileOptions.availableCapabilities)

  const addEntity = (kind: Cinema2TargetEntityKind, ownerId: string): Cinema2TargetEntityHandle => {
    const entity = freeze({ id: entityTargetId(manifest.id, kind, ownerId), kind, ownerId })
    entities.push(entity)
    return entity
  }
  const addTarget = (
    entity: Cinema2TargetEntityHandle,
    property: string,
    valueType: Cinema2TargetValueType,
    authoredBaseValue: Cinema2JsonValue | undefined,
    options: Cinema2TargetDefinitionOptions = {},
  ): Cinema2TargetHandle => {
    const operations = options.operations ?? operationsForType(valueType)
    const handle = freeze({
      id: propertyTargetId(entity.id, property),
      entityId: entity.id,
      kind: entity.kind,
      ownerId: entity.ownerId,
      property,
      channel: valueType === 'action' ? 'action' as const : 'value' as const,
      valueType,
      operations: Object.freeze([...operations]),
      parameterId: options.parameterId ?? null,
      authoredBaseValue: cloneJson(authoredBaseValue),
      min: options.min ?? null,
      max: options.max ?? null,
      step: options.step ?? null,
      options: Object.freeze([...(options.values ?? [])]),
      capabilities: Object.freeze([...(options.capabilities ?? [])].sort(compareStrings)),
      capabilityAvailability: resolveCapabilityAvailability(options.capabilities ?? [], availableCapabilities),
    })
    targets.push(handle)
    targetByLookup.set(lookupKey(entity.kind, entity.ownerId, property), handle)
    return handle
  }

  const presetEntity = addEntity('preset', 'root')
  void presetEntity

  for (const definition of parameters.definitions) {
    const entity = addEntity('parameter', definition.id)
    addParameterTarget(entity, definition, parameters.authoredDefaults[definition.id], addTarget)
    if (definition.type === 'trigger') addEntity('action', definition.id)
  }

  for (const layer of manifest.layers ?? []) {
    const entity = addEntity('layer', layer.id)
    addTarget(entity, 'visible', 'boolean', layer.visible ?? true)
    addTarget(entity, 'opacity', 'number', layer.opacity ?? 1, { min: 0, max: 1 })
  }

  for (const module of manifest.modules ?? []) {
    const entity = addEntity('module', module.id)
    const capabilities = module.capabilities?.map(capability => capability.id) ?? []
    addTarget(entity, 'enabled', 'boolean', module.enabled ?? true, { capabilities })
    for (const [property, value] of Object.entries(module.parameters ?? {}).sort(compareEntries)) {
      addInferredTarget(
        entity,
        property,
        value,
        addTarget,
        capabilities,
        module.parameterBindings?.[property]?.$ref ?? null,
      )
    }
  }

  for (const node of manifest.scene?.nodes ?? []) {
    const entity = addEntity('scene-node', node.id)
    addTarget(entity, 'visible', 'boolean', node.visible ?? true)
    addTransformTargets(entity, node.transform, addTarget)
  }

  for (const effect of manifest.effects ?? []) {
    const entity = addEntity('effect', effect.id)
    addTarget(entity, 'enabled', 'boolean', effect.enabled ?? true, {
      parameterId: effect.parameterBindings?.enabled?.$ref ?? null,
    })
    for (const [property, value] of Object.entries(effect.parameters ?? {}).sort(compareEntries)) {
      addInferredTarget(entity, property, value, addTarget, [], effect.parameterBindings?.[property]?.$ref ?? null)
    }
  }

  for (const camera of manifest.cameras ?? []) {
    const entity = addEntity('camera', camera.id)
    addTransformTargets(entity, camera.transform, addTarget)
    addTarget(entity, 'target', 'vec3', camera.target ?? [0, 0, 0])
    if (camera.projection === 'perspective') addTarget(entity, 'fovDegrees', 'number', camera.fovDegrees ?? 50, { min: 1, max: 179 })
    addTarget(entity, 'near', 'number', camera.near ?? 0.1, { min: 0.0001 })
    addTarget(entity, 'far', 'number', camera.far ?? 1000, { min: 0.0001 })
  }

  for (const light of manifest.lighting?.lights ?? []) {
    const entity = addEntity('light', light.id)
    addTarget(entity, 'color', 'color', light.color ?? [1, 1, 1, 1], { min: 0, max: 1 })
    addTarget(entity, 'intensity', 'number', light.intensity ?? 1, { min: 0 })
    addTransformTargets(entity, light.transform, addTarget)
  }

  if (manifest.environment != null) {
    const entity = addEntity('environment', 'root')
    addTarget(entity, 'backgroundColor', 'color', manifest.environment.backgroundColor ?? [0, 0, 0, 1], { min: 0, max: 1 })
    addTarget(entity, 'exposure', 'number', manifest.environment.exposure ?? 1, { min: 0, max: 32 })
    if (manifest.environment.fog != null) {
      addTarget(entity, 'fog.color', 'color', manifest.environment.fog.color ?? [0, 0, 0, 1], { min: 0, max: 1 })
      addTarget(entity, 'fog.density', 'number', manifest.environment.fog.density ?? 0, { min: 0, max: 10 })
      addTarget(entity, 'fog.near', 'number', manifest.environment.fog.near ?? 0, { min: 0 })
      addTarget(entity, 'fog.far', 'number', manifest.environment.fog.far ?? 1000, { min: 0 })
    }
  }

  for (const media of manifest.mediaSlots ?? []) {
    const entity = addEntity('media', media.id)
    addTarget(entity, 'source', 'media', null)
  }

  for (const variation of manifest.variations ?? []) {
    const entity = addEntity('variation', variation.id)
    addTarget(entity, 'activate', 'action', undefined, { operations: ACTION_ONLY })
  }

  const choreographyTargets: Cinema2CompiledChoreographyTargetHandle[] = []
  for (const [ruleIndex, rule] of (manifest.choreography?.rules ?? []).entries()) {
    for (const [actionIndex, action] of rule.actions.entries()) {
      const actionEntity = addEntity('action', action.id)
      addTarget(actionEntity, 'dispatch', 'action', undefined, { operations: ACTION_ONLY })
      const path = `$.choreography.rules[${ruleIndex}].actions[${actionIndex}]`
      const handle = resolveWritableTargetHandle(action.target, targetByLookup)
      if (!handle) {
        diagnostics.push(issue('CINEMA2_TARGET_UNKNOWN_OR_UNSUPPORTED', 'Writable target is not registered or its property is unsupported.', `${path}.target`))
        continue
      }
      const operation = choreographyOperation(action)
      if (!handle.operations.includes(operation)) {
        diagnostics.push(issue(
          handle.channel === 'action' || operation === 'action' ? 'CINEMA2_TARGET_SCALAR_ACTION_MISMATCH' : 'CINEMA2_TARGET_COMPOSITION_INCOMPATIBLE',
          `Target "${handle.id}" does not support ${operation} composition.`,
          `${path}.operation`,
        ))
        continue
      }
      choreographyTargets.push(freeze({ actionId: action.id, target: handle, operation }))
    }
  }

  return freeze({
    plan: freeze({
      version: CINEMA2_TARGET_PLAN_VERSION,
      presetId: manifest.id,
      entities: Object.freeze([...entities].sort((a, b) => compareStrings(a.id, b.id))),
      targets: Object.freeze([...targets].sort((a, b) => compareStrings(a.id, b.id))),
      choreographyTargets: Object.freeze([...choreographyTargets].sort((a, b) => compareStrings(a.actionId, b.actionId))),
    }),
    diagnostics: Object.freeze(diagnostics.map(entry => freeze({ ...entry }))),
  })
}

export class Cinema2FinalValueResolver {
  private readonly targets = new Map<Cinema2TargetId, Readonly<Cinema2TargetHandle>>()
  private readonly transientContributions = new Map<Cinema2TargetId, readonly Readonly<Cinema2TargetContribution>[]>()
  private readonly resolveBaseValue: (target: Readonly<Cinema2TargetHandle>) => Cinema2JsonValue | undefined
  private readonly dispatchAction: ((event: Readonly<Cinema2DispatchedTargetAction>) => void) | null
  private readonly authorizedTransientWriterIds: ReadonlySet<string>

  constructor(
    readonly plan: Readonly<Cinema2CompiledTargetPlan>,
    options: Cinema2FinalValueResolverOptions = {},
  ) {
    for (const target of plan.targets) this.targets.set(target.id, target)
    this.resolveBaseValue = options.resolveBaseValue ?? (target => cloneJson(target.authoredBaseValue))
    this.dispatchAction = options.dispatchAction ?? null
    this.authorizedTransientWriterIds = new Set(options.authorizedTransientWriterIds ?? ['choreography'])
  }

  getTarget(targetId: Cinema2TargetId): Readonly<Cinema2TargetHandle> | null {
    return this.targets.get(targetId) ?? null
  }

  /**
   * Atomically replaces shared frame/runtime modulation without touching authored
   * or persistent state. The writer id is an ownership guard, not a creative
   * namespace. Invalid authorized batches fail safe to an empty transient set.
   */
  replaceTransientContributions(
    writerId: string,
    submissions: readonly Readonly<Cinema2TargetContributionSubmission>[],
  ): Readonly<Cinema2TargetWriteBatchResult> {
    const writerDiagnostic = this.authorizeTransientWriter(writerId)
    if (writerDiagnostic) return freeze({ ok: false, applied: false, diagnostics: Object.freeze([writerDiagnostic]) })

    const next = new Map<Cinema2TargetId, Cinema2TargetContribution[]>()
    const diagnostics: Cinema2TargetDiagnostic[] = []
    let invalid = false
    for (const submission of submissions) {
      const target = this.targets.get(submission.targetId) ?? null
      if (!target) {
        diagnostics.push(issue('CINEMA2_TARGET_UNKNOWN', `Unknown Cinema 2.0 target "${submission.targetId}" in transient write batch.`, String(submission.targetId)))
        invalid = true
        continue
      }
      if (!submission.contribution.contributorId.trim()) {
        diagnostics.push(issue('CINEMA2_TARGET_UNAUTHORIZED_WRITER', `Transient writer "${writerId}" submitted an empty contributor identity.`, target.id))
        invalid = true
        continue
      }
      if (writerId === 'choreography' && !submission.contribution.contributorId.startsWith('choreography:')) {
        diagnostics.push(issue('CINEMA2_TARGET_UNAUTHORIZED_WRITER', `Transient writer "${writerId}" cannot publish contributor "${submission.contribution.contributorId}".`, target.id))
        invalid = true
        continue
      }
      if (target.channel !== 'value' || submission.contribution.operation === 'action') {
        diagnostics.push(issue('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', `Transient value batch cannot write action target "${target.id}".`, target.id))
        invalid = true
        continue
      }
      if (!target.operations.includes(submission.contribution.operation)) {
        diagnostics.push(issue('CINEMA2_TARGET_COMPOSITION_INCOMPATIBLE', `Target "${target.id}" does not support ${submission.contribution.operation} composition.`, target.id))
        invalid = true
        continue
      }
      const values = next.get(submission.targetId) ?? []
      values.push(freeze({ ...submission.contribution, value: cloneJson(submission.contribution.value) }))
      next.set(submission.targetId, values)
    }

    if (invalid) {
      this.transientContributions.clear()
      return freeze({ ok: false, applied: true, diagnostics: Object.freeze(diagnostics) })
    }

    for (const [targetId, values] of next) {
      const target = this.targets.get(targetId)
      if (target) diagnoseReplacementConflict(target, values, diagnostics)
    }
    this.transientContributions.clear()
    for (const [targetId, values] of next) {
      this.transientContributions.set(targetId, Object.freeze([...values].sort(compareContributions)))
    }
    return freeze({ ok: diagnostics.length === 0, applied: true, diagnostics: Object.freeze(diagnostics) })
  }

  clearTransientContributions(writerId: string): Readonly<Cinema2TargetWriteBatchResult> {
    const writerDiagnostic = this.authorizeTransientWriter(writerId)
    if (writerDiagnostic) return freeze({ ok: false, applied: false, diagnostics: Object.freeze([writerDiagnostic]) })
    this.transientContributions.clear()
    return freeze({ ok: true, applied: true, diagnostics: Object.freeze([]) })
  }

  private authorizeTransientWriter(writerId: string): Cinema2TargetDiagnostic | null {
    const normalized = writerId.trim()
    if (normalized && this.authorizedTransientWriterIds.has(normalized)) return null
    return issue('CINEMA2_TARGET_UNAUTHORIZED_WRITER', `Writer "${writerId}" is not authorized to mutate shared Cinema 2.0 transient target state.`, '$.targets.transient')
  }

  getTransientContributions(targetId: Cinema2TargetId): readonly Readonly<Cinema2TargetContribution>[] {
    return this.transientContributions.get(targetId) ?? Object.freeze([])
  }

  resolve(
    targetId: Cinema2TargetId,
    contributions: readonly Readonly<Cinema2TargetContribution>[] = [],
    userAuthority: Cinema2TargetUserAuthority = 'base',
  ): Cinema2ResolvedTargetValue {
    const target = this.targets.get(targetId) ?? null
    if (!target) return failureValue('CINEMA2_TARGET_UNKNOWN', `Unknown Cinema 2.0 target "${targetId}".`, String(targetId))
    if (target.capabilityAvailability !== 'available') {
      return failureValue(
        target.capabilityAvailability === 'unavailable' ? 'CINEMA2_TARGET_CAPABILITY_UNAVAILABLE' : 'CINEMA2_TARGET_CAPABILITY_UNRESOLVED',
        `Target "${target.id}" cannot resolve because its required capability availability is ${target.capabilityAvailability}.`,
        target.id,
        target,
      )
    }
    if (target.channel === 'action') {
      return failureValue('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', `Action target "${target.id}" cannot be resolved as a persistent scalar/value.`, target.id, target)
    }

    const diagnostics: Cinema2TargetDiagnostic[] = []
    const rawBase = this.resolveBaseValue(target) ?? target.authoredBaseValue
    const normalizedBase = normalizeTargetValue(target, rawBase, `${target.id}.base`)
    diagnostics.push(...normalizedBase.diagnostics)
    if (!normalizedBase.ok || normalizedBase.value === undefined) {
      return freeze({ ok: false, target, value: undefined, diagnostics: Object.freeze(diagnostics) })
    }

    if (userAuthority === 'lock') {
      return freeze({ ok: diagnostics.length === 0, target, value: cloneJson(normalizedBase.value), diagnostics: Object.freeze(diagnostics) })
    }
    if (userAuthority === 'scale' && !isNumericComposable(target.valueType)) {
      diagnostics.push(issue('CINEMA2_TARGET_USER_AUTHORITY_INCOMPATIBLE', `Scale authority requires a numeric or vector target, not ${target.valueType}.`, target.id))
      return freeze({ ok: false, target, value: cloneJson(normalizedBase.value), diagnostics: Object.freeze(diagnostics) })
    }

    const sorted = [...(this.transientContributions.get(targetId) ?? []), ...contributions].sort(compareContributions)
    const compatible: Cinema2TargetContribution[] = []
    for (const contribution of sorted) {
      if (contribution.operation === 'action') {
        diagnostics.push(issue('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', `Value target "${target.id}" cannot receive action events.`, target.id))
        continue
      }
      if (!target.operations.includes(contribution.operation)) {
        diagnostics.push(issue('CINEMA2_TARGET_COMPOSITION_INCOMPATIBLE', `Target "${target.id}" does not support ${contribution.operation} composition.`, target.id))
        continue
      }
      compatible.push(contribution)
    }

    const additive = compatible.filter(entry => entry.operation === 'add')
    const multiplicative = compatible.filter(entry => entry.operation === 'multiply')
    const replacements = compatible.filter(entry => entry.operation === 'replace')
    let candidate: Cinema2JsonValue = cloneJson(normalizedBase.value)

    if (userAuthority === 'scale') {
      candidate = composeScaleAuthority(target, normalizedBase.value, additive, multiplicative, diagnostics)
    } else {
      candidate = composeBaseAuthority(target, normalizedBase.value, additive, multiplicative, diagnostics)
    }

    const replacement = chooseReplacement(target, replacements, diagnostics)
    if (replacement !== undefined) {
      const normalizedReplacement = normalizeTargetValue(target, replacement, `${target.id}.replace`)
      diagnostics.push(...normalizedReplacement.diagnostics)
      if (normalizedReplacement.ok && normalizedReplacement.value !== undefined) {
        candidate = userAuthority === 'scale'
          ? scaleValues(normalizedBase.value, normalizedReplacement.value, target, diagnostics, `${target.id}.replace`)
          : normalizedReplacement.value
      }
    }

    const normalizedFinal = normalizeTargetValue(target, candidate, `${target.id}.final`)
    diagnostics.push(...normalizedFinal.diagnostics)
    return freeze({
      ok: diagnostics.length === 0 && normalizedFinal.ok,
      target,
      value: normalizedFinal.ok ? cloneJson(normalizedFinal.value) : undefined,
      diagnostics: Object.freeze(diagnostics),
    })
  }

  dispatch(
    targetId: Cinema2TargetId,
    contributions: readonly Readonly<Cinema2TargetContribution>[],
  ): Cinema2ActionDispatchResult {
    const target = this.targets.get(targetId) ?? null
    if (!target) return failureAction('CINEMA2_TARGET_UNKNOWN', `Unknown Cinema 2.0 target "${targetId}".`, String(targetId))
    if (target.capabilityAvailability !== 'available') {
      return failureAction(
        target.capabilityAvailability === 'unavailable' ? 'CINEMA2_TARGET_CAPABILITY_UNAVAILABLE' : 'CINEMA2_TARGET_CAPABILITY_UNRESOLVED',
        `Target "${target.id}" cannot dispatch because its required capability availability is ${target.capabilityAvailability}.`,
        target.id,
        target,
      )
    }
    if (target.channel !== 'action') {
      return failureAction('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', `Value target "${target.id}" cannot dispatch action events.`, target.id, target)
    }

    const diagnostics: Cinema2TargetDiagnostic[] = []
    const events: Cinema2DispatchedTargetAction[] = []
    for (const contribution of [...contributions].sort(compareContributions)) {
      if (contribution.operation !== 'action') {
        diagnostics.push(issue('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', `Action target "${target.id}" cannot receive ${contribution.operation} value composition.`, target.id))
        continue
      }
      const eventId = contribution.eventId?.trim()
      if (!eventId) {
        diagnostics.push(issue('CINEMA2_TARGET_ACTION_EVENT_INVALID', 'Action contributions require a stable non-empty eventId.', target.id))
        continue
      }
      const event = freeze({
        targetId: target.id,
        contributorId: contribution.contributorId,
        eventId,
        priority: finitePriority(contribution.priority),
        payload: cloneJson(contribution.value),
      })
      events.push(event)
      this.dispatchAction?.(event)
    }
    return freeze({ ok: diagnostics.length === 0, target, events: Object.freeze(events), diagnostics: Object.freeze(diagnostics) })
  }
}

function addParameterTarget(
  entity: Cinema2TargetEntityHandle,
  definition: Readonly<Cinema2CompiledParameterDefinition>,
  authoredBaseValue: Cinema2JsonValue | undefined,
  addTarget: AddCinema2Target,
): void {
  const valueType = parameterTargetType(definition.type)
  addTarget(entity, definition.type === 'trigger' ? 'invoke' : 'value', valueType, authoredBaseValue, {
    operations: definition.type === 'trigger' ? ACTION_ONLY : definition.readOnly ? [] : operationsForType(valueType),
    parameterId: definition.id,
    min: definition.min ?? (definition.type === 'color' ? 0 : null),
    max: definition.max ?? (definition.type === 'color' ? 1 : null),
    step: definition.step ?? null,
    values: definition.options?.map(option => option.value) ?? [],
    capabilities: definition.capabilities?.map(capability => capability.id) ?? [],
  })
}

function addTransformTargets(
  entity: Cinema2TargetEntityHandle,
  transform: { position?: readonly [number, number, number]; rotation?: readonly [number, number, number]; scale?: readonly [number, number, number] } | undefined,
  addTarget: AddCinema2Target,
): void {
  addTarget(entity, 'transform.position', 'vec3', transform?.position ?? [0, 0, 0])
  addTarget(entity, 'transform.rotation', 'vec3', transform?.rotation ?? [0, 0, 0])
  addTarget(entity, 'transform.scale', 'vec3', transform?.scale ?? [1, 1, 1])
}

function addInferredTarget(
  entity: Cinema2TargetEntityHandle,
  property: string,
  value: Cinema2JsonValue,
  addTarget: AddCinema2Target,
  capabilities: readonly Cinema2CapabilityId[] = [],
  parameterId: Cinema2ParameterId | null = null,
): void {
  const type = inferValueType(value)
  if (type) addTarget(entity, property, type, value, { capabilities, parameterId })
}

function inferValueType(value: Cinema2JsonValue): Cinema2TargetValueType | null {
  if (typeof value === 'number' && Number.isFinite(value)) return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value) && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    if (value.length === 2) return 'vec2'
    if (value.length === 3) return 'vec3'
    if (value.length === 4) return 'color'
  }
  return null
}

function parameterTargetType(type: Cinema2CompiledParameterDefinition['type']): Cinema2TargetValueType {
  switch (type) {
    case 'float':
    case 'meter': return 'number'
    case 'integer': return 'integer'
    case 'boolean': return 'boolean'
    case 'enum': return 'enum'
    case 'color': return 'color'
    case 'vec2': return 'vec2'
    case 'vec3': return 'vec3'
    case 'string': return 'string'
    case 'text': return 'text'
    case 'media': return 'media'
    case 'status': return 'status'
    case 'trigger': return 'action'
  }
}

function operationsForType(type: Cinema2TargetValueType): readonly Cinema2TargetOperation[] {
  return isNumericComposable(type) ? NUMERIC_OPERATIONS : type === 'action' ? ACTION_ONLY : REPLACE_ONLY
}

function isNumericComposable(type: Cinema2TargetValueType): boolean {
  return type === 'number' || type === 'integer' || type === 'color' || type === 'vec2' || type === 'vec3'
}

function resolveCapabilityAvailability(
  capabilities: readonly Cinema2CapabilityId[],
  availableCapabilities: ReadonlySet<Cinema2CapabilityId> | null,
): Cinema2TargetCapabilityAvailability {
  if (capabilities.length === 0) return 'available'
  if (availableCapabilities == null) return 'unresolved'
  return capabilities.every(capability => availableCapabilities.has(capability)) ? 'available' : 'unavailable'
}

function resolveWritableTargetHandle(
  target: Cinema2WritableTargetRef,
  lookup: ReadonlyMap<string, Cinema2TargetHandle>,
): Cinema2TargetHandle | null {
  switch (target.kind) {
    case 'parameter': {
      const value = lookup.get(lookupKey('parameter', target.ref.$ref, 'value'))
      const action = lookup.get(lookupKey('parameter', target.ref.$ref, 'invoke'))
      return value ?? action ?? null
    }
    case 'module': return lookup.get(lookupKey('module', target.ref.$ref, target.property)) ?? null
    case 'scene-node': return lookup.get(lookupKey('scene-node', target.ref.$ref, target.property)) ?? null
    case 'layer': return lookup.get(lookupKey('layer', target.ref.$ref, target.property)) ?? null
    case 'camera': return lookup.get(lookupKey('camera', target.ref.$ref, target.property)) ?? null
    case 'light': return lookup.get(lookupKey('light', target.ref.$ref, target.property)) ?? null
    case 'effect': return lookup.get(lookupKey('effect', target.ref.$ref, target.property)) ?? null
    case 'environment': return lookup.get(lookupKey('environment', 'root', target.property)) ?? null
    case 'media': return lookup.get(lookupKey('media', target.ref.$ref, 'source')) ?? null
    case 'variation': return lookup.get(lookupKey('variation', target.ref.$ref, 'activate')) ?? null
  }
}

function choreographyOperation(action: Readonly<Cinema2ChoreographyActionManifest>): Cinema2TargetOperation {
  switch (action.operation) {
    case 'add': return 'add'
    case 'multiply': return 'multiply'
    case 'trigger':
    case 'spawn':
    case 'variation-switch': return 'action'
    case 'pulse':
    case 'envelope':
    case 'set-for-duration': return action.composition ?? 'replace'
    case 'map':
    case 'set':
    case 'replace':
    case 'toggle': return 'replace'
  }
}

function composeBaseAuthority(
  target: Readonly<Cinema2TargetHandle>,
  base: Cinema2JsonValue,
  additive: readonly Cinema2TargetContribution[],
  multiplicative: readonly Cinema2TargetContribution[],
  diagnostics: Cinema2TargetDiagnostic[],
): Cinema2JsonValue {
  let value = cloneJson(base)
  for (const contribution of additive) value = arithmeticValues(value, contribution.value, target, 'add', diagnostics, target.id)
  for (const contribution of multiplicative) value = arithmeticValues(value, contribution.value, target, 'multiply', diagnostics, target.id)
  return value
}

function composeScaleAuthority(
  target: Readonly<Cinema2TargetHandle>,
  base: Cinema2JsonValue,
  additive: readonly Cinema2TargetContribution[],
  multiplicative: readonly Cinema2TargetContribution[],
  diagnostics: Cinema2TargetDiagnostic[],
): Cinema2JsonValue {
  let factor: Cinema2JsonValue = numericNeutral(base, 1)
  for (const contribution of additive) factor = arithmeticValues(factor, contribution.value, target, 'add', diagnostics, target.id)
  for (const contribution of multiplicative) factor = arithmeticValues(factor, contribution.value, target, 'multiply', diagnostics, target.id)
  return scaleValues(base, factor, target, diagnostics, target.id)
}

function diagnoseReplacementConflict(
  target: Readonly<Cinema2TargetHandle>,
  contributions: readonly Cinema2TargetContribution[],
  diagnostics: Cinema2TargetDiagnostic[],
): void {
  const replacements = contributions.filter(entry => entry.operation === 'replace')
  if (replacements.length < 2) return
  const ranked = [...replacements].sort((left, right) => finitePriority(right.priority) - finitePriority(left.priority) || compareStrings(left.contributorId, right.contributorId))
  const winner = ranked[0]
  const topPriority = finitePriority(winner.priority)
  const tied = ranked.filter(entry => finitePriority(entry.priority) === topPriority)
  if (tied.length > 1 && tied.some(entry => !jsonEqual(entry.value, winner.value))) {
    diagnostics.push(issue(
      'CINEMA2_TARGET_REPLACE_PRIORITY_CONFLICT',
      `Equal-priority replacements conflict for target "${target.id}"; contributor "${winner.contributorId}" wins deterministically.`,
      target.id,
    ))
  }
}

function chooseReplacement(
  target: Readonly<Cinema2TargetHandle>,
  replacements: readonly Cinema2TargetContribution[],
  diagnostics: Cinema2TargetDiagnostic[],
): Cinema2JsonValue | undefined {
  if (replacements.length === 0) return undefined
  const ranked = [...replacements].sort((left, right) => finitePriority(right.priority) - finitePriority(left.priority) || compareStrings(left.contributorId, right.contributorId))
  const winner = ranked[0]
  const topPriority = finitePriority(winner.priority)
  const tied = ranked.filter(entry => finitePriority(entry.priority) === topPriority)
  if (tied.length > 1 && tied.some(entry => !jsonEqual(entry.value, winner.value))) {
    diagnostics.push(issue(
      'CINEMA2_TARGET_REPLACE_PRIORITY_CONFLICT',
      `Equal-priority replacements conflict for target "${target.id}"; contributor "${winner.contributorId}" wins deterministically.`,
      target.id,
    ))
  }
  return cloneJson(winner.value)
}

function arithmeticValues(
  current: Cinema2JsonValue,
  contribution: Cinema2JsonValue | undefined,
  target: Readonly<Cinema2TargetHandle>,
  operation: 'add' | 'multiply',
  diagnostics: Cinema2TargetDiagnostic[],
  path: string,
): Cinema2JsonValue {
  if (typeof current === 'number' && typeof contribution === 'number' && Number.isFinite(contribution)) {
    return operation === 'add' ? current + contribution : current * contribution
  }
  if (Array.isArray(current) && Array.isArray(contribution) && current.length === contribution.length && current.every(value => typeof value === 'number') && contribution.every(value => typeof value === 'number' && Number.isFinite(value))) {
    return current.map((value, index) => operation === 'add' ? (value as number) + (contribution[index] as number) : (value as number) * (contribution[index] as number))
  }
  diagnostics.push(issue('CINEMA2_TARGET_CONTRIBUTION_TYPE_INVALID', `${operation} contribution does not match ${target.valueType} target "${target.id}".`, path))
  return cloneJson(current)
}

function scaleValues(
  base: Cinema2JsonValue,
  factor: Cinema2JsonValue,
  target: Readonly<Cinema2TargetHandle>,
  diagnostics: Cinema2TargetDiagnostic[],
  path: string,
): Cinema2JsonValue {
  if (typeof base === 'number' && typeof factor === 'number') return base * factor
  if (Array.isArray(base) && Array.isArray(factor) && base.length === factor.length && base.every(value => typeof value === 'number') && factor.every(value => typeof value === 'number')) {
    return base.map((value, index) => (value as number) * (factor[index] as number))
  }
  diagnostics.push(issue('CINEMA2_TARGET_USER_AUTHORITY_INCOMPATIBLE', `Scale authority cannot compose ${target.valueType} target "${target.id}".`, path))
  return cloneJson(base)
}

function normalizeTargetValue(
  target: Readonly<Cinema2TargetHandle>,
  candidate: unknown,
  path: string,
): { ok: boolean; value: Cinema2JsonValue | undefined; diagnostics: Cinema2TargetDiagnostic[] } {
  const diagnostics: Cinema2TargetDiagnostic[] = []
  let value: Cinema2JsonValue | undefined
  switch (target.valueType) {
    case 'number':
    case 'integer': {
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Target requires a finite number.', path))
      else {
        let next = target.valueType === 'integer' ? Math.round(candidate) : candidate
        next = clampStep(next, target)
        value = next
      }
      break
    }
    case 'boolean':
      if (typeof candidate !== 'boolean') diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Target requires a boolean.', path))
      else value = candidate
      break
    case 'enum':
      if (typeof candidate !== 'string' || !target.options.includes(candidate)) diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Target requires an authored enum option.', path))
      else value = candidate
      break
    case 'string':
    case 'text':
      if (typeof candidate !== 'string') diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Target requires a string.', path))
      else value = candidate
      break
    case 'media':
      if (candidate !== null && typeof candidate !== 'string') diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Media target requires a media reference string or null.', path))
      else value = candidate as string | null
      break
    case 'status':
      if (candidate !== null && !['string', 'number', 'boolean'].includes(typeof candidate)) diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', 'Status target requires a scalar JSON value or null.', path))
      else value = candidate as Cinema2JsonValue
      break
    case 'color':
    case 'vec2':
    case 'vec3': {
      const length = target.valueType === 'color' ? 4 : target.valueType === 'vec2' ? 2 : 3
      if (!Array.isArray(candidate) || candidate.length !== length || candidate.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
        diagnostics.push(issue('CINEMA2_TARGET_VALUE_TYPE_INVALID', `Target requires a ${length}-component finite numeric vector.`, path))
      } else {
        value = candidate.map(component => clampStep(component as number, target))
      }
      break
    }
    case 'action':
      diagnostics.push(issue('CINEMA2_TARGET_SCALAR_ACTION_MISMATCH', 'Action targets do not carry persistent scalar values.', path))
      break
  }
  return { ok: diagnostics.length === 0, value, diagnostics }
}

function clampStep(value: number, target: Readonly<Cinema2TargetHandle>): number {
  let next = value
  if (target.min != null) next = Math.max(target.min, next)
  if (target.max != null) next = Math.min(target.max, next)
  if (target.step != null && target.step > 0) {
    const origin = target.min ?? 0
    next = origin + Math.round((next - origin) / target.step) * target.step
    if (target.min != null) next = Math.max(target.min, next)
    if (target.max != null) next = Math.min(target.max, next)
  }
  if (target.valueType === 'integer') next = Math.round(next)
  return next
}

function numericNeutral(value: Cinema2JsonValue, neutral: number): Cinema2JsonValue {
  if (typeof value === 'number') return neutral
  if (Array.isArray(value)) return value.map(() => neutral)
  return neutral
}

function entityTargetId(presetId: Cinema2PresetId, kind: Cinema2TargetEntityKind, ownerId: string): Cinema2TargetId {
  return `${presetId}/target/${kind}/${encodeURIComponent(ownerId)}` as Cinema2TargetId
}

function propertyTargetId(entityId: Cinema2TargetId, property: string): Cinema2TargetId {
  return `${entityId}/property/${encodeURIComponent(property)}` as Cinema2TargetId
}

function lookupKey(kind: Cinema2TargetEntityKind, ownerId: string, property: string): string {
  return `${kind}\u0000${ownerId}\u0000${property}`
}

function compareEntries(left: [string, Cinema2JsonValue], right: [string, Cinema2JsonValue]): number {
  return compareStrings(left[0], right[0])
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareContributions(left: Readonly<Cinema2TargetContribution>, right: Readonly<Cinema2TargetContribution>): number {
  const operationOrder: Record<Cinema2TargetOperation, number> = { add: 0, multiply: 1, replace: 2, action: 3 }
  return operationOrder[left.operation] - operationOrder[right.operation]
    || finitePriority(right.priority) - finitePriority(left.priority)
    || compareStrings(left.contributorId, right.contributorId)
    || compareStrings(left.eventId ?? '', right.eventId ?? '')
}

function finitePriority(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function issue(code: string, message: string, path: string): Cinema2TargetDiagnostic {
  return { code, message, path }
}

function failureValue(code: string, message: string, path: string, target: Readonly<Cinema2TargetHandle> | null = null): Cinema2ResolvedTargetValue {
  return freeze({ ok: false, target, value: undefined, diagnostics: Object.freeze([freeze(issue(code, message, path))]) })
}

function failureAction(code: string, message: string, path: string, target: Readonly<Cinema2TargetHandle> | null = null): Cinema2ActionDispatchResult {
  return freeze({ ok: false, target, events: Object.freeze([]), diagnostics: Object.freeze([freeze(issue(code, message, path))]) })
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value)) as T
}

function freeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) freeze(child)
  return value
}

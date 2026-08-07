import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PACKAGE_SCHEMA_ID,
  CINEMA_PACKAGE_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  isCinemaJsonValue,
  type CinemaCollectionDefinition,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
  type CinemaJsonObject,
  type CinemaPackageDefinition,
} from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  parseCinemaNamespacedId,
  parseCinemaParameterPath,
  parseCinemaStableId,
  type CinemaCompositionId,
  type CinemaCompositionInstanceId,
  type CinemaNodeTypeId,
  type CinemaRendererPluginId,
} from './CinemaIdentifiers'
import {
  createCinemaNodeDefinitionRegistry,
  type CinemaFeedbackPortContract,
  type CinemaNodeQualityLimits,
  type CinemaNodeRegistrationSource,
  type CinemaNodeRegistryEntry,
} from './CinemaNodeRegistry'
import type { CinemaNodeTypeDefinition } from './CinemaRendererContracts'
import { validateCinemaCompositionGraph } from './CinemaGraphCompiler'
import { validateCinemaParameterSchemas } from './CinemaParameterSchema'
import { normalizeCinemaAssetBinding } from './CinemaAssets'
import { normalizeCinemaGraphEditorMetadata } from './CinemaGraphEditorMetadata'

export const CINEMA_PERSISTED_STORE_SCHEMA_ID = 'drmvyz.cinema.store' as const
export const CINEMA_PERSISTED_STORE_SCHEMA_VERSION = 4 as const
export const CINEMA_DEFAULT_HISTORY_LIMIT = 50 as const
export const CINEMA_MAX_HISTORY_LIMIT = 200 as const
export const CINEMA_STAGE_12_MIGRATION_TIMESTAMP = '2026-08-06T00:00:00.000Z' as const
export const CINEMA_STAGE_14_MIGRATION_TIMESTAMP = '2026-08-06T20:41:00.000Z' as const
export const CINEMA_STAGE_22_MIGRATION_TIMESTAMP = '2026-08-07T03:38:00.000Z' as const

export interface CinemaMigrationProvenance {
  fromSchemaVersion: number
  toSchemaVersion: number
  migratedAt: string
}

/** Serializable node registration metadata. Runtime plugin availability is intentionally excluded. */
export interface CinemaPersistedDefinition {
  id: CinemaNodeTypeId
  definition: CinemaNodeTypeDefinition
  rendererPluginId: CinemaRendererPluginId
  source: CinemaNodeRegistrationSource
  feedback?: CinemaFeedbackPortContract
  quality: CinemaNodeQualityLimits
}

export interface CinemaPersistedState {
  schemaId: typeof CINEMA_PERSISTED_STORE_SCHEMA_ID
  schemaVersion: typeof CINEMA_PERSISTED_STORE_SCHEMA_VERSION
  definitions: readonly CinemaPersistedDefinition[]
  compositions: readonly CinemaCompositionDefinition[]
  instances: readonly CinemaCompositionInstance[]
  collections: readonly CinemaCollectionDefinition[]
  activeCompositionId: CinemaCompositionId | null
  activeInstanceId: CinemaCompositionInstanceId | null
  editorMetadata: CinemaJsonObject
  migrationProvenance: readonly CinemaMigrationProvenance[]
}

export interface CinemaPersistencePackageDefinition extends Omit<CinemaPackageDefinition,
  'compositions' | 'instances' | 'collections' | 'migrationProvenance'
> {
  definitions: readonly CinemaPersistedDefinition[]
  compositions: readonly CinemaCompositionDefinition[]
  instances: readonly CinemaCompositionInstance[]
  collections: readonly CinemaCollectionDefinition[]
  activeCompositionId?: CinemaCompositionId | null
  activeInstanceId?: CinemaCompositionInstanceId | null
  editorMetadata?: CinemaJsonObject
  migrationProvenance?: readonly CinemaMigrationProvenance[]
}

export type CinemaPersistenceResult<Value> =
  | { ok: true; value: Value; diagnostics: CinemaDiagnosticSnapshot }
  | { ok: false; value: null; diagnostics: CinemaDiagnosticSnapshot }

const ROOT_KEYS = new Set([
  'schemaId',
  'schemaVersion',
  'definitions',
  'compositions',
  'instances',
  'collections',
  'activeCompositionId',
  'activeInstanceId',
  'editorMetadata',
  'migrationProvenance',
])

export function createEmptyCinemaPersistedState(): CinemaPersistedState {
  return {
    schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
    schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
    definitions: [],
    compositions: [],
    instances: [],
    collections: [],
    activeCompositionId: null,
    activeInstanceId: null,
    editorMetadata: normalizeCinemaGraphEditorMetadata({}).metadata,
    migrationProvenance: [],
  }
}

export function normalizeCinemaHistoryLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return CINEMA_DEFAULT_HISTORY_LIMIT
  return Math.max(1, Math.min(CINEMA_MAX_HISTORY_LIMIT, Math.floor(value)))
}

export function cloneCinemaSerializable<Value>(value: Value): Value {
  if (!isCinemaJsonValue(value)) {
    throw new TypeError('Cinema persisted values must contain plain finite JSON data only.')
  }
  return JSON.parse(JSON.stringify(value)) as Value
}

/** Migrates only known Cinema JSON contracts. Future versions remain rejected. */
export function migrateCinemaPersistedStateInput(input: Record<string, unknown>): Record<string, unknown> {
  let current = input
  if (current.schemaVersion === 1) {
    const provenance = Array.isArray(current.migrationProvenance) ? current.migrationProvenance : []
    current = {
      ...current,
      schemaVersion: 2,
      compositions: Array.isArray(current.compositions)
        ? current.compositions.map(migrateCinemaCompositionInput)
        : current.compositions,
      migrationProvenance: [...provenance, {
        fromSchemaVersion: 1,
        toSchemaVersion: 2,
        migratedAt: CINEMA_STAGE_12_MIGRATION_TIMESTAMP,
      }],
    }
  }
  if (current.schemaVersion === 2) {
    const provenance = Array.isArray(current.migrationProvenance) ? current.migrationProvenance : []
    current = {
      ...current,
      schemaVersion: 3,
      compositions: Array.isArray(current.compositions)
        ? current.compositions.map(migrateCinemaCompositionInput)
        : current.compositions,
      migrationProvenance: [...provenance, {
        fromSchemaVersion: 2,
        toSchemaVersion: 3,
        migratedAt: CINEMA_STAGE_14_MIGRATION_TIMESTAMP,
      }],
    }
  }
  if (current.schemaVersion === 3) {
    const provenance = Array.isArray(current.migrationProvenance) ? current.migrationProvenance : []
    current = {
      ...current,
      schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
      migrationProvenance: [...provenance, {
        fromSchemaVersion: 3,
        toSchemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
        migratedAt: CINEMA_STAGE_22_MIGRATION_TIMESTAMP,
      }],
    }
  }
  return current
}

export function migrateCinemaCompositionInput(input: unknown): unknown {
  if (!isPlainRecord(input)) return input
  let current = input
  if (current.schemaVersion === 1) {
    current = {
      ...current,
      schemaVersion: 2,
      performanceRules: Array.isArray(current.performanceRules)
        ? current.performanceRules.map(migrateCinemaPerformanceRuleInput)
        : current.performanceRules,
    }
  }
  if (current.schemaVersion === 2) {
    current = {
      ...current,
      schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
      assetBindings: Array.isArray(current.assetBindings)
        ? current.assetBindings.map(migrateCinemaAssetBindingInput)
        : current.assetBindings,
    }
  }
  return current
}

function migrateCinemaAssetBindingInput(input: unknown): unknown {
  if (!isPlainRecord(input)) return input
  return {
    ...input,
    ...(typeof input.colorizeWithBrandRole === 'string' && input.brandColorPolicy === undefined
      ? { brandColorPolicy: 'derived' }
      : {}),
  }
}

function migrateCinemaPerformanceRuleInput(input: unknown): unknown {
  if (!isPlainRecord(input)) return input
  const ruleId = typeof input.id === 'string' ? input.id : 'performance-rule'
  return {
    ...input,
    schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
    condition: isPlainRecord(input.condition)
      ? { ...input.condition, schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION }
      : input.condition,
    actions: Array.isArray(input.actions)
      ? input.actions.map((action, index) => migrateCinemaPerformanceActionInput(action, ruleId, index))
      : input.actions,
  }
}

function migrateCinemaPerformanceActionInput(input: unknown, ruleId: string, index: number): unknown {
  if (!isPlainRecord(input)) return input
  const { actionId: _legacyResetActionId, ...action } = input
  return {
    ...action,
    schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
    id: typeof input.id === 'string' ? input.id : `${ruleId}-action-${index + 1}`,
    type: action.type === 'reset-node-state' ? 'resetNodeState' : action.type,
  }
}

export function snapshotCinemaPersistedState(
  state: Pick<CinemaPersistedState, keyof CinemaPersistedState>,
): CinemaPersistedState {
  return cloneCinemaSerializable({
    schemaId: state.schemaId,
    schemaVersion: state.schemaVersion,
    definitions: state.definitions,
    compositions: state.compositions,
    instances: state.instances,
    collections: state.collections,
    activeCompositionId: state.activeCompositionId,
    activeInstanceId: state.activeInstanceId,
    editorMetadata: state.editorMetadata,
    migrationProvenance: state.migrationProvenance,
  })
}

export function normalizeCinemaPersistedState(input: unknown): CinemaPersistenceResult<CinemaPersistedState> {
  try {
    if (input == null) {
      return success(createEmptyCinemaPersistedState(), [])
    }
    if (!isPlainRecord(input)) {
      return failure([schemaDiagnostic('Cinema persisted state must be a plain object.')])
    }
    if (!isCinemaJsonValue(input)) {
      return failure([schemaDiagnostic('Cinema persisted state contains a runtime resource or non-JSON value.')])
    }

    const migratedInput = migrateCinemaPersistedStateInput(input)
    const schemaId = migratedInput.schemaId
    const schemaVersion = migratedInput.schemaVersion
    if (schemaId !== CINEMA_PERSISTED_STORE_SCHEMA_ID) {
      return failure([schemaDiagnostic(
        `Cinema persisted state schema must be "${CINEMA_PERSISTED_STORE_SCHEMA_ID}".`,
        { schemaId: String(schemaId ?? '<missing>') },
      )])
    }
    if (schemaVersion !== CINEMA_PERSISTED_STORE_SCHEMA_VERSION) {
      return failure([createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
        severity: 'error',
        message: `Cinema persisted state schema version "${String(schemaVersion)}" is unsupported.`,
        details: {
          receivedVersion: typeof schemaVersion === 'number' ? schemaVersion : -1,
          supportedVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
        },
      })])
    }

    const diagnostics: CinemaDiagnostic[] = []
    const unknownKeys = Object.keys(migratedInput).filter(key => !ROOT_KEYS.has(key)).sort(compareStrings)
    if (unknownKeys.length > 0) {
      diagnostics.push(schemaDiagnostic('Cinema persisted state contains unknown root fields.', {
        fields: unknownKeys.join(','),
      }))
    }

    const rawCompositions = readArray(migratedInput, 'compositions', diagnostics)
    const normalizedCompositions = rawCompositions.map(composition => normalizePersistedCompositionAssets(composition, diagnostics))
    const graphEditorMetadata = normalizeCinemaGraphEditorMetadata(
      isPlainRecord(migratedInput.editorMetadata) ? migratedInput.editorMetadata as CinemaJsonObject : {},
    )
    diagnostics.push(...graphEditorMetadata.diagnostics)
    const candidate: CinemaPersistedState = {
      schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
      schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
      definitions: readArray(migratedInput, 'definitions', diagnostics) as unknown as readonly CinemaPersistedDefinition[],
      compositions: normalizedCompositions as unknown as readonly CinemaCompositionDefinition[],
      instances: readArray(migratedInput, 'instances', diagnostics) as unknown as readonly CinemaCompositionInstance[],
      collections: readArray(migratedInput, 'collections', diagnostics) as unknown as readonly CinemaCollectionDefinition[],
      activeCompositionId: migratedInput.activeCompositionId == null
        ? null
        : migratedInput.activeCompositionId as CinemaCompositionId,
      activeInstanceId: migratedInput.activeInstanceId == null
        ? null
        : migratedInput.activeInstanceId as CinemaCompositionInstanceId,
      editorMetadata: graphEditorMetadata.metadata,
      migrationProvenance: readArray(migratedInput, 'migrationProvenance', diagnostics) as unknown as readonly CinemaMigrationProvenance[],
    }

    if (migratedInput.editorMetadata !== undefined && !isPlainRecord(migratedInput.editorMetadata)) {
      diagnostics.push(schemaDiagnostic('Cinema editor metadata must be a plain JSON object.'))
    }

    diagnostics.push(...validateCinemaPersistedState(candidate))
    if (hasErrors(diagnostics)) return failure(diagnostics)
    return success(cloneCinemaSerializable(candidate), diagnostics)
  } catch (error) {
    return failure([schemaDiagnostic('Cinema persisted state could not be normalized safely.', {
      reason: error instanceof Error ? error.message : String(error),
    })])
  }
}

function normalizePersistedCompositionAssets(
  composition: unknown,
  diagnostics: CinemaDiagnostic[],
): unknown {
  if (!isPlainRecord(composition) || !Array.isArray(composition.assetBindings)) return composition
  return {
    ...composition,
    assetBindings: composition.assetBindings.map(binding => {
      const normalized = normalizeCinemaAssetBinding(binding)
      diagnostics.push(...normalized.diagnostics.diagnostics)
      return normalized.value ?? binding
    }),
  }
}

export function validateCinemaPersistedState(state: CinemaPersistedState): readonly CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  const definitionIds = new Set<string>()
  const registryEntries: CinemaNodeRegistryEntry[] = []

  for (const persistedDefinition of state.definitions) {
    if (!isPlainRecord(persistedDefinition)) {
      diagnostics.push(schemaDiagnostic('Cinema definition entries must be plain objects.'))
      continue
    }
    diagnostics.push(...parseCinemaNamespacedId(persistedDefinition.id, 'persisted node definition').diagnostics)
    if (definitionIds.has(String(persistedDefinition.id))) {
      diagnostics.push(duplicateDiagnostic('persisted node definition', String(persistedDefinition.id)))
    }
    definitionIds.add(String(persistedDefinition.id))
    if (!isPlainRecord(persistedDefinition.definition)) {
      diagnostics.push(schemaDiagnostic('Cinema persisted definition must include node type metadata.', {
        definitionId: String(persistedDefinition.id ?? '<missing>'),
      }))
      continue
    }
    if (persistedDefinition.id !== persistedDefinition.definition.typeId) {
      diagnostics.push(schemaDiagnostic('Cinema persisted definition ID must equal its node type ID.', {
        definitionId: String(persistedDefinition.id),
        typeId: String(persistedDefinition.definition.typeId),
      }))
    }
    diagnostics.push(...parseCinemaNamespacedId(persistedDefinition.rendererPluginId, 'renderer plugin').diagnostics)
    registryEntries.push({
      definition: persistedDefinition.definition,
      // Persistence validates metadata contracts only. Runtime plugin availability is resolved later.
      rendererPlugin: { id: persistedDefinition.rendererPluginId, available: true },
      source: persistedDefinition.source,
      ...(persistedDefinition.feedback ? { feedback: persistedDefinition.feedback } : {}),
      quality: persistedDefinition.quality,
    })
  }

  const registryResult = createCinemaNodeDefinitionRegistry(registryEntries)
  diagnostics.push(...registryResult.diagnostics)

  const compositionIds = new Set<string>()
  const compositionsById = new Map<string, CinemaCompositionDefinition>()
  for (const composition of state.compositions) {
    if (!isPlainRecord(composition)) {
      diagnostics.push(schemaDiagnostic('Cinema composition entries must be plain objects.'))
      continue
    }
    if (composition.schemaId !== CINEMA_COMPOSITION_SCHEMA_ID) {
      diagnostics.push(schemaDiagnostic('Cinema composition schema ID is invalid.', {
        compositionId: String(composition.id ?? '<missing>'),
      }))
      continue
    }
    if (composition.schemaVersion !== CINEMA_COMPOSITION_SCHEMA_VERSION) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
        severity: 'error',
        message: `Cinema composition "${String(composition.id ?? '<missing>')}" uses an unsupported schema version.`,
        attribution: { compositionId: String(composition.id ?? '<missing>') },
        details: {
          receivedVersion: typeof composition.schemaVersion === 'number' ? composition.schemaVersion : -1,
          supportedVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
        },
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(composition.id, 'composition').diagnostics)
    if (compositionIds.has(String(composition.id))) {
      diagnostics.push(duplicateDiagnostic('composition', String(composition.id)))
    }
    compositionIds.add(String(composition.id))
    compositionsById.set(String(composition.id), composition as CinemaCompositionDefinition)
    const rawNodes = Array.isArray(composition.nodes) ? composition.nodes : []
    const hasMalformedNode = !Array.isArray(composition.nodes)
      || rawNodes.some(node => !isPlainRecord(node))
    const unresolvedTypeIds = [...new Set(rawNodes
      .filter(isPlainRecord)
      .map(node => String(node.typeId))
      .filter(typeId => !definitionIds.has(typeId)))]
      .sort(compareStrings)
    if (!hasMalformedNode && unresolvedTypeIds.length === 0) {
      const validation = validateCinemaCompositionGraph(composition, registryResult.registry)
      diagnostics.push(...validation.diagnostics.diagnostics)
    } else {
      diagnostics.push(...validateCinemaCompositionEnvelope(composition))
      for (const typeId of unresolvedTypeIds) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_PLUGIN_UNAVAILABLE',
          severity: 'warning',
          message: `Cinema node definition "${typeId}" is external to persisted state and must be resolved by the runtime registry.`,
          attribution: { compositionId: String(composition.id) },
          details: { typeId },
        }))
      }
    }
  }

  const instanceIds = new Set<string>()
  for (const instance of state.instances) {
    if (!isPlainRecord(instance)) {
      diagnostics.push(schemaDiagnostic('Cinema composition instance entries must be plain objects.'))
      continue
    }
    diagnostics.push(...parseCinemaStableId(instance.id, 'composition instance').diagnostics)
    diagnostics.push(...parseCinemaStableId(instance.compositionId, 'composition').diagnostics)
    if (instanceIds.has(String(instance.id))) {
      diagnostics.push(duplicateDiagnostic('composition instance', String(instance.id)))
    }
    instanceIds.add(String(instance.id))
    const referencedComposition = compositionsById.get(String(instance.compositionId))
    if (!referencedComposition) {
      diagnostics.push(schemaDiagnostic('Cinema composition instance references a missing composition.', {
        instanceId: String(instance.id),
        compositionId: String(instance.compositionId),
      }))
    }
    if (!Number.isInteger(instance.revision) || instance.revision < 1 || typeof instance.label !== 'string') {
      diagnostics.push(schemaDiagnostic('Cinema composition instance revision and label are invalid.', {
        instanceId: String(instance.id),
      }))
    }
    if (!isPlainRecord(instance.masterOverrides)
      || !Array.isArray(instance.nodeOverrides)
      || !Array.isArray(instance.cameraOverrides)
      || !Array.isArray(instance.assetBindingOverrides)) {
      diagnostics.push(schemaDiagnostic('Cinema composition instance overrides are malformed.', {
        instanceId: String(instance.id),
      }))
      continue
    }
    if (referencedComposition) {
      const masterParameterIds = new Set(referencedComposition.masterParameters.map(parameter => String(parameter.id)))
      const nodeIds = new Set(referencedComposition.nodes.map(node => String(node.id)))
      const cameraIds = new Set(referencedComposition.cameras.map(camera => String(camera.id)))
      const bindingIds = new Set(referencedComposition.assetBindings.map(binding => String(binding.id)))
      for (const parameterId of Object.keys(instance.masterOverrides)) {
        if (!masterParameterIds.has(parameterId)) {
          diagnostics.push(schemaDiagnostic('Cinema instance master override references a missing parameter.', {
            instanceId: String(instance.id),
            parameterId,
          }))
        }
      }
      diagnostics.push(...validateOverrideReferences(
        instance.nodeOverrides,
        'nodeId',
        nodeIds,
        'node',
        String(instance.id),
      ))
      diagnostics.push(...validateOverrideReferences(
        instance.cameraOverrides,
        'cameraId',
        cameraIds,
        'camera',
        String(instance.id),
      ))
      diagnostics.push(...validateOverrideReferences(
        instance.assetBindingOverrides,
        'bindingId',
        bindingIds,
        'asset binding',
        String(instance.id),
      ))
    }
  }

  const collectionIds = new Set<string>()
  for (const collection of state.collections) {
    if (!isPlainRecord(collection)) {
      diagnostics.push(schemaDiagnostic('Cinema collection entries must be plain objects.'))
      continue
    }
    diagnostics.push(...parseCinemaStableId(collection.id, 'collection').diagnostics)
    if (collectionIds.has(String(collection.id))) {
      diagnostics.push(duplicateDiagnostic('collection', String(collection.id)))
    }
    collectionIds.add(String(collection.id))
    if (typeof collection.label !== 'string' || !Array.isArray(collection.compositionIds)) {
      diagnostics.push(schemaDiagnostic('Cinema collection label or composition list is invalid.', {
        collectionId: String(collection.id),
      }))
      continue
    }
    for (const compositionId of collection.compositionIds) {
      diagnostics.push(...parseCinemaStableId(compositionId, 'composition').diagnostics)
      if (!compositionIds.has(String(compositionId))) {
        diagnostics.push(schemaDiagnostic('Cinema collection references a missing composition.', {
          collectionId: String(collection.id),
          compositionId: String(compositionId),
        }))
      }
    }
  }

  if (state.activeCompositionId != null) {
    diagnostics.push(...parseCinemaStableId(state.activeCompositionId, 'composition').diagnostics)
    if (!compositionIds.has(String(state.activeCompositionId))) {
      diagnostics.push(schemaDiagnostic('Active Cinema composition references a missing composition.', {
        compositionId: String(state.activeCompositionId),
      }))
    }
  }
  if (state.activeInstanceId != null) {
    diagnostics.push(...parseCinemaStableId(state.activeInstanceId, 'composition instance').diagnostics)
    const activeInstance = state.instances.find(instance => instance.id === state.activeInstanceId)
    if (!activeInstance) {
      diagnostics.push(schemaDiagnostic('Active Cinema instance references a missing instance.', {
        instanceId: String(state.activeInstanceId),
      }))
    } else if (state.activeCompositionId != null && activeInstance.compositionId !== state.activeCompositionId) {
      diagnostics.push(schemaDiagnostic('Active Cinema instance does not belong to the active composition.', {
        instanceId: String(activeInstance.id),
        compositionId: String(state.activeCompositionId),
      }))
    }
  }

  for (const provenance of state.migrationProvenance) {
    if (!isPlainRecord(provenance)
      || !Number.isInteger(provenance.fromSchemaVersion)
      || provenance.fromSchemaVersion < 1
      || !Number.isInteger(provenance.toSchemaVersion)
      || provenance.toSchemaVersion < 1
      || typeof provenance.migratedAt !== 'string'
      || !Number.isFinite(Date.parse(provenance.migratedAt))) {
      diagnostics.push(schemaDiagnostic('Cinema migration provenance entry is invalid.'))
    }
  }

  return deduplicateCinemaDiagnostics(diagnostics)
}

export function createCinemaPackageFromPersistedState(
  state: CinemaPersistedState,
  options: { exportedAt?: string; assetIds?: CinemaPackageDefinition['assetIds'] } = {},
): CinemaPersistencePackageDefinition {
  return cloneCinemaSerializable({
    schemaId: CINEMA_PACKAGE_SCHEMA_ID,
    schemaVersion: CINEMA_PACKAGE_SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    definitions: state.definitions,
    compositions: state.compositions,
    instances: state.instances,
    collections: state.collections,
    assetIds: options.assetIds ?? collectCinemaAssetIds(state.compositions),
    activeCompositionId: state.activeCompositionId,
    activeInstanceId: state.activeInstanceId,
    editorMetadata: state.editorMetadata,
    migrationProvenance: state.migrationProvenance,
  })
}

export function persistedStateFromCinemaPackage(
  packageDefinition: CinemaPersistencePackageDefinition,
): CinemaPersistedState {
  return cloneCinemaSerializable({
    schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
    schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
    definitions: packageDefinition.definitions,
    compositions: packageDefinition.compositions,
    instances: packageDefinition.instances,
    collections: packageDefinition.collections,
    activeCompositionId: packageDefinition.activeCompositionId === undefined
      ? packageDefinition.compositions[0]?.id ?? null
      : packageDefinition.activeCompositionId,
    activeInstanceId: packageDefinition.activeInstanceId ?? null,
    editorMetadata: packageDefinition.editorMetadata ?? {},
    migrationProvenance: packageDefinition.migrationProvenance ?? [],
  })
}

function collectCinemaAssetIds(
  compositions: readonly CinemaCompositionDefinition[],
): CinemaPackageDefinition['assetIds'] {
  const ids = new Set<string>()
  for (const composition of compositions) {
    for (const binding of composition.assetBindings) ids.add(binding.assetId)
  }
  return [...ids].sort(compareStrings) as unknown as CinemaPackageDefinition['assetIds']
}


function validateCinemaCompositionEnvelope(
  composition: CinemaCompositionDefinition,
): CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  if (!Number.isInteger(composition.revision) || composition.revision < 1) {
    diagnostics.push(schemaDiagnostic('Cinema composition revision must be a positive integer.', {
      compositionId: String(composition.id),
    }))
  }
  if (!isPlainRecord(composition.metadata) || typeof composition.metadata.name !== 'string') {
    diagnostics.push(schemaDiagnostic('Cinema composition metadata must include a name.', {
      compositionId: String(composition.id),
    }))
  }
  if (!Array.isArray(composition.nodes)
    || !Array.isArray(composition.connections)
    || !Array.isArray(composition.masterParameters)
    || !Array.isArray(composition.cameras)
    || !Array.isArray(composition.assetBindings)
    || !Array.isArray(composition.modulationRoutes)
    || !Array.isArray(composition.performanceRules)
    || !isPlainRecord(composition.masterValues)) {
    diagnostics.push(schemaDiagnostic('Cinema composition graph fields are malformed.', {
      compositionId: String(composition.id),
    }))
    return diagnostics
  }

  diagnostics.push(...validateCinemaParameterSchemas(composition.masterParameters, { owner: 'master' }))
  diagnostics.push(...parseCinemaStableId(composition.outputNodeId, 'node').diagnostics)
  const nodeIds = new Set<string>()
  const outputIds: string[] = []
  const bindingIds = new Set<string>()
  const cameraIds = new Set<string>()
  const validNodes: Record<string, unknown>[] = []

  for (const node of composition.nodes) {
    if (!isPlainRecord(node)) {
      diagnostics.push(schemaDiagnostic('Cinema composition node must be a plain object.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    validNodes.push(node)
    diagnostics.push(...parseCinemaStableId(node.id, 'node').diagnostics)
    diagnostics.push(...parseCinemaNamespacedId(node.typeId, 'node type').diagnostics)
    const nodeId = String(node.id)
    const typeVersion = node.typeVersion
    const enabled = node.enabled
    const opacity = node.opacity
    if (nodeIds.has(nodeId)) diagnostics.push(duplicateDiagnostic('node', nodeId))
    nodeIds.add(nodeId)
    if (node.family === 'output' && enabled !== false) outputIds.push(nodeId)
    if (typeof typeVersion !== 'number'
      || !Number.isInteger(typeVersion)
      || typeVersion < 1
      || typeof enabled !== 'boolean'
      || typeof opacity !== 'number'
      || !Number.isFinite(opacity)
      || opacity < 0
      || opacity > 1
      || !isPlainRecord(node.parameterValues)) {
      diagnostics.push(schemaDiagnostic('Cinema composition node fields are invalid.', {
        compositionId: String(composition.id),
        nodeId,
      }))
    }
  }

  if (outputIds.length !== 1 || outputIds[0] !== String(composition.outputNodeId)) {
    diagnostics.push(createCinemaDiagnostic({
      code: outputIds.length > 1 ? 'CINEMA_OUTPUT_MULTIPLE' : 'CINEMA_OUTPUT_MISSING',
      severity: 'error',
      message: 'Cinema composition must identify exactly one active output node.',
      attribution: { compositionId: String(composition.id), nodeId: String(composition.outputNodeId) },
    }))
  }

  const connectionIds = new Set<string>()
  for (const connection of composition.connections) {
    if (!isPlainRecord(connection) || !isPlainRecord(connection.from) || !isPlainRecord(connection.to)) {
      diagnostics.push(schemaDiagnostic('Cinema connection must include plain from/to endpoints.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(connection.id, 'connection').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.from.nodeId, 'node').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.from.portId, 'port').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.to.nodeId, 'node').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.to.portId, 'port').diagnostics)
    const connectionId = String(connection.id)
    if (connectionIds.has(connectionId)) diagnostics.push(duplicateDiagnostic('connection', connectionId))
    connectionIds.add(connectionId)
    if (!nodeIds.has(String(connection.from.nodeId)) || !nodeIds.has(String(connection.to.nodeId))) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_CONNECTION_INVALID',
        severity: 'error',
        message: 'Cinema connection references a missing node.',
        attribution: { compositionId: String(composition.id), connectionId },
      }))
    }
  }

  for (const binding of composition.assetBindings) {
    if (!isPlainRecord(binding)) {
      diagnostics.push(schemaDiagnostic('Cinema asset binding must be a plain object.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(binding.id, 'asset binding').diagnostics)
    diagnostics.push(...parseCinemaStableId(binding.assetId, 'asset').diagnostics)
    const bindingId = String(binding.id)
    if (bindingIds.has(bindingId)) diagnostics.push(duplicateDiagnostic('asset binding', bindingId))
    bindingIds.add(bindingId)
  }
  for (const node of validNodes) {
    const assetBindingIds = node.assetBindingIds
    if (assetBindingIds !== undefined && !Array.isArray(assetBindingIds)) {
      diagnostics.push(schemaDiagnostic('Cinema node assetBindingIds must be an array.', {
        compositionId: String(composition.id),
        nodeId: String(node.id),
      }))
      continue
    }
    for (const bindingId of assetBindingIds ?? []) {
      if (!bindingIds.has(String(bindingId))) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_ASSET_BINDING_MISSING',
          severity: 'error',
          message: `Cinema node "${String(node.id)}" references a missing asset binding.`,
          attribution: {
            compositionId: String(composition.id),
            nodeId: String(node.id),
          },
          details: { bindingId: String(bindingId) },
        }))
      }
    }
  }

  for (const camera of composition.cameras) {
    if (!isPlainRecord(camera)) {
      diagnostics.push(schemaDiagnostic('Cinema camera must be a plain object.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(camera.id, 'camera').diagnostics)
    const cameraId = String(camera.id)
    if (cameraIds.has(cameraId)) diagnostics.push(duplicateDiagnostic('camera', cameraId))
    cameraIds.add(cameraId)
    diagnostics.push(...validateCinemaCameraResource(camera, String(composition.id), cameraId))
  }

  const routeIds = new Set<string>()
  for (const route of composition.modulationRoutes) {
    if (!isPlainRecord(route)) {
      diagnostics.push(schemaDiagnostic('Cinema modulation route must be a plain object.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(route.id, 'modulation route').diagnostics)
    diagnostics.push(...parseCinemaNamespacedId(route.sourceId, 'modulation source').diagnostics)
    const parsedDestination = parseCinemaParameterPath(route.destination)
    diagnostics.push(...parsedDestination.diagnostics)
    const routeId = String(route.id)
    if (routeIds.has(routeId)) diagnostics.push(duplicateDiagnostic('modulation route', routeId))
    routeIds.add(routeId)
    if (parsedDestination.ok && parsedDestination.ownerId != null) {
      const ownerExists = parsedDestination.namespace === 'cameras'
        ? cameraIds.has(parsedDestination.ownerId)
        : nodeIds.has(parsedDestination.ownerId)
      if (!ownerExists) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_PARAMETER_DESTINATION_UNAVAILABLE',
          severity: 'error',
          message: 'Cinema modulation route destination owner is missing.',
          attribution: {
            compositionId: String(composition.id),
            parameterPath: String(route.destination),
          },
        }))
      }
    }
  }

  const ruleIds = new Set<string>()
  const performanceActionIds = new Set<string>()
  for (const rule of composition.performanceRules) {
    if (!isPlainRecord(rule) || !Array.isArray(rule.actions)) {
      diagnostics.push(schemaDiagnostic('Cinema performance rule must include an action list.', {
        compositionId: String(composition.id),
      }))
      continue
    }
    diagnostics.push(...parseCinemaStableId(rule.id, 'performance rule').diagnostics)
    const ruleId = String(rule.id)
    if (rule.schemaVersion !== CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION
      || !isPlainRecord(rule.condition)
      || rule.condition.schemaVersion !== CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION) {
      diagnostics.push(schemaDiagnostic('Cinema performance rule or condition schema version is unsupported.', {
        compositionId: String(composition.id), ruleId,
      }))
    }
    if (ruleIds.has(ruleId)) diagnostics.push(duplicateDiagnostic('performance rule', ruleId))
    ruleIds.add(ruleId)
    for (const action of rule.actions) {
      if (!isPlainRecord(action) || typeof action.type !== 'string') {
        diagnostics.push(schemaDiagnostic('Cinema performance action is malformed.', {
          compositionId: String(composition.id),
          ruleId,
        }))
        continue
      }
      diagnostics.push(...parseCinemaStableId(action.id, 'performance action').diagnostics)
      const actionId = String(action.id)
      if (performanceActionIds.has(actionId)) diagnostics.push(duplicateDiagnostic('performance action', actionId))
      performanceActionIds.add(actionId)
      if (action.schemaVersion !== CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION) {
        diagnostics.push(schemaDiagnostic('Cinema performance action schema version is unsupported.', {
          compositionId: String(composition.id), ruleId, actionId: String(action.id),
        }))
      }
      if ((action.type === 'resetNodeState'
        || action.type === 'resetFeedback'
        || action.type === 'reseedSimulation'
        || action.type === 'clearTrailHistory'
        || action.type === 'set-node-enabled'
        || action.type === 'set-effect-enabled') && !nodeIds.has(String(action.nodeId))) {
        diagnostics.push(schemaDiagnostic('Cinema performance action references a missing node.', {
          compositionId: String(composition.id),
          ruleId,
          nodeId: String(action.nodeId),
        }))
      }
      if (action.type === 'select-camera' && !cameraIds.has(String(action.cameraId))) {
        diagnostics.push(schemaDiagnostic('Cinema performance action references a missing camera.', {
          compositionId: String(composition.id),
          ruleId,
          cameraId: String(action.cameraId),
        }))
      }
      if (action.type === 'set-parameter' || action.type === 'trigger-parameter') {
        diagnostics.push(...parseCinemaParameterPath(action.destination).diagnostics)
      }
    }
  }

  return diagnostics
}

function validateCinemaCameraResource(
  camera: Record<string, unknown>,
  compositionId: string,
  cameraId: string,
): CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  const modes = new Set(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path', 'auto-director'])
  if (typeof camera.label !== 'string' || camera.label.trim().length === 0
    || typeof camera.mode !== 'string' || !modes.has(camera.mode)
    || !isPlainRecord(camera.parameterValues)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_INVALID',
      severity: 'error',
      message: 'Cinema camera label, mode, or parameter values are invalid.',
      attribution: { compositionId, cameraId, stage: 'persistence' },
    }))
  }
  if (camera.safeRange !== undefined && !isValidCameraSafeRange(camera.safeRange)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_INVALID',
      severity: 'error',
      message: 'Cinema camera safe range is malformed or internally inconsistent.',
      attribution: { compositionId, cameraId, stage: 'persistence' },
    }))
  }
  if (camera.path !== undefined && (!Array.isArray(camera.path) || camera.path.some(point => !isValidCameraPose(point)))) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_INVALID',
      severity: 'error',
      message: 'Cinema camera path metadata is malformed.',
      attribution: { compositionId, cameraId, stage: 'persistence' },
    }))
  }
  if (camera.invalidRegions !== undefined) {
    if (!Array.isArray(camera.invalidRegions) || camera.invalidRegions.some(region => !isValidCameraInvalidRegion(region))) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_CAMERA_INVALID',
        severity: 'error',
        message: 'Cinema camera invalid-region metadata is malformed.',
        attribution: { compositionId, cameraId, stage: 'persistence' },
      }))
    }
  }
  if (camera.authoredShots !== undefined) {
    if (!Array.isArray(camera.authoredShots) || camera.authoredShots.some(shot => !isValidCameraAuthoredShot(shot))) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_CAMERA_INVALID',
        severity: 'error',
        message: 'Cinema camera authored-shot metadata is malformed.',
        attribution: { compositionId, cameraId, stage: 'persistence' },
      }))
    } else {
      const ids = new Set<string>()
      for (const shot of camera.authoredShots) {
        const id = String((shot as Record<string, unknown>).id)
        if (ids.has(id)) diagnostics.push(duplicateDiagnostic('camera authored shot', id))
        ids.add(id)
      }
    }
  }
  return diagnostics
}

function isValidCameraSafeRange(value: unknown): boolean {
  if (!isPlainRecord(value)
    || !isFiniteVector3(value.minPosition)
    || !isFiniteVector3(value.maxPosition)
    || !isFiniteNumber(value.minFovDegrees)
    || !isFiniteNumber(value.maxFovDegrees)
    || !isFiniteNumber(value.minNear)
    || !isFiniteNumber(value.maxFar)) return false
  const min = value.minPosition
  const max = value.maxPosition
  return min[0] <= max[0] && min[1] <= max[1] && min[2] <= max[2]
    && value.minFovDegrees <= value.maxFovDegrees
    && value.minFovDegrees > 0
    && value.minNear > 0
    && value.maxFar > value.minNear
}

function isValidCameraInvalidRegion(value: unknown): boolean {
  if (!isPlainRecord(value)
    || typeof value.id !== 'string' || value.id.trim().length === 0
    || (value.shape !== 'box' && value.shape !== 'sphere')
    || !isFiniteVector3(value.center)) return false
  if (value.fallbackPosition !== undefined && !isFiniteVector3(value.fallbackPosition)) return false
  return value.shape === 'box'
    ? isFiniteVector3(value.size) && value.size.every(component => component > 0)
    : isFiniteNumber(value.radius) && value.radius > 0
}

function isValidCameraAuthoredShot(value: unknown): boolean {
  if (!isPlainRecord(value)
    || typeof value.id !== 'string' || value.id.trim().length === 0
    || !['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'].includes(String(value.mode))) return false
  if (value.sections !== undefined && (!Array.isArray(value.sections) || value.sections.some(section => typeof section !== 'string'))) return false
  if (value.position !== undefined && !isFiniteVector3(value.position)) return false
  if (value.rotation !== undefined && !isFiniteVector3(value.rotation)) return false
  if (value.target !== undefined && !isFiniteVector3(value.target)) return false
  if (value.path !== undefined && (!Array.isArray(value.path) || value.path.some(point => !isValidCameraPose(point)))) return false
  if (!['fovDegrees', 'rollRadians', 'near', 'far', 'weight', 'minimumDurationSec']
    .every(key => value[key] === undefined || isFiniteNumber(value[key]))) return false
  const weight = value.weight
  const minimumDurationSec = value.minimumDurationSec
  const near = value.near
  const far = value.far
  if (weight !== undefined && (!isFiniteNumber(weight) || weight <= 0)) return false
  if (minimumDurationSec !== undefined && (!isFiniteNumber(minimumDurationSec) || minimumDurationSec < 0)) return false
  return !(isFiniteNumber(near) && isFiniteNumber(far) && far <= near)
}

function isValidCameraPose(value: unknown): boolean {
  if (!isPlainRecord(value)) return false
  if (value.position !== undefined && !isFiniteVector3(value.position)) return false
  if (value.rotation !== undefined && !isFiniteVector3(value.rotation)) return false
  if (value.target !== undefined && !isFiniteVector3(value.target)) return false
  if (!['fovDegrees', 'rollRadians', 'near', 'far']
    .every(key => value[key] === undefined || isFiniteNumber(value[key]))) return false
  const near = value.near
  const far = value.far
  return !(isFiniteNumber(near) && isFiniteNumber(far) && far <= near)
}

function isFiniteVector3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateOverrideReferences(
  overrides: readonly unknown[],
  idKey: 'nodeId' | 'cameraId' | 'bindingId',
  availableIds: ReadonlySet<string>,
  kind: string,
  instanceId: string,
): CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  const seen = new Set<string>()
  for (const override of overrides) {
    if (!isPlainRecord(override) || !isPlainRecord(override.values)) {
      diagnostics.push(schemaDiagnostic(`Cinema instance ${kind} override is malformed.`, { instanceId }))
      continue
    }
    const id = String(override[idKey] ?? '')
    if (seen.has(id)) diagnostics.push(duplicateDiagnostic(`${kind} override`, id))
    seen.add(id)
    if (!availableIds.has(id)) {
      diagnostics.push(schemaDiagnostic(`Cinema instance override references a missing ${kind}.`, {
        instanceId,
        [`${idKey}`]: id,
      }))
    }
  }
  return diagnostics
}

function readArray(
  source: Record<string, unknown>,
  key: string,
  diagnostics: CinemaDiagnostic[],
): readonly unknown[] {
  const value = source[key]
  if (value === undefined) return []
  if (Array.isArray(value)) return value
  diagnostics.push(schemaDiagnostic(`Cinema persisted field "${key}" must be an array.`))
  return []
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function schemaDiagnostic(
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_SCHEMA_INVALID',
    severity: 'error',
    message,
    ...(details ? { details } : {}),
  })
}

function duplicateDiagnostic(kind: string, id: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_ID_DUPLICATE',
    severity: 'error',
    message: `Duplicate Cinema ${kind} ID "${id}".`,
    details: { id, kind },
  })
}

function success<Value>(value: Value, diagnostics: readonly CinemaDiagnostic[]): CinemaPersistenceResult<Value> {
  return {
    ok: true,
    value,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

function failure<Value>(diagnostics: readonly CinemaDiagnostic[]): CinemaPersistenceResult<Value> {
  return {
    ok: false,
    value: null,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

function hasErrors(diagnostics: readonly CinemaDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

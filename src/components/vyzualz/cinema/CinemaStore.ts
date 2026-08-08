import { create } from 'zustand'
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import { createCinemaFoundationPersistedState, reconcileCinemaBuiltInState } from './CinemaFoundation'
import {
  EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW,
  type CinemaComposerRuntimePreview,
} from './CinemaComposerStage19'
import type {
  CinemaCollectionDefinition,
  CinemaCompositionDefinition,
  CinemaAssetBindingDefinition,
  CinemaCompositionInstance,
  CinemaJsonObject,
} from './CinemaDomain'
import type {
  CinemaActionId,
  CinemaAssetBindingId,
  CinemaCollectionId,
  CinemaCompositionId,
  CinemaCompositionInstanceId,
  CinemaConnectionId,
  CinemaModulationRouteId,
  CinemaNodeTypeId,
  CinemaNodeId,
} from './CinemaIdentifiers'
import { preflightCinemaPackage } from './CinemaPackageIO'
import {
  duplicateCinemaCompositionGraph,
  isCinemaBuiltInComposition,
  markCinemaCompositionSaved,
} from './CinemaLibrary'
import { createSplitPersistStorage } from '../../../lib/splitPersistStorage'
import {
  CINEMA_DEFAULT_HISTORY_LIMIT,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  cloneCinemaSerializable,
  createCinemaPackageFromPersistedState,
  createEmptyCinemaPersistedState,
  normalizeCinemaHistoryLimit,
  normalizeCinemaPersistedState,
  persistedStateFromCinemaPackage,
  snapshotCinemaPersistedState,
  type CinemaPersistedDefinition,
  type CinemaPersistedState,
  type CinemaPersistencePackageDefinition,
} from './CinemaPersistence'
import {
  getCinemaGraphEditorCompositionMetadata,
  getCinemaGraphEditorPrimarySelection,
  mergeCinemaGraphEditorMetadata,
  scopeCinemaGraphEditorMetadata,
  withCinemaGraphEditorCompositionMetadata,
  withoutCinemaGraphEditorCompositionMetadata,
  type CinemaEditorMode,
  type CinemaGraphEditorPoint,
  type CinemaGraphEditorViewport,
} from './CinemaGraphEditorMetadata'

export const CINEMA_PERSIST_STORAGE_NAME = 'drmvyz:cinema-store' as const
export const CINEMA_PERSIST_MIDDLEWARE_VERSION = 4 as const
export const CINEMA_PROJECT_STATE_KEYS = Object.freeze([
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
] as const satisfies readonly (keyof CinemaPersistedState)[])

export interface CinemaHistoryEntry {
  label: string
  state: CinemaPersistedState
}

export interface CinemaHistoryTransaction {
  label: string
  baseline: CinemaPersistedState
}

export interface CinemaStoreOperationResult {
  ok: boolean
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaCompositionEditResult {
  composition: CinemaCompositionDefinition
  selectedNodeId?: CinemaNodeId | null
}

export interface CinemaPackageImportOptions {
  mode?: 'replace' | 'merge'
  conflictPolicy?: 'reject' | 'replace'
  signal?: AbortSignal
}

export interface CinemaStoreState extends CinemaPersistedState {
  historyLimit: number
  undoStack: readonly CinemaHistoryEntry[]
  redoStack: readonly CinemaHistoryEntry[]
  historyTransaction: CinemaHistoryTransaction | null
  lastDiagnostics: CinemaDiagnosticSnapshot
  /** Runtime-only Composer audition state. It is deliberately excluded from persistence/history snapshots. */
  composerRuntimePreview: Readonly<CinemaComposerRuntimePreview>

  setCinemaComposerModulationPreview: (compositionId: CinemaCompositionId, routeId: CinemaModulationRouteId | null) => void
  triggerCinemaComposerManualAction: (compositionId: CinemaCompositionId, actionId: CinemaActionId) => void
  clearCinemaComposerRuntimePreview: () => void

  hydrateCinemaState: (input: unknown) => CinemaStoreOperationResult
  replaceCinemaState: (input: unknown, label?: string) => CinemaStoreOperationResult
  resetCinemaState: () => CinemaStoreOperationResult

  upsertCinemaDefinition: (definition: CinemaPersistedDefinition) => CinemaStoreOperationResult
  deleteCinemaDefinition: (definitionId: CinemaNodeTypeId) => CinemaStoreOperationResult
  upsertCinemaComposition: (composition: CinemaCompositionDefinition) => CinemaStoreOperationResult
  editCinemaComposition: (
    compositionId: CinemaCompositionId,
    label: string,
    edit: (composition: Readonly<CinemaCompositionDefinition>) => CinemaCompositionEditResult,
  ) => CinemaStoreOperationResult
  setCinemaEditorSelection: (compositionId: CinemaCompositionId, nodeId: CinemaNodeId | null) => CinemaStoreOperationResult
  setCinemaGraphEditorMode: (compositionId: CinemaCompositionId, mode: CinemaEditorMode) => CinemaStoreOperationResult
  setCinemaGraphEditorViewport: (compositionId: CinemaCompositionId, viewport: CinemaGraphEditorViewport) => CinemaStoreOperationResult
  setCinemaGraphEditorSelection: (
    compositionId: CinemaCompositionId,
    nodeIds: readonly CinemaNodeId[],
    connectionId?: CinemaConnectionId | null,
  ) => CinemaStoreOperationResult
  setCinemaGraphNodePositions: (
    compositionId: CinemaCompositionId,
    positions: Readonly<Record<string, CinemaGraphEditorPoint>>,
    label?: string,
  ) => CinemaStoreOperationResult
  upsertCinemaAssetBinding: (compositionId: CinemaCompositionId, binding: CinemaAssetBindingDefinition) => CinemaStoreOperationResult
  deleteCinemaAssetBinding: (compositionId: CinemaCompositionId, bindingId: CinemaAssetBindingId) => CinemaStoreOperationResult
  saveCinemaComposition: (compositionId: CinemaCompositionId, savedAt?: string) => CinemaStoreOperationResult
  saveCinemaCompositionAs: (
    compositionId: CinemaCompositionId,
    duplicateId: CinemaCompositionId,
    name?: string,
    savedAt?: string,
  ) => CinemaStoreOperationResult
  renameCinemaComposition: (compositionId: CinemaCompositionId, name: string) => CinemaStoreOperationResult
  duplicateCinemaComposition: (
    compositionId: CinemaCompositionId,
    duplicateId: CinemaCompositionId,
    name?: string,
  ) => CinemaStoreOperationResult
  deleteCinemaComposition: (compositionId: CinemaCompositionId) => CinemaStoreOperationResult
  upsertCinemaInstance: (instance: CinemaCompositionInstance) => CinemaStoreOperationResult
  deleteCinemaInstance: (instanceId: CinemaCompositionInstanceId) => CinemaStoreOperationResult
  upsertCinemaCollection: (collection: CinemaCollectionDefinition) => CinemaStoreOperationResult
  deleteCinemaCollection: (collectionId: CinemaCollectionId) => CinemaStoreOperationResult
  setActiveCinemaComposition: (
    compositionId: CinemaCompositionId | null,
    instanceId?: CinemaCompositionInstanceId | null,
  ) => CinemaStoreOperationResult

  beginCinemaHistoryTransaction: (label?: string) => CinemaStoreOperationResult
  commitCinemaHistoryTransaction: () => CinemaStoreOperationResult
  cancelCinemaHistoryTransaction: () => CinemaStoreOperationResult
  undoCinemaEdit: () => CinemaStoreOperationResult
  redoCinemaEdit: () => CinemaStoreOperationResult

  exportCinemaPackage: (options?: { exportedAt?: string }) => CinemaPersistencePackageDefinition
  exportCinemaCompositionPackage: (compositionId: CinemaCompositionId, options?: { exportedAt?: string }) => CinemaPersistencePackageDefinition
  importCinemaPackage: (input: unknown, options?: CinemaPackageImportOptions) => CinemaStoreOperationResult
}

export interface CreateCinemaStoreOptions {
  initialState?: unknown
  historyLimit?: number
}

export type CinemaStoreApi = StoreApi<CinemaStoreState>

const EMPTY_DIAGNOSTICS = createCinemaDiagnosticSnapshot([])

export function createCinemaStore(options: CreateCinemaStoreOptions = {}): CinemaStoreApi {
  const source = options.initialState === undefined ? createCinemaFoundationPersistedState() : options.initialState
  const initialResult = normalizeCinemaPersistedState(source)
  const initialState = initialResult.ok
    ? reconcileCinemaBuiltInState(initialResult.value)
    : createEmptyCinemaPersistedState()
  return createStore<CinemaStoreState>()(createCinemaStoreInitializer(
    initialState,
    normalizeCinemaHistoryLimit(options.historyLimit),
    initialResult.diagnostics,
  ))
}

export const useCinemaStore = create<CinemaStoreState>()(
  persist(
    createCinemaStoreInitializer(
      createCinemaFoundationPersistedState(),
      CINEMA_DEFAULT_HISTORY_LIMIT,
      EMPTY_DIAGNOSTICS,
    ),
    {
      name: CINEMA_PERSIST_STORAGE_NAME,
      version: CINEMA_PERSIST_MIDDLEWARE_VERSION,
      storage: createSplitPersistStorage<CinemaPersistedState>({
        projectKeys: CINEMA_PROJECT_STATE_KEYS,
      }),
      partialize: state => snapshotCinemaPersistedState(state),
      migrate: (persistedState, version) => version > CINEMA_PERSIST_MIDDLEWARE_VERSION
        ? { unsupportedPersistMiddlewareVersion: version }
        : persistedState,
      merge: (persistedState, currentState) => {
        const normalized = normalizeCinemaPersistedState(persistedState)
        return normalized.ok
          ? {
            ...currentState,
            ...reconcileCinemaBuiltInState(normalized.value, { initializeMissingFoundation: true }),
            lastDiagnostics: normalized.diagnostics,
          }
          : { ...currentState, lastDiagnostics: normalized.diagnostics }
      },
    },
  ),
)

function createCinemaStoreInitializer(
  initialState: CinemaPersistedState,
  historyLimit: number,
  initialDiagnostics: CinemaDiagnosticSnapshot,
): StateCreator<CinemaStoreState> {
  return (set, get) => {
    const applyDocument = (
      candidate: CinemaPersistedState,
      label: string,
      options: { recordHistory?: boolean; clearHistory?: boolean; clearRuntimePreview?: boolean } = {},
    ): CinemaStoreOperationResult => {
      const normalized = normalizeCinemaPersistedState(candidate)
      if (!normalized.ok) {
        set({ lastDiagnostics: normalized.diagnostics })
        return { ok: false, diagnostics: normalized.diagnostics }
      }

      const current = get()
      const before = snapshotCinemaPersistedState(current)
      const after = normalized.value
      const changed = !sameDocument(before, after)
      const shouldRecordHistory = options.recordHistory !== false && changed
      const historyEntry: CinemaHistoryEntry = { label, state: before }
      const transactionActive = current.historyTransaction != null

      set({
        ...after,
        ...(options.clearHistory
          ? { undoStack: [], redoStack: [], historyTransaction: null }
          : shouldRecordHistory && !transactionActive
            ? {
                undoStack: pushBounded(current.undoStack, historyEntry, current.historyLimit),
                redoStack: [],
              }
            : {}),
        lastDiagnostics: normalized.diagnostics,
        ...(options.clearRuntimePreview ? { composerRuntimePreview: EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW } : {}),
      })
      return { ok: true, diagnostics: normalized.diagnostics }
    }

    const mutateDocument = (
      label: string,
      mutation: (current: CinemaPersistedState) => CinemaPersistedState,
    ): CinemaStoreOperationResult => {
      try {
        return applyDocument(mutation(snapshotCinemaPersistedState(get())), label)
      } catch (error) {
        const diagnostics = createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
          code: 'CINEMA_VALIDATION_FAILED',
          severity: 'error',
          message: `Cinema edit "${label}" failed safely.`,
          details: { reason: error instanceof Error ? error.message : String(error) },
        })])
        set({ lastDiagnostics: diagnostics })
        return { ok: false, diagnostics }
      }
    }

    return {
      ...initialState,
      historyLimit,
      undoStack: [],
      redoStack: [],
      historyTransaction: null,
      lastDiagnostics: initialDiagnostics,
      composerRuntimePreview: EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW,

      setCinemaComposerModulationPreview: (compositionId, routeId) => set(current => ({
        composerRuntimePreview: Object.freeze({
          ...current.composerRuntimePreview,
          compositionId: String(compositionId),
          modulationRouteId: routeId,
        }),
      })),

      triggerCinemaComposerManualAction: (compositionId, actionId) => set(current => ({
        composerRuntimePreview: Object.freeze({
          ...current.composerRuntimePreview,
          compositionId: String(compositionId),
          manualActionId: actionId,
          manualActionSequence: current.composerRuntimePreview.manualActionSequence + 1,
        }),
      })),

      clearCinemaComposerRuntimePreview: () => set({ composerRuntimePreview: EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW }),

      hydrateCinemaState: input => {
        const normalized = normalizeCinemaPersistedState(input)
        if (!normalized.ok) {
          set({ lastDiagnostics: normalized.diagnostics })
          return { ok: false, diagnostics: normalized.diagnostics }
        }
        return applyDocument(reconcileCinemaBuiltInState(normalized.value, { initializeMissingFoundation: true }), 'Hydrate Cinema state', {
          recordHistory: false,
          clearHistory: true,
          clearRuntimePreview: true,
        })
      },

      replaceCinemaState: (input, label = 'Replace Cinema state') => {
        const normalized = normalizeCinemaPersistedState(input)
        if (!normalized.ok) {
          set({ lastDiagnostics: normalized.diagnostics })
          return { ok: false, diagnostics: normalized.diagnostics }
        }
        return applyDocument(reconcileCinemaBuiltInState(normalized.value, { initializeMissingFoundation: true }), label, { clearRuntimePreview: true })
      },

      resetCinemaState: () => applyDocument(createCinemaFoundationPersistedState(), 'Reset Cinema state', { clearRuntimePreview: true }),

      upsertCinemaDefinition: definition => mutateDocument('Update Cinema definition', current => {
        const existing = current.definitions.find(candidate => candidate.id === definition.id)
        if (existing && isImmutableCinemaDefinition(existing)) {
          throw new Error(`Built-in Cinema definition "${definition.id}" is immutable.`)
        }
        return {
          ...current,
          definitions: upsertById(current.definitions, definition),
        }
      }),

      deleteCinemaDefinition: definitionId => mutateDocument('Delete Cinema definition', current => {
        const existing = current.definitions.find(definition => definition.id === definitionId)
        if (existing && isImmutableCinemaDefinition(existing)) {
          throw new Error(`Built-in Cinema definition "${definitionId}" is immutable.`)
        }
        return {
          ...current,
          definitions: current.definitions.filter(definition => definition.id !== definitionId),
        }
      }),

      upsertCinemaComposition: composition => mutateDocument('Update Cinema composition', current => {
        const existing = current.compositions.find(candidate => candidate.id === composition.id)
        if (existing && isCinemaBuiltInComposition(existing)) {
          throw new Error(`Built-in Cinema composition "${composition.id}" is immutable; duplicate it before editing.`)
        }
        return {
          ...current,
          compositions: upsertById(current.compositions, composition),
        }
      }),

      editCinemaComposition: (compositionId, label, edit) => mutateDocument(label, current => {
        const source = current.compositions.find(composition => composition.id === compositionId)
        if (!source) throw new Error(`Cinema composition "${compositionId}" does not exist.`)
        assertMutableCinemaComposition(source)
        const result = edit(cloneCinemaSerializable(source))
        const nextComposition = result.composition
        if (nextComposition.id !== compositionId) throw new Error('Cinema composition edits cannot change the stable composition ID.')

        const remainingNodeIds = new Set(nextComposition.nodes.map(node => String(node.id)))
        const remainingCameraIds = new Set(nextComposition.cameras.map(camera => String(camera.id)))
        const remainingBindingIds = new Set(nextComposition.assetBindings.map(binding => String(binding.id)))
        const selectedNodeId = result.selectedNodeId === undefined
          ? getCinemaEditorSelection(current.editorMetadata, compositionId)
          : result.selectedNodeId
        const safeSelection = selectedNodeId != null && remainingNodeIds.has(String(selectedNodeId)) ? selectedNodeId : null

        return {
          ...current,
          compositions: upsertById(current.compositions, nextComposition),
          instances: current.instances.map(instance => {
            if (instance.compositionId !== compositionId) return instance
            const nodeOverrides = instance.nodeOverrides.filter(override => remainingNodeIds.has(String(override.nodeId)))
            const cameraOverrides = instance.cameraOverrides.filter(override => remainingCameraIds.has(String(override.cameraId)))
            const assetBindingOverrides = instance.assetBindingOverrides.filter(override => remainingBindingIds.has(String(override.bindingId)))
            const changed = nodeOverrides.length !== instance.nodeOverrides.length
              || cameraOverrides.length !== instance.cameraOverrides.length
              || assetBindingOverrides.length !== instance.assetBindingOverrides.length
            return changed
              ? { ...instance, revision: instance.revision + 1, nodeOverrides, cameraOverrides, assetBindingOverrides }
              : instance
          }),
          editorMetadata: withCinemaEditorSelection(current.editorMetadata, compositionId, safeSelection),
        }
      }),

      setCinemaEditorSelection: (compositionId, nodeId) => {
        const current = get()
        const composition = current.compositions.find(candidate => candidate.id === compositionId)
        if (!composition) {
          const diagnostics = transactionDiagnostic(`Cinema composition "${compositionId}" does not exist.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        if (nodeId != null && !composition.nodes.some(node => node.id === nodeId)) {
          const diagnostics = transactionDiagnostic(`Cinema node "${nodeId}" does not exist in the active composition.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        return applyDocument({
          ...snapshotCinemaPersistedState(current),
          editorMetadata: withCinemaEditorSelection(current.editorMetadata, compositionId, nodeId),
        }, 'Select Cinema editor node', { recordHistory: false })
      },

      setCinemaGraphEditorMode: (compositionId, mode) => {
        const current = get()
        if (!current.compositions.some(composition => composition.id === compositionId)) {
          const diagnostics = transactionDiagnostic(`Cinema composition "${compositionId}" does not exist.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        return applyDocument({
          ...snapshotCinemaPersistedState(current),
          editorMetadata: withCinemaGraphEditorCompositionMetadata(current.editorMetadata, compositionId, { mode }),
        }, 'Switch Cinema editor mode', { recordHistory: false })
      },

      setCinemaGraphEditorViewport: (compositionId, viewport) => {
        const current = get()
        if (!current.compositions.some(composition => composition.id === compositionId)) {
          const diagnostics = transactionDiagnostic(`Cinema composition "${compositionId}" does not exist.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        return applyDocument({
          ...snapshotCinemaPersistedState(current),
          editorMetadata: withCinemaGraphEditorCompositionMetadata(current.editorMetadata, compositionId, { viewport }),
        }, 'Pan or zoom Cinema graph', { recordHistory: false })
      },

      setCinemaGraphEditorSelection: (compositionId, nodeIds, connectionId = null) => {
        const current = get()
        const composition = current.compositions.find(candidate => candidate.id === compositionId)
        if (!composition) {
          const diagnostics = transactionDiagnostic(`Cinema composition "${compositionId}" does not exist.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const validNodeIds = new Set(composition.nodes.map(node => String(node.id)))
        if (nodeIds.some(nodeId => !validNodeIds.has(String(nodeId)))) {
          const diagnostics = transactionDiagnostic('Cinema graph selection contains a node that no longer exists.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        if (connectionId != null && !composition.connections.some(connection => connection.id === connectionId)) {
          const diagnostics = transactionDiagnostic(`Cinema connection "${connectionId}" no longer exists.`)
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        return applyDocument({
          ...snapshotCinemaPersistedState(current),
          editorMetadata: withCinemaGraphEditorCompositionMetadata(current.editorMetadata, compositionId, {
            selectedNodeIds: nodeIds,
            selectedConnectionId: connectionId,
          }),
        }, 'Select Cinema graph item', { recordHistory: false })
      },

      setCinemaGraphNodePositions: (compositionId, positions, label = 'Arrange Cinema graph') => mutateDocument(
        label,
        current => {
          const composition = requireCinemaComposition(current, compositionId)
          const nodeIds = new Set(composition.nodes.map(node => String(node.id)))
          if (Object.keys(positions).some(nodeId => !nodeIds.has(nodeId))) {
            throw new Error('Cinema graph layout contains a node that no longer exists.')
          }
          return {
            ...current,
            editorMetadata: withCinemaGraphEditorCompositionMetadata(current.editorMetadata, compositionId, { nodePositions: positions }),
          }
        },
      ),

      upsertCinemaAssetBinding: (compositionId, binding) => mutateDocument(
        'Update Cinema asset binding',
        current => {
          const source = requireCinemaComposition(current, compositionId)
          assertMutableCinemaComposition(source)
          return {
            ...current,
            compositions: current.compositions.map(composition => composition.id === compositionId
              ? {
                  ...composition,
                  revision: composition.revision + 1,
                  assetBindings: upsertById(composition.assetBindings, binding),
                }
              : composition),
          }
        },
      ),

      deleteCinemaAssetBinding: (compositionId, bindingId) => mutateDocument(
        'Delete Cinema asset binding',
        current => {
          const source = requireCinemaComposition(current, compositionId)
          assertMutableCinemaComposition(source)
          return {
            ...current,
            compositions: current.compositions.map(composition => composition.id === compositionId
              ? {
                  ...composition,
                  revision: composition.revision + 1,
                  assetBindings: composition.assetBindings.filter(binding => binding.id !== bindingId),
                  nodes: composition.nodes.map(node => ({
                    ...node,
                    assetBindingIds: node.assetBindingIds?.filter(id => id !== bindingId),
                  })),
                }
              : composition),
            instances: current.instances.map(instance => instance.compositionId === compositionId
              ? {
                  ...instance,
                  revision: instance.revision + 1,
                  assetBindingOverrides: instance.assetBindingOverrides.filter(override => override.bindingId !== bindingId),
                }
              : instance),
          }
        },
      ),

      saveCinemaComposition: (compositionId, savedAt) => mutateDocument('Save Cinema composition', current => {
        const source = requireCinemaComposition(current, compositionId)
        assertMutableCinemaComposition(source)
        return {
          ...current,
          compositions: current.compositions.map(composition => composition.id === compositionId
            ? markCinemaCompositionSaved(composition, savedAt)
            : composition),
        }
      }),

      saveCinemaCompositionAs: (compositionId, duplicateId, name, savedAt) => mutateDocument(
        'Save Cinema composition as',
        current => duplicateCompositionIntoState(current, compositionId, duplicateId, name, true, savedAt),
      ),

      renameCinemaComposition: (compositionId, name) => mutateDocument('Rename Cinema composition', current => {
        const source = requireCinemaComposition(current, compositionId)
        assertMutableCinemaComposition(source)
        const normalizedName = name.trim()
        if (!normalizedName) throw new Error('Cinema composition name must not be empty.')
        return {
          ...current,
          compositions: current.compositions.map(composition => composition.id === compositionId
            ? {
                ...composition,
                revision: composition.revision + 1,
                metadata: { ...composition.metadata, name: normalizedName },
              }
            : composition),
        }
      }),

      duplicateCinemaComposition: (compositionId, duplicateId, name) => mutateDocument(
        'Duplicate Cinema composition',
        current => duplicateCompositionIntoState(current, compositionId, duplicateId, name, true),
      ),

      deleteCinemaComposition: compositionId => {
        const result = mutateDocument('Delete Cinema composition', current => {
          const source = requireCinemaComposition(current, compositionId)
          assertMutableCinemaComposition(source)
          const remainingCompositions = current.compositions.filter(composition => composition.id !== compositionId)
          const fallbackCompositionId = remainingCompositions[0]?.id ?? null
          const removedInstanceIds = new Set(
            current.instances
              .filter(instance => instance.compositionId === compositionId)
              .map(instance => instance.id),
          )
          return {
            ...current,
            compositions: remainingCompositions,
            instances: current.instances.filter(instance => instance.compositionId !== compositionId),
            collections: current.collections.map(collection => ({
              ...collection,
              compositionIds: collection.compositionIds.filter(id => id !== compositionId),
            })),
            activeCompositionId: current.activeCompositionId === compositionId ? fallbackCompositionId : current.activeCompositionId,
            activeInstanceId: current.activeCompositionId === compositionId
              || current.activeInstanceId != null && removedInstanceIds.has(current.activeInstanceId)
              ? null
              : current.activeInstanceId,
            editorMetadata: withoutCinemaGraphEditorCompositionMetadata(current.editorMetadata, compositionId),
          }
        })
        if (result.ok && get().composerRuntimePreview.compositionId === String(compositionId)) set({ composerRuntimePreview: EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW })
        return result
      },

      upsertCinemaInstance: instance => mutateDocument('Update Cinema instance', current => ({
        ...current,
        instances: upsertById(current.instances, instance),
      })),

      deleteCinemaInstance: instanceId => mutateDocument('Delete Cinema instance', current => ({
        ...current,
        instances: current.instances.filter(instance => instance.id !== instanceId),
        activeInstanceId: current.activeInstanceId === instanceId ? null : current.activeInstanceId,
      })),

      upsertCinemaCollection: collection => mutateDocument('Update Cinema collection', current => ({
        ...current,
        collections: upsertById(current.collections, collection),
      })),

      deleteCinemaCollection: collectionId => mutateDocument('Delete Cinema collection', current => ({
        ...current,
        collections: current.collections.filter(collection => collection.id !== collectionId),
      })),

      setActiveCinemaComposition: (compositionId, instanceId = null) => {
        const previousCompositionId = get().activeCompositionId
        const result = mutateDocument(
          'Select active Cinema composition',
          current => ({
            ...current,
            activeCompositionId: compositionId,
            activeInstanceId: compositionId == null ? null : instanceId,
          }),
        )
        if (result.ok && previousCompositionId !== compositionId) set({ composerRuntimePreview: EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW })
        return result
      },

      beginCinemaHistoryTransaction: (label = 'Cinema edit transaction') => {
        const current = get()
        if (current.historyTransaction) {
          const diagnostics = transactionDiagnostic('A Cinema history transaction is already active.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        set({
          historyTransaction: { label, baseline: snapshotCinemaPersistedState(current) },
          lastDiagnostics: EMPTY_DIAGNOSTICS,
        })
        return { ok: true, diagnostics: EMPTY_DIAGNOSTICS }
      },

      commitCinemaHistoryTransaction: () => {
        const current = get()
        const transaction = current.historyTransaction
        if (!transaction) {
          const diagnostics = transactionDiagnostic('No Cinema history transaction is active.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const changed = !sameDocument(transaction.baseline, snapshotCinemaPersistedState(current))
        set({
          historyTransaction: null,
          ...(changed
            ? {
                undoStack: pushBounded(current.undoStack, {
                  label: transaction.label,
                  state: transaction.baseline,
                }, current.historyLimit),
                redoStack: [],
              }
            : {}),
          lastDiagnostics: EMPTY_DIAGNOSTICS,
        })
        return { ok: true, diagnostics: EMPTY_DIAGNOSTICS }
      },

      cancelCinemaHistoryTransaction: () => {
        const current = get()
        const transaction = current.historyTransaction
        if (!transaction) {
          const diagnostics = transactionDiagnostic('No Cinema history transaction is active.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const diagnostics = createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
          code: 'CINEMA_TRANSACTION_ROLLED_BACK',
          severity: 'info',
          message: `Cinema transaction "${transaction.label}" was cancelled and rolled back.`,
        })])
        set({
          ...transaction.baseline,
          historyTransaction: null,
          lastDiagnostics: diagnostics,
        })
        return { ok: true, diagnostics }
      },

      undoCinemaEdit: () => {
        const current = get()
        if (current.historyTransaction) {
          const diagnostics = transactionDiagnostic('Commit or cancel the active Cinema transaction before undo.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const entry = current.undoStack[current.undoStack.length - 1]
        if (!entry) return { ok: false, diagnostics: EMPTY_DIAGNOSTICS }
        const present = snapshotCinemaPersistedState(current)
        set({
          ...entry.state,
          undoStack: current.undoStack.slice(0, -1),
          redoStack: pushBounded(current.redoStack, { label: entry.label, state: present }, current.historyLimit),
          lastDiagnostics: EMPTY_DIAGNOSTICS,
        })
        return { ok: true, diagnostics: EMPTY_DIAGNOSTICS }
      },

      redoCinemaEdit: () => {
        const current = get()
        if (current.historyTransaction) {
          const diagnostics = transactionDiagnostic('Commit or cancel the active Cinema transaction before redo.')
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const entry = current.redoStack[current.redoStack.length - 1]
        if (!entry) return { ok: false, diagnostics: EMPTY_DIAGNOSTICS }
        const present = snapshotCinemaPersistedState(current)
        set({
          ...entry.state,
          undoStack: pushBounded(current.undoStack, { label: entry.label, state: present }, current.historyLimit),
          redoStack: current.redoStack.slice(0, -1),
          lastDiagnostics: EMPTY_DIAGNOSTICS,
        })
        return { ok: true, diagnostics: EMPTY_DIAGNOSTICS }
      },

      exportCinemaPackage: options => createCinemaPackageFromPersistedState(
        snapshotCinemaPersistedState(get()),
        options,
      ),

      exportCinemaCompositionPackage: (compositionId, options) => {
        const current = snapshotCinemaPersistedState(get())
        const composition = requireCinemaComposition(current, compositionId)
        const instances = current.instances.filter(instance => instance.compositionId === compositionId)
        const instanceIds = new Set(instances.map(instance => String(instance.id)))
        const scopedState: CinemaPersistedState = {
          ...current,
          // Node definitions are stable external plugin contracts. Scoped packages
          // intentionally rely on the receiving registry rather than duplicating it.
          definitions: [],
          compositions: [composition],
          instances,
          collections: current.collections
            .filter(collection => collection.compositionIds.includes(compositionId))
            .map(collection => ({ ...collection, compositionIds: [compositionId] })),
          activeCompositionId: compositionId,
          activeInstanceId: current.activeInstanceId != null && instanceIds.has(String(current.activeInstanceId))
            ? current.activeInstanceId
            : null,
          editorMetadata: scopeCinemaGraphEditorMetadata(current.editorMetadata, compositionId),
        }
        return createCinemaPackageFromPersistedState(scopedState, options)
      },

      importCinemaPackage: (input, options = {}) => {
        if (options.signal?.aborted) {
          const diagnostics = createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
            code: 'CINEMA_IMPORT_CANCELLED',
            severity: 'warning',
            message: 'Cinema package import was cancelled before mutation.',
          })])
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }
        const preflight = preflightCinemaPackage(input)
        if (!preflight.ok) {
          set({ lastDiagnostics: preflight.diagnostics })
          return { ok: false, diagnostics: preflight.diagnostics }
        }
        if (options.signal?.aborted) {
          const diagnostics = createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
            code: 'CINEMA_IMPORT_CANCELLED',
            severity: 'warning',
            message: 'Cinema package import was cancelled after preflight and before mutation.',
          })])
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }

        const imported = persistedStateFromCinemaPackage(preflight.value)
        if ((options.mode ?? 'replace') === 'replace') {
          return applyDocument(imported, 'Import Cinema package', { clearRuntimePreview: true })
        }

        const current = snapshotCinemaPersistedState(get())
        const conflictPolicy = options.conflictPolicy ?? 'reject'
        const conflicts = collectPackageConflicts(current, imported)
        if (conflicts.length > 0 && conflictPolicy === 'reject') {
          const diagnostics = createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
            code: 'CINEMA_IMPORT_INVALID',
            severity: 'error',
            message: 'Cinema package merge has stable-ID conflicts and was not applied.',
            details: { conflicts: conflicts.join(',') },
          })])
          set({ lastDiagnostics: diagnostics })
          return { ok: false, diagnostics }
        }

        const merged: CinemaPersistedState = {
          ...current,
          definitions: mergeById(current.definitions, imported.definitions, conflictPolicy),
          compositions: mergeById(current.compositions, imported.compositions, conflictPolicy),
          instances: mergeById(current.instances, imported.instances, conflictPolicy),
          collections: mergeById(current.collections, imported.collections, conflictPolicy),
          activeCompositionId: imported.activeCompositionId ?? current.activeCompositionId,
          activeInstanceId: imported.activeInstanceId ?? current.activeInstanceId,
          editorMetadata: mergeCinemaGraphEditorMetadata(current.editorMetadata, imported.editorMetadata),
          migrationProvenance: [...current.migrationProvenance, ...imported.migrationProvenance],
        }
        return applyDocument(merged, 'Merge Cinema package', { clearRuntimePreview: true })
      },
    }
  }
}

export function getCinemaEditorSelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaNodeId | null {
  return getCinemaGraphEditorPrimarySelection(metadata, compositionId)
}

function withCinemaEditorSelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
  nodeId: CinemaNodeId | null,
): CinemaJsonObject {
  return withCinemaGraphEditorCompositionMetadata(metadata, compositionId, {
    selectedNodeIds: nodeId == null ? [] : [nodeId],
    selectedConnectionId: null,
  })
}

function isImmutableCinemaDefinition(definition: Readonly<CinemaPersistedDefinition>): boolean {
  return definition.source.kind === 'built-in' || definition.source.kind === 'adapter'
}

function requireCinemaComposition(
  state: Readonly<CinemaPersistedState>,
  compositionId: CinemaCompositionId,
): CinemaCompositionDefinition {
  const composition = state.compositions.find(candidate => candidate.id === compositionId)
  if (!composition) throw new Error(`Cinema composition "${compositionId}" does not exist.`)
  return composition
}

function assertMutableCinemaComposition(composition: Readonly<CinemaCompositionDefinition>): void {
  if (isCinemaBuiltInComposition(composition)) {
    throw new Error(`Built-in Cinema composition "${composition.id}" is immutable; duplicate it before editing.`)
  }
}

function duplicateCompositionIntoState(
  current: Readonly<CinemaPersistedState>,
  compositionId: CinemaCompositionId,
  duplicateId: CinemaCompositionId,
  name: string | undefined,
  saved: boolean,
  timestamp?: string,
): CinemaPersistedState {
  const source = requireCinemaComposition(current, compositionId)
  if (current.compositions.some(composition => composition.id === duplicateId)) {
    throw new Error(`Cinema composition "${duplicateId}" already exists.`)
  }
  const duplicate = duplicateCinemaCompositionGraph(source, {
    id: duplicateId,
    name,
    saved,
    timestamp,
  })
  const sourceEditor = getCinemaGraphEditorCompositionMetadata(current.editorMetadata, source.id)
  const duplicatePositions = Object.fromEntries(source.nodes.flatMap((node, index) => {
    const position = sourceEditor.nodePositions[String(node.id)]
    const duplicateNode = duplicate.nodes[index]
    return position && duplicateNode ? [[String(duplicateNode.id), position]] : []
  }))
  const selectedIndexes = sourceEditor.selectedNodeIds
    .map(nodeId => source.nodes.findIndex(node => node.id === nodeId))
    .filter(index => index >= 0)
  const selectedNodeIds = selectedIndexes
    .map(index => duplicate.nodes[index]?.id)
    .filter((nodeId): nodeId is CinemaNodeId => nodeId != null)
  return {
    ...current,
    compositions: [...current.compositions, duplicate],
    activeCompositionId: duplicate.id,
    activeInstanceId: null,
    editorMetadata: withCinemaGraphEditorCompositionMetadata(current.editorMetadata, duplicate.id, {
      mode: sourceEditor.mode,
      viewport: sourceEditor.viewport,
      nodePositions: duplicatePositions,
      selectedNodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : duplicate.nodes[0]?.id ? [duplicate.nodes[0].id] : [],
      selectedConnectionId: null,
    }),
  }
}

function collectPackageConflicts(current: CinemaPersistedState, imported: CinemaPersistedState): string[] {
  return [
    ...findConflicts('definition', current.definitions, imported.definitions),
    ...findConflicts('composition', current.compositions, imported.compositions),
    ...findConflicts('instance', current.instances, imported.instances),
    ...findConflicts('collection', current.collections, imported.collections),
  ].sort(compareStrings)
}

function findConflicts<Value extends { id: string }>(
  kind: string,
  current: readonly Value[],
  imported: readonly Value[],
): string[] {
  const ids = new Set(current.map(value => value.id))
  return imported.filter(value => ids.has(value.id)).map(value => `${kind}:${value.id}`)
}

function mergeById<Value extends { id: string }>(
  current: readonly Value[],
  imported: readonly Value[],
  conflictPolicy: 'reject' | 'replace',
): readonly Value[] {
  if (conflictPolicy === 'reject') return [...current, ...imported]
  const importedIds = new Set(imported.map(value => value.id))
  return [...current.filter(value => !importedIds.has(value.id)), ...imported]
}

function upsertById<Value extends { id: string }>(current: readonly Value[], value: Value): readonly Value[] {
  const index = current.findIndex(candidate => candidate.id === value.id)
  if (index < 0) return [...current, cloneCinemaSerializable(value)]
  return current.map((candidate, candidateIndex) => candidateIndex === index
    ? cloneCinemaSerializable(value)
    : candidate)
}

function pushBounded<Value>(current: readonly Value[], value: Value, limit: number): readonly Value[] {
  const next = [...current, value]
  return next.length > limit ? next.slice(next.length - limit) : next
}

function sameDocument(left: CinemaPersistedState, right: CinemaPersistedState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function transactionDiagnostic(message: string): CinemaDiagnosticSnapshot {
  return createCinemaDiagnosticSnapshot([createCinemaDiagnostic({
    code: 'CINEMA_TRANSACTION_ROLLED_BACK',
    severity: 'warning',
    message,
  })])
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

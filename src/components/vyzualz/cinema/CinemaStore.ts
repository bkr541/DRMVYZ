import { create } from 'zustand'
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
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
  CinemaModulationRouteId,
  CinemaNodeTypeId,
  CinemaNodeId,
} from './CinemaIdentifiers'
import { preflightCinemaPackage } from './CinemaPackageIO'
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

export const CINEMA_PERSIST_STORAGE_NAME = 'drmvyz:cinema-store' as const
export const CINEMA_PERSIST_MIDDLEWARE_VERSION = 3 as const

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
  upsertCinemaAssetBinding: (compositionId: CinemaCompositionId, binding: CinemaAssetBindingDefinition) => CinemaStoreOperationResult
  deleteCinemaAssetBinding: (compositionId: CinemaCompositionId, bindingId: CinemaAssetBindingId) => CinemaStoreOperationResult
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

const fallbackStorageData = new Map<string, string>()
const fallbackStorage: StateStorage = {
  getItem: name => fallbackStorageData.get(name) ?? null,
  setItem: (name, value) => { fallbackStorageData.set(name, value) },
  removeItem: name => { fallbackStorageData.delete(name) },
}

function resolveCinemaStorage(): StateStorage {
  return typeof localStorage === 'undefined' ? fallbackStorage : localStorage
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
      storage: createJSONStorage(resolveCinemaStorage),
      partialize: state => snapshotCinemaPersistedState(state),
      migrate: (persistedState, version) => version > CINEMA_PERSIST_MIDDLEWARE_VERSION
        ? { unsupportedPersistMiddlewareVersion: version }
        : persistedState,
      merge: (persistedState, currentState) => {
        const normalized = normalizeCinemaPersistedState(persistedState)
        return normalized.ok
          ? { ...currentState, ...reconcileCinemaBuiltInState(normalized.value), lastDiagnostics: normalized.diagnostics }
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
        return applyDocument(reconcileCinemaBuiltInState(normalized.value), 'Hydrate Cinema state', {
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
        return applyDocument(reconcileCinemaBuiltInState(normalized.value), label, { clearRuntimePreview: true })
      },

      resetCinemaState: () => applyDocument(createCinemaFoundationPersistedState(), 'Reset Cinema state', { clearRuntimePreview: true }),

      upsertCinemaDefinition: definition => mutateDocument('Update Cinema definition', current => ({
        ...current,
        definitions: upsertById(current.definitions, definition),
      })),

      deleteCinemaDefinition: definitionId => mutateDocument('Delete Cinema definition', current => ({
        ...current,
        definitions: current.definitions.filter(definition => definition.id !== definitionId),
      })),

      upsertCinemaComposition: composition => mutateDocument('Update Cinema composition', current => ({
        ...current,
        compositions: upsertById(current.compositions, composition),
      })),

      editCinemaComposition: (compositionId, label, edit) => mutateDocument(label, current => {
        const source = current.compositions.find(composition => composition.id === compositionId)
        if (!source) throw new Error(`Cinema composition "${compositionId}" does not exist.`)
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

      upsertCinemaAssetBinding: (compositionId, binding) => mutateDocument(
        'Update Cinema asset binding',
        current => ({
          ...current,
          compositions: current.compositions.map(composition => composition.id === compositionId
            ? {
                ...composition,
                revision: composition.revision + 1,
                assetBindings: upsertById(composition.assetBindings, binding),
              }
            : composition),
        }),
      ),

      deleteCinemaAssetBinding: (compositionId, bindingId) => mutateDocument(
        'Delete Cinema asset binding',
        current => ({
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
        }),
      ),

      renameCinemaComposition: (compositionId, name) => mutateDocument('Rename Cinema composition', current => ({
        ...current,
        compositions: current.compositions.map(composition => composition.id === compositionId
          ? {
              ...composition,
              revision: composition.revision + 1,
              metadata: { ...composition.metadata, name },
            }
          : composition),
      })),

      duplicateCinemaComposition: (compositionId, duplicateId, name) => mutateDocument(
        'Duplicate Cinema composition',
        current => {
          const source = current.compositions.find(composition => composition.id === compositionId)
          if (!source) throw new Error(`Cinema composition "${compositionId}" does not exist.`)
          if (current.compositions.some(composition => composition.id === duplicateId)) {
            throw new Error(`Cinema composition "${duplicateId}" already exists.`)
          }
          const duplicate = cloneCinemaSerializable({
            ...source,
            id: duplicateId,
            revision: 1,
            metadata: {
              ...source.metadata,
              name: name ?? `${source.metadata.name} Copy`,
            },
          })
          return {
            ...current,
            compositions: [...current.compositions, duplicate],
          }
        },
      ),

      deleteCinemaComposition: compositionId => {
        const result = mutateDocument('Delete Cinema composition', current => {
          const removedInstanceIds = new Set(
            current.instances
              .filter(instance => instance.compositionId === compositionId)
              .map(instance => instance.id),
          )
          return {
            ...current,
            compositions: current.compositions.filter(composition => composition.id !== compositionId),
            instances: current.instances.filter(instance => instance.compositionId !== compositionId),
            collections: current.collections.map(collection => ({
              ...collection,
              compositionIds: collection.compositionIds.filter(id => id !== compositionId),
            })),
            activeCompositionId: current.activeCompositionId === compositionId ? null : current.activeCompositionId,
            activeInstanceId: current.activeInstanceId != null && removedInstanceIds.has(current.activeInstanceId)
              ? null
              : current.activeInstanceId,
            editorMetadata: withCinemaEditorSelection(current.editorMetadata, compositionId, null),
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
          editorMetadata: { ...current.editorMetadata, ...imported.editorMetadata },
          migrationProvenance: [...current.migrationProvenance, ...imported.migrationProvenance],
        }
        return applyDocument(merged, 'Merge Cinema package', { clearRuntimePreview: true })
      },
    }
  }
}

const CINEMA_EDITOR_SELECTION_KEY = 'composerSelectionByComposition'

export function getCinemaEditorSelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaNodeId | null {
  const raw = metadata[CINEMA_EDITOR_SELECTION_KEY]
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = (raw as Record<string, unknown>)[String(compositionId)]
  return typeof value === 'string' ? value as CinemaNodeId : null
}

function withCinemaEditorSelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
  nodeId: CinemaNodeId | null,
): CinemaJsonObject {
  const raw = metadata[CINEMA_EDITOR_SELECTION_KEY]
  const current = raw != null && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, string>) }
    : {}
  if (nodeId == null) delete current[String(compositionId)]
  else current[String(compositionId)] = String(nodeId)
  return { ...metadata, [CINEMA_EDITOR_SELECTION_KEY]: current }
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

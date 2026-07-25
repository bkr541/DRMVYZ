import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ShaderParamValue, ShaderParamValues } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ModulationEvaluationFrame } from '../modulation/shaderModulationTypes'
import type { ShaderAudioUniformFrame } from '../audio/shaderAudioTypes'
import type {
  ShaderTexSourceSelection,
  TextureInputValidation,
} from '../textures/shaderTextureInputTypes'
import { shaderRegistry } from '../registry'
import { DEFAULT_SHADER_SCENE_ID } from '../scenes'
import type { ShaderCompileStatus } from '../editor/ShaderCompilePanel'
import type { PerformanceMetrics } from '../performance/shaderPerformanceTypes'
import type { QualityTier } from '../registry/shaderRegistryTypes'
import type { RenderPassInfo } from '../rendergraph/shaderRenderGraphTypes'
import type { ShaderPerformanceRuntimeSnapshot } from '../performance/ShaderPerformanceProgramTypes'
import {
  createUserShaderRoute,
  markShaderRouteModified,
  resolveShaderRoutesForDefinition,
} from '../performance/ShaderPerformanceRoutes'
import {
  REACTOR_SCENE_ID,
  applyReactorRecipe as getReactorRecipeValues,
  isReactorRecipe,
  normalizeReactorParamValues,
  type ReactorRecipe,
} from '../scenes/reactor'
import {
  getLegacyReactorRecipe,
  migrateLegacyReactorParamValueMap,
  migrateLegacyReactorParamValues,
  migrateLegacyReactorRoutes,
  migrateLegacyReactorSceneId,
  migrateLegacyReactorTextureSelections,
} from '../scenes/reactorMigration'

// ── ShaderPanelStore ──────────────────────────────────────────────────────────

export interface ShaderPanelState {
  // ── Active scene ──────────────────────────────────────────────────────────
  activeShaderId:  string | null

  // ── Parameter values (per-scene) ─────────────────────────────────────────
  paramValuesByShaderId: Record<string, ShaderParamValues>

  // Convenience projection: param values for the active scene
  paramValues:     ShaderParamValues
  modulatedValues: Record<string, number>

  // ── Compile state ─────────────────────────────────────────────────────────
  compileError:   string | null
  compileStatus:  ShaderCompileStatus

  // ── Modulation routes (per-scene) ─────────────────────────────────────────
  routesByShaderId:   Record<string, ShaderModulationRoute[]>
  audioFrame:         ShaderAudioUniformFrame | null
  evaluationFrame:    ModulationEvaluationFrame | null
  performanceSnapshot: ShaderPerformanceRuntimeSnapshot | null

  // ── Texture selections (per-scene) ────────────────────────────────────────
  textureSelectionsByShaderId:  Record<string, Record<string, ShaderTexSourceSelection>>
  textureValidationByShaderId:  Record<string, TextureInputValidation[]>
  triggeredParamIds:  string[]

  // ── Performance ───────────────────────────────────────────────────────────
  performanceMetrics: PerformanceMetrics | null
  effectiveQualityTier: QualityTier | null

  // ── Actions ───────────────────────────────────────────────────────────────
  setActiveShaderId:  (id: string | null) => void
  setParamValue:      (paramId: string, value: ShaderParamValue) => void
  applyReactorRecipe: (recipe: Exclude<ReactorRecipe, 'custom'>) => void
  setModulatedValue:  (paramId: string, value: number) => void
  setCompileError:    (error: string | null) => void
  resetParams:        () => void

  // Modulation routes
  setRoutesForShader: (shaderId: string, routes: ShaderModulationRoute[]) => void
  addRoute:           (shaderId: string, route: ShaderModulationRoute) => void
  updateRoute:        (shaderId: string, routeId: string, patch: Partial<ShaderModulationRoute>) => void
  removeRoute:        (shaderId: string, routeId: string) => void
  ensureNativeProgram: (shaderId: string) => ShaderModulationRoute[]

  // Live frames
  setLiveAudioFrame:     (frame: ShaderAudioUniformFrame) => void
  setEvaluationFrame:    (frame: ModulationEvaluationFrame) => void
  setPerformanceSnapshot: (snapshot: ShaderPerformanceRuntimeSnapshot | null) => void
  setCompileStatus:      (status: ShaderCompileStatus) => void
  setPerformanceMetrics: (metrics: PerformanceMetrics) => void
  setEffectiveQualityTier: (tier: QualityTier) => void
  setModulatedValues:    (values: Record<string, number>) => void

  // Per-scene texture selections
  setTextureSelection:   (shaderId: string, inputName: string, sel: ShaderTexSourceSelection) => void
  clearTextureSelection: (shaderId: string, inputName: string) => void
  setTextureValidation:  (shaderId: string, results: TextureInputValidation[]) => void

  // Triggers
  triggerParam:         (paramId: string) => void
  consumeTriggeredParams: () => string[]

  // Compile preview (renderer hooks in a callback at runtime)
  _previewCompileCallback: ((fragSrc: string, vertSrc?: string) => void) | null
  setPreviewCompileCallback: (cb: ((fragSrc: string, vertSrc?: string) => void) | null) => void
  requestPreviewCompile: (fragSrc: string, vertSrc?: string) => void

  // Preview reset (renderer hooks in a callback at runtime)
  _previewResetCallback: (() => void) | null
  setPreviewResetCallback: (cb: (() => void) | null) => void
  requestPreviewReset: () => void

  // Forced recompile of the active scene (e.g. after user-scene update)
  pendingRecompileSceneId: string | null
  requestRecompile: (sceneId: string) => void
  consumePendingRecompile: () => string | null

  // Live pass info from the active render graph (for ShaderPassInspector)
  passInfo: RenderPassInfo[] | null
  setPassInfo: (info: RenderPassInfo[] | null) => void
}

const IDLE_COMPILE_STATUS: ShaderCompileStatus = { state: 'idle' }

export const RETIRED_SHADER_SCENE_IDS = new Set<string>([
  'shader-spectrum-cathedral',
  'shader-dreamstate-mycelium',
  'shader-feedback-kaleidoscope',
  'shader-riddim-railgun-sequencer',
])

export function migrateRetiredShaderSceneId(id: string | null): string | null {
  return id && RETIRED_SHADER_SCENE_IDS.has(id) ? DEFAULT_SHADER_SCENE_ID : id
}

function normalizeShaderSceneId(id: string | null): string | null {
  return migrateRetiredShaderSceneId(migrateLegacyReactorSceneId(id))
}

function removeRetiredShaderRecords<T>(value: Record<string, T> | undefined): Record<string, T> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([shaderId]) => !RETIRED_SHADER_SCENE_IDS.has(shaderId)),
  )
}

export interface ShaderPanelPersistedState {
  activeShaderId: string | null
  paramValuesByShaderId: Record<string, ShaderParamValues>
  routesByShaderId: Record<string, ShaderModulationRoute[]>
  textureSelectionsByShaderId: Record<string, Record<string, ShaderTexSourceSelection>>
}

function serializableTextureSelections(
  selections: ShaderPanelState['textureSelectionsByShaderId'],
): ShaderPanelPersistedState['textureSelectionsByShaderId'] {
  return Object.fromEntries(
    Object.entries(selections).map(([shaderId, inputs]) => [
      shaderId,
      Object.fromEntries(
        Object.entries(inputs).map(([inputName, selection]) => {
          // DOM media elements are runtime handles. Persist only the stable POJO
          // selection descriptor so the texture manager can re-resolve it later.
          const { mediaElement: _runtimeElement, ...serializable } = selection
          return [inputName, serializable]
        }),
      ),
    ]),
  )
}

export function shaderPanelPartialize(state: ShaderPanelState): ShaderPanelPersistedState {
  return {
    activeShaderId:              normalizeShaderSceneId(state.activeShaderId),
    paramValuesByShaderId:       removeRetiredShaderRecords(state.paramValuesByShaderId),
    routesByShaderId:            removeRetiredShaderRecords(state.routesByShaderId),
    textureSelectionsByShaderId: removeRetiredShaderRecords(
      serializableTextureSelections(state.textureSelectionsByShaderId),
    ),
  }
}

export function migrateShaderPanelPersistedState(
  persistedState: unknown,
): Partial<ShaderPanelPersistedState> {
  const persisted = (persistedState ?? {}) as Partial<ShaderPanelPersistedState>
  const persistedActiveShaderId = typeof persisted.activeShaderId === 'string'
    ? persisted.activeShaderId
    : null
  const activeShaderId = normalizeShaderSceneId(persistedActiveShaderId)
  const paramValuesByShaderId = removeRetiredShaderRecords(
    migrateLegacyReactorParamValueMap(persisted.paramValuesByShaderId),
  )
  const textureSelectionsByShaderId = removeRetiredShaderRecords(
    migrateLegacyReactorTextureSelections(persisted.textureSelectionsByShaderId),
  )

  if (persistedActiveShaderId && getLegacyReactorRecipe(persistedActiveShaderId)) {
    paramValuesByShaderId[REACTOR_SCENE_ID] = migrateLegacyReactorParamValues(
      persistedActiveShaderId,
      persisted.paramValuesByShaderId?.[persistedActiveShaderId],
    )
    const activeTextureSelections = persisted.textureSelectionsByShaderId?.[persistedActiveShaderId]
    if (activeTextureSelections) {
      textureSelectionsByShaderId[REACTOR_SCENE_ID] = {
        ...(textureSelectionsByShaderId[REACTOR_SCENE_ID] ?? {}),
        ...activeTextureSelections,
      }
    }
  }

  const migratedRoutes = removeRetiredShaderRecords(
    migrateLegacyReactorRoutes(persisted.routesByShaderId),
  )
  const routesByShaderId: Record<string, ShaderModulationRoute[]> = { ...migratedRoutes }
  for (const def of shaderRegistry.getAll()) {
    if (!def.performanceProgram) continue
    if (Object.prototype.hasOwnProperty.call(migratedRoutes, def.id) || def.id === activeShaderId) {
      routesByShaderId[def.id] = resolveShaderRoutesForDefinition(def, migratedRoutes[def.id])
    }
  }

  return {
    ...persisted,
    activeShaderId,
    paramValuesByShaderId,
    routesByShaderId,
    textureSelectionsByShaderId,
  }
}

export function mergeShaderPanelState(
  persistedState: unknown,
  currentState: ShaderPanelState,
): ShaderPanelState {
  const persisted = migrateShaderPanelPersistedState(persistedState)
  const activeShaderId = persisted.activeShaderId ?? null
  const paramValuesByShaderId = persisted.paramValuesByShaderId ?? {}
  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null
  const storedParamValues = activeShaderId
    ? (paramValuesByShaderId[activeShaderId] ?? (def ? { ...def.defaults } : {}))
    : {}
  const paramValues = activeShaderId === REACTOR_SCENE_ID
    ? normalizeReactorParamValues(storedParamValues)
    : storedParamValues

  if (activeShaderId) paramValuesByShaderId[activeShaderId] = { ...paramValues }

  return {
    ...currentState,
    activeShaderId,
    paramValuesByShaderId,
    paramValues,
    routesByShaderId:            persisted.routesByShaderId ?? {},
    performanceSnapshot:         null,
    textureSelectionsByShaderId: persisted.textureSelectionsByShaderId ?? {},
  }
}

export const useShaderPanelStore = create<ShaderPanelState>()(
  persist((set, get) => ({
  activeShaderId:              null,
  paramValuesByShaderId:       {},
  paramValues:                 {},
  modulatedValues:             {},
  compileError:                null,
  compileStatus:               IDLE_COMPILE_STATUS,
  routesByShaderId:            {},
  audioFrame:                  null,
  evaluationFrame:             null,
  performanceSnapshot:          null,
  textureSelectionsByShaderId: {},
  textureValidationByShaderId: {},
  triggeredParamIds:           [],
  performanceMetrics:          null,
  effectiveQualityTier:        null,
  _previewCompileCallback:     null,
  _previewResetCallback:       null,
  pendingRecompileSceneId:     null,
  passInfo:                    null,

  setActiveShaderId: (id) => {
    const legacyRecipe = getLegacyReactorRecipe(id)
    const migratedId = normalizeShaderSceneId(id)
    const def = migratedId ? shaderRegistry.get(migratedId) : null
    const prev = get()
    // Preserve previously edited param values for normal scene activation. A legacy
    // scene reference deliberately selects the equivalent Reactor recipe.
    const savedValues = migratedId ? (prev.paramValuesByShaderId[migratedId] ?? null) : null
    const legacyValues = id ? prev.paramValuesByShaderId[id] : undefined
    const rawValues = legacyRecipe && id
      ? migrateLegacyReactorParamValues(id, legacyValues)
      : savedValues ?? (def ? { ...def.defaults } : {})
    const newValues = migratedId === REACTOR_SCENE_ID
      ? normalizeReactorParamValues(rawValues)
      : rawValues

    set(s => {
      const resolvedRoutes = migratedId
        ? resolveShaderRoutesForDefinition(def, s.routesByShaderId[migratedId])
        : []
      return {
        activeShaderId: migratedId,
        paramValues: newValues,
        paramValuesByShaderId: migratedId
          ? { ...s.paramValuesByShaderId, [migratedId]: { ...newValues } }
          : s.paramValuesByShaderId,
        routesByShaderId: migratedId
          ? { ...s.routesByShaderId, [migratedId]: resolvedRoutes }
          : s.routesByShaderId,
        modulatedValues: {},
        performanceSnapshot: null,
        compileError: null,
        compileStatus: IDLE_COMPILE_STATUS,
      }
    })
  },

  setParamValue: (paramId, value) =>
    set(s => {
      let newParamValues: ShaderParamValues
      if (s.activeShaderId === REACTOR_SCENE_ID && paramId === 'recipe' && isReactorRecipe(value)) {
        newParamValues = value === 'custom'
          ? { ...s.paramValues, recipe: 'custom' }
          : getReactorRecipeValues(value)
      } else if (s.activeShaderId === REACTOR_SCENE_ID) {
        newParamValues = { ...s.paramValues, [paramId]: value, recipe: 'custom' }
      } else {
        newParamValues = { ...s.paramValues, [paramId]: value }
      }
      const byId = s.activeShaderId
        ? { ...s.paramValuesByShaderId, [s.activeShaderId]: newParamValues }
        : s.paramValuesByShaderId
      return { paramValues: newParamValues, paramValuesByShaderId: byId }
    }),

  applyReactorRecipe: (recipe) =>
    set(s => {
      const newParamValues = getReactorRecipeValues(recipe)
      return {
        activeShaderId: REACTOR_SCENE_ID,
        paramValues: newParamValues,
        paramValuesByShaderId: {
          ...s.paramValuesByShaderId,
          [REACTOR_SCENE_ID]: newParamValues,
        },
        modulatedValues: {},
      }
    }),

  setModulatedValue: (paramId, value) =>
    set(s => ({ modulatedValues: { ...s.modulatedValues, [paramId]: value } })),

  setModulatedValues: (values) => set({ modulatedValues: values }),

  setCompileError: (error) => set({ compileError: error }),

  resetParams: () => {
    const { activeShaderId } = get()
    const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null
    const newValues = def ? { ...def.defaults } : {}
    set(s => ({
      paramValues:     newValues,
      modulatedValues: {},
      paramValuesByShaderId: activeShaderId
        ? { ...s.paramValuesByShaderId, [activeShaderId]: newValues }
        : s.paramValuesByShaderId,
    }))
  },

  setRoutesForShader: (shaderId, routes) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [targetShaderId]: routes.map(route => route.origin ? { ...route } : createUserShaderRoute(route)),
      },
    }))
  },

  addRoute: (shaderId, route) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [targetShaderId]: [
          ...(s.routesByShaderId[targetShaderId] ?? []),
          createUserShaderRoute(route),
        ],
      },
    }))
  },

  updateRoute: (shaderId, routeId, patch) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [targetShaderId]: (s.routesByShaderId[targetShaderId] ?? []).map(route =>
          route.id === routeId ? markShaderRouteModified(route, patch) : route
        ),
      },
    }))
  },

  removeRoute: (shaderId, routeId) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => {
      const current = s.routesByShaderId[targetShaderId] ?? []
      const target = current.find(route => route.id === routeId)
      const next = target && (target.origin === 'built-in' || target.id.startsWith('builtin:'))
        ? current.map(route => route.id === routeId
          ? markShaderRouteModified(route, { enabled: false })
          : route)
        : current.filter(route => route.id !== routeId)
      return { routesByShaderId: { ...s.routesByShaderId, [targetShaderId]: next } }
    })
  },

  ensureNativeProgram: (shaderId) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    const def = shaderRegistry.get(targetShaderId)
    const resolved = resolveShaderRoutesForDefinition(
      def,
      get().routesByShaderId[targetShaderId],
    )
    set(s => ({
      routesByShaderId: { ...s.routesByShaderId, [targetShaderId]: resolved },
    }))
    return resolved
  },

  setLiveAudioFrame:       (frame)   => set({ audioFrame: frame }),
  setEvaluationFrame:      (frame)   => set({ evaluationFrame: frame }),
  setPerformanceSnapshot:  (snapshot) => set({ performanceSnapshot: snapshot }),
  setCompileStatus:        (status)  => set({ compileStatus: status }),
  setPerformanceMetrics:   (metrics) => set({ performanceMetrics: metrics }),
  setEffectiveQualityTier: (tier)    => set({ effectiveQualityTier: tier }),

  setTextureSelection: (shaderId, inputName, sel) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => ({
      textureSelectionsByShaderId: {
        ...s.textureSelectionsByShaderId,
        [targetShaderId]: {
          ...(s.textureSelectionsByShaderId[targetShaderId] ?? {}),
          [inputName]: sel,
        },
      },
    }))
  },

  clearTextureSelection: (shaderId, inputName) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => {
      const current = { ...(s.textureSelectionsByShaderId[targetShaderId] ?? {}) }
      delete current[inputName]
      return {
        textureSelectionsByShaderId: {
          ...s.textureSelectionsByShaderId,
          [targetShaderId]: current,
        },
      }
    })
  },

  setTextureValidation: (shaderId, results) => {
    const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
    set(s => ({
      textureValidationByShaderId: {
        ...s.textureValidationByShaderId,
        [targetShaderId]: results,
      },
    }))
  },

  triggerParam: (paramId) =>
    set(s => ({
      triggeredParamIds: [...s.triggeredParamIds, paramId],
      paramValues: { ...s.paramValues, [paramId]: true },
    })),

  consumeTriggeredParams: () => {
    const ids = get().triggeredParamIds
    if (ids.length === 0) return []
    // Clear trigger values back to false, clear the queue
    set(s => {
      const cleared: Record<string, ShaderParamValue> = {}
      for (const id of ids) cleared[id] = false
      return {
        triggeredParamIds: [],
        paramValues: { ...s.paramValues, ...cleared },
      }
    })
    return ids
  },

  setPreviewCompileCallback: (cb) => set({ _previewCompileCallback: cb }),

  requestPreviewCompile: (fragSrc, vertSrc) => {
    get()._previewCompileCallback?.(fragSrc, vertSrc)
  },

  setPreviewResetCallback: (cb) => set({ _previewResetCallback: cb }),

  requestPreviewReset: () => {
    get()._previewResetCallback?.()
  },

  requestRecompile: (sceneId) => set({
    pendingRecompileSceneId: normalizeShaderSceneId(sceneId) ?? sceneId,
  }),

  consumePendingRecompile: () => {
    const id = get().pendingRecompileSceneId
    if (id !== null) set({ pendingRecompileSceneId: null })
    return id
  },

  setPassInfo: (info) => set({ passInfo: info }),
  }), {
    name: 'drmvyz:shader-panel',
    version: 4,
    storage: createJSONStorage(() => localStorage),
    partialize: shaderPanelPartialize,
    migrate: persistedState => migrateShaderPanelPersistedState(persistedState),
    merge: mergeShaderPanelState,
    // Quality preference is already persisted by ShaderLibraryStore. Keeping a
    // single owner avoids two stores racing to restore different quality tiers.
  }),
)

// ── Convenience selector ──────────────────────────────────────────────────────

export function getActiveRoutes(shaderId: string | null): ShaderModulationRoute[] {
  if (!shaderId) return []
  const targetShaderId = normalizeShaderSceneId(shaderId) ?? shaderId
  return useShaderPanelStore.getState().routesByShaderId[targetShaderId] ?? []
}

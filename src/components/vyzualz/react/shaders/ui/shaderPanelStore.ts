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
import type { ShaderCompileStatus } from '../editor/ShaderCompilePanel'
import type { PerformanceMetrics } from '../performance/shaderPerformanceTypes'
import type { QualityTier } from '../registry/shaderRegistryTypes'
import type { RenderPassInfo } from '../rendergraph/shaderRenderGraphTypes'

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
  setModulatedValue:  (paramId: string, value: number) => void
  setCompileError:    (error: string | null) => void
  resetParams:        () => void

  // Modulation routes
  setRoutesForShader: (shaderId: string, routes: ShaderModulationRoute[]) => void
  addRoute:           (shaderId: string, route: ShaderModulationRoute) => void
  updateRoute:        (shaderId: string, routeId: string, patch: Partial<ShaderModulationRoute>) => void
  removeRoute:        (shaderId: string, routeId: string) => void

  // Live frames
  setLiveAudioFrame:     (frame: ShaderAudioUniformFrame) => void
  setEvaluationFrame:    (frame: ModulationEvaluationFrame) => void
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
    activeShaderId:              state.activeShaderId,
    paramValuesByShaderId:       state.paramValuesByShaderId,
    routesByShaderId:            state.routesByShaderId,
    textureSelectionsByShaderId: serializableTextureSelections(state.textureSelectionsByShaderId),
  }
}

export function mergeShaderPanelState(
  persistedState: unknown,
  currentState: ShaderPanelState,
): ShaderPanelState {
  const persisted = (persistedState ?? {}) as Partial<ShaderPanelPersistedState>
  const activeShaderId = typeof persisted.activeShaderId === 'string'
    ? persisted.activeShaderId
    : null
  const paramValuesByShaderId = persisted.paramValuesByShaderId ?? {}
  const def = activeShaderId ? shaderRegistry.get(activeShaderId) : null
  const paramValues = activeShaderId
    ? (paramValuesByShaderId[activeShaderId] ?? (def ? { ...def.defaults } : {}))
    : {}

  return {
    ...currentState,
    activeShaderId,
    paramValuesByShaderId,
    paramValues,
    routesByShaderId:            persisted.routesByShaderId ?? {},
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
    const def = id ? shaderRegistry.get(id) : null
    const prev = get()
    // Preserve previously edited param values for this scene when available
    const savedValues = id ? (prev.paramValuesByShaderId[id] ?? null) : null
    const newValues = savedValues ?? (def ? { ...def.defaults } : {})

    set({
      activeShaderId:  id,
      paramValues:     newValues,
      modulatedValues: {},
      compileError:    null,
      compileStatus:   IDLE_COMPILE_STATUS,
    })

    // Save fresh defaults into by-scene map only when no prior values exist
    if (id && def && !savedValues) {
      set(s => ({
        paramValuesByShaderId: {
          ...s.paramValuesByShaderId,
          [id]: { ...def.defaults },
        },
      }))
    }
  },

  setParamValue: (paramId, value) =>
    set(s => {
      const newParamValues = { ...s.paramValues, [paramId]: value }
      const byId = s.activeShaderId
        ? { ...s.paramValuesByShaderId, [s.activeShaderId]: newParamValues }
        : s.paramValuesByShaderId
      return { paramValues: newParamValues, paramValuesByShaderId: byId }
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

  setRoutesForShader: (shaderId, routes) =>
    set(s => ({
      routesByShaderId: { ...s.routesByShaderId, [shaderId]: routes },
    })),

  addRoute: (shaderId, route) =>
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [shaderId]: [...(s.routesByShaderId[shaderId] ?? []), route],
      },
    })),

  updateRoute: (shaderId, routeId, patch) =>
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [shaderId]: (s.routesByShaderId[shaderId] ?? []).map(r =>
          r.id === routeId ? { ...r, ...patch } : r
        ),
      },
    })),

  removeRoute: (shaderId, routeId) =>
    set(s => ({
      routesByShaderId: {
        ...s.routesByShaderId,
        [shaderId]: (s.routesByShaderId[shaderId] ?? []).filter(r => r.id !== routeId),
      },
    })),

  setLiveAudioFrame:       (frame)   => set({ audioFrame: frame }),
  setEvaluationFrame:      (frame)   => set({ evaluationFrame: frame }),
  setCompileStatus:        (status)  => set({ compileStatus: status }),
  setPerformanceMetrics:   (metrics) => set({ performanceMetrics: metrics }),
  setEffectiveQualityTier: (tier)    => set({ effectiveQualityTier: tier }),

  setTextureSelection: (shaderId, inputName, sel) =>
    set(s => ({
      textureSelectionsByShaderId: {
        ...s.textureSelectionsByShaderId,
        [shaderId]: {
          ...(s.textureSelectionsByShaderId[shaderId] ?? {}),
          [inputName]: sel,
        },
      },
    })),

  clearTextureSelection: (shaderId, inputName) =>
    set(s => {
      const current = { ...(s.textureSelectionsByShaderId[shaderId] ?? {}) }
      delete current[inputName]
      return {
        textureSelectionsByShaderId: {
          ...s.textureSelectionsByShaderId,
          [shaderId]: current,
        },
      }
    }),

  setTextureValidation: (shaderId, results) =>
    set(s => ({
      textureValidationByShaderId: {
        ...s.textureValidationByShaderId,
        [shaderId]: results,
      },
    })),

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

  requestRecompile: (sceneId) => set({ pendingRecompileSceneId: sceneId }),

  consumePendingRecompile: () => {
    const id = get().pendingRecompileSceneId
    if (id !== null) set({ pendingRecompileSceneId: null })
    return id
  },

  setPassInfo: (info) => set({ passInfo: info }),
  }), {
    name: 'drmvyz:shader-panel',
    version: 1,
    storage: createJSONStorage(() => localStorage),
    partialize: shaderPanelPartialize,
    merge: mergeShaderPanelState,
    // Quality preference is already persisted by ShaderLibraryStore. Keeping a
    // single owner avoids two stores racing to restore different quality tiers.
  }),
)

// ── Convenience selector ──────────────────────────────────────────────────────

export function getActiveRoutes(shaderId: string | null): ShaderModulationRoute[] {
  if (!shaderId) return []
  return useShaderPanelStore.getState().routesByShaderId[shaderId] ?? []
}

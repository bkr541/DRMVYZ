import { create } from 'zustand'
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
import type { PerformanceMetrics, QualityTierWithAuto } from '../performance/shaderPerformanceTypes'
import type { QualityTier } from '../registry/shaderRegistryTypes'

// ── ShaderPanelStore ──────────────────────────────────────────────────────────

interface ShaderPanelState {
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
}

const IDLE_COMPILE_STATUS: ShaderCompileStatus = { state: 'idle' }

export const useShaderPanelStore = create<ShaderPanelState>((set, get) => ({
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
}))

// ── Convenience selector ──────────────────────────────────────────────────────

export function getActiveRoutes(shaderId: string | null): ShaderModulationRoute[] {
  if (!shaderId) return []
  return useShaderPanelStore.getState().routesByShaderId[shaderId] ?? []
}

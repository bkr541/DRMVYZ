import { create } from 'zustand'
import type { ShaderParamValue } from '../registry/shaderRegistryTypes'
import { shaderRegistry } from '../registry'

// ── ShaderPanelStore ──────────────────────────────────────────────────────────
//
// Module-level Zustand store for the shader engine UI.
// Owns the active scene selection and per-parameter values.
// This store is intentionally separate from reactStore to avoid coupling
// the WebGL shader engine to the React visual engine's preset model.

interface ShaderPanelState {
  activeShaderId:  string | null
  paramValues:     Record<string, ShaderParamValue>
  modulatedValues: Record<string, number>
  compileError:    string | null

  setActiveShaderId:  (id: string | null) => void
  setParamValue:      (paramId: string, value: ShaderParamValue) => void
  setModulatedValue:  (paramId: string, value: number) => void
  setCompileError:    (error: string | null) => void
  resetParams:        () => void
}

export const useShaderPanelStore = create<ShaderPanelState>((set, get) => ({
  activeShaderId:  null,
  paramValues:     {},
  modulatedValues: {},
  compileError:    null,

  setActiveShaderId: (id) => {
    const def = id ? shaderRegistry.get(id) : null
    set({
      activeShaderId:  id,
      paramValues:     def ? { ...def.defaults } : {},
      modulatedValues: {},
      compileError:    null,
    })
  },

  setParamValue: (paramId, value) =>
    set(s => ({ paramValues: { ...s.paramValues, [paramId]: value } })),

  setModulatedValue: (paramId, value) =>
    set(s => ({ modulatedValues: { ...s.modulatedValues, [paramId]: value } })),

  setCompileError: (error) => set({ compileError: error }),

  resetParams: () => {
    const def = get().activeShaderId ? shaderRegistry.get(get().activeShaderId!) : null
    set({ paramValues: def ? { ...def.defaults } : {}, modulatedValues: {} })
  },
}))

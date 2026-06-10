import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_REACT_PRESETS, DEFAULT_PERFORMANCE_PADS } from '../components/vyzualz/react/ReactTypes'
import type {
  ReactEngineId,
  ReactPreset,
  ReactPresetParams,
  ReactTrackSection,
  ReactPerformancePad,
} from '../components/vyzualz/react/ReactTypes'

interface ReactStoreState {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
  reactPresets: ReactPreset[]

  // Manual track sections
  manualTrackSections: ReactTrackSection[]
  selectedSectionId: string | null

  // Global performance controls
  reactIntensity:       number
  reactMotion:          number
  reactGlow:            number
  reactBassReactivity:  number
  reactColorPalette:    string
  reactTrailDecay:      number
  reactFogDensity:      number
  reactParticleDensity: number

  // Actions
  setActiveReactPresetId: (id: string | null) => void
  setActiveReactEngineId: (id: ReactEngineId) => void
  selectReactPreset: (id: string) => void
  updateReactPresetParams: (id: string, patch: Partial<ReactPresetParams>) => void

  setReactIntensity:       (v: number) => void
  setReactMotion:          (v: number) => void
  setReactGlow:            (v: number) => void
  setReactBassReactivity:  (v: number) => void
  setReactColorPalette:    (palette: string) => void
  setReactTrailDecay:      (v: number) => void
  setReactFogDensity:      (v: number) => void
  setReactParticleDensity: (v: number) => void

  setSelectedSectionId: (id: string | null) => void
  addManualSection: (section: ReactTrackSection) => void
  updateManualSection: (id: string, patch: Partial<ReactTrackSection>) => void
  removeManualSection: (id: string) => void

  // Performance pads
  performancePads: ReactPerformancePad[]
  activePadId: string | null
  setActivePadId: (id: string | null) => void
  updatePerformancePad: (id: string, patch: Partial<ReactPerformancePad>) => void

  resetReactView: () => void
}

const INITIAL_PRESET_ID = DEFAULT_REACT_PRESETS[0].id
const INITIAL_ENGINE_ID: ReactEngineId = DEFAULT_REACT_PRESETS[0].engine

export const useReactStore = create<ReactStoreState>()(
  persist(
    (set) => ({
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
      reactPresets: DEFAULT_REACT_PRESETS,
      manualTrackSections: [],
      selectedSectionId: null,
      performancePads: DEFAULT_PERFORMANCE_PADS,
      activePadId: null,
      reactIntensity:       0.7,
      reactMotion:          0.5,
      reactGlow:            0.65,
      reactBassReactivity:  0.8,
      reactColorPalette:    'dvydrm',
      reactTrailDecay:      0.08,
      reactFogDensity:      0.5,
      reactParticleDensity: 0.5,

      setActiveReactPresetId: (id) => set({ activeReactPresetId: id }),

      setActiveReactEngineId: (id) => set({ activeReactEngineId: id }),

      selectReactPreset: (id) =>
        set((s) => {
          const preset = s.reactPresets.find((p) => p.id === id)
          if (!preset) return {}
          return {
            activeReactPresetId: id,
            activeReactEngineId: preset.engine,
            reactIntensity: preset.params.intensity,
            reactMotion: preset.params.motion,
            reactGlow: preset.params.glow,
            reactBassReactivity: preset.params.bassReactivity,
          }
        }),

      updateReactPresetParams: (id, patch) =>
        set((s) => ({
          reactPresets: s.reactPresets.map((p) =>
            p.id === id ? { ...p, params: { ...p.params, ...patch } } : p,
          ),
        })),

      setReactIntensity:       (v) => set({ reactIntensity: v }),
      setReactMotion:          (v) => set({ reactMotion: v }),
      setReactGlow:            (v) => set({ reactGlow: v }),
      setReactBassReactivity:  (v) => set({ reactBassReactivity: v }),
      setReactColorPalette:    (palette) => set({ reactColorPalette: palette }),
      setReactTrailDecay:      (v) => set({ reactTrailDecay: v }),
      setReactFogDensity:      (v) => set({ reactFogDensity: v }),
      setReactParticleDensity: (v) => set({ reactParticleDensity: v }),

      setSelectedSectionId: (id) => set({ selectedSectionId: id }),

      addManualSection: (section) =>
        set((s) => ({ manualTrackSections: [...s.manualTrackSections, section] })),

      updateManualSection: (id, patch) =>
        set((s) => ({
          manualTrackSections: s.manualTrackSections.map((sec) =>
            sec.id === id ? { ...sec, ...patch } : sec,
          ),
        })),

      removeManualSection: (id) =>
        set((s) => ({
          manualTrackSections: s.manualTrackSections.filter((sec) => sec.id !== id),
          selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
        })),

      setActivePadId: (id) =>
        set((s) => {
          if (!id) return { activePadId: null }
          const pad = s.performancePads.find((p) => p.id === id)
          if (!pad?.presetId) return { activePadId: id }
          const preset = s.reactPresets.find((p) => p.id === pad.presetId)
          if (!preset) return { activePadId: id }
          return {
            activePadId: id,
            activeReactPresetId: preset.id,
            activeReactEngineId: preset.engine,
            reactIntensity: preset.params.intensity,
            reactMotion: preset.params.motion,
            reactGlow: preset.params.glow,
            reactBassReactivity: preset.params.bassReactivity,
          }
        }),

      updatePerformancePad: (id, patch) =>
        set((s) => ({
          performancePads: s.performancePads.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      resetReactView: () =>
        set({
          activeReactPresetId:  INITIAL_PRESET_ID,
          activeReactEngineId:  INITIAL_ENGINE_ID,
          manualTrackSections:  [],
          selectedSectionId:    null,
          performancePads:      DEFAULT_PERFORMANCE_PADS,
          activePadId:          null,
          reactIntensity:       0.7,
          reactMotion:          0.5,
          reactGlow:            0.65,
          reactBassReactivity:  0.8,
          reactColorPalette:    'dvydrm',
          reactTrailDecay:      0.08,
          reactFogDensity:      0.5,
          reactParticleDensity: 0.5,
        }),
    }),
    {
      name: 'drmvyz:react-store',
      partialize: (s) => ({
        activeReactPresetId:  s.activeReactPresetId,
        activeReactEngineId:  s.activeReactEngineId,
        manualTrackSections:  s.manualTrackSections,
        reactIntensity:       s.reactIntensity,
        reactMotion:          s.reactMotion,
        reactGlow:            s.reactGlow,
        reactBassReactivity:  s.reactBassReactivity,
        reactColorPalette:    s.reactColorPalette,
        reactTrailDecay:      s.reactTrailDecay,
        reactFogDensity:      s.reactFogDensity,
        reactParticleDensity: s.reactParticleDensity,
      }),
    },
  ),
)

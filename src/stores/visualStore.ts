import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface VzEffects {
  masterIntensity: number
  bassReactivity:  number
  glitchAmount:    number
  rgbSplit:        number
  tunnelSpeed:     number
  displacement:    number
  bloom:           number
  strobe:          number
  feedbackTrails:  number
  logoScale:       number
  colorShift:      number
}

export const DEFAULT_EFFECTS: VzEffects = {
  masterIntensity: 0.85,
  bassReactivity:  0.90,
  glitchAmount:    0.00,
  rgbSplit:        0.00,
  tunnelSpeed:     0.60,
  displacement:    0.00,
  bloom:           0.40,
  strobe:          0.00,
  feedbackTrails:  0.00,
  logoScale:       1.00,
  colorShift:      0.00,
}

export interface VzPreset {
  id: string
  name: string
  color: string
  gradient: string
  effects: VzEffects
  enabledFx: string[]
  isDefault?: boolean
}

export const DEFAULT_PRESETS: VzPreset[] = [
  {
    id: 'dream-theft',
    name: 'Dream Theft',
    color: '#19bff2',
    gradient: 'linear-gradient(135deg,#0a1830 0%,#0a3a55 60%,#19bff2 100%)',
    effects: { ...DEFAULT_EFFECTS, rgbSplit: 0.3, bloom: 0.6, feedbackTrails: 0.2 },
    enabledFx: ['RGB Split', 'Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'nightmare-signal',
    name: 'Nightmare Signal',
    color: '#e11d48',
    gradient: 'linear-gradient(135deg,#1a0010 0%,#550020 60%,#e11d48 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0.8, rgbSplit: 0.7, strobe: 0.4, feedbackTrails: 0.5 },
    enabledFx: ['Glitch Bars', 'RGB Split', 'Scanlines', 'Feedback'],
    isDefault: true,
  },
  {
    id: 'boss-intro',
    name: 'Boss Intro',
    color: '#f97316',
    gradient: 'linear-gradient(135deg,#1a0800 0%,#7a2000 60%,#f97316 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, bloom: 0.9, displacement: 0.6, tunnelSpeed: 0.8 },
    enabledFx: ['Tunnel', 'Bloom', 'Displacement'],
    isDefault: true,
  },
  {
    id: 'drmwld-portal',
    name: 'DRMWLD Portal',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg,#150020 0%,#5a0090 60%,#a855f7 100%)',
    effects: { ...DEFAULT_EFFECTS, colorShift: 0.6, bloom: 0.7, feedbackTrails: 0.4, tunnelSpeed: 0.5 },
    enabledFx: ['Tunnel', 'Bloom', 'RGB Split'],
    isDefault: true,
  },
  {
    id: 'cyber-bloom',
    name: 'Cyber Bloom',
    color: '#2edcb3',
    gradient: 'linear-gradient(135deg,#001520 0%,#004a40 60%,#2edcb3 100%)',
    effects: { ...DEFAULT_EFFECTS, bloom: 1.0, rgbSplit: 0.2, masterIntensity: 1.0 },
    enabledFx: ['Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'bass-impact',
    name: 'Bass Impact',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg,#1a1200 0%,#604000 60%,#fbbf24 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, strobe: 0.6, glitchAmount: 0.3, displacement: 0.4 },
    enabledFx: ['Glitch Bars', 'Displacement', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'clean-reactive',
    name: 'Clean Audio Reactive',
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#475569 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0, rgbSplit: 0, strobe: 0, feedbackTrails: 0, bloom: 0.2 },
    enabledFx: ['Scanlines'],
    isDefault: true,
  },
]

interface VisualState {
  effects: VzEffects
  enabledFxArr: string[]  // stored as array for Zustand persist (Set is not JSON-serializable)
  activePresetId: string
  activeMediaId: string | null
  presets: VzPreset[]
  bpm: number
  bpmSync: boolean
  isPlaying: boolean

  setEffect(key: keyof VzEffects, v: number): void
  resetEffects(): void
  toggleFx(name: string): void
  selectPreset(id: string): void
  savePreset(name: string): void
  deletePreset(id: string): void
  setActiveMedia(id: string | null): void
  setBpm(v: number): void
  toggleBpmSync(): void
  setPlaying(v: boolean): void
}

export const useVisualStore = create<VisualState>()(
  persist(
    (set, get) => ({
      effects: DEFAULT_PRESETS[0].effects,
      enabledFxArr: DEFAULT_PRESETS[0].enabledFx,
      activePresetId: DEFAULT_PRESETS[0].id,
      activeMediaId: null,
      presets: DEFAULT_PRESETS,
      bpm: 120,
      bpmSync: false,
      isPlaying: false,

      setEffect(key, v) {
        set(s => ({ effects: { ...s.effects, [key]: v }, activePresetId: 'custom' }))
      },
      resetEffects() {
        set({ effects: DEFAULT_EFFECTS, enabledFxArr: [], activePresetId: 'custom' })
      },
      toggleFx(name) {
        set(s => {
          const arr = s.enabledFxArr.includes(name)
            ? s.enabledFxArr.filter(x => x !== name)
            : [...s.enabledFxArr, name]
          return { enabledFxArr: arr }
        })
      },
      selectPreset(id) {
        const preset = get().presets.find(p => p.id === id)
        if (!preset) return
        set({ effects: preset.effects, enabledFxArr: preset.enabledFx, activePresetId: id })
      },
      savePreset(name) {
        const { effects, enabledFxArr } = get()
        const id = `custom-${Date.now().toString(36)}`
        const newPreset: VzPreset = {
          id, name,
          color: '#19bff2',
          gradient: 'linear-gradient(135deg,#0a1830 0%,#0a3a55 60%,#19bff2 100%)',
          effects: { ...effects },
          enabledFx: [...enabledFxArr],
        }
        set(s => ({ presets: [...s.presets, newPreset], activePresetId: id }))
      },
      deletePreset(id) {
        set(s => ({
          presets: s.presets.filter(p => p.id !== id || p.isDefault),
          activePresetId: s.activePresetId === id ? DEFAULT_PRESETS[0].id : s.activePresetId,
        }))
      },
      setActiveMedia(id) { set({ activeMediaId: id }) },
      setBpm(v) { set({ bpm: Math.max(40, Math.min(300, v)) }) },
      toggleBpmSync() { set(s => ({ bpmSync: !s.bpmSync })) },
      setPlaying(v) { set({ isPlaying: v }) },
    }),
    {
      name: 'drmvyz-visual-store',
      partialize: (s) => ({
        effects: s.effects,
        enabledFxArr: s.enabledFxArr,
        activePresetId: s.activePresetId,
        presets: s.presets.filter(p => !p.isDefault),
        bpm: s.bpm,
        bpmSync: s.bpmSync,
      }),
      // Re-inject default presets after rehydration so they are never missing
      merge: (persisted, current) => {
        const p = persisted as Partial<VisualState>
        return {
          ...current,
          ...p,
          presets: [...DEFAULT_PRESETS, ...(p.presets ?? [])],
        }
      },
    }
  )
)

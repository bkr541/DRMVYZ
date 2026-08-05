import { useState } from 'react'
import { DEFAULT_OSCILLATOR_SETTINGS, type OscillatorSettings } from '../ReactTypes'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../soundDrawing/SoundDrawingPerformanceTypes'

// Shared local state for the Sound Drawing mockup surfaces (left SOURCE tab,
// right DESIGN/REACT tabs). Production keeps oscillatorSettings and
// soundDrawingPerformanceSettings as one store slice read from both rails —
// this hook mirrors that by lifting the same local state to LayoutLabMockup
// once, instead of each mock panel owning a disconnected copy that would
// silently drift from what the other rail shows.

const REACT_MASTER_DEFAULTS = {
  reactIntensity: 0.7,
  reactMotion: 0.5,
  reactGlow: 0.65,
  reactBassReactivity: 0.8,
  reactTrailDecay: 0.08,
}

export function useSoundDrawingMockState() {
  const [osc, setOscState] = useState<OscillatorSettings>(DEFAULT_OSCILLATOR_SETTINGS)
  const [perf, setPerfState] = useState(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS)
  const [glyphLostNotice, setGlyphLostNotice] = useState<string | null>(null)
  const [reactIntensity, setReactIntensity] = useState(REACT_MASTER_DEFAULTS.reactIntensity)
  const [reactMotion, setReactMotion] = useState(REACT_MASTER_DEFAULTS.reactMotion)
  const [reactGlow, setReactGlow] = useState(REACT_MASTER_DEFAULTS.reactGlow)
  const [reactBassReactivity, setReactBassReactivity] = useState(REACT_MASTER_DEFAULTS.reactBassReactivity)
  const [reactTrailDecay, setReactTrailDecay] = useState(REACT_MASTER_DEFAULTS.reactTrailDecay)

  const set = (patch: Partial<OscillatorSettings>) => setOscState(prev => ({ ...prev, ...patch }))
  const resetOscillatorSettings = () => setOscState(DEFAULT_OSCILLATOR_SETTINGS)
  const setSoundDrawingPerformanceSettings = (patch: Partial<typeof perf>) =>
    setPerfState(prev => ({ ...prev, ...patch }))
  const resetSoundDrawingPerformanceSettings = () => setPerfState(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS)
  const requestSoundDrawingRibbonReset = () =>
    setPerfState(prev => ({ ...prev, livingRibbon: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon }))
  const clearGlyphLostNotice = () => setGlyphLostNotice(null)
  const selectOscillatorFont = (fontId: string | null) => set({ textFontId: fontId })
  const selectSvgAsset = (mediaId: string) => set({ selectedSvgId: mediaId, sourceType: 'svg' })

  return {
    osc,
    set,
    resetOscillatorSettings,
    perf,
    setSoundDrawingPerformanceSettings,
    resetSoundDrawingPerformanceSettings,
    requestSoundDrawingRibbonReset,
    glyphLostNotice,
    clearGlyphLostNotice,
    selectOscillatorFont,
    selectSvgAsset,
    reactIntensity, setReactIntensity,
    reactMotion, setReactMotion,
    reactGlow, setReactGlow,
    reactBassReactivity, setReactBassReactivity,
    reactTrailDecay, setReactTrailDecay,
  }
}

export type SoundDrawingMockState = ReturnType<typeof useSoundDrawingMockState>

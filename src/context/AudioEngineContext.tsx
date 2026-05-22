import { createContext, useContext, useMemo } from 'react'
import { useAudioEngine, type AudioEngine } from '../hooks/useAudioEngine'

const AudioEngineCtx = createContext<AudioEngine | null>(null)

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useAudioEngine()

  // Only propagate a new context value when observable state fields change.
  // Stable useCallback method references are intentionally excluded — they don't
  // change identity across renders and should not trigger consumer re-renders.
  // This prevents Meyda (or any future high-frequency internal state) from
  // broadcasting unnecessary re-renders to every context consumer.
  const value = useMemo(() => engine, [
    engine.source, engine.micError, engine.isActive,
    engine.tracks, engine.currentIndex, engine.isPlaying,
    engine.currentTime, engine.duration, engine.volume,
    engine.fftSize, engine.smoothing, engine.sampleRate,
    engine.analyserMaster, engine.analyserL, engine.analyserR,
    engine.audioContext, engine.ringBuffer,
    engine.monitoringMode, engine.referenceTracks, engine.activeRefSlot,
    engine.isABMode, engine.refVolume, engine.autoLoudnessMatch,
    engine.refAnalyserMaster, engine.refAnalyserL, engine.refAnalyserR,
    engine.demoSilent, engine.spectralFeatures, engine.bpmDetecting, engine.meydaActive,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ])

  return <AudioEngineCtx.Provider value={value}>{children}</AudioEngineCtx.Provider>
}

export function useSharedAudio(): AudioEngine {
  const ctx = useContext(AudioEngineCtx)
  if (!ctx) throw new Error('useSharedAudio must be used inside AudioEngineProvider')
  return ctx
}

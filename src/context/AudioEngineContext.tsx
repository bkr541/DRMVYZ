import { createContext, useContext, useMemo, useRef } from 'react'
import { useAudioEngine, type AudioEngine } from '../hooks/useAudioEngine'

const AudioEngineCtx = createContext<AudioEngine | null>(null)

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useAudioEngine()
  const engineRef = useRef(engine)
  engineRef.current = engine

  // Only propagate a new context value when observable state fields change.
  // Stable useCallback method references are intentionally excluded — they don't
  // change identity across renders and should not trigger consumer re-renders.
  // This prevents Meyda (or any future high-frequency internal state) from
  // broadcasting unnecessary re-renders to every context consumer.
  const contextRevision = useMemo(() => [
    engine.source, engine.micError, engine.isActive,
    engine.tracks, engine.currentIndex, engine.isPlaying,
    engine.currentTime, engine.duration, engine.volume,
    engine.fftSize, engine.smoothing, engine.sampleRate,
    engine.analyserMaster, engine.analyserL, engine.analyserR,
    engine.audioContext, engine.ringBuffer,
    engine.monitoringMode, engine.referenceTracks, engine.activeRefSlot,
    engine.isABMode, engine.refVolume, engine.autoLoudnessMatch,
    engine.refAnalyserMaster, engine.refAnalyserL, engine.refAnalyserR,
    engine.demoSilent, engine.spectralFeatures, engine.meydaActive,
    engine.currentTrackId, engine.currentAudioTrackId, engine.currentTrackIsPersisted, engine.currentTrack,
    engine.currentAnalysis, engine.currentAnalyzedBpm,
    engine.currentAnalysisStatus, engine.currentAnalysisError,
    engine.currentEffectiveBpm, engine.currentBpmConfidence, engine.currentBpmSource,
    engine.currentKey,
  ] as const, [
    engine.source, engine.micError, engine.isActive,
    engine.tracks, engine.currentIndex, engine.isPlaying,
    engine.currentTime, engine.duration, engine.volume,
    engine.fftSize, engine.smoothing, engine.sampleRate,
    engine.analyserMaster, engine.analyserL, engine.analyserR,
    engine.audioContext, engine.ringBuffer,
    engine.monitoringMode, engine.referenceTracks, engine.activeRefSlot,
    engine.isABMode, engine.refVolume, engine.autoLoudnessMatch,
    engine.refAnalyserMaster, engine.refAnalyserL, engine.refAnalyserR,
    engine.demoSilent, engine.spectralFeatures, engine.meydaActive,
    engine.currentTrackId, engine.currentAudioTrackId, engine.currentTrackIsPersisted, engine.currentTrack,
    engine.currentAnalysis, engine.currentAnalyzedBpm,
    engine.currentAnalysisStatus, engine.currentAnalysisError,
    engine.currentEffectiveBpm, engine.currentBpmConfidence, engine.currentBpmSource,
    engine.currentKey,
  ])
  const value = useMemo(() => {
    void contextRevision
    return engineRef.current
  }, [contextRevision])

  return <AudioEngineCtx.Provider value={value}>{children}</AudioEngineCtx.Provider>
}

export function useSharedAudio(): AudioEngine {
  const ctx = useContext(AudioEngineCtx)
  if (!ctx) throw new Error('useSharedAudio must be used inside AudioEngineProvider')
  return ctx
}

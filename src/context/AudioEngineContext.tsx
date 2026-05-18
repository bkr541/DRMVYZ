import { createContext, useContext } from 'react'
import { useAudioEngine, type AudioEngine } from '../hooks/useAudioEngine'

const AudioEngineCtx = createContext<AudioEngine | null>(null)

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = useAudioEngine()
  return <AudioEngineCtx.Provider value={engine}>{children}</AudioEngineCtx.Provider>
}

export function useSharedAudio(): AudioEngine {
  const ctx = useContext(AudioEngineCtx)
  if (!ctx) throw new Error('useSharedAudio must be used inside AudioEngineProvider')
  return ctx
}

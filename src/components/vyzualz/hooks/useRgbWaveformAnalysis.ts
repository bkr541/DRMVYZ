import { useEffect } from 'react'
import type { AudioEngine } from '../../../hooks/useAudioEngine'
import { useRgbWaveformStore } from '../../../features/waveform/rgbWaveformStorage'
import { analyzeRgbWaveform } from '../../../features/waveform/analyzeRgbWaveform'

// Decode audio independently when the coordinator buffer has been evicted.
async function decodeUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  const arrayBuf = await response.arrayBuffer()
  const offlineCtx = new OfflineAudioContext(1, 1, 44100)
  return offlineCtx.decodeAudioData(arrayBuf)
}

async function runAnalysis(
  analysisKey: string,
  buffer:      AudioBuffer | undefined,
  trackUrl:    string,
): Promise<void> {
  const store = useRgbWaveformStore.getState()
  try {
    store.setStatus(analysisKey, 'analyzing')
    const resolvedBuffer = buffer ?? await decodeUrl(trackUrl)
    const analysis = await analyzeRgbWaveform(resolvedBuffer)
    useRgbWaveformStore.getState().setWaveform(analysisKey, analysis)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg !== 'Aborted') {
      useRgbWaveformStore.getState().setStatus(analysisKey, 'error', msg)
    }
  }
}

export function useRgbWaveformAnalysis(engine: AudioEngine): void {
  const tracks = engine.tracks

  useEffect(() => {
    for (const track of tracks) {
      if (track.analysisRuntime.status !== 'complete') continue
      const key = track.analysisRuntime.analysisKey
      if (!key) continue

      const store = useRgbWaveformStore.getState()
      const entry = store.getEntry(key)
      if (entry) continue  // already queued/analyzing/complete

      // Mark synchronously to prevent duplicate analysis kicks
      store.setStatus(key, 'queued')

      const buffer = engine.getDecodedBuffer(track.id)
      void runAnalysis(key, buffer, track.url)
    }
  }, [tracks, engine])
}

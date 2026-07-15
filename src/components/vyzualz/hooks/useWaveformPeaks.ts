import { useEffect, useState } from 'react'

const peaksCache = new Map<string, number[]>()
const pendingPeaks = new Map<string, Promise<number[]>>()

export const WAVEFORM_PEAK_COUNT = 2_000

export function downsampleWaveform(buffer: AudioBuffer, numPeaks = WAVEFORM_PEAK_COUNT): number[] {
  const channel = buffer.getChannelData(0)
  const safePeakCount = Math.max(1, Math.round(numPeaks))
  const blockSize = Math.max(1, Math.floor(channel.length / safePeakCount))
  const peaks: number[] = []
  for (let i = 0; i < safePeakCount; i++) {
    const start = i * blockSize
    let max = 0
    for (let j = start; j < start + blockSize && j < channel.length; j++) {
      const abs = Math.abs(channel[j])
      if (abs > max) max = abs
    }
    peaks.push(max)
  }
  return peaks
}

async function loadPeaksFromUrl(cacheKey: string, trackUrl: string): Promise<number[]> {
  const existing = pendingPeaks.get(cacheKey)
  if (existing) return existing

  const request = (async () => {
    const response = await fetch(trackUrl)
    if (response.ok === false) throw new Error(`Waveform request failed (${response.status})`)
    const arrayBuffer = await response.arrayBuffer()
    const context = new OfflineAudioContext(1, 1, 44_100)
    const decoded = await context.decodeAudioData(arrayBuffer)
    const computed = downsampleWaveform(decoded)
    peaksCache.set(cacheKey, computed)
    return computed
  })().finally(() => {
    if (pendingPeaks.get(cacheKey) === request) pendingPeaks.delete(cacheKey)
  })

  pendingPeaks.set(cacheKey, request)
  return request
}

/** Test and lifecycle hook for explicit cache invalidation after canonical media deletion. */
export function clearWaveformPeaksCache(cacheKey?: string): void {
  if (cacheKey) {
    peaksCache.delete(cacheKey)
    pendingPeaks.delete(cacheKey)
    return
  }
  peaksCache.clear()
  pendingPeaks.clear()
}

export function getCachedWaveformPeaks(cacheKey: string): number[] | null {
  return peaksCache.get(cacheKey) ?? null
}

/**
 * Generates downsampled waveform peaks shared by Audio Dock and Lyric Manager.
 * The decoded AudioEngine buffer always wins. URL work is a deduplicated fallback
 * and stale results cannot replace a newly selected track.
 */
export function useWaveformPeaks(
  trackId:     string | null,
  audioBuffer: AudioBuffer | null | undefined,
  trackUrl:    string | null,
): { peaks: number[] | null; loading: boolean } {
  const cacheKey = trackId ?? trackUrl
  const [peaks, setPeaks] = useState<number[] | null>(
    cacheKey ? (peaksCache.get(cacheKey) ?? null) : null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!cacheKey) {
      setPeaks(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    const cached = peaksCache.get(cacheKey)
    if (cached) {
      setPeaks(cached)
      setLoading(false)
      return () => { cancelled = true }
    }

    if (audioBuffer) {
      const computed = downsampleWaveform(audioBuffer)
      peaksCache.set(cacheKey, computed)
      setPeaks(computed)
      setLoading(false)
      return () => { cancelled = true }
    }

    if (!trackUrl) {
      setPeaks(null)
      setLoading(false)
      return () => { cancelled = true }
    }

    setPeaks(null)
    setLoading(true)
    void loadPeaksFromUrl(cacheKey, trackUrl)
      .then(computed => {
        if (!cancelled) setPeaks(computed)
      })
      .catch(() => {
        // waveform unavailable — canvas shows placeholder
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [cacheKey, audioBuffer, trackUrl])

  return { peaks, loading }
}

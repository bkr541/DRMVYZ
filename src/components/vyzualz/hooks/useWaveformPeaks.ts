import { useEffect, useState } from 'react'

const peaksCache = new Map<string, number[]>()

function downsample(buffer: AudioBuffer, numPeaks: number): number[] {
  const channel   = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(channel.length / numPeaks))
  const peaks: number[] = []
  for (let i = 0; i < numPeaks; i++) {
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

/**
 * Generates downsampled waveform peaks for the RGB fallback canvas.
 *
 * When the AudioEngine already has a decoded buffer for the track, peaks are
 * computed synchronously from it — no fetch or decodeAudioData call.  The
 * URL-based path is a fallback for the case where the engine buffer is not yet
 * available.  Keying effects on trackId (not URL) ensures stale async results
 * from a previous track are cancelled when the track changes.
 */
export function useWaveformPeaks(
  trackId:     string | null,
  audioBuffer: AudioBuffer | null | undefined,
  trackUrl:    string | null,
): { peaks: number[] | null; loading: boolean } {
  // trackId is the preferred cache key; fall back to URL when trackId is absent.
  const cacheKey = trackId ?? trackUrl

  const [peaks,   setPeaks]   = useState<number[] | null>(
    cacheKey ? (peaksCache.get(cacheKey) ?? null) : null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cacheKey) { setPeaks(null); return }

    const cached = peaksCache.get(cacheKey)
    if (cached) { setPeaks(cached); return }

    // Fast path: engine already decoded the buffer — no network round-trip needed.
    // setLoading(false) clears any stale loading state from a prior URL fetch that
    // was cancelled when the buffer arrived for the same track.
    if (audioBuffer) {
      const computed = downsample(audioBuffer, 1000)
      peaksCache.set(cacheKey, computed)
      setPeaks(computed)
      setLoading(false)
      return
    }

    // URL fallback: used when the engine has not yet decoded the buffer.
    if (!trackUrl) { setPeaks(null); return }

    let cancelled = false
    setLoading(true)
    setPeaks(null)

    ;(async () => {
      try {
        const resp        = await fetch(trackUrl)
        if (cancelled) return
        const arrayBuffer = await resp.arrayBuffer()
        if (cancelled) return
        const ctx         = new OfflineAudioContext(1, 1, 44100)
        const decoded     = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return
        const computed    = downsample(decoded, 1000)
        peaksCache.set(cacheKey, computed)
        if (!cancelled) setPeaks(computed)
      } catch {
        // waveform unavailable — canvas shows placeholder
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [cacheKey, audioBuffer, trackUrl])

  return { peaks, loading }
}

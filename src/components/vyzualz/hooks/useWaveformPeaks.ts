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

export function useWaveformPeaks(trackUrl: string | null): {
  peaks: number[] | null
  loading: boolean
} {
  const [peaks,   setPeaks]   = useState<number[] | null>(
    trackUrl ? (peaksCache.get(trackUrl) ?? null) : null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!trackUrl) { setPeaks(null); return }

    const cached = peaksCache.get(trackUrl)
    if (cached) { setPeaks(cached); return }

    let cancelled = false
    setLoading(true)
    setPeaks(null)

    ;(async () => {
      try {
        const resp        = await fetch(trackUrl)
        if (cancelled) return
        const arrayBuffer = await resp.arrayBuffer()
        if (cancelled) return
        // OfflineAudioContext with 1 channel and minimal sample rate just for decode
        const ctx         = new OfflineAudioContext(1, 1, 44100)
        const decoded     = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return
        const computed    = downsample(decoded, 1000)
        peaksCache.set(trackUrl, computed)
        if (!cancelled) setPeaks(computed)
      } catch {
        // waveform unavailable — canvas shows placeholder
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [trackUrl])

  return { peaks, loading }
}

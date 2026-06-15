import { useRef, useCallback } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'

/**
 * Collects tap timestamps, derives an average BPM from the last 4 taps, and
 * writes it as a per-track manual override on the currently active file track.
 *
 * Tap tempo is intentionally a no-op for demo / microphone sources — those
 * sources don't have a persistent track to attach the override to.
 */
export function useTapTempo() {
  const engine      = useSharedAudio()
  const tapTimesRef = useRef<number[]>([])

  const handleTap = useCallback(() => {
    const trackId = engine.currentTrackId
    if (!trackId || engine.source !== 'file') return

    const now   = performance.now()
    const times = tapTimesRef.current
    times.push(now)
    if (times.length > 4) times.splice(0, times.length - 4)

    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i]!)
      const avg       = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm       = Math.round(60000 / avg)
      engine.setBpmOverride(trackId, bpm)
    }
  }, [engine])

  return { handleTap }
}

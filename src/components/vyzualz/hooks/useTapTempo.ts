import { useRef, useCallback } from 'react'
import { useVisualStore } from '../../../stores/visualStore'

export function useTapTempo() {
  const { setBpm } = useVisualStore()
  const tapTimesRef = useRef<number[]>([])

  const handleTap = useCallback(() => {
    const now = performance.now()
    const times = tapTimesRef.current
    times.push(now)
    if (times.length > 4) times.splice(0, times.length - 4)
    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpm(Math.round(60000 / avg))
    }
  }, [setBpm])

  return { handleTap }
}

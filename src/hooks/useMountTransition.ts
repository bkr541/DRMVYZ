import { useEffect, useRef, useState } from 'react'

export type MountTransitionPhase = 'unmounted' | 'entering' | 'entered' | 'exiting'

/**
 * Drives a CSS enter/exit transition around content that conditionally
 * mounts (e.g. `selectedTrack && <Section />`) — React removes unmounted
 * content immediately, before a CSS transition on it could ever play.
 * Keeps rendering for `durationMs` after `shouldRender` goes false so an
 * exit transition (driven by the 'exiting' phase) has time to finish, and
 * forces one extra paint before flipping to 'entered' so the enter
 * transition has an actual style change to animate from — mounting
 * already in the final state wouldn't trigger a transition at all.
 */
export function useMountTransition(shouldRender: boolean, durationMs: number): MountTransitionPhase {
  const [phase, setPhase] = useState<MountTransitionPhase>(shouldRender ? 'entering' : 'unmounted')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (shouldRender) {
      setPhase('entering')
      const frame = requestAnimationFrame(() => setPhase('entered'))
      return () => cancelAnimationFrame(frame)
    }

    setPhase(current => (current === 'unmounted' ? current : 'exiting'))
    timeoutRef.current = setTimeout(() => setPhase('unmounted'), durationMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [shouldRender, durationMs])

  return phase
}

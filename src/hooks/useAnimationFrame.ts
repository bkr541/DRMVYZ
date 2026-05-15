import { useEffect, useRef } from 'react'

export function useAnimationFrame(callback: () => void, active = true) {
  const cbRef = useRef(callback)
  const rafRef = useRef<number>(0)

  cbRef.current = callback

  useEffect(() => {
    if (!active) return

    const loop = () => {
      cbRef.current()
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active])
}

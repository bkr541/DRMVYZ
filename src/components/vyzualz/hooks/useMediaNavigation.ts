import { useCallback } from 'react'
import { useMediaStore } from '../../../stores/mediaStore'
import { useVisualStore } from '../../../stores/visualStore'
import { isPrimaryMedia } from '../../../lib/mediaRoles'

export function useMediaNavigation() {
  const { items } = useMediaStore()
  const { activeMediaId, setActiveMedia } = useVisualStore()

  const handlePrev = useCallback(() => {
    if (!items.length) return
    const pool = items.filter(isPrimaryMedia)
    const nav  = pool.length ? pool : items
    const idx  = nav.findIndex(i => i.id === activeMediaId)
    const prev = idx <= 0 ? nav[nav.length - 1] : nav[idx - 1]
    setActiveMedia(prev.id)
  }, [items, activeMediaId, setActiveMedia])

  const handleNext = useCallback(() => {
    if (!items.length) return
    const pool = items.filter(isPrimaryMedia)
    const nav  = pool.length ? pool : items
    const idx  = nav.findIndex(i => i.id === activeMediaId)
    const next = idx === -1 || idx >= nav.length - 1 ? nav[0] : nav[idx + 1]
    setActiveMedia(next.id)
  }, [items, activeMediaId, setActiveMedia])

  return { handlePrev, handleNext }
}

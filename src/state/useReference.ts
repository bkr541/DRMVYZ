import { useState, useCallback } from 'react'
import { generateId } from '../utils/audioUtils'
import type { ReferenceTrack } from '../types/audio'

const MAX_SLOTS = 4

export function useReference() {
  const [referenceTracks, setReferenceTracks] = useState<ReferenceTrack[]>([])
  const [activeSlot, setActiveSlot] = useState<number>(1)
  const [isABMode, setIsABMode] = useState(false)
  const [autoLoudnessMatch, setAutoLoudnessMatch] = useState(true)

  const addReferenceTrack = useCallback((file: File, slot?: number) => {
    const targetSlot = slot ?? (referenceTracks.length < MAX_SLOTS ? referenceTracks.length + 1 : 1)
    const url = URL.createObjectURL(file)
    const name = file.name
    const displayName = name.replace(/\.[^.]+$/, '')

    setReferenceTracks(prev => {
      const filtered = prev.filter(t => t.slot !== targetSlot)
      const existing = prev.find(t => t.slot === targetSlot)
      if (existing) URL.revokeObjectURL(existing.url)
      return [...filtered, { id: generateId(), name, displayName, url, slot: targetSlot }]
        .sort((a, b) => a.slot - b.slot)
    })
    setActiveSlot(targetSlot)
  }, [referenceTracks.length])

  const removeReferenceTrack = useCallback((id: string) => {
    setReferenceTracks(prev => {
      const track = prev.find(t => t.id === id)
      if (track) URL.revokeObjectURL(track.url)
      return prev.filter(t => t.id !== id)
    })
  }, [])

  const toggleABMode = useCallback(() => setIsABMode(p => !p), [])

  const activeRefTrack = referenceTracks.find(t => t.slot === activeSlot) ?? null

  return {
    referenceTracks,
    activeSlot,
    setActiveSlot,
    isABMode,
    setIsABMode,
    toggleABMode,
    autoLoudnessMatch,
    setAutoLoudnessMatch,
    addReferenceTrack,
    removeReferenceTrack,
    activeRefTrack,
  }
}

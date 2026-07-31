import { useEffect } from 'react'
import { isKeyboardInputTarget } from '../../../utils/keyboardTargets'

type UseVyzualzKeyboardOptions = {
  enabled?: boolean
  onPlayPause?: () => void
  onFullscreen?: () => void
  presets?: { id: string }[]
  onSelectPreset?: (id: string) => void
}

export function useVyzualzKeyboard({
  enabled = true,
  onPlayPause,
  onFullscreen,
  presets = [],
  onSelectPreset,
}: UseVyzualzKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      if (isKeyboardInputTarget(e.target)) return
      if (e.key === 'f' || e.key === 'F') onFullscreen?.()
      if (e.key === ' ') { e.preventDefault(); onPlayPause?.() }
      if (e.key >= '1' && e.key <= '5') {
        const preset = presets[parseInt(e.key) - 1]
        if (preset) onSelectPreset?.(preset.id)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onPlayPause, onFullscreen, presets, onSelectPreset])
}

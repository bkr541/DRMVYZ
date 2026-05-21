import { useEffect } from 'react'

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
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) return
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

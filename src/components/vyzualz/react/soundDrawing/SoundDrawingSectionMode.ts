import type { ReactSectionType } from '../ReactTypes'

export type SoundDrawingSectionScopeMode = 'waveform' | 'radialScope' | 'lissajous' | 'spiralScope'

/**
 * Canonical mapping for manual Classic Scope section following. Keep this
 * outside the renderer so the control surface can report the same effective
 * visual that the runtime will draw.
 */
export function resolveSoundDrawingSectionScopeMode(
  type: ReactSectionType | null | undefined,
): SoundDrawingSectionScopeMode {
  switch (type) {
    case 'build':
    case 'preDrop':
      return 'radialScope'
    case 'drop':
      return 'lissajous'
    case 'breakdown':
    case 'bridge':
      return 'spiralScope'
    case 'intro':
    case 'verse':
    case 'outro':
    default:
      return 'waveform'
  }
}

export function soundDrawingSectionScopeModeLabel(mode: SoundDrawingSectionScopeMode): string {
  switch (mode) {
    case 'radialScope':
      return 'Radial Scope'
    case 'lissajous':
      return 'Mono Delay Portrait'
    case 'spiralScope':
      return 'Spiral Scope'
    case 'waveform':
    default:
      return 'Waveform'
  }
}

import { describe, expect, it } from 'vitest'
import {
  resolveSoundDrawingSectionScopeMode,
  soundDrawingSectionScopeModeLabel,
} from './SoundDrawingSectionMode'

describe('Sound Drawing section-following mode', () => {
  it('maps analyzed sections to the same effective Classic Scope topology reported by the UI', () => {
    expect(resolveSoundDrawingSectionScopeMode('intro')).toBe('waveform')
    expect(resolveSoundDrawingSectionScopeMode('verse')).toBe('waveform')
    expect(resolveSoundDrawingSectionScopeMode('build')).toBe('radialScope')
    expect(resolveSoundDrawingSectionScopeMode('preDrop')).toBe('radialScope')
    expect(resolveSoundDrawingSectionScopeMode('drop')).toBe('lissajous')
    expect(resolveSoundDrawingSectionScopeMode('breakdown')).toBe('spiralScope')
    expect(resolveSoundDrawingSectionScopeMode('bridge')).toBe('spiralScope')
    expect(resolveSoundDrawingSectionScopeMode('outro')).toBe('waveform')
    expect(resolveSoundDrawingSectionScopeMode(null)).toBe('waveform')
  })

  it('uses truthful user-facing labels for each effective topology', () => {
    expect(soundDrawingSectionScopeModeLabel('waveform')).toBe('Waveform')
    expect(soundDrawingSectionScopeModeLabel('radialScope')).toBe('Radial Scope')
    expect(soundDrawingSectionScopeModeLabel('lissajous')).toBe('Mono Delay Portrait')
    expect(soundDrawingSectionScopeModeLabel('spiralScope')).toBe('Spiral Scope')
  })
})

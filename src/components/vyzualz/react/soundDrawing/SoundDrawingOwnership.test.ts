import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './SoundDrawingPerformanceTypes'
import { resolveSoundDrawingOwnership } from './SoundDrawingOwnership'

describe('Sound Drawing authored-show ownership', () => {
  it('keeps the base Sound Drawing source authoritative until a preset is selected', () => {
    const state = resolveSoundDrawingOwnership(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS)
    expect(state.owner).toBe('manual')
    expect(state.showName).toBe('No Performance Show')
    expect(state.status).toContain('base Classic Scope, Built-in Shape, Text, or SVG source owns the output')
  })

  it('keeps a selected show authoritative in its base-design state while Auto Performance is off', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'stereoPulseStudy',
      autoPerformance: false,
    })
    expect(state.owner).toBe('authored')
    expect(state.showRunning).toBe(true)
    expect(state.domains.source).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.topology).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.presentation).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.geometry).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.status).toContain('base design is active')
    expect(state.status).toContain('section choreography is paused')
  })

  it('makes a running show authoritative for source, generators, topology, and presentation', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'phaseOrbit',
      autoPerformance: true,
      performanceSource: 'activeUserSource',
      generatorPreference: 'horizontalOscilloscope',
      locks: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
        generator: true,
        layerRecruitment: true,
        topology: true,
      },
    })

    expect(state.owner).toBe('authored')
    expect(state.domains.source).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.topology).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.presentation).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.geometry).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.domains.performanceIntensity).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.status).toContain('owns its source, generators, layers, and section choreography')
  })

  it('marks Pro Scope program-owned only for shows that author one', () => {
    const authored = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'phaseOrbit',
      autoPerformance: true,
    })
    expect(authored.domains.scope).toMatchObject({ owner: 'program', editable: false, label: 'Program' })
    expect(authored.professionalScopeOwner).toBe('authored')

    const unavailable = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'radialPressureSystem',
      autoPerformance: true,
    })
    expect(unavailable.domains.scope).toMatchObject({ owner: 'unavailable', editable: false })
    expect(unavailable.professionalScopeOwner).toBe('none')
  })

  it('does not resurrect manual ownership from legacy Parameter Lock values', () => {
    for (const key of Object.keys(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks) as Array<keyof typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks>) {
      const state = resolveSoundDrawingOwnership({
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
        selectedShowId: 'radialPressureSystem',
        autoPerformance: true,
        locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, [key]: true },
      })
      expect(Object.values(state.domains).some(domain => domain.owner === 'manual')).toBe(false)
      expect(state.domains.topology.owner).toBe('program')
      expect(state.domains.geometry.owner).toBe('mixed')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './SoundDrawingPerformanceTypes'
import { resolveSoundDrawingOwnership } from './SoundDrawingOwnership'

describe('Sound Drawing row and domain ownership', () => {
  it('reports every domain as manual while Auto Performance is off', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'stereoPulseStudy',
      autoPerformance: false,
    })
    expect(state.owner).toBe('manual')
    expect(Object.values(state.domains).every(domain => domain.owner === 'manual' && domain.editable)).toBe(true)
    expect(state.domains.scope.ariaDescription).toContain('Manual ownership')
  })

  it('marks Pro Scope program-owned and unavailable according to the selected show', () => {
    const authored = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'phaseOrbit',
      autoPerformance: true,
    })
    expect(authored.domains.scope).toMatchObject({ owner: 'program', editable: false, label: 'Program' })
    expect(authored.domains.scope.ariaDescription).toContain('manual scope edits cannot affect output')

    const unavailable = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'radialPressureSystem',
      autoPerformance: true,
    })
    expect(unavailable.domains.scope).toMatchObject({ owner: 'unavailable', editable: false })
  })

  it('keeps live mixed inputs editable and disables only fully shadowed topology', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
    })
    expect(state.domains.source).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.domains.geometry).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.domains.motion).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.domains.topology).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.echo).toMatchObject({ owner: 'program', editable: false })
    expect(state.domains.trails).toMatchObject({ owner: 'mixed', editable: true })
    expect(state.domains.reaction).toMatchObject({ owner: 'mixed', editable: true })
  })


  it('marks source selection unavailable only when Generated Show Visuals bypasses it', () => {
    const state = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      performanceSource: 'generatedVisual',
    })
    expect(state.domains.source).toMatchObject({ owner: 'unavailable', editable: false })
  })

  it('promotes mixed Visual Size to locked ownership for Scale or Transform locks', () => {
    const generatorOnly = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, generator: true },
    })
    expect(generatorOnly.domains.geometry).toMatchObject({ owner: 'mixed', editable: true })

    const scale = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, scale: true },
    })
    expect(scale.domains.geometry).toMatchObject({ owner: 'locked', editable: true })
  })

  it('restores manual topology controls only through topology-aware locks', () => {
    const unlocked = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
    })
    expect(unlocked.domains.topology).toMatchObject({ owner: 'program', editable: false })

    const locked = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, topology: true },
    })
    expect(locked.domains.topology).toMatchObject({ owner: 'locked', editable: true })
    expect(locked.domains.echo).toMatchObject({ owner: 'locked', editable: true })

    const echoOnly = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, echoBehavior: true },
    })
    expect(echoOnly.domains.topology).toMatchObject({ owner: 'program', editable: false })
    expect(echoOnly.domains.echo).toMatchObject({ owner: 'locked', editable: true })
  })

  it('truthfully labels corrected and legacy trail locks', () => {
    const corrected = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, trail: true },
      trailLockContract: { version: 2, mode: 'manualResolved', snapshot: null },
    })
    expect(corrected.domains.trails).toMatchObject({ owner: 'locked', editable: true })
    expect(corrected.domains.trails.reason).toContain('captured manual Trail Decay')

    const legacy = resolveSoundDrawingOwnership({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      autoPerformance: true,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, trail: true },
      trailLockContract: { version: 1, mode: 'legacyRecipe', snapshot: null },
    })
    expect(legacy.domains.trails.reason).toContain('legacy recipe lock')
  })
})

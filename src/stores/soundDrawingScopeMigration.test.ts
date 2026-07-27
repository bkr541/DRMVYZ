import { describe, expect, it } from 'vitest'
import { migrateReactStore } from './reactStore'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../components/vyzualz/react/ReactTypes'
import type { OscillatorSettings } from '../components/vyzualz/react/ReactTypes'
import { DEFAULT_SOUND_DRAWING_SCOPE_STATE } from '../audio/scope'

/**
 * Migration guarantees for the professional scope core.
 *
 * The one thing this patch must never do is change how an existing project
 * looks. These tests pin that: the legacy `lissajous` mode keeps rendering the
 * same figure under its accurate name, and the professional core stays off until
 * the user asks for it.
 */

const CURRENT_VERSION = 99

function migrateOscillator(oscillatorSettings: Record<string, unknown>): OscillatorSettings {
  const result = migrateReactStore({ oscillatorSettings }, CURRENT_VERSION)
  return result.oscillatorSettings as OscillatorSettings
}

describe('legacy Sound Drawing project migration', () => {
  it('renames the legacy lissajous mode without changing what it draws', () => {
    const migrated = migrateOscillator({ ...DEFAULT_OSCILLATOR_SETTINGS, classicMode: 'lissajous' })
    // Same visual, honest name: the mode plots a delayed mono portrait, and
    // always did.
    expect(migrated.classicMode).toBe('monoDelayXY')
  })

  it('never promotes a legacy project to true stereo', () => {
    const migrated = migrateOscillator({ ...DEFAULT_OSCILLATOR_SETTINGS, classicMode: 'lissajous' })
    expect(migrated.classicMode).not.toBe('professionalScope')
    expect(migrated.scope.enabled).toBe(false)
  })

  it('leaves every other classic mode alone', () => {
    for (const mode of ['waveform', 'radialScope', 'spiralScope', 'sectionAuto'] as const) {
      expect(migrateOscillator({ ...DEFAULT_OSCILLATOR_SETTINGS, classicMode: mode }).classicMode).toBe(mode)
    }
  })

  it('fills in scope defaults for projects saved before the state existed', () => {
    const legacy = { ...DEFAULT_OSCILLATOR_SETTINGS } as Record<string, unknown>
    delete legacy.scope
    expect(migrateOscillator(legacy).scope).toEqual(DEFAULT_SOUND_DRAWING_SCOPE_STATE)
  })

  it('preserves a user-configured scope across a reload', () => {
    const configured = {
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      enabled: true,
      signalMode: 'midSideXY' as const,
      trigger: { ...DEFAULT_SOUND_DRAWING_SCOPE_STATE.trigger, mode: 'normal' as const, level: 0.3 },
    }
    const migrated = migrateOscillator({ ...DEFAULT_OSCILLATOR_SETTINGS, scope: configured })
    expect(migrated.scope.signalMode).toBe('midSideXY')
    expect(migrated.scope.trigger.mode).toBe('normal')
    expect(migrated.scope.trigger.level).toBeCloseTo(0.3, 6)
  })

  it('repairs a corrupted persisted scope rather than trusting it', () => {
    const migrated = migrateOscillator({
      ...DEFAULT_OSCILLATOR_SETTINGS,
      scope: { signalMode: 'nonsense', trigger: { level: 'not a number' }, timebase: null },
    })
    expect(migrated.scope.signalMode).toBe(DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalMode)
    expect(Number.isFinite(migrated.scope.trigger.level)).toBe(true)
    expect(migrated.scope.timebase).toEqual(DEFAULT_SOUND_DRAWING_SCOPE_STATE.timebase)
  })

  it('falls back to the default for an unrecognised classic mode', () => {
    const migrated = migrateOscillator({ ...DEFAULT_OSCILLATOR_SETTINGS, classicMode: 'someRemovedMode' })
    expect(migrated.classicMode).toBe(DEFAULT_OSCILLATOR_SETTINGS.classicMode)
  })
})

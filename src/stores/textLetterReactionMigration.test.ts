/**
 * Regression tests for the v11 → v12 migration that adds textLetterReactionMode
 * to persisted oscillatorSettings.
 */

import { describe, it, expect } from 'vitest'
import { migrateReactStore } from './reactStore'

describe('textLetterReactionMode migration — v11 → v12', () => {
  it('adds textLetterReactionMode="uniform" when the field is absent', () => {
    const state = { oscillatorSettings: { text: 'DRMVYZ', sourceType: 'text' } }
    const result = migrateReactStore(state, 11)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.textLetterReactionMode).toBe('uniform')
  })

  it('does not overwrite an existing textLetterReactionMode value', () => {
    const state = { oscillatorSettings: { text: 'HI', textLetterReactionMode: 'ripple' } }
    const result = migrateReactStore(state, 11)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.textLetterReactionMode).toBe('ripple')
  })

  it('v27 migration initializes oscillatorSettings with defaults when absent', () => {
    const result = migrateReactStore({ activeReactEngineId: 'oscilloscope' }, 11)
    expect(result.oscillatorSettings).toBeDefined()
  })

  it('does not strip unrelated oscillatorSettings keys', () => {
    const state = {
      oscillatorSettings: { text: 'DRMVYZ', bassScale: 0.3, midTwist: 0.12 },
    }
    const result = migrateReactStore(state, 11)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.text).toBe('DRMVYZ')
    expect(osc.bassScale).toBe(0.3)
    expect(osc.midTwist).toBe(0.12)
  })

  it('does not strip unrelated top-level keys', () => {
    const state = {
      oscillatorSettings: { text: 'X' },
      activeReactEngineId: 'oscilloscope',
      reactIntensity: 0.7,
    }
    const result = migrateReactStore(state, 11)
    expect(result.activeReactEngineId).toBe('oscilloscope')
    expect(result.reactIntensity).toBe(0.7)
  })

  it('runs without throwing from any version < 12', () => {
    for (const v of [0, 1, 5, 10, 11]) {
      expect(() =>
        migrateReactStore({ oscillatorSettings: { text: 'TEST' } }, v)
      ).not.toThrow()
    }
  })

  it('full chain from v0 adds textLetterReactionMode', () => {
    const result = migrateReactStore({ oscillatorSettings: { text: 'DRMVYZ', sourceType: 'text' } }, 0)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.textLetterReactionMode).toBe('uniform')
  })
})

/**
 * Regression tests for the v12 → v13 migration that adds textLetterAssignments
 * to persisted oscillatorSettings.
 */

import { describe, it, expect } from 'vitest'
import { migrateReactStore } from './reactStore'

describe('textLetterAssignments migration — v12 → v13', () => {
  it('adds textLetterAssignments=[] when the field is absent', () => {
    const state = { oscillatorSettings: { text: 'DRMVYZ', textLetterReactionMode: 'custom' } }
    const result = migrateReactStore(state, 12)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(Array.isArray(osc.textLetterAssignments)).toBe(true)
    expect((osc.textLetterAssignments as unknown[]).length).toBe(0)
  })

  it('does not overwrite existing textLetterAssignments', () => {
    const existing = [{ characterIndex: 0, source: 'bass', target: 'scale', amount: 0.5, invert: false, phaseOffset: 0 }]
    const state = { oscillatorSettings: { text: 'HI', textLetterReactionMode: 'custom', textLetterAssignments: existing } }
    const result = migrateReactStore(state, 12)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.textLetterAssignments).toEqual(existing)
  })

  it('is a no-op when oscillatorSettings is absent', () => {
    const result = migrateReactStore({ activeReactEngineId: 'oscilloscope' }, 12)
    expect(result.oscillatorSettings).toBeUndefined()
  })

  it('does not strip unrelated oscillatorSettings keys', () => {
    const state = {
      oscillatorSettings: { text: 'DRMVYZ', bassScale: 0.3, textLetterReactionMode: 'uniform' },
    }
    const result = migrateReactStore(state, 12)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.text).toBe('DRMVYZ')
    expect(osc.bassScale).toBe(0.3)
    expect(osc.textLetterReactionMode).toBe('uniform')
  })

  it('does not strip unrelated top-level keys', () => {
    const state = {
      oscillatorSettings: { text: 'X' },
      activeReactEngineId: 'oscilloscope',
      reactIntensity: 0.7,
    }
    const result = migrateReactStore(state, 12)
    expect(result.activeReactEngineId).toBe('oscilloscope')
    expect(result.reactIntensity).toBe(0.7)
  })

  it('full chain from v11 adds both textLetterReactionMode and textLetterAssignments', () => {
    const state = { oscillatorSettings: { text: 'DRMVYZ', sourceType: 'text' } }
    const result = migrateReactStore(state, 11)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(osc.textLetterReactionMode).toBe('uniform')
    expect(Array.isArray(osc.textLetterAssignments)).toBe(true)
    expect((osc.textLetterAssignments as unknown[]).length).toBe(0)
  })

  it('full chain from v0 adds textLetterAssignments', () => {
    const result = migrateReactStore({ oscillatorSettings: { text: 'DRMVYZ', sourceType: 'text' } }, 0)
    const osc = result.oscillatorSettings as Record<string, unknown>
    expect(Array.isArray(osc.textLetterAssignments)).toBe(true)
  })

  it('runs without throwing from any version < 13', () => {
    for (const v of [0, 1, 5, 10, 11, 12]) {
      expect(() =>
        migrateReactStore({ oscillatorSettings: { text: 'TEST' } }, v)
      ).not.toThrow()
    }
  })
})

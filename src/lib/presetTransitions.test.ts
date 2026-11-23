import { describe, expect, it } from 'vitest'
import {
  PRESET_TRANSITION_CHOICES, PRESET_TRANSITION_DESCRIPTIONS, PRESET_TRANSITION_LABELS, PRESET_TRANSITION_STYLES,
  isPresetTransitionChoice, isPresetTransitionOverride, resolvePresetTransition,
} from './presetTransitions'

describe('preset transition choices', () => {
  it('offers five styles plus Random, each with a label and a description', () => {
    expect(PRESET_TRANSITION_STYLES).toHaveLength(5)
    expect(PRESET_TRANSITION_CHOICES).toEqual([...PRESET_TRANSITION_STYLES, 'random'])
    for (const choice of PRESET_TRANSITION_CHOICES) {
      expect(PRESET_TRANSITION_LABELS[choice].length).toBeGreaterThan(0)
      expect(PRESET_TRANSITION_DESCRIPTIONS[choice].length).toBeGreaterThan(0)
    }
  })

  it('recognises only real choices, and overrides add inherit and off', () => {
    expect(isPresetTransitionChoice('wipe')).toBe(true)
    expect(isPresetTransitionChoice('random')).toBe(true)
    expect(isPresetTransitionChoice('inherit')).toBe(false)
    expect(isPresetTransitionChoice('spin')).toBe(false)
    expect(isPresetTransitionChoice(3)).toBe(false)
    for (const value of ['inherit', 'off', 'zoom', 'random']) expect(isPresetTransitionOverride(value)).toBe(true)
    expect(isPresetTransitionOverride('spin')).toBe(false)
  })
})

describe('resolvePresetTransition', () => {
  it('is a plain cut while Transitions is off, whatever the choice or override', () => {
    expect(resolvePresetTransition({ enabled: false, choice: 'wipe' })).toBeNull()
    expect(resolvePresetTransition({ enabled: false, choice: 'random', override: 'zoom' })).toBeNull()
  })

  it('uses the chosen style, and follows the setting for an absent or inherit override', () => {
    expect(resolvePresetTransition({ enabled: true, choice: 'zoom' })).toBe('zoom')
    expect(resolvePresetTransition({ enabled: true, choice: 'zoom', override: null })).toBe('zoom')
    expect(resolvePresetTransition({ enabled: true, choice: 'zoom', override: 'inherit' })).toBe('zoom')
  })

  it('lets a per-pad or per-cue override switch one change off or force a style', () => {
    expect(resolvePresetTransition({ enabled: true, choice: 'zoom', override: 'off' })).toBeNull()
    expect(resolvePresetTransition({ enabled: true, choice: 'zoom', override: 'flash' })).toBe('flash')
    expect(resolvePresetTransition({ enabled: true, choice: 'dissolve', override: 'random', random: () => 0 })).toBe('dissolve')
  })

  it('Random picks a style, covers all five, and never repeats the previous one back to back', () => {
    const seen = new Set<string>()
    for (let step = 0; step < 50; step += 1) seen.add(resolvePresetTransition({ enabled: true, choice: 'random', random: () => step / 50 })!)
    expect([...seen].sort()).toEqual([...PRESET_TRANSITION_STYLES].sort())
    for (const previous of PRESET_TRANSITION_STYLES) {
      for (let step = 0; step < 20; step += 1) expect(resolvePresetTransition({ enabled: true, choice: 'random', previous, random: () => step / 20 })).not.toBe(previous)
    }
  })

  it('Random stays inside the styles for any random value, including the edges', () => {
    for (const value of [0, 0.999999, 1, -1, 2]) expect(PRESET_TRANSITION_STYLES).toContain(resolvePresetTransition({ enabled: true, choice: 'random', random: () => value })!)
  })
})

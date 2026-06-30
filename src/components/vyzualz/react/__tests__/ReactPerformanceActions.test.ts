// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  getReactPerformanceActionsForTarget,
  isFormFieldKeyboardTarget,
  validateReactPerformanceActionRegistry,
} from '../ReactPerformanceActions'
import {
  NL_TRIGGER_PADS,
  resolvePerformancePadKeyboardRoute,
} from '../ReactPerformancePads'

const LEGACY_NEON_LABELS = [
  'Rail Burst', 'Cascade', 'Cross Flare', 'Whiteout',
  'Blackout', 'Reseed', 'Freeze', 'Cyan Strike',
]
const LEGACY_NEON_TRIGGERS = [
  'railBurst', 'blockCascade', 'crossFlare', 'whiteout',
  'blackout', 'reseed', 'freezeTrails', 'cyanStrike',
]

describe('React visual performance action registry', () => {
  it('validates stable IDs, contextual slots, bindings, targets, and envelopes', () => {
    expect(validateReactPerformanceActionRegistry()).toEqual([])
    const constellation = getReactPerformanceActionsForTarget({
      engineId: 'cinematicPortal',
      worldId: 'reactiveConstellation',
    })
    expect(constellation.map(action => action.label)).toEqual([
      'Collapse', 'Burst', 'Reseed', 'Freeze', 'Beam Fan',
      'Crystal Only', 'Edges Only', 'Palette Flip', 'White Flash', 'Blackout',
    ])
    expect(constellation.filter(action => action.behavior === 'momentary').every(action => (
      action.envelope != null && action.envelope.releaseMs > 0
    ))).toBe(true)
  })

  it('preserves Neon Lattice labels, pad slots, keyboard bindings, and legacy trigger IDs', () => {
    expect(NL_TRIGGER_PADS.map(pad => pad.label)).toEqual(LEGACY_NEON_LABELS)
    expect(NL_TRIGGER_PADS.map(pad => pad.trigger)).toEqual(LEGACY_NEON_TRIGGERS)
    expect(NL_TRIGGER_PADS.map(pad => pad.padId)).toEqual([
      'pad-1', 'pad-2', 'pad-3', 'pad-4', 'pad-5', 'pad-6', 'pad-7', 'pad-8',
    ])
  })

  it('routes contextual keys before preset pads and leaves remaining slots assigned to presets', () => {
    const actions = getReactPerformanceActionsForTarget({
      engineId: 'cinematicPortal',
      worldId: 'reactiveConstellation',
    })
    expect(resolvePerformancePadKeyboardRoute('1', actions)).toEqual({
      kind: 'action', actionId: 'reactiveConstellation.collapse',
    })
    expect(resolvePerformancePadKeyboardRoute('s', actions)).toEqual({
      kind: 'action', actionId: 'reactiveConstellation.blackout',
    })
    expect(resolvePerformancePadKeyboardRoute('d', actions)).toEqual({ kind: 'preset', padId: 'pad-11' })
    expect(resolvePerformancePadKeyboardRoute('?', actions)).toBeNull()
  })

  it('ignores input, textarea, select, and content-editable keyboard targets', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    Object.defineProperty(editable, 'isContentEditable', { value: true })

    expect(isFormFieldKeyboardTarget(input)).toBe(true)
    expect(isFormFieldKeyboardTarget(textarea)).toBe(true)
    expect(isFormFieldKeyboardTarget(select)).toBe(true)
    expect(isFormFieldKeyboardTarget(editable)).toBe(true)
    expect(isFormFieldKeyboardTarget(document.createElement('button'))).toBe(false)
  })
})

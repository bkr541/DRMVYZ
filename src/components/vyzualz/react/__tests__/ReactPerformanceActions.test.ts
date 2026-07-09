// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  getReactPerformanceActionsForTarget,
  REACT_VISUAL_PERFORMANCE_ACTIONS,
  isFormFieldKeyboardTarget,
  validateReactPerformanceActionRegistry,
} from '../ReactPerformanceActions'
import { resolvePerformancePadKeyboardRoute } from '../ReactPerformancePads'

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

    const canvas = getReactPerformanceActionsForTarget({ engineId: 'canvas' })
    expect(canvas.map(action => action.label)).toEqual([
      'Clean', 'Bloom', 'Ghost', 'Glitch', 'Stutter', 'Aura', 'Restart', 'Luma',
    ])
  })

  it('does not register retired Neon Lattice actions or targets', () => {
    expect(REACT_VISUAL_PERFORMANCE_ACTIONS.some(action => action.id.startsWith('neonLattice.'))).toBe(false)
    expect(REACT_VISUAL_PERFORMANCE_ACTIONS.some(action => String(action.target.engineId) === 'neonLattice')).toBe(false)
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

    const canvasActions = getReactPerformanceActionsForTarget({ engineId: 'canvas' })
    expect(resolvePerformancePadKeyboardRoute('1', canvasActions)).toEqual({
      kind: 'action', actionId: 'canvas.cleanPlayback',
    })
    expect(resolvePerformancePadKeyboardRoute('e', canvasActions)).toEqual({
      kind: 'action', actionId: 'canvas.restartClip',
    })
    expect(resolvePerformancePadKeyboardRoute('a', canvasActions)).toEqual({ kind: 'preset', padId: 'pad-9' })
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

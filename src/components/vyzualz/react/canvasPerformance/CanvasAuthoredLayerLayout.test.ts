import { describe, expect, it } from 'vitest'
import { resolveCanvasAuthoredLayerLayout } from './CanvasAuthoredLayerLayout'

function expectUniformScale(layout: ReturnType<typeof resolveCanvasAuthoredLayerLayout>, expected: number) {
  expect(layout).not.toBeNull()
  expect(layout?.scaleX).toBeCloseTo(expected, 10)
  expect(layout?.scaleY).toBeCloseTo(expected, 10)
}

describe('CANVAS authored deterministic layer layout', () => {
  it('preserves the existing full-canvas geometry for one visible layer', () => {
    expect(resolveCanvasAuthoredLayerLayout(1, 0)).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 })
  })

  it('places two layers at top-left and bottom-right with an inset', () => {
    expect(resolveCanvasAuthoredLayerLayout(2, 0)).toMatchObject({ x: -0.5, y: -0.5 })
    expect(resolveCanvasAuthoredLayerLayout(2, 1)).toMatchObject({ x: 0.5, y: 0.5 })
    expectUniformScale(resolveCanvasAuthoredLayerLayout(2, 0), 0.46)
    expectUniformScale(resolveCanvasAuthoredLayerLayout(2, 1), 0.46)
  })

  it('places three layers in a single deterministic left-to-right row', () => {
    expect(resolveCanvasAuthoredLayerLayout(3, 0)).toMatchObject({ x: -2 / 3, y: 0 })
    expect(resolveCanvasAuthoredLayerLayout(3, 1)).toMatchObject({ x: 0, y: 0 })
    expect(resolveCanvasAuthoredLayerLayout(3, 2)).toMatchObject({ x: 2 / 3, y: 0 })
    for (let index = 0; index < 3; index += 1) {
      const layout = resolveCanvasAuthoredLayerLayout(3, index)
      expect(layout?.scaleX).toBeCloseTo(0.92 / 3, 10)
      expect(layout?.scaleY).toBeCloseTo(0.92, 10)
    }
  })

  it('places four layers in canonical quadrant order', () => {
    expect(resolveCanvasAuthoredLayerLayout(4, 0)).toMatchObject({ x: -0.5, y: -0.5 })
    expect(resolveCanvasAuthoredLayerLayout(4, 1)).toMatchObject({ x: 0.5, y: -0.5 })
    expect(resolveCanvasAuthoredLayerLayout(4, 2)).toMatchObject({ x: -0.5, y: 0.5 })
    expect(resolveCanvasAuthoredLayerLayout(4, 3)).toMatchObject({ x: 0.5, y: 0.5 })
    for (let index = 0; index < 4; index += 1) {
      expectUniformScale(resolveCanvasAuthoredLayerLayout(4, index), 0.46)
    }
  })

  it('rejects empty, invalid, fractional, and fifth-layer layout states', () => {
    expect(resolveCanvasAuthoredLayerLayout(0, 0)).toBeNull()
    expect(resolveCanvasAuthoredLayerLayout(1, -1)).toBeNull()
    expect(resolveCanvasAuthoredLayerLayout(2, 2)).toBeNull()
    expect(resolveCanvasAuthoredLayerLayout(2.5, 0)).toBeNull()
    expect(resolveCanvasAuthoredLayerLayout(5, 0)).toBeNull()
  })
})

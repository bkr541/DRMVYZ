import { describe, expect, it } from 'vitest'
import {
  mapPixGridOutputToLogicalCell,
  resolvePixGridFallbackResolution,
  resolvePixGridLogicalResolution,
  resolvePixGridPresentationViewport,
  samplePixGridCellShape,
} from '../../renderers/pixGrid/PixGridRenderMath'


describe('PixGrid logical and presentation math', () => {
  it('maps every quality tier to the locked logical framebuffer dimensions', () => {
    expect(resolvePixGridLogicalResolution('draft')).toEqual({ width: 64, height: 36 })
    expect(resolvePixGridLogicalResolution('low')).toEqual({ width: 96, height: 54 })
    expect(resolvePixGridLogicalResolution('high')).toEqual({ width: 160, height: 90 })
    expect(resolvePixGridLogicalResolution('ultra')).toEqual({ width: 256, height: 144 })
  })

  it('promotes Draft fallback to at least 96 × 54 readability', () => {
    expect(resolvePixGridFallbackResolution('draft')).toEqual({ width: 96, height: 54 })
    expect(resolvePixGridFallbackResolution('high')).toEqual({ width: 160, height: 90 })
  })

  it('letterboxes the logical matrix and maps output pixels to exact logical cells', () => {
    expect(resolvePixGridPresentationViewport(1000, 1000, 160, 90)).toEqual({
      x: 0,
      y: 218.75,
      width: 1000,
      height: 562.5,
    })
    expect(mapPixGridOutputToLogicalCell(500, 500, 1000, 1000, 160, 90)).toMatchObject({
      cellX: 80,
      cellY: 45,
      localX: -0.5,
      localY: -0.5,
    })
    expect(mapPixGridOutputToLogicalCell(500, 100, 1000, 1000, 160, 90)).toBeNull()
  })

  it('keeps the cell center bright while gap and roundness remove corner coverage', () => {
    const center = samplePixGridCellShape(0, 0, 0.16, 0.2)
    const squareCorner = samplePixGridCellShape(0.3, 0.3, 0.16, 0)
    const roundedCorner = samplePixGridCellShape(0.3, 0.3, 0.16, 0.5)
    const gap = samplePixGridCellShape(0.48, 0, 0.16, 0.2)

    expect(center.inside).toBe(true)
    expect(center.centerLight).toBe(1)
    expect(squareCorner.inside).toBe(true)
    expect(roundedCorner.inside).toBe(false)
    expect(gap.inside).toBe(false)
  })
})

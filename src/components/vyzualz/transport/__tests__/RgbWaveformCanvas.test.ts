import { describe, expect, it } from 'vitest'
import { resolveDeckWaveformPlot, resolvePlayheadHeadBounds } from '../RgbWaveformCanvas'

describe('resolveDeckWaveformPlot', () => {
  it('maps the first beat to a padded coordinate with room for a centered playhead head', () => {
    const plot = resolveDeckWaveformPlot(200)

    expect(plot).toEqual({ left: 6, width: 188 })
    expect(resolvePlayheadHeadBounds(plot.left, 200)).toEqual({ left: 1, right: 11 })
  })
})

describe('resolvePlayheadHeadBounds', () => {
  it('extends the head inward without moving its tip from a timeline boundary', () => {
    expect(resolvePlayheadHeadBounds(0, 200)).toEqual({ left: 0, right: 10 })
    expect(resolvePlayheadHeadBounds(200, 200)).toEqual({ left: 190, right: 200 })
  })

  it('centers the head around a playhead positioned away from a boundary', () => {
    expect(resolvePlayheadHeadBounds(84, 200)).toEqual({ left: 79, right: 89 })
  })
})

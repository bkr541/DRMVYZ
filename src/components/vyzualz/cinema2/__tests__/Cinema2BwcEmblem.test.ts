import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BWC_EMBLEM_INTERIORS, BWC_EMBLEM_OUTLINE, BWC_EMBLEM_VIEW_BOX } from '../modules/bwc/Cinema2BwcEmblem.generated'
import {
  BWC_EMBLEM_CENTER_Y_M,
  BWC_EMBLEM_HEIGHT_M,
  BWC_EMBLEM_TEXTURE_HEIGHT,
  BWC_EMBLEM_TEXTURE_WIDTH,
  BWC_EMBLEM_WIDTH_M,
  BWC_EMBLEM_WRAP_RADIUS_M,
  bwcEmblemGlsl,
  rasterizeBwcEmblem,
} from '../modules/bwc/Cinema2BwcEmblem'

const svg = readFileSync(join(process.cwd(), 'docs/BWC/Claw_Marks_Filled.svg'), 'utf8')
const attribute = (tag: string, name: string): string | null => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null
const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(match => match[0]).map(tag => ({
  id: attribute(tag, 'id'), d: attribute(tag, ' d')?.replace(/\s+/g, ' ').trim() ?? attribute(tag, 'd'), fill: attribute(tag, 'fill'), fillRule: attribute(tag, 'fill-rule'),
}))
const normalised = (value: string | null) => value?.replace(/\s+/g, ' ').trim()

describe('BWC can emblem', () => {
  it('is exactly the artwork in docs/BWC/Claw_Marks_Filled.svg: view box, three interior fills and the black outline', () => {
    expect(svg.match(/viewBox="([^"]+)"/)![1]!.split(/\s+/).map(Number)).toEqual([...BWC_EMBLEM_VIEW_BOX])
    expect(paths.map(path => path.id)).toEqual(['left-interior', 'middle-interior', 'right-interior', 'claw-outline'])
    for (const interior of BWC_EMBLEM_INTERIORS) {
      const source = paths.find(path => path.id === interior.id)!
      expect(normalised(source.d)).toBe(interior.d)
      expect(source.fill).toBe(interior.fill)
    }
    expect(BWC_EMBLEM_INTERIORS.map(interior => interior.fill)).toEqual(['#d0d0d0', '#bcbcbc', '#c8c8c8'])
    const outline = paths.find(path => path.id === 'claw-outline')!
    expect(normalised(outline.d)).toBe(BWC_EMBLEM_OUTLINE.d)
    expect(outline.fill).toBe('#111111')
    expect(BWC_EMBLEM_OUTLINE.fill).toBe('#111111')
    expect(outline.fillRule).toBe('evenodd')
    expect(BWC_EMBLEM_OUTLINE.fillRule).toBe('evenodd')
  })

  it('has the SVG\'s transparent background and no other shapes', () => {
    expect(svg).not.toMatch(/<rect\b|<circle\b|<image\b/)
    expect(svg).not.toMatch(/display="none"/)
  })

  it('is printed on the straight body of the can, facing out, without wrapping past the side', () => {
    const bottom = BWC_EMBLEM_CENTER_Y_M - BWC_EMBLEM_HEIGHT_M / 2
    const top = BWC_EMBLEM_CENTER_Y_M + BWC_EMBLEM_HEIGHT_M / 2
    // The straight body of the artifact runs 4.45 mm to 156.568 mm.
    expect(bottom).toBeGreaterThan(0.00445)
    expect(top).toBeLessThan(0.156568)
    // Half the printed width as an angle either side of the front stays inside the 1.4 rad the shader allows.
    expect(BWC_EMBLEM_WIDTH_M / 2 / BWC_EMBLEM_WRAP_RADIUS_M).toBeLessThan(1.4)
    // And the artwork's proportions are kept.
    expect(BWC_EMBLEM_WIDTH_M / BWC_EMBLEM_HEIGHT_M).toBeCloseTo(BWC_EMBLEM_VIEW_BOX[2] / BWC_EMBLEM_VIEW_BOX[3], 9)
    expect(BWC_EMBLEM_TEXTURE_WIDTH / BWC_EMBLEM_TEXTURE_HEIGHT).toBeCloseTo(BWC_EMBLEM_VIEW_BOX[2] / BWC_EMBLEM_VIEW_BOX[3], 9)
  })

  it('hands the shader the same placement constants', () => {
    const glsl = bwcEmblemGlsl()
    expect(glsl).toContain(`const float EMBLEM_HEIGHT = ${BWC_EMBLEM_HEIGHT_M.toFixed(6)};`)
    expect(glsl).toContain(`const float EMBLEM_WIDTH = ${BWC_EMBLEM_WIDTH_M.toFixed(6)};`)
  })

  it('prints nothing, rather than failing, where there is no canvas to draw the artwork on', () => {
    // No Path2D in this environment: the renderer then binds a transparent texel and the cans stay plain white.
    if (typeof Path2D === 'undefined') expect(rasterizeBwcEmblem()).toBeNull()
  })
})

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { compileXyScopeSvg, buildXyScopeSvgLayout, XY_SCOPE_SVG_POINT_BUDGET } from './XyScopeSvg'
import { normalizeXyScopeSettings } from './XyScopeSettings'
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><g transform="translate(10 5)"><path d="M0 0 L80 0 L80 40"/><rect x="100" y="10" width="40" height="40"/></g></svg>'
describe('uploaded SVG oscillator geometry', () => {
  it('compiles transformed independent open and closed paths with a bounded budget', () => {
    const source = compileXyScopeSvg('upload', SVG)
    const xs=source.points.map(p=>p.x),ys=source.points.map(p=>p.y)
    expect(Math.min(...xs)+Math.max(...xs)).toBeCloseTo(0)
    expect(Math.min(...ys)+Math.max(...ys)).toBeCloseTo(0)
    expect(source.points.length).toBeLessThanOrEqual(XY_SCOPE_SVG_POINT_BUDGET)
    const layout = buildXyScopeSvgLayout(source, 900, 600, .84, 0, 'outline')
    expect(layout.glyphs).toHaveLength(2)
    expect(layout.glyphs.map(g => g.closed?.[0])).toEqual([false, true])
    expect(layout.glyphs[0].x[0]).toBeLessThan(layout.glyphs[1].x[0])
    expect(layout.glyphs.every(g => [...g.x, ...g.y, ...g.nx, ...g.ny].every(Number.isFinite))).toBe(true)
    expect(layout.totalPoints).toBeLessThanOrEqual(XY_SCOPE_SVG_POINT_BUDGET)
  })
  it('keeps geometry proportional when resizing and provides three actual beam processing modes', () => {
    const source = compileXyScopeSvg('upload', SVG)
    const large = buildXyScopeSvgLayout(source, 900, 600, .84, 0, 'outline')
    const small = buildXyScopeSvgLayout(source, 450, 300, .84, 0, 'segments')
    expect(small.glyphs[0].x[0]).toBeCloseTo(large.glyphs[0].x[0]/2)
    for (const processing of ['outline', 'segments', 'points'] as const) expect(buildXyScopeSvgLayout(source, 900, 600, .84, 0, processing).glyphs.every(g => g.drawMode === processing)).toBe(true)
    expect(buildXyScopeSvgLayout(null,900,600,.84,0,'outline').totalPoints).toBe(0)
  })
  it('rejects unsupported or raster-only uploads without a fallback circle', () => {
    for (const raw of ['not svg', '<svg><text>HELLO</text></svg>', '<svg><image href="data:image/png;base64,AAAA"/></svg>']) expect(() => compileXyScopeSvg('bad',raw)).toThrow()
  })
  it('normalizes persisted selection and processing without discarding text or font settings', () => {
    const settings = normalizeXyScopeSettings({sourceMode:'svg',svgMediaId:'upload',svgProcessing:'points',text:'KEEP',fontId:'font-1'})
    expect(settings).toMatchObject({sourceMode:'svg',svgMediaId:'upload',svgProcessing:'points',text:'KEEP',fontId:'font-1'})
    expect(normalizeXyScopeSettings({sourceMode:'bad',svgProcessing:'bad'})).toMatchObject({sourceMode:'text',svgProcessing:'outline'})
    expect(settings.parameters.bassResponse).toBe(1)
  })
})

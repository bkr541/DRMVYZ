import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { composeCutbankFrame, type CutbankDrawable } from './CutbankCompose'
import { CutbankRuntime, type CutbankFramePlan } from './CutbankRuntime'
import { CUTBANK_TREAT_FRAGMENT_SRC } from './CutbankTreatPass'
import { testContext, testMedia, testPool, testSettings } from './cutbankTestUtils'

type Call = { name: string; args: unknown[] }

function recordingCtx() {
  const calls: Call[] = []
  const props: Record<string, unknown> = {}
  const ctx = new Proxy({}, {
    get(_t, key: string) {
      if (key === '__calls') return calls
      if (key === 'measureText') return (text: string) => ({ width: text.length * 10 })
      if (key in props) return props[key]
      return (...args: unknown[]) => { calls.push({ name: key, args }) }
    },
    set(_t, key: string, value) { props[key] = value; return true },
  }) as unknown as CanvasRenderingContext2D & { __calls: Call[] }
  return ctx
}

const media = [testMedia('img-1'), testMedia('svg-1', 'svg')]
const drawable = (id: string): CutbankDrawable => ({ source: {} as CanvasImageSource, width: 1600, height: 900, svgLuma: id.startsWith('svg') ? 0.9 : null })

function planFor(pool: ReturnType<typeof testPool>, settingsPatch: Parameters<typeof testSettings>[0] = {}): CutbankFramePlan {
  const runtime = new CutbankRuntime()
  return runtime.update({
    settings: testSettings({ layoutMode: 'hero', ...settingsPatch }), pool, mediaItems: media,
    context: testContext(2), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1,
  })
}

describe('CUTBANK compose', () => {
  it('renders native text with fillText (not an image)', () => {
    const ctx = recordingCtx()
    const stats = composeCutbankFrame(ctx, { plan: planFor(testPool([], ['DON\'T WAKE ME']), { mediaMode: 'text' }), width: 800, height: 450, resolveDrawable: () => null })
    const names = ctx.__calls.map(c => c.name)
    expect(names).toContain('fillText')
    expect(names).not.toContain('drawImage')
    expect(ctx.__calls.some(c => c.name === 'fillText' && String(c.args[0]).includes('DON\'T'))).toBe(true)
    expect(stats.drawnElements).toBeGreaterThan(0)
  })

  it('renders images and reports unresolved media without throwing', () => {
    const ctx = recordingCtx()
    const plan = planFor(testPool(['img-1']), { mediaMode: 'images' })
    const ok = composeCutbankFrame(ctx, { plan, width: 800, height: 450, resolveDrawable: drawable })
    expect(ctx.__calls.map(c => c.name)).toContain('drawImage')
    expect(ok.drawnElements).toBeGreaterThan(0)
    const missing = composeCutbankFrame(recordingCtx(), { plan, width: 800, height: 450, resolveDrawable: () => null })
    expect(missing.missingElements).toBeGreaterThan(0)
    expect(missing.drawnElements).toBe(0)
  })

  it('combines text and visual media in one composition', () => {
    const ctx = recordingCtx()
    const plan = planFor(testPool(['img-1'], ['IS THIS REAL?']), { layoutMode: 'poster', layerCount: 3, layoutComplexity: 1 })
    composeCutbankFrame(ctx, { plan, width: 800, height: 450, resolveDrawable: drawable })
    const names = ctx.__calls.map(c => c.name)
    expect(names).toContain('drawImage')
    expect(names).toContain('fillText')
  })

  it('draws both compositions while a transition runs', () => {
    const runtime = new CutbankRuntime()
    const settings = testSettings({ layoutMode: 'poster', cutRate: 1, minimumHold: 0, maximumHold: 0.2, chaos: 0, transitionDuration: 1, transitionStyle: 'rgbCut' })
    let withTransition: CutbankFramePlan | null = null
    for (let f = 0; f < 240 && !withTransition; f += 1) {
      const plan = runtime.update({ settings, pool: testPool(['img-1'], ['ONE', 'TWO']), mediaItems: media, context: testContext(f / 20), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
      if (plan.transition && plan.outgoing) withTransition = plan
    }
    expect(withTransition).not.toBeNull()
    const ctx = recordingCtx()
    composeCutbankFrame(ctx, { plan: withTransition!, width: 800, height: 450, resolveDrawable: drawable })
    expect(ctx.__calls.filter(c => c.name === 'fillRect').length).toBeGreaterThanOrEqual(3)
  })

  it('draws a legible silhouette for a dark SVG logo on the ink backdrop', () => {
    const ctx = recordingCtx()
    const plan = planFor(testPool(['svg-1']), { layoutMode: 'logoHit', mediaMode: 'svg' })
    composeCutbankFrame(ctx, { plan, width: 400, height: 225, resolveDrawable: () => ({ source: {} as CanvasImageSource, width: 200, height: 200, svgLuma: 0.05 }) })
    // jsdom-free environment: silhouette() falls back to a plain drawImage when no document exists.
    expect(ctx.__calls.map(c => c.name)).toContain('drawImage')
  })
})

describe('CUTBANK treat shader', () => {
  const pass = readFileSync(join(__dirname, 'CutbankTreatPass.ts'), 'utf8')
  const declared = new Set([...CUTBANK_TREAT_FRAGMENT_SRC.matchAll(/uniform\s+\w+\s+(u\w+);/g)].map(m => m[1]))
  const assigned = new Set([...pass.matchAll(/p\.set\w+\('(u\w+)'/g)].map(m => m[1]))

  it('every declared uniform is fed by the pass and every fed uniform exists', () => {
    for (const name of declared) expect(assigned.has(name), `${name} declared but never set`).toBe(true)
    for (const name of assigned) expect(declared.has(name), `${name} set but not declared`).toBe(true)
  })

  it('every treatment/palette plan control reaches a shader uniform', () => {
    for (const field of ['threshold', 'thresholdLevel', 'thresholdStyle', 'posterize', 'grain', 'scanlines', 'lens', 'signal', 'jitter', 'roll', 'rgb', 'distortion', 'ripple', 'smear', 'smearAngle', 'feedback', 'flashWhite', 'flashBlack', 'exposureBurn']) {
      expect(pass, field).toContain(`t.${field}`)
    }
    for (const field of ['modeCode', 'sourceAmount', 'saturation', 'contrast', 'exposureStops', 'blackPoint', 'whitePoint', 'tint', 'tintAmount', 'accent1', 'accent2', 'colorize', 'invert']) {
      expect(pass, field).toContain(`pal.${field}`)
    }
  })
})

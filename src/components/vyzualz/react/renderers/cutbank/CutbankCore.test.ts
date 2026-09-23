import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveCutbankContent } from './CutbankContent'
import { resolveCutbankFreedomEnvelope } from './CutbankFreedom'
import {
  buildCutbankComposition, CUTBANK_LAYOUT_IDS, cutbankElementBudget, resolveEffectiveCutbankLayout,
  type CutbankLayoutId, type CutbankPickWant,
} from './CutbankLayouts'
import { pickCutbankItem } from './CutbankSelection'
import { CutbankRuntime, resolveCutbankHoldBeats } from './CutbankRuntime'
import { resolveCutbankPalette, autoPaletteBars } from './CutbankPalette'
import { resolveCutbankClock, resolveCutbankEnergy, holdSliderToBeats, snapHoldBeats, cutRateToIntervalBeats } from './CutbankClock'
import { CUTBANK_TRANSITION_MAP, cutbankTransitionDurationSec, resolveCutbankTransitionStyle, startCutbankTransition, evaluateCutbankTransition } from './CutbankTransitions'
import { resolveCutbankTreatment, EMPTY_CUTBANK_IMPULSES, cutbankMasterScale } from './CutbankTreatment'
import { CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS, DEFAULT_CANVAS_CUTBANK_SETTINGS, normalizeCanvasCutbankSettings } from './CutbankSettings'
import { testContext, testMedia, testPool, testSettings } from './cutbankTestUtils'

const media = [testMedia('img-1'), testMedia('img-2'), testMedia('svg-1', 'svg'), testMedia('vid-1', 'video')]
const mixedPool = testPool(['img-1', 'img-2', 'svg-1', 'vid-1'], ['DON\'T WAKE ME', 'IS THIS REAL?'])

function run(
  settings = testSettings(),
  opts: { pool?: ReturnType<typeof testPool> | null; beats?: number; bpm?: number; ctx?: Parameters<typeof testContext>[1] } = {},
) {
  const runtime = new CutbankRuntime()
  const plans = []
  const beats = opts.beats ?? 64
  for (let f = 0; f <= beats * 30; f += 1) {
    const beat = f / 30
    const context = testContext(beat, opts.ctx ?? {}, opts.bpm ?? 120)
    plans.push(runtime.update({
      settings, pool: opts.pool === undefined ? mixedPool : opts.pool, mediaItems: media, context,
      dtSec: 1 / 60, trackIdentity: 'track-a', poolRevision: 1,
    }))
  }
  return plans
}

describe('CUTBANK settings', () => {
  it('normalizes missing/invalid input to complete defaults (pre-CUTBANK projects)', () => {
    expect(normalizeCanvasCutbankSettings(undefined)).toEqual(DEFAULT_CANVAS_CUTBANK_SETTINGS)
    const messy = normalizeCanvasCutbankSettings({ mediaMode: 'weighted', selectionMode: 'weighted', layoutMode: 'nope', layerCount: 99, chaos: 7, minimumHold: 0.8, maximumHold: 0.2, tintColor: 'red' })
    expect(messy.mediaMode).toBe('mixed')
    expect(messy.selectionMode).toBe(DEFAULT_CANVAS_CUTBANK_SETTINGS.selectionMode)
    expect(messy.layoutMode).toBe('auto')
    expect(messy.layerCount).toBe(4)
    expect(messy.chaos).toBe(1)
    expect(messy.maximumHold).toBeGreaterThanOrEqual(messy.minimumHold)
    expect(messy.tintColor).toBe('#FFFFFF')
  })

  it('exposes only Random and Shuffle selection and none of the forbidden controls', () => {
    const keys = Object.keys(DEFAULT_CANVAS_CUTBANK_SETTINGS)
    for (const forbidden of ['imageBias', 'textBias', 'repeatProtection', 'cropAmount', 'overscan', 'scaleRange', 'rotationRange', 'negativeSpace', 'compositionVariety']) {
      expect(keys).not.toContain(forbidden)
    }
    expect(keys).toContain('compositionFreedom')
    expect(normalizeCanvasCutbankSettings({ selectionMode: 'weighted' }).selectionMode).not.toBe('weighted')
  })
})

describe('CUTBANK content eligibility', () => {
  it('filters by Media Mode and falls back gracefully when the mode has no entries', () => {
    const images = resolveCutbankContent({ pool: mixedPool, mediaItems: media, mode: 'images' })
    expect(images.eligible.map(item => item.kind)).toEqual(['image', 'image'])
    const text = resolveCutbankContent({ pool: mixedPool, mediaItems: media, mode: 'text' })
    expect(text.eligible.every(item => item.kind === 'text')).toBe(true)
    expect(resolveCutbankContent({ pool: mixedPool, mediaItems: media, mode: 'mixed' }).eligible).toHaveLength(6)
    const imageOnly = resolveCutbankContent({ pool: testPool(['img-1']), mediaItems: media, mode: 'text' })
    expect(imageOnly.modeFallback).toBe(true)
    expect(imageOnly.eligible).toHaveLength(1)
  })

  it('reports empty, missing, and deleted content without throwing', () => {
    expect(resolveCutbankContent({ pool: null, mediaItems: media, mode: 'mixed' }).status).toBe('no-pool')
    expect(resolveCutbankContent({ pool: testPool([]), mediaItems: media, mode: 'mixed' }).status).toBe('empty-pool')
    const deleted = resolveCutbankContent({ pool: testPool(['gone-1', 'gone-2']), mediaItems: media, mode: 'mixed' })
    expect(deleted.status).toBe('no-available-content')
    expect(deleted.missingMediaIds).toEqual(['gone-1', 'gone-2'])
    const failed = resolveCutbankContent({ pool: testPool(['img-1', 'img-2']), mediaItems: media, mode: 'mixed', failedMediaIds: new Set(['img-1']) })
    expect(failed.eligible.map(item => item.mediaId)).toEqual(['img-2'])
  })

  it('changes its signature when text is edited or membership changes', () => {
    const a = resolveCutbankContent({ pool: testPool(['img-1'], ['ONE']), mediaItems: media, mode: 'mixed' }).signature
    const b = resolveCutbankContent({ pool: testPool(['img-1'], ['TWO']), mediaItems: media, mode: 'mixed' }).signature
    const c = resolveCutbankContent({ pool: testPool(['img-1', 'img-2'], ['ONE']), mediaItems: media, mode: 'mixed' }).signature
    expect(new Set([a, b, c]).size).toBe(3)
  })
})

describe('CUTBANK deterministic selection', () => {
  const items = resolveCutbankContent({ pool: mixedPool, mediaItems: media, mode: 'mixed' }).eligible
  const identity = { trackIdentity: 'track-a', poolId: 'pool-1', poolRevision: 1 }

  it('Random is deterministic for identical context and varies with sequence/slot', () => {
    const args = { items, mode: 'random' as const, identity }
    expect(pickCutbankItem({ ...args, sequenceIndex: 5, slot: 0 })).toBe(pickCutbankItem({ ...args, sequenceIndex: 5, slot: 0 }))
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickCutbankItem({ ...args, sequenceIndex: i, slot: 0 })?.key))
    expect(seen.size).toBeGreaterThan(2)
  })

  it('Shuffle shows every entry once per cycle and reshuffles deterministically', () => {
    const cycle = (start: number) => Array.from({ length: items.length }, (_, i) =>
      pickCutbankItem({ items, mode: 'shuffle', identity, sequenceIndex: 0, slot: start + i })!.key)
    const first = Array.from({ length: items.length }, (_, i) => pickCutbankItem({ items, mode: 'shuffle', identity, sequenceIndex: 0, slot: i })!.key)
    expect(new Set(first).size).toBe(items.length)
    expect(cycle(0)).toEqual(first)
    const second = Array.from({ length: items.length }, (_, i) => pickCutbankItem({ items, mode: 'shuffle', identity, sequenceIndex: 0, slot: items.length + i })!.key)
    expect(new Set(second).size).toBe(items.length)
  })

  it('a different pool revision selects differently', () => {
    const a = Array.from({ length: 12 }, (_, i) => pickCutbankItem({ items, mode: 'random', identity, sequenceIndex: i, slot: 0 })!.key)
    const b = Array.from({ length: 12 }, (_, i) => pickCutbankItem({ items, mode: 'random', identity: { ...identity, poolRevision: 2 }, sequenceIndex: i, slot: 0 })!.key)
    expect(a).not.toEqual(b)
  })
})

describe('CUTBANK layouts', () => {
  const items = resolveCutbankContent({ pool: mixedPool, mediaItems: media, mode: 'mixed' }).eligible
  const pick = (slot: number, want: CutbankPickWant) => {
    const list = want === 'any' ? items : want === 'text' ? items.filter(i => i.kind === 'text') : want === 'svg' ? items.filter(i => i.kind === 'svg') : items.filter(i => i.kind !== 'text')
    return list.length ? list[slot % list.length] : null
  }
  const build = (layout: CutbankLayoutId, patch: Partial<{ freedom: number; complexity: number; layerCount: number; seed: number }> = {}) =>
    buildCutbankComposition({ layout, requestedLayout: layout, seed: patch.seed ?? 42, freedom: patch.freedom ?? 0.5, complexity: patch.complexity ?? 0.6, layerCount: patch.layerCount ?? 4, pick })

  it('resolves every authored layout to at least one element', () => {
    for (const layout of CUTBANK_LAYOUT_IDS) {
      const composition = build(layout)
      expect(composition.elements.length, layout).toBeGreaterThan(0)
      expect(composition.layout).toBe(layout)
    }
  })

  it('never exceeds Layer Count and degrades multi-layer layouts at one layer', () => {
    for (const layout of CUTBANK_LAYOUT_IDS) {
      for (const layerCount of [1, 2, 3, 4]) {
        expect(build(layout, { layerCount, complexity: 1 }).elements.length, `${layout}/${layerCount}`).toBeLessThanOrEqual(layerCount)
      }
    }
    expect(resolveEffectiveCutbankLayout('stack', 1)).toBe('hero')
    expect(resolveEffectiveCutbankLayout('stack', 2)).toBe('stack')
    expect(build('fragment', { layerCount: 1 }).layout).toBe('hero')
    expect(cutbankElementBudget(1, 4)).toBe(4)
    expect(cutbankElementBudget(0, 4)).toBe(1)
  })

  it('Composition Freedom widens the layout envelope monotonically', () => {
    const lo = resolveCutbankFreedomEnvelope(0)
    const mid = resolveCutbankFreedomEnvelope(0.5)
    const hi = resolveCutbankFreedomEnvelope(1)
    for (const key of ['offset', 'scaleHi', 'rotation', 'overscan', 'cropZoom', 'negativeSpace', 'variety'] as const) {
      expect(lo[key]).toBeLessThan(mid[key])
      expect(mid[key]).toBeLessThan(hi[key])
    }
    expect(lo.scaleLo).toBeGreaterThan(hi.scaleLo)
    expect(lo.legibility).toBeGreaterThan(hi.legibility)
  })

  it('low Composition Freedom keeps elements contained, high freedom lets them bleed and rotate', () => {
    const extent = (freedom: number) => {
      let maxRot = 0
      let maxBleed = 0
      for (let seed = 1; seed <= 60; seed += 1) {
        for (const layout of ['hero', 'overscan', 'edgeCrop', 'stack', 'poster'] as const) {
          for (const el of build(layout, { freedom, seed }).elements) {
            maxRot = Math.max(maxRot, Math.abs(el.rotation))
            if (el.type === 'media') maxBleed = Math.max(maxBleed, Math.abs(el.cx - 0.5) + el.w / 2 - 0.5)
          }
        }
      }
      return { maxRot, maxBleed }
    }
    const low = extent(0)
    const high = extent(1)
    expect(low.maxRot).toBeLessThan(0.16)
    expect(high.maxRot).toBeGreaterThan(low.maxRot * 2)
    expect(high.maxBleed).toBeGreaterThan(low.maxBleed)
  })

  it('is deterministic for a given seed', () => {
    expect(build('poster', { seed: 9 })).toEqual(build('poster', { seed: 9 }))
    expect(build('poster', { seed: 9 })).not.toEqual(build('poster', { seed: 10 }))
  })

  it('handles text-only and media-only pools', () => {
    const textOnly = resolveCutbankContent({ pool: testPool([], ['A', 'B']), mediaItems: media, mode: 'mixed' }).eligible
    const pickText = (slot: number, want: CutbankPickWant) => (want === 'any' || want === 'text') ? textOnly[slot % textOnly.length] : null
    for (const layout of CUTBANK_LAYOUT_IDS) {
      const c = buildCutbankComposition({ layout, requestedLayout: layout, seed: 3, freedom: 0.5, complexity: 0.5, layerCount: 3, pick: pickText })
      expect(c.elements.every(el => el.type === 'text'), layout).toBe(true)
    }
    const mediaOnly = items.filter(i => i.kind !== 'text')
    const pickMedia = (slot: number, want: CutbankPickWant) => want === 'text' ? null : mediaOnly[slot % mediaOnly.length]
    for (const layout of CUTBANK_LAYOUT_IDS) {
      const c = buildCutbankComposition({ layout, requestedLayout: layout, seed: 3, freedom: 0.5, complexity: 0.5, layerCount: 3, pick: pickMedia })
      expect(c.elements.every(el => el.type === 'media'), layout).toBe(true)
    }
  })
})

describe('CUTBANK timing and runtime', () => {
  it('maps hold and cut-rate sliders to musical divisions', () => {
    expect(holdSliderToBeats(0)).toBe(0.5)
    expect(holdSliderToBeats(1)).toBe(32)
    expect(snapHoldBeats(2.8)).toBe(2)
    expect(snapHoldBeats(3)).toBe(4)
    expect(snapHoldBeats(5.5)).toBe(4)
    expect(cutRateToIntervalBeats(0)).toBe(16)
    expect(cutRateToIntervalBeats(1)).toBe(0.5)
  })

  it('uses the canonical BPM when synced and a deterministic fallback otherwise', () => {
    const ctx = testContext(10.5)
    const synced = resolveCutbankClock(ctx, { bpmSync: true, transportTimeSec: ctx.audioTimeSec })
    expect(synced.canonical).toBe(true)
    expect(synced.beat).toBeCloseTo(10.5, 3)
    const off = resolveCutbankClock(ctx, { bpmSync: false, transportTimeSec: 5 })
    expect(off.canonical).toBe(false)
    expect(off.beat).toBeCloseTo(10, 3)
    const noBpm = resolveCutbankClock(testContext(0, { bpm: 0 }), { bpmSync: true, transportTimeSec: 3 })
    expect(noBpm.canonical).toBe(false)
    expect(noBpm.beat).toBeCloseTo(6, 3)
  })

  it('respects Minimum and Maximum Hold', () => {
    const settings = testSettings({ minimumHold: 0.5, maximumHold: 0.5, cutRate: 1, chaos: 0 })
    const plans = run(settings, { beats: 96 })
    const startBeats = plans.filter(p => p.cutThisFrame).map(p => p.clock.beat)
    const gaps = startBeats.slice(1).map((b, i) => b - startBeats[i])
    const hold = snapHoldBeats(holdSliderToBeats(0.5))
    expect(gaps.length).toBeGreaterThan(3)
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(hold - 0.2)
    for (const gap of gaps) expect(gap).toBeLessThanOrEqual(hold + 1.2)
  })

  it('Cut Rate changes editorial frequency', () => {
    const count = (cutRate: number) => run(testSettings({ cutRate, minimumHold: 0, maximumHold: 1, chaos: 0, autoPerformance: false }), { beats: 64 }).filter(p => p.cutThisFrame).length
    expect(count(0.9)).toBeGreaterThan(count(0.1) * 2)
  })

  it('cuts on musical boundaries when BPM Sync is on (bar downbeats for long holds)', () => {
    const plans = run(testSettings({ bpmSync: true, cutRate: 0.1, minimumHold: 0.5, maximumHold: 0.7, chaos: 0 }), { beats: 96 })
    const cuts = plans.filter(p => p.cutThisFrame).slice(1)
    expect(cuts.length).toBeGreaterThan(1)
    for (const cut of cuts) expect(cut.clock.beatWithinBar).toBeLessThan(0.9)
  })

  it('reconstructs the same composition after a seek to the same position', () => {
    const settings = testSettings()
    const at = (runtime: CutbankRuntime, beat: number) => runtime.update({ settings, pool: mixedPool, mediaItems: media, context: testContext(beat, { seekDetected: true }), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    const a = new CutbankRuntime()
    const b = new CutbankRuntime()
    for (let f = 0; f < 200; f += 1) a.update({ settings, pool: mixedPool, mediaItems: media, context: testContext(f / 30), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    const seekA = at(a, 130)
    const seekB = at(b, 130)
    expect(seekA.current).toEqual(seekB.current)
    expect(seekA.transition).toBeNull()
  })

  it('two runtimes fed the same timeline agree exactly', () => {
    const a = run(testSettings(), { beats: 48 }).filter(p => p.cutThisFrame).map(p => `${p.sequenceIndex}:${p.current?.layout}:${p.current?.elements.map(e => e.itemKey).join(',')}`)
    const b = run(testSettings(), { beats: 48 }).filter(p => p.cutThisFrame).map(p => `${p.sequenceIndex}:${p.current?.layout}:${p.current?.elements.map(e => e.itemKey).join(',')}`)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(3)
  })

  it('a fixed Layout Mode is honoured; Auto produces multiple layouts', () => {
    const fixed = run(testSettings({ layoutMode: 'poster' }), { beats: 40 })
    expect(new Set(fixed.map(p => p.current!.layout))).toEqual(new Set(['poster']))
    const auto = run(testSettings({ layoutMode: 'auto', cutRate: 1, minimumHold: 0, chaos: 0 }), { beats: 128 })
    expect(new Set(auto.map(p => p.current!.layout)).size).toBeGreaterThan(3)
  })

  it('Layer Count limits simultaneous elements at runtime', () => {
    for (const plan of run(testSettings({ layerCount: 1, layoutComplexity: 1, cutRate: 1 }), { beats: 60 })) {
      expect(plan.current!.elements.length).toBeLessThanOrEqual(1)
      expect((plan.outgoing?.elements.length ?? 0)).toBeLessThanOrEqual(1)
    }
  })

  it('never crashes on empty, deleted, or missing pools and clears stale state', () => {
    for (const pool of [null, testPool([]), testPool(['gone'])]) {
      const plans = run(testSettings(), { pool, beats: 8 })
      expect(plans.every(p => p.current === null && p.status.message !== null)).toBe(true)
    }
    const runtime = new CutbankRuntime()
    const feed = (pool: typeof mixedPool | null, beat: number) => runtime.update({ settings: testSettings(), pool, mediaItems: media, context: testContext(beat), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    expect(feed(mixedPool, 1).current).not.toBeNull()
    expect(feed(null, 1.1).current).toBeNull()
    expect(feed(mixedPool, 1.2).current).not.toBeNull()
  })

  it('removes deleted media/text from the current composition immediately', () => {
    const runtime = new CutbankRuntime()
    const settings = testSettings({ layoutMode: 'hero', mediaMode: 'text' })
    const feed = (pool: typeof mixedPool, beat: number) => runtime.update({ settings, pool, mediaItems: media, context: testContext(beat), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    const first = feed(testPool([], ['ONE', 'TWO']), 1)
    expect(first.current!.elements.length).toBeGreaterThan(0)
    const edited = feed(testPool([], ['EDITED', 'TWO']), 1.05)
    const key = edited.current!.elements[0].itemKey
    expect(edited.items.get(key)?.text === 'EDITED' || edited.items.get(key)?.text === 'TWO').toBe(true)
    const only = feed(testPool([], ['ONLY']), 1.1)
    for (const el of only.current!.elements) expect(only.items.get(el.itemKey)?.text).toBe('ONLY')
  })

  it('a pool change rebuilds selection safely (no stale item keys)', () => {
    const runtime = new CutbankRuntime()
    const settings = testSettings()
    const feed = (pool: typeof mixedPool, rev: number, beat: number) => runtime.update({ settings, pool, mediaItems: media, context: testContext(beat), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: rev })
    feed(testPool(['img-1', 'img-2'], [], 'pool-a'), 1, 1)
    const swapped = feed(testPool(['svg-1'], ['HELLO'], 'pool-b'), 2, 1.05)
    for (const el of swapped.current!.elements) expect(['media:svg-1', 'text:t0']).toContain(el.itemKey)
    expect(swapped.transition).toBeNull()
  })

  it('bounds preloading: small pools preload all media, large pools only the next picks', () => {
    const many = Array.from({ length: 40 }, (_, i) => testMedia(`m${i}`))
    const runtime = new CutbankRuntime()
    const plan = runtime.update({ settings: testSettings(), pool: testPool(many.map(m => m.id)), mediaItems: many, context: testContext(1), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    expect(plan.preloadMediaIds.length).toBeLessThanOrEqual(10)
    const small = new CutbankRuntime().update({ settings: testSettings(), pool: mixedPool, mediaItems: media, context: testContext(1), dtSec: 0.016, trackIdentity: 'track-a', poolRevision: 1 })
    expect(small.preloadMediaIds.length).toBe(4)
  })

  it('defers a cut until the next composition media is ready, then commits after a bound', () => {
    const settings = testSettings({ cutRate: 1, minimumHold: 0, maximumHold: 0.2, chaos: 0, layoutMode: 'hero', mediaMode: 'images' })
    const runtime = new CutbankRuntime()
    const seen = new Set<number>()
    let now = 0
    for (let f = 0; f < 90; f += 1) {
      const plan = runtime.update({ settings, pool: mixedPool, mediaItems: media, context: testContext(f / 15), dtSec: 1 / 60, trackIdentity: 'track-a', poolRevision: 1, isMediaReady: () => false, nowMs: now })
      seen.add(plan.sequenceIndex)
      now += 100
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('CUTBANK energy and Auto Performance', () => {
  it('quiet passages hold longer and drops cut faster, always inside Min/Max Hold', () => {
    const settings = testSettings({ cutRate: 0.5, minimumHold: 0.1, maximumHold: 0.9, chaos: 0 })
    const quiet = resolveCutbankEnergy(testContext(1, { energy: 0.1, trackRelativeEnergy: 0.1, sectionType: 'breakdown' }), true)
    const drop = resolveCutbankEnergy(testContext(1, { energy: 0.95, trackRelativeEnergy: 0.95, sectionType: 'drop', dropImpact: 1 }), true)
    expect(quiet.tier).toBe('low')
    expect(drop.tier).toBe('high')
    expect(drop.drop).toBe(true)
    const q = resolveCutbankHoldBeats(settings, quiet, 3)
    const d = resolveCutbankHoldBeats(settings, drop, 3)
    expect(q).toBeGreaterThan(d)
    const minB = snapHoldBeats(holdSliderToBeats(0.1))
    const maxB = snapHoldBeats(holdSliderToBeats(0.9))
    for (const h of [q, d]) { expect(h).toBeGreaterThanOrEqual(minB); expect(h).toBeLessThanOrEqual(maxB) }
  })

  it('a drop cuts far more often than a quiet section over the same span', () => {
    const settings = testSettings({ cutRate: 0.6, minimumHold: 0, maximumHold: 1, chaos: 0 })
    const quiet = run(settings, { beats: 64, ctx: { energy: 0.1, trackRelativeEnergy: 0.1, sectionType: 'breakdown' } }).filter(p => p.cutThisFrame).length
    const drop = run(settings, { beats: 64, ctx: { energy: 0.95, trackRelativeEnergy: 0.95, sectionType: 'drop', dropImpact: 1 } }).filter(p => p.cutThisFrame).length
    expect(drop).toBeGreaterThan(quiet * 1.5)
  })

  it('Auto Performance off pins neutral energy so manual settings decide', () => {
    const e = resolveCutbankEnergy(testContext(1, { energy: 1, sectionType: 'drop', dropImpact: 1 }), false)
    expect(e.level).toBe(0.5)
    expect(e.drop).toBe(false)
  })

  it('Auto treatment never exceeds the user ceilings, even on a drop', () => {
    const settings = testSettings({ effectAmount: 0.5, masterIntensity: 0.5, grain: 0.4, threshold: 0.3, distortion: 0.2, signalDamage: 0.2, rgbSplit: 0.2, smear: 0.2, lensWarp: 0.1, feedback: 0.1, flashAmount: 0, treatmentVariety: 1 })
    const drop = resolveCutbankEnergy(testContext(1, { energy: 1, sectionType: 'drop', dropImpact: 1 }), true)
    const hot = { kick: 1, snare: 1, hat: 1, downbeat: 1, bass: 1, high: 1, transient: 1 }
    const clock = resolveCutbankClock(testContext(1), { bpmSync: true, transportTimeSec: 0.5 })
    const scale = 0.5 * cutbankMasterScale(0.5)
    for (let seed = 1; seed < 40; seed += 1) {
      const t = resolveCutbankTreatment({ settings, energy: drop, impulses: hot, transition: null, seed, epoch: seed, clock })
      expect(t.threshold).toBeLessThanOrEqual(0.3 * scale + 1e-9)
      expect(t.distortion).toBeLessThanOrEqual(0.2 * scale + 1e-9)
      expect(t.signal).toBeLessThanOrEqual(0.2 * scale + 1e-9)
      expect(t.rgb).toBeLessThanOrEqual(0.2 * scale + 1e-9)
      expect(t.smear).toBeLessThanOrEqual(0.2 * scale + 1e-9)
      expect(t.lens).toBeLessThanOrEqual(0.1 * scale + 1e-9)
      expect(t.feedback).toBeLessThanOrEqual(0.1 * scale + 1e-9)
      expect(t.grain).toBeLessThanOrEqual(0.4 * scale + 1e-9)
      expect(t.flashWhite).toBe(0)
      expect(t.flashBlack).toBe(0)
    }
  })

  it('Flash Amount above zero can produce a drop-impact flash frame; zero never does', () => {
    const drop = resolveCutbankEnergy(testContext(1, { energy: 1, sectionType: 'drop', dropImpact: 1 }), true)
    const clock = resolveCutbankClock(testContext(1), { bpmSync: true, transportTimeSec: 0.5 })
    const impulses = { ...EMPTY_CUTBANK_IMPULSES, downbeat: 1 }
    let flashes = 0
    for (let seed = 1; seed < 40; seed += 1) {
      const t = resolveCutbankTreatment({ settings: testSettings({ flashAmount: 1, masterIntensity: 1 }), energy: drop, impulses, transition: null, seed, epoch: 1, clock })
      if (t.flashWhite > 0 || t.flashBlack > 0) flashes += 1
    }
    expect(flashes).toBeGreaterThan(0)
  })
})

describe('CUTBANK effects (each control changes the treatment plan)', () => {
  const clock = resolveCutbankClock(testContext(1), { bpmSync: true, transportTimeSec: 0.5 })
  const energy = resolveCutbankEnergy(testContext(1, { energy: 0.6 }), true)
  const plan = (patch: Parameters<typeof testSettings>[0], impulses = { ...EMPTY_CUTBANK_IMPULSES, bass: 0.8, kick: 0.8, snare: 0.8, hat: 0.8, high: 0.8, transient: 0.8 }) =>
    resolveCutbankTreatment({ settings: testSettings({ treatmentMode: 'manual', chaos: 1, ...patch }), energy, impulses, transition: null, seed: 11, epoch: 1, clock })

  it.each([
    ['grain', 'grain'], ['threshold', 'threshold'], ['distortion', 'distortion'], ['signalDamage', 'signal'],
    ['rgbSplit', 'rgb'], ['feedback', 'feedback'], ['lensWarp', 'lens'], ['smear', 'smear'],
  ] as const)('%s drives %s', (setting, field) => {
    const lo = plan({ [setting]: 0, effectAmount: 1, masterIntensity: 1 })
    const hi = plan({ [setting]: 1, effectAmount: 1, masterIntensity: 1 })
    expect(hi[field]).toBeGreaterThan(lo[field])
  })

  it('Effect Amount and Master Intensity scale the ceiling', () => {
    const a = plan({ grain: 1, effectAmount: 0.2, masterIntensity: 1 })
    const b = plan({ grain: 1, effectAmount: 1, masterIntensity: 1 })
    const c = plan({ grain: 1, effectAmount: 1, masterIntensity: 0.1 })
    expect(b.grain).toBeGreaterThan(a.grain)
    expect(b.grain).toBeGreaterThan(c.grain)
  })

  it('Effects Enabled off and Treatment None bypass treatments but keep flashes/transitions', () => {
    const off = plan({ effectsEnabled: false, grain: 1, threshold: 1, effectAmount: 1 })
    const none = plan({ treatmentMode: 'none', grain: 1, threshold: 1, effectAmount: 1 })
    for (const t of [off, none]) {
      expect(t.active).toBe(false)
      expect(t.grain).toBe(0)
      expect(t.threshold).toBe(0)
      expect(t.feedback).toBe(0)
    }
    expect(plan({ effectsEnabled: true, grain: 1, effectAmount: 1 }).active).toBe(true)
  })

  it('Treatment Variety widens the set of eligible families in Auto', () => {
    const families = (variety: number) => {
      const seen = new Set<string>()
      for (let seed = 1; seed < 60; seed += 1) {
        const t = resolveCutbankTreatment({ settings: testSettings({ treatmentMode: 'auto', treatmentVariety: variety }), energy, impulses: EMPTY_CUTBANK_IMPULSES, transition: null, seed, epoch: 0, clock })
        expect(Object.values(t.families).filter(Boolean).length).toBe(1 + Math.round(variety * 3))
        Object.entries(t.families).forEach(([k, v]) => v && seen.add(k))
      }
      return seen.size
    }
    expect(families(0)).toBeGreaterThanOrEqual(1)
    expect(families(1)).toBe(4)
  })
})

describe('CUTBANK palette', () => {
  const clock = (bar: number) => ({ ...resolveCutbankClock(testContext(bar * 4), { bpmSync: true, transportTimeSec: 0 }), bar })
  it('Source / Monochrome / Custom / Auto resolve differently', () => {
    const src = resolveCutbankPalette(testSettings({ paletteMode: 'source' }), clock(0), 1)
    const mono = resolveCutbankPalette(testSettings({ paletteMode: 'monochrome' }), clock(0), 1)
    const custom = resolveCutbankPalette(testSettings({ paletteMode: 'custom', colorizeAmount: 1 }), clock(0), 1)
    expect([src.modeCode, mono.modeCode, custom.modeCode]).toEqual([0, 1, 2])
    expect(mono.sourceAmount).toBe(0)
    expect(custom.colorize).toBe(1)
    const states = new Set(Array.from({ length: 64 }, (_, i) => resolveCutbankPalette(testSettings({ paletteMode: 'auto', colorChangeRate: 1 }), clock(i), 7).label))
    expect(states.size).toBeGreaterThan(2)
  })

  it('Monochrome never restores source color, whatever the source amount', () => {
    for (let bar = 0; bar < 40; bar += 1) {
      const p = resolveCutbankPalette(testSettings({ paletteMode: 'monochrome', sourceColorAmount: 1, colorizeAmount: 1 }), clock(bar), 3)
      expect(p.modeCode).toBe(1)
      expect(p.sourceAmount).toBe(0)
      expect(p.colorize).toBe(0)
    }
  })

  it('Color Change Rate paces Auto palette changes on bar boundaries only', () => {
    expect(autoPaletteBars(0)).toBe(16)
    expect(autoPaletteBars(1)).toBe(1)
    const slow = testSettings({ paletteMode: 'auto', colorChangeRate: 0 })
    const a = resolveCutbankPalette(slow, clock(3), 9)
    const b = resolveCutbankPalette(slow, { ...clock(3), beat: clock(3).beat + 0.9 }, 9)
    expect(a.stateIndex).toBe(b.stateIndex)
    expect(resolveCutbankPalette(slow, clock(16), 9).stateIndex).toBe(1)
  })

  it('maps sliders, tint, invert, and levels into the plan', () => {
    const p = resolveCutbankPalette(testSettings({ saturation: 1, contrast: 1, exposure: 1, blackLevel: 1, whiteLevel: 0, tintColor: '#FF0000', tintAmount: 1, invertColors: true }), clock(0), 1)
    expect(p.saturation).toBe(2)
    expect(p.contrast).toBeGreaterThan(2)
    expect(p.exposureStops).toBeGreaterThan(1)
    expect(p.blackPoint).toBeGreaterThan(0.3)
    expect(p.whitePoint).toBe(0.5)
    expect(p.tint).toEqual([1, 0, 0])
    expect(p.invert).toBe(true)
  })
})

describe('CUTBANK transitions', () => {
  const ctx = testContext(8)
  it('maps every user-facing style onto an existing Canvas transition', () => {
    for (const option of CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS) {
      if (option.value === 'auto') continue
      expect(CUTBANK_TRANSITION_MAP[option.value].canvasId, option.value).toBeTruthy()
    }
    expect(CUTBANK_TRANSITION_MAP.hardCut.canvasId).toBe('hardCut')
    expect(CUTBANK_TRANSITION_MAP.blackCut.canvasId).toBe('dipToBlack')
    expect(CUTBANK_TRANSITION_MAP.whiteFlash.canvasId).toBe('dipToWhite')
    expect(CUTBANK_TRANSITION_MAP.thresholdDissolve.canvasId).toBe('lumaDissolve')
    expect(CUTBANK_TRANSITION_MAP.signalTear.canvasId).toBe('frameTear')
    expect(CUTBANK_TRANSITION_MAP.rgbCut.canvasId).toBe('rgbSplit')
    expect(CUTBANK_TRANSITION_MAP.feedbackSmear.canvasId).toBe('feedbackSmear')
  })

  it('an explicit Transition Style is used; Auto avoids flash styles when Flash Amount is 0', () => {
    const energy = resolveCutbankEnergy(testContext(1, { energy: 1, sectionType: 'drop', dropImpact: 1 }), true)
    expect(resolveCutbankTransitionStyle({ settings: testSettings({ transitionStyle: 'zoomBurst' }), energy, seed: 1, styleSeed: 's' })).toBe('zoomBurst')
    for (let seed = 0; seed < 60; seed += 1) {
      const style = resolveCutbankTransitionStyle({ settings: testSettings({ transitionStyle: 'auto', flashAmount: 0, transitionVariety: 1, chaos: 1 }), energy, seed, styleSeed: `s${seed}` })
      expect(CUTBANK_TRANSITION_MAP[style].usesFlash, style).toBe(false)
    }
  })

  it('Transition Variety widens the Auto vocabulary', () => {
    const energy = resolveCutbankEnergy(testContext(1, { energy: 0.6 }), true)
    const count = (variety: number) => new Set(Array.from({ length: 80 }, (_, i) => resolveCutbankTransitionStyle({ settings: testSettings({ transitionStyle: 'auto', transitionVariety: variety }), energy, seed: i, styleSeed: 'fixed' }))).size
    expect(count(1)).toBeGreaterThan(count(0))
  })

  it('Transition Duration maps to musical divisions when synced and seconds otherwise', () => {
    const short = cutbankTransitionDurationSec({ transitionDuration: 0, bpmSync: true }, ctx, true)
    const long = cutbankTransitionDurationSec({ transitionDuration: 1, bpmSync: true }, ctx, true)
    expect(short).toBeCloseTo(0.5 / 8, 3)
    expect(long).toBeCloseTo(1, 3)
    expect(cutbankTransitionDurationSec({ transitionDuration: 1, bpmSync: false }, ctx, true)).toBeCloseTo(1, 3)
    expect(cutbankTransitionDurationSec({ transitionDuration: 0, bpmSync: false }, ctx, true)).toBeCloseTo(0.05, 3)
  })

  it('Flash Amount 0 turns flash styles into clean cuts; Transition Intensity scales the deviation', () => {
    const flat = startCutbankTransition({ style: 'whiteFlash', context: ctx, durationSec: 0.5, fromIdentity: 'a', toIdentity: 'b', flashAmount: 0 })
    expect(flat?.spec.canvasId).toBe('hardCut')
    const t = startCutbankTransition({ style: 'zoomBurst', context: ctx, durationSec: 1, fromIdentity: 'a', toIdentity: 'b', flashAmount: 1 })!
    const soft = evaluateCutbankTransition(t, t.startTimeSec + 0.5, 0.1)
    const hard = evaluateCutbankTransition(t, t.startTimeSec + 0.5, 1)
    expect(Math.abs(hard.visual.outgoingScale - 1)).toBeGreaterThan(Math.abs(soft.visual.outgoingScale - 1))
    expect(evaluateCutbankTransition(t, t.startTimeSec + 2, 1).complete).toBe(true)
  })

  it('does not start a transition across a seek/loop discontinuity', () => {
    expect(startCutbankTransition({ style: 'signalTear', context: testContext(8, { seekDetected: true }), durationSec: 0.3, fromIdentity: 'a', toIdentity: 'b', flashAmount: 1 })).toBeNull()
  })
})

describe('CUTBANK hygiene', () => {
  it('never uses Math.random or interval/timeout scheduling in its runtime modules', () => {
    const dir = __dirname
    for (const file of readdirSync(dir).filter(name => /^Cutbank.*\.tsx?$/.test(name) && !name.includes('.test.'))) {
      const source = readFileSync(join(dir, file), 'utf8')
      expect(source, file).not.toMatch(/Math\.random\(/)
      expect(source, file).not.toMatch(/setInterval\(|setTimeout\(/)
    }
    const layer = readFileSync(join(dir, 'CanvasCutbankLayer.tsx'), 'utf8')
    expect(layer).not.toMatch(/Math\.random\(|setInterval\(/)
  })
})

import { describe, expect, it } from 'vitest'
import { PRESET_TRANSITION_STYLES } from './presetTransitions'
import {
  STAGE_TRANSITION_FALLBACK_BPM, STAGE_TRANSITION_FLASH_MIN_MS, STAGE_TRANSITION_MAX_MS, STAGE_TRANSITION_MIN_MS,
  drawTransitionFrame, easeInOut, resolveTransitionDurationMs, trustedTransitionBpm, type TransitionContext, type TransitionTempo,
} from './stageTransition'

const tempo = (patch: Partial<TransitionTempo> = {}): TransitionTempo => ({ bpm: 120, confidence: 0.9, source: 'offline_analysis', liveInput: false, ...patch })

describe('transition length follows the tempo', () => {
  it('is a number of beats at a trusted tempo: two beats of a dissolve at 120 BPM is a second', () => {
    expect(resolveTransitionDurationMs('dissolve', tempo({ bpm: 120 }))).toBe(1000)
    expect(resolveTransitionDurationMs('wipe', tempo({ bpm: 120 }))).toBe(500)
    expect(resolveTransitionDurationMs('wipe', tempo({ bpm: 150, source: 'rekordbox' }))).toBe(400)
  })

  it('is clamped, and a flash is never a strobe', () => {
    expect(resolveTransitionDurationMs('dissolve', tempo({ bpm: 40 }))).toBe(STAGE_TRANSITION_MAX_MS)
    expect(resolveTransitionDurationMs('wipe', tempo({ bpm: 220 }))).toBe(Math.max(STAGE_TRANSITION_MIN_MS, Math.round(60000 / 220)))
    expect(resolveTransitionDurationMs('flash', tempo({ bpm: 220 }))).toBe(STAGE_TRANSITION_FLASH_MIN_MS)
  })

  it('uses a fixed length (a beat of 600 ms) when no tempo can be trusted, as with live input that has not found the beat', () => {
    const live = tempo({ source: 'live_analysis', confidence: 0.2, liveInput: true })
    expect(trustedTransitionBpm(live)).toBeNull()
    expect(resolveTransitionDurationMs('wipe', live)).toBe(Math.round(60000 / STAGE_TRANSITION_FALLBACK_BPM))
    expect(resolveTransitionDurationMs('dissolve', live)).toBe(1200)
  })

  it('trusts live input only on real confidence, and a track grid, Rekordbox or a manual tempo much sooner', () => {
    expect(trustedTransitionBpm(tempo({ source: 'live_analysis', confidence: 0.7, liveInput: true, bpm: 128 }))).toBe(128)
    expect(trustedTransitionBpm(tempo({ source: 'live_analysis', confidence: 0.5, liveInput: true }))).toBeNull()
    expect(trustedTransitionBpm(tempo({ source: 'rekordbox', confidence: 0 }))).toBe(120)
    expect(trustedTransitionBpm(tempo({ source: 'manual_override', confidence: 0 }))).toBe(120)
    expect(trustedTransitionBpm(tempo({ source: 'offline_analysis', confidence: 0.1 }))).toBeNull()
  })

  it('falls back to the loaded track\'s tempo, but never for live input, and ignores nonsense tempos', () => {
    expect(trustedTransitionBpm(tempo({ confidence: 0.05, trackBpm: 140 }))).toBe(140)
    expect(trustedTransitionBpm(tempo({ confidence: 0.05, trackBpm: 140, liveInput: true, source: 'live_analysis' }))).toBeNull()
    expect(trustedTransitionBpm(tempo({ bpm: 0, trackBpm: null }))).toBeNull()
    expect(trustedTransitionBpm(tempo({ bpm: 900, source: 'rekordbox' }))).toBeNull()
    expect(trustedTransitionBpm(tempo({ bpm: Number.NaN, source: 'rekordbox' }))).toBeNull()
  })
})

describe('easing', () => {
  it('runs 0 to 1 smoothly and clamps outside', () => {
    expect(easeInOut(0)).toBe(0); expect(easeInOut(1)).toBe(1); expect(easeInOut(0.5)).toBe(0.5)
    expect(easeInOut(-3)).toBe(0); expect(easeInOut(9)).toBe(1)
    expect(easeInOut(0.25)).toBeLessThan(0.25)
  })
})

function recorder() {
  const calls: Array<{ op: string; args: unknown[]; alpha: number }> = []
  const ctx: TransitionContext & { calls: typeof calls } = {
    calls, globalAlpha: 1, fillStyle: '#000',
    save() { calls.push({ op: 'save', args: [], alpha: this.globalAlpha }) }, restore() { calls.push({ op: 'restore', args: [], alpha: this.globalAlpha }) },
    drawImage(image, ...rest) { calls.push({ op: 'draw', args: [image, ...rest], alpha: this.globalAlpha }) },
    fillRect(...args) { calls.push({ op: 'fill', args: [this.fillStyle, ...args], alpha: this.globalAlpha }) },
    beginPath() {}, rect(...args) { calls.push({ op: 'rect', args, alpha: this.globalAlpha }) }, clip() { calls.push({ op: 'clip', args: [], alpha: this.globalAlpha }) },
    translate() {}, scale(...args) { calls.push({ op: 'scale', args, alpha: this.globalAlpha }) },
  }
  return ctx
}
const FROM = { id: 'old' } as unknown as CanvasImageSource
const TO = { id: 'new' } as unknown as CanvasImageSource
const draws = (ctx: ReturnType<typeof recorder>) => ctx.calls.filter(call => call.op === 'draw').map(call => ({ image: (call.args[0] as { id: string }).id, alpha: call.alpha }))

describe('each style draws the blend', () => {
  it('holds the old picture until the new one has a frame', () => {
    for (const style of PRESET_TRANSITION_STYLES) {
      const ctx = recorder(); drawTransitionFrame(ctx, style, 0.5, FROM, null, 100, 50)
      expect(draws(ctx)).toEqual([{ image: 'old', alpha: 1 }])
    }
  })

  it('every style ends on the new picture alone, and starts on the old one', () => {
    for (const style of PRESET_TRANSITION_STYLES) {
      const end = recorder(); drawTransitionFrame(end, style, 1, FROM, TO, 100, 50)
      expect(draws(end)).toEqual([{ image: 'new', alpha: 1 }])
      expect(end.calls.some(call => call.op === 'fill')).toBe(false)
      const start = recorder(); drawTransitionFrame(start, style, 0, FROM, TO, 100, 50)
      const picture = start.calls.filter(call => call.op === 'draw')
      const visibleOld = style === 'flash' || style === 'dip' ? picture[0] : picture[picture.length - 1]
      expect((visibleOld.args[0] as { id: string }).id).toBe('old')
    }
  })

  it('dissolve fades the old picture out over the new one', () => {
    const ctx = recorder(); drawTransitionFrame(ctx, 'dissolve', 0.5, FROM, TO, 100, 50)
    expect(draws(ctx)).toEqual([{ image: 'new', alpha: 1 }, { image: 'old', alpha: 0.5 }])
  })

  it('wipe clips the old picture to the part not yet swept, growing with progress', () => {
    const at = (p: number) => { const ctx = recorder(); drawTransitionFrame(ctx, 'wipe', p, FROM, TO, 100, 50); return ctx.calls.find(call => call.op === 'rect')!.args as number[] }
    expect(at(0.25)[0]).toBeLessThan(at(0.75)[0])
    expect(at(0.5)).toEqual([50, 0, 50, 50])
  })

  it('zoom pushes the old picture in as it fades', () => {
    const at = (p: number) => { const ctx = recorder(); drawTransitionFrame(ctx, 'zoom', p, FROM, TO, 100, 50); return { scale: ctx.calls.find(call => call.op === 'scale')!.args[0] as number, alpha: draws(ctx)[1].alpha } }
    expect(at(0.75).scale).toBeGreaterThan(at(0.25).scale)
    expect(at(0.75).alpha).toBeLessThan(at(0.25).alpha)
    expect(at(0.5).scale).toBeCloseTo(1.175)
  })

  it('flash covers the change with white that peaks below full strength, then clears', () => {
    const alphaAt = (p: number) => { const ctx = recorder(); drawTransitionFrame(ctx, 'flash', p, FROM, TO, 100, 50); const f = ctx.calls.find(call => call.op === 'fill')!; return { color: f.args[0], alpha: f.alpha, image: draws(ctx)[0].image } }
    expect(alphaAt(0.25)).toEqual({ color: '#ffffff', alpha: 0.85, image: 'new' })
    expect(alphaAt(0.1).image).toBe('old')
    expect(alphaAt(0.9).alpha).toBeLessThan(alphaAt(0.4).alpha)
    for (let p = 0; p < 1; p += 0.05) expect(alphaAt(p).alpha).toBeLessThanOrEqual(0.85)
  })

  it('dip goes down to black on the old picture and up from black on the new one', () => {
    const at = (p: number) => { const ctx = recorder(); drawTransitionFrame(ctx, 'dip', p, FROM, TO, 100, 50); const f = ctx.calls.find(call => call.op === 'fill')!; return { image: draws(ctx)[0].image, black: f.alpha } }
    expect(at(0.25).image).toBe('old'); expect(at(0.75).image).toBe('new')
    expect(at(0.499).black).toBeGreaterThan(0.95); expect(at(0.501).black).toBeGreaterThan(0.95)
    expect(at(0.1).black).toBeLessThan(at(0.4).black); expect(at(0.9).black).toBeLessThan(at(0.6).black)
  })
})


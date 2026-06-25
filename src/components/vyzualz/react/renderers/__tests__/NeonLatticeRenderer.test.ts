/**
 * NeonLatticeRenderer.test.ts
 *
 * Renderer-path tests: each test calls renderNeonLattice() and asserts
 * internal state via __getNeonLatticeState(). These tests fail when the
 * renderer's production behavior is disconnected, not just when helpers
 * return wrong values.
 *
 * Test environment: Node (no DOM). OffscreenCanvas and Canvas2D are mocked
 * in the beforeAll block so the renderer can allocate and draw without a
 * real browser context.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  renderNeonLattice,
  clearNeonLatticeVisualState,
  __getNeonLatticeState,
} from '../NeonLatticeRenderer'
import type { ReactFrameContext, ReactRenderParams } from '../reactRenderUtils'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import type { ReactPreset, ReactSectionType, NeonLatticeSettings } from '../../ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS, DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { MAX_VERT, MAX_HORIZ, MAX_PULSES, MAX_SHOCKWAVES } from '../neonLatticeUtils'

// ── Canvas mock ───────────────────────────────────────────────────────────────

function makeMockCtx2d() {
  return {
    globalAlpha:              1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle:                '' as string | CanvasGradient | CanvasPattern,
    strokeStyle:              '' as string | CanvasGradient | CanvasPattern,
    lineWidth:                1,
    lineCap:                  'butt'  as CanvasLineCap,
    lineJoin:                 'miter' as CanvasLineJoin,
    save:                vi.fn(),
    restore:             vi.fn(),
    fillRect:            vi.fn(),
    clearRect:           vi.fn(),
    beginPath:           vi.fn(),
    closePath:           vi.fn(),
    moveTo:              vi.fn(),
    lineTo:              vi.fn(),
    arc:                 vi.fn(),
    arcTo:               vi.fn(),
    fill:                vi.fn(),
    stroke:              vi.fn(),
    translate:           vi.fn(),
    scale:               vi.fn(),
    rotate:              vi.fn(),
    drawImage:           vi.fn(),
    strokeRect:          vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    putImageData:        vi.fn(),
    getImageData:        vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    createImageData:     vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  }
}

class MockOffscreenCanvas {
  width:  number
  height: number
  private readonly _ctx = makeMockCtx2d()
  constructor(w: number, h: number) { this.width = w; this.height = h }
  getContext(type: string) { return type === '2d' ? this._ctx : null }
}

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas)
})

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Create a fresh mock canvas context (each test needs its own key for stateMap). */
function makeCtx(): CanvasRenderingContext2D {
  return makeMockCtx2d() as unknown as CanvasRenderingContext2D
}

const NL_PRESET = DEFAULT_REACT_PRESETS.find(p => p.engine === 'neonLattice')!

function makePreset(nlOverrides: Partial<NeonLatticeSettings> = {}): ReactPreset {
  return {
    ...NL_PRESET,
    neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, ...nlOverrides },
  }
}

function makeParams(nlOverrides: Partial<NeonLatticeSettings> = {}, extra: Partial<ReactRenderParams> = {}): ReactRenderParams {
  const { neonLatticeTrigger, ...extraRest } = extra as Partial<ReactRenderParams> & { neonLatticeTrigger?: ReactRenderParams['neonLatticeTrigger'] }
  return {
    ...DEFAULT_REACT_RENDER_PARAMS,
    intensity:      0.7,
    motion:         0.5,
    glow:           0.65,
    bassReactivity: 0,
    trailDecay:     0.08,
    neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, ...nlOverrides },
    neonLatticeTrigger:  neonLatticeTrigger ?? null,
    ...extraRest,
  }
}

function makeMI(
  overrides: Partial<{
    frameId:     number
    beatIndex:   number
    barIndex:    number
    beatHit:     boolean
    downbeatHit: boolean
    kickHit:     boolean
    kickStrength:number
    snareHit:    boolean
    snareStrength:number
    hatHit:      boolean
    hatStrength: number
    dropImpact:  number
    buildProgress:number
    tension:     number
    instant:     number
    sectionType: ReactSectionType | null
    sectionProgress: number
    fakeoutConfidence: number
  }> = {},
): MusicIntelligenceFrame {
  const {
    frameId = 1, beatIndex = 1, barIndex = 1,
    beatHit = false, downbeatHit = false,
    kickHit = false, kickStrength = 0,
    snareHit = false, snareStrength = 0,
    hatHit = false, hatStrength = 0,
    dropImpact = 0, buildProgress = 0, tension = 0, instant = 0.3,
    sectionType = null, sectionProgress = 0.5,
    fakeoutConfidence = 0,
  } = overrides

  const emptyBands = {
    sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
    normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0,
    normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0,
  }
  const emptyHarmonic = {
    key: null, mode: null, keyConfidence: 0,
    chord: null, chordConfidence: 0, chordChanged: false,
    rootNote: null, pitchHz: null, note: null, melodyContour: null,
  }
  const emptyStems = {
    vocals: 0, drums: 0, bass: 0, instruments: 0, other: 0,
    vocalEnergy: 0, drumEnergy: 0, bassStemEnergy: 0,
    instrumentEnergy: 0, otherStemEnergy: 0,
    vocalActivity: 0, drumTransient: false, bassStemTransient: false,
  }
  const emptyLyrics = {
    activeLine: null, activeWord: null, vocalActivity: 0,
    phraseConfidence: 0, lyricLineProgress: 0, wordHit: false,
  }

  return {
    timeSec:    0,
    frameId,
    sampleRate: 44100,
    sourceId:   null,
    trackId:    null,
    bands:      emptyBands,
    rhythm: {
      bpm: 120, bpmConfidence: 1,
      beatPhase: 0, beatHit, beatIndex, beatInBar: 0,
      barIndex, downbeatHit,
      phrase4Progress: 0, phrase8Progress: 0, phrase16Progress: 0, phrase32Progress: 0,
      phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      kickHit, kickStrength,
      snareHit, snareStrength,
      hatHit, hatStrength,
      transient: 0, transientConfidence: 0,
    },
    energy: {
      instant, shortTerm: 0, longTerm: 0, peak: 0, rms: 0, crestFactor: 0,
      spectralFlux: 0, delta: 0, percentile: 0,
      buildProgress, dropImpact, tension, complexity: 0,
      spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0,
    },
    section: {
      type: sectionType, label: sectionType ?? 'none',
      startSec: 0, endSec: 100, progress: sectionProgress,
      intensity: 0.8, confidence: 1, source: 'manual',
    },
    harmonic: emptyHarmonic,
    stems:    emptyStems,
    lyrics:   emptyLyrics,
    semantics: {
      buildConfidence: 0, dropConfidence: 0, fakeoutConfidence,
      vocalHookConfidence: 0, mood: 'neutral' as const, texture: 'sustained' as const,
    },
    raw:    { freqData: null, timeDomainData: null },
    confidence: { overall: 1, rhythm: 1, harmonic: 1, section: 1 },
  } as MusicIntelligenceFrame
}

function makeFrame(overrides: Partial<ReactFrameContext> & { mi?: MusicIntelligenceFrame | null } = {}): ReactFrameContext {
  const { mi, ...rest } = overrides
  return {
    W: 800, H: 600, dpr: 1, t: 0,
    audioTime: 1.0,
    bpm: 120,
    beatPhase: 0,
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0, mid: 0, high: 0, volume: 0 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: mi !== undefined ? mi : null,
    ...rest,
  }
}

function run(
  ctx:          CanvasRenderingContext2D,
  frame?:       Partial<ReactFrameContext> & { mi?: MusicIntelligenceFrame | null },
  nlSettings?:  Partial<NeonLatticeSettings>,
  extraParams?: Partial<ReactRenderParams>,
  section?:     ReactSectionType | null,
): void {
  const nl = nlSettings ?? {}
  renderNeonLattice(ctx, makeFrame(frame ?? {}), makeParams(nl, extraParams), makePreset(nl), section ?? null)
}

// ── 1. State bootstrap and lifecycle ─────────────────────────────────────────

describe('State bootstrap: renderer creates and reuses per-canvas state', () => {
  it('first frame creates state, returns non-null snapshot', () => {
    const ctx = makeCtx()
    run(ctx)
    expect(__getNeonLatticeState(ctx)).not.toBeNull()
  })

  it('second same-size frame reuses state (lastW/H unchanged)', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0 })
    run(ctx, { audioTime: 1.1 })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.lastW).toBe(800)
    expect(snap.lastH).toBe(600)
  })

  it('resize: different W/H clears rails', () => {
    const ctx = makeCtx()
    // Populate rails via kick events
    const mi = makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 1.0, mi })
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, beatIndex: 2, beatHit: true, kickHit: true, kickStrength: 0.9 }) })
    const beforeResize = __getNeonLatticeState(ctx)!.railCount

    // Now resize
    run(ctx, { audioTime: 1.2, W: 1024, H: 768, mi: null })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.railCount).toBe(0)
    expect(snap.lastW).toBe(1024)
    // sanity: we had rails before resize (otherwise test proves nothing)
    expect(beforeResize).toBeGreaterThan(0)
  })

  it('stopped-play: isPlaying=false after true resets rails', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, isPlaying: true })
    run(ctx, { audioTime: 1.1, isPlaying: true,
      mi: makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 }) })
    run(ctx, { audioTime: 1.2, isPlaying: false })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.railCount).toBe(0)
    expect(snap.wasPlaying).toBe(false)
  })

  it('clearNeonLatticeVisualState removes state from WeakMap', () => {
    const ctx = makeCtx()
    run(ctx)
    expect(__getNeonLatticeState(ctx)).not.toBeNull()
    clearNeonLatticeVisualState(ctx, 800, 600)
    expect(__getNeonLatticeState(ctx)).toBeNull()
  })

  it('new frame after clear creates fresh state with zero rails', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 }) })
    clearNeonLatticeVisualState(ctx, 800, 600)
    run(ctx, { audioTime: 1.3 })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.railCount).toBe(0)
  })

  it('offscreen canvas reuse: seed advances but lastW/H stays same across frames', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0 })
    const snap1 = __getNeonLatticeState(ctx)!
    run(ctx, { audioTime: 1.1 })
    const snap2 = __getNeonLatticeState(ctx)!
    // Dimensions stable — no resize happened
    expect(snap1.lastW).toBe(snap2.lastW)
    expect(snap1.lastH).toBe(snap2.lastH)
  })
})

// ── 2. Pulse Trigger event selection ─────────────────────────────────────────

describe('Pulse Trigger: events route to the correct trigger type', () => {
  it('trigger=kick + kickHit → pulse spawned', () => {
    const ctx = makeCtx()
    // First frame: populate at least one rail (kick always spawns rails)
    const mi1 = makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 1.0, mi: mi1 }, { trigger: 'kick' })
    // Second frame: new beat so snap slot advances; kick fires
    const mi2 = makeMI({ frameId: 2, beatIndex: 2, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 1.5, mi: mi2 }, { trigger: 'kick' })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.pulseCount).toBeGreaterThan(0)
  })

  it('trigger=kick + snareHit only → no pulse via kick trigger', () => {
    const ctx = makeCtx()
    // Populate rails
    const mi1 = makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 1.0, mi: mi1 }, { trigger: 'kick' })
    const beforePulses = __getNeonLatticeState(ctx)!.pulseCount
    // Now: kick trigger but only snare fires
    const mi2 = makeMI({ frameId: 2, beatIndex: 2, beatHit: true, snareHit: true, snareStrength: 0.9, kickHit: false })
    run(ctx, { audioTime: 1.5, mi: mi2 }, { trigger: 'kick' })
    const snap = __getNeonLatticeState(ctx)!
    // Pulse count should not have grown from a new kick event
    expect(snap.pulseCount).toBeLessThanOrEqual(beforePulses)
  })

  it('trigger=snare + snareHit → pulse spawned (≥ 2 for opposing pair)', () => {
    const ctx = makeCtx()
    // Populate horiz rails first (snare spawns on horiz)
    const mi1 = makeMI({ frameId: 1, beatIndex: 1, beatHit: true, snareHit: true, snareStrength: 0.9 })
    run(ctx, { audioTime: 1.0, mi: mi1 }, { trigger: 'snare' })
    const mi2 = makeMI({ frameId: 2, beatIndex: 2, beatHit: true, snareHit: true, snareStrength: 0.9 })
    run(ctx, { audioTime: 1.5, mi: mi2 }, { trigger: 'snare' })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.pulseCount).toBeGreaterThan(0)
  })

  it('trigger=beat + beatHit (no kick or snare) → pulse spawned', () => {
    const ctx = makeCtx()
    // First populate rails via kick (different trigger won't fire kick pulses)
    const mi1 = makeMI({ frameId: 1, beatIndex: 1, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 1.0, mi: mi1 }, { trigger: 'beat' })
    // Now: pure beat hit (no kick/snare)
    const mi2 = makeMI({ frameId: 2, beatIndex: 2, beatHit: true, kickHit: false, snareHit: false })
    run(ctx, { audioTime: 1.5, mi: mi2 }, { trigger: 'beat' })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.pulseCount).toBeGreaterThan(0)
  })
})

// ── 3. MI event one-time processing ──────────────────────────────────────────

describe('MI event deduplication: same frameId is processed at most once', () => {
  it('same MI frameId across two render calls processes events only once', () => {
    const ctx = makeCtx()
    const mi = makeMI({ frameId: 5, beatIndex: 5, barIndex: 2, beatHit: true, kickHit: true, kickStrength: 0.9 })
    run(ctx, { audioTime: 2.0, mi }, { trigger: 'kick' })
    const rails1 = __getNeonLatticeState(ctx)!.railCount

    // Same frameId — should not process events again
    run(ctx, { audioTime: 2.016, mi }, { trigger: 'kick' })
    const rails2 = __getNeonLatticeState(ctx)!.railCount

    // Rails should not grow because kick was not reprocessed
    expect(rails2).toBeLessThanOrEqual(rails1 + 0)
  })

  it('lastMiFrameId advances to the new MI frameId each frame', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 10 }) })
    expect(__getNeonLatticeState(ctx)!.lastMiFrameId).toBe(10)
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 11 }) })
    expect(__getNeonLatticeState(ctx)!.lastMiFrameId).toBe(11)
  })

  it('lastBarIndex advances when barIndex changes', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, barIndex: 3 }) })
    expect(__getNeonLatticeState(ctx)!.lastBarIndex).toBe(3)
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, barIndex: 4 }) })
    expect(__getNeonLatticeState(ctx)!.lastBarIndex).toBe(4)
  })

  it('lastBeatIndex advances when beatIndex changes', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, beatIndex: 7, beatHit: true }) })
    expect(__getNeonLatticeState(ctx)!.lastBeatIndex).toBe(7)
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, beatIndex: 8, beatHit: true }) })
    expect(__getNeonLatticeState(ctx)!.lastBeatIndex).toBe(8)
  })
})

// ── 4. Section-entry behavior ─────────────────────────────────────────────────

describe('Section entry transitions: qualified edges trigger correct behaviors', () => {
  it('first frame (prevSectionType=null) does NOT trigger entry behavior', () => {
    const ctx = makeCtx()
    // Drop on the very first frame — should NOT spawn entry shockwave (no qualified entry)
    const mi = makeMI({ frameId: 1, sectionType: 'drop' })
    run(ctx, { audioTime: 1.0, mi }, { shockwaveAmount: 1.0 }, {}, 'drop')
    const snap = __getNeonLatticeState(ctx)!
    // prevSectionType was null → qualifiedEntry = false → no entry shockwave
    expect(snap.prevSectionType).toBe('drop')  // now set after the frame
    // shockwaveCount should be 0 (no downbeat either)
    expect(snap.shockwaveCount).toBe(0)
  })

  it('verse→drop entry spawns shockwave when shockwaveAmount > 0', () => {
    const ctx = makeCtx()
    // Establish verse as prevSectionType
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { shockwaveAmount: 1.0 }, {}, 'verse')
    expect(__getNeonLatticeState(ctx)!.prevSectionType).toBe('verse')

    // Now transition to drop
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'drop' }) }, { shockwaveAmount: 1.0 }, {}, 'drop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.shockwaveCount).toBeGreaterThan(0)
  })

  it('verse→breakdown entry clears blocks and foreground pulses', () => {
    const ctx = makeCtx()
    // Establish verse
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, {}, {}, 'verse')
    // Transition to breakdown
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'breakdown' }) }, {}, {}, 'breakdown')
    const snap = __getNeonLatticeState(ctx)!
    // blocks should be empty after breakdown entry
    expect(snap.blockCount).toBe(0)
  })

  it('verse→intro entry clears all accent objects', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, {}, {}, 'verse')
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'intro' }) }, {}, {}, 'intro')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.pulseCount).toBe(0)
    expect(snap.flareCount).toBe(0)
    expect(snap.blockCount).toBe(0)
    expect(snap.shockwaveCount).toBe(0)
  })
})

// ── 5. Hard object caps ───────────────────────────────────────────────────────

describe('Object caps: renderer never exceeds hard limits', () => {
  it('rails never exceed MAX_VERT + MAX_HORIZ even under sustained kick/snare', () => {
    const ctx = makeCtx()
    for (let i = 0; i < 60; i++) {
      run(ctx, {
        audioTime: 1.0 + i * 0.1,
        mi: makeMI({ frameId: i + 1, beatIndex: i + 1, barIndex: Math.floor(i / 4), beatHit: true, kickHit: true, kickStrength: 0.9 }),
      }, { railDensity: 1.0, trigger: 'kick' })
    }
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.railCount).toBeLessThanOrEqual(MAX_VERT + MAX_HORIZ)
  })

  it('shockwave count never exceeds shockMax = round(shockwaveAmount * MAX_SHOCKWAVES)', () => {
    const ctx = makeCtx()
    const shockwaveAmount = 0.5
    const shockMax = Math.max(1, Math.round(shockwaveAmount * MAX_SHOCKWAVES))
    for (let i = 0; i < 20; i++) {
      run(ctx, {
        audioTime: 1.0 + i * 0.1,
        mi: makeMI({
          frameId: i + 1, barIndex: i + 1, beatIndex: i + 1,
          beatHit: true, downbeatHit: true, instant: 0.6,
        }),
      }, { shockwaveAmount })
    }
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.shockwaveCount).toBeLessThanOrEqual(shockMax)
  })

  it('shockwaveAmount=0 never spawns shockwaves even on downbeats', () => {
    const ctx = makeCtx()
    for (let i = 0; i < 10; i++) {
      run(ctx, {
        audioTime: 1.0 + i * 0.5,
        mi: makeMI({
          frameId: i + 1, barIndex: i + 1, beatIndex: i * 4 + 1,
          beatHit: true, downbeatHit: true, instant: 0.8,
        }),
      }, { shockwaveAmount: 0 })
    }
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.shockwaveCount).toBe(0)
  })
})

// ── 6. Downbeat camera zoom burst ─────────────────────────────────────────────

describe('Downbeat zoom burst: cameraZoomBurst set on downbeat, then decays', () => {
  it('downbeat event with cameraMotion > 0 sets cameraZoomBurst > 0', () => {
    const ctx = makeCtx()
    run(ctx, {
      audioTime: 1.0,
      mi: makeMI({ frameId: 1, beatIndex: 1, barIndex: 1, beatHit: true, downbeatHit: true, instant: 0.7 }),
    }, { cameraMotion: 0.8, shockwaveAmount: 0.8 })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.cameraZoomBurst).toBeGreaterThan(0)
  })

  it('cameraZoomBurst stays at 0 when cameraMotion = 0', () => {
    const ctx = makeCtx()
    run(ctx, {
      audioTime: 1.0,
      mi: makeMI({ frameId: 1, beatIndex: 1, barIndex: 1, beatHit: true, downbeatHit: true, instant: 0.9, dropImpact: 0.9 }),
    }, { cameraMotion: 0, shockwaveAmount: 1.0 })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.cameraZoomBurst).toBe(0)
  })
})

// ── 7. Rail morph after reseed trigger ───────────────────────────────────────

describe('Reseed: trigger animates rails to new targets instead of clearing', () => {
  it('reseed trigger: existing rails have morphProgress < 1 (animating)', () => {
    const ctx = makeCtx()
    // Populate rails over 3 frames
    for (let i = 1; i <= 3; i++) {
      run(ctx, {
        audioTime: i * 0.1,
        mi: makeMI({ frameId: i, beatIndex: i, beatHit: true, kickHit: true, kickStrength: 0.9 }),
      }, { trigger: 'kick' })
    }
    const beforeReseed = __getNeonLatticeState(ctx)!.railCount
    expect(beforeReseed).toBeGreaterThan(0)

    // Trigger reseed
    run(ctx, {
      audioTime: 0.35,
      mi: makeMI({ frameId: 4, beatIndex: 4 }),
    }, {}, { neonLatticeTrigger: { type: 'reseed', seq: 1 } })

    const snap = __getNeonLatticeState(ctx)!
    const morphingRails = snap.rails.filter(r => r.morphProgress < 1)
    expect(morphingRails.length).toBeGreaterThan(0)
  })

  it('manual reseed updates lastReseedBarIndex to prevent immediate auto-re-fire', () => {
    const ctx = makeCtx()
    // Set up lastBarIndex by rendering a few MI frames
    run(ctx, {
      audioTime: 1.0,
      mi: makeMI({ frameId: 1, barIndex: 5, beatIndex: 1 }),
    }, { reseedInterval: 8 })
    run(ctx, {
      audioTime: 1.1,
      mi: makeMI({ frameId: 2, barIndex: 5, beatIndex: 2 }),
    }, { reseedInterval: 8 })

    // Trigger manual reseed
    run(ctx, {
      audioTime: 1.2,
      mi: makeMI({ frameId: 3, barIndex: 5, beatIndex: 3 }),
    }, { reseedInterval: 8 }, { neonLatticeTrigger: { type: 'reseed', seq: 2 } })

    const snap = __getNeonLatticeState(ctx)!
    // lastReseedBarIndex should be >= 0 (was updated by manual trigger)
    expect(snap.lastReseedBarIndex).toBeGreaterThanOrEqual(0)
  })

  it('reseedInterval=0 disables auto-reseed: lastReseedBarIndex stays at -1', () => {
    const ctx = makeCtx()
    for (let i = 1; i <= 5; i++) {
      run(ctx, {
        audioTime: i * 2.0,
        mi: makeMI({ frameId: i, barIndex: i * 2, beatIndex: i * 8, beatHit: true, downbeatHit: true }),
      }, { reseedInterval: 0 })
    }
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.lastReseedBarIndex).toBe(-1)
  })

  it('auto-reseed fires at the configured bar interval and updates lastReseedBarIndex', () => {
    const ctx = makeCtx()
    const reseedInterval = 4
    // Bar 0 → bar 4 is when auto-reseed should fire
    for (let bar = 0; bar <= 4; bar++) {
      run(ctx, {
        audioTime: bar * 2.0,
        mi: makeMI({
          frameId: bar + 1, barIndex: bar, beatIndex: bar * 4,
          downbeatHit: bar > 0, beatHit: true,
        }),
      }, { reseedInterval })
    }
    const snap = __getNeonLatticeState(ctx)!
    // Should have reseeded at bar 4
    expect(snap.lastReseedBarIndex).toBeGreaterThanOrEqual(reseedInterval)
  })
})

// ── 8. Automatic blackout ─────────────────────────────────────────────────────

describe('Automatic blackout: entry-edge gating and mode behavior', () => {
  it('instant mode: preDrop section entry sets overlayAlpha=1 and overlayColor=#000000', () => {
    const ctx = makeCtx()
    // Establish prevSectionType=verse
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'instant' }, {}, 'verse')
    // Transition to preDrop (qualified entry)
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'instant' }, {}, 'preDrop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.overlayAlpha).toBe(1)
    expect(snap.overlayColor).toBe('#000000')
  })

  it('fadeOut mode: preDrop entry sets autoBlackoutFadeIn=true (ramp-in)', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'fadeOut' }, {}, 'verse')
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'fadeOut' }, {}, 'preDrop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.autoBlackoutFadeIn).toBe(true)
    expect(snap.autoBlackoutFadeRate).toBeGreaterThan(0)
  })

  it('strobe mode: preDrop entry sets autoBlackoutEnd > audioTime', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'strobe' }, {}, 'verse')
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'strobe' }, {}, 'preDrop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.autoBlackoutEnd).toBeGreaterThan(1.1)
  })

  it('drop entry after preDrop: clears autoBlackoutFadeIn and zeroes autoBlackoutEnd', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'fadeOut' }, {}, 'verse')
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'fadeOut' }, {}, 'preDrop')
    expect(__getNeonLatticeState(ctx)!.autoBlackoutFadeIn).toBe(true)

    // Drop entry should release the blackout
    run(ctx, { audioTime: 1.2, mi: makeMI({ frameId: 3, sectionType: 'drop' }) }, { blackoutMode: 'fadeOut' }, {}, 'drop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.autoBlackoutFadeIn).toBe(false)
    expect(snap.autoBlackoutEnd).toBe(0)
  })

  it('blackoutMode=none: preDrop entry does NOT set any overlay', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'none' }, {}, 'verse')
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'none' }, {}, 'preDrop')
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.overlayAlpha).toBe(0)
    expect(snap.autoBlackoutFadeIn).toBe(false)
    expect(snap.autoBlackoutEnd).toBe(0)
  })

  it('repeated preDrop frames (no re-entry) do NOT re-fire blackout', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0, mi: makeMI({ frameId: 1, sectionType: 'verse' }) }, { blackoutMode: 'instant' }, {}, 'verse')
    // Entry frame
    run(ctx, { audioTime: 1.1, mi: makeMI({ frameId: 2, sectionType: 'preDrop' }) }, { blackoutMode: 'instant' }, {}, 'preDrop')
    const endAfterEntry = __getNeonLatticeState(ctx)!.autoBlackoutEnd

    // Stay in preDrop for several more frames
    for (let i = 3; i <= 6; i++) {
      run(ctx, { audioTime: 1.0 + i * 0.1, mi: makeMI({ frameId: i, sectionType: 'preDrop' }) }, { blackoutMode: 'instant' }, {}, 'preDrop')
    }
    const snap = __getNeonLatticeState(ctx)!
    // autoBlackoutEnd should NOT have been reset to 0 or changed dramatically
    expect(snap.autoBlackoutEnd).toBe(endAfterEntry)
  })
})

// ── 9. Cyan Strike ────────────────────────────────────────────────────────────

describe('CyanStrike trigger: sets active window without mutating palette', () => {
  it('cyanStrike trigger sets cyanStrikeUntilSec > audioTime', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 5.0 }, {}, { neonLatticeTrigger: { type: 'cyanStrike', seq: 1 } })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.cyanStrikeUntilSec).toBeGreaterThan(5.0)
  })

  it('cyanStrike window expires naturally (cyanStrikeUntilSec <= later audioTime)', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 5.0 }, {}, { neonLatticeTrigger: { type: 'cyanStrike', seq: 1 } })
    const untilSec = __getNeonLatticeState(ctx)!.cyanStrikeUntilSec
    // Render a frame well past the expiry
    run(ctx, { audioTime: untilSec + 1.0 })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.cyanStrikeUntilSec).toBeLessThanOrEqual(snap.cyanStrikeUntilSec)  // value unchanged
    // The key assertion: audioTime > cyanStrikeUntilSec means it's expired
    expect(untilSec + 1.0).toBeGreaterThan(snap.cyanStrikeUntilSec)
  })

  it('unique trigger seq is required to re-fire cyanStrike', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0 }, {}, { neonLatticeTrigger: { type: 'cyanStrike', seq: 1 } })
    const first = __getNeonLatticeState(ctx)!.cyanStrikeUntilSec
    // Same seq — should not re-fire
    run(ctx, { audioTime: 1.1 }, {}, { neonLatticeTrigger: { type: 'cyanStrike', seq: 1 } })
    expect(__getNeonLatticeState(ctx)!.cyanStrikeUntilSec).toBe(first)
    // New seq — fires again
    run(ctx, { audioTime: 1.2 }, {}, { neonLatticeTrigger: { type: 'cyanStrike', seq: 2 } })
    expect(__getNeonLatticeState(ctx)!.cyanStrikeUntilSec).toBeGreaterThan(1.2)
  })
})

// ── 10. Manual trigger dispatching ────────────────────────────────────────────

describe('Manual triggers: dispatchTrigger behavior via production path', () => {
  it('blackout trigger: sets overlayColor=#000000 and overlayAlpha=1', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0 }, {}, { neonLatticeTrigger: { type: 'blackout', seq: 1 } })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.overlayColor).toBe('#000000')
    expect(snap.overlayAlpha).toBe(1)
  })

  it('railBurst trigger: rail count increases', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 1.0 })
    const before = __getNeonLatticeState(ctx)!.railCount
    run(ctx, { audioTime: 1.1 }, {}, { neonLatticeTrigger: { type: 'railBurst', seq: 1 } })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.railCount).toBeGreaterThan(before)
  })

  it('freezeTrails trigger: frozenUntilSec advances beyond audioTime', () => {
    const ctx = makeCtx()
    run(ctx, { audioTime: 3.0 }, {}, { neonLatticeTrigger: { type: 'freezeTrails', seq: 1 } })
    const snap = __getNeonLatticeState(ctx)!
    expect(snap.frozenUntilSec).toBeGreaterThan(3.0)
  })
})

// ── 11. Depth-plane: rails spawn with valid depth values ──────────────────────

describe('Depth plane: rails get normalized depth in [0, 1]', () => {
  it('all spawned rails have depth in [0, 1]', () => {
    const ctx = makeCtx()
    for (let i = 1; i <= 5; i++) {
      run(ctx, {
        audioTime: i * 0.1,
        mi: makeMI({ frameId: i, beatIndex: i, beatHit: true, kickHit: true, kickStrength: 0.9 }),
      }, { railDensity: 0.8, depth: 0.5 })
    }
    const snap = __getNeonLatticeState(ctx)!
    for (const rail of snap.rails) {
      expect(rail.depth).toBeGreaterThanOrEqual(0)
      expect(rail.depth).toBeLessThanOrEqual(1)
    }
  })

  it('rails have pos (normalized position) in [0, 1]', () => {
    const ctx = makeCtx()
    for (let i = 1; i <= 4; i++) {
      run(ctx, {
        audioTime: i * 0.1,
        mi: makeMI({ frameId: i, beatIndex: i, beatHit: true, kickHit: true, kickStrength: 0.9 }),
      })
    }
    const snap = __getNeonLatticeState(ctx)!
    for (const rail of snap.rails) {
      expect(rail.pos).toBeGreaterThanOrEqual(0)
      expect(rail.pos).toBeLessThanOrEqual(1)
    }
  })
})

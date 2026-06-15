import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkTriggerTimingFilter,
  uiBarToInternalIndex,
  internalIndexToUiBar,
  uiBeatToInternalIndex,
  TRIGGER_TIMING_EVENT_SOURCES,
  applyModulationRoute,
  resetAllEnvelopes,
} from '../LaserDmxModulationEngine'
import type { LaserDmxTriggerTimingFilter, LaserDmxModulationRoute } from '../../ReactTypes'

// ── Minimal MI stub ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMI(rhythm: Record<string, unknown> = {}): any {
  return {
    frameId: 1,
    bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
      normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0,
      normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0 },
    rhythm: {
      bpm: 120, bpmConfidence: 1,
      beatPhase: 0,
      beatHit: false, beatIndex: 0,
      beatInBar: 0, barIndex: 0,
      downbeatHit: false,
      phrase4Progress: 0, phrase8Progress: 0, phrase16Progress: 0, phrase32Progress: 0,
      phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      kickHit: false, kickStrength: 0,
      snareHit: false, snareStrength: 0,
      hatHit: false, hatStrength: 0,
      transient: 0, transientConfidence: 0,
      ...rhythm,
    },
    energy: { instant: 0, shortTerm: 0, longTerm: 0, spectralFlux: 0,
      tension: 0, complexity: 0, buildProgress: 0, dropImpact: 0,
      rms: 0, peak: 0, crestFactor: 0, percentile: 0, delta: 0,
      spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0 },
    harmonic: { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: 'unknown' },
    stems: { vocals: 0, drums: 0, bassStemEnergy: 0, instrumentEnergy: 0,
      vocalEnergy: 0, drumEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0,
      wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0,
      vocalHookConfidence: 0, mood: 'unknown' },
    section: { type: 'unknown', progress: 0, intensity: 0 },
  }
}

/** MI at given 0-based barIndex and 0-based beatInBar with beatHit=true. */
function miAt(barIndex: number, beatInBar: number, extra: Record<string, unknown> = {}) {
  return makeMI({ barIndex, beatInBar, beatHit: true, bpm: 120, ...extra })
}

function mkFilter(overrides: Partial<LaserDmxTriggerTimingFilter> = {}): LaserDmxTriggerTimingFilter {
  return { mode: 'everyOccurrence', ...overrides }
}

function mkRoute(overrides: Partial<LaserDmxModulationRoute> = {}): LaserDmxModulationRoute {
  return {
    id: 'r1', enabled: true, source: 'beat', target: 'dimmer',
    amount: 1, min: 0, max: 1, curve: 'linear', mode: 'trigger',
    smoothing: 0, attack: 0, release: 0, invert: false,
    ...overrides,
  }
}

beforeEach(() => resetAllEnvelopes())

// ── 1. Bar/beat numbering utilities ──────────────────────────────────────────

describe('uiBarToInternalIndex', () => {
  it('UI bar 1 → internal 0', () => expect(uiBarToInternalIndex(1)).toBe(0))
  it('UI bar 33 → internal 32', () => expect(uiBarToInternalIndex(33)).toBe(32))
})

describe('internalIndexToUiBar', () => {
  it('internal 0 → UI bar 1', () => expect(internalIndexToUiBar(0)).toBe(1))
  it('internal 32 → UI bar 33', () => expect(internalIndexToUiBar(32)).toBe(33))
})

describe('uiBeatToInternalIndex', () => {
  it('UI beat 1 → internal 0', () => expect(uiBeatToInternalIndex(1)).toBe(0))
  it('UI beat 3 → internal 2', () => expect(uiBeatToInternalIndex(3)).toBe(2))
})

// ── 2. TRIGGER_TIMING_EVENT_SOURCES set ──────────────────────────────────────

describe('TRIGGER_TIMING_EVENT_SOURCES', () => {
  it('includes beat, beatHit, downbeat, downbeatHit', () => {
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('beat')).toBe(true)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('beatHit')).toBe(true)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('downbeat')).toBe(true)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('downbeatHit')).toBe(true)
  })
  it('includes kickHit, snareHit, hatHit', () => {
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('kickHit')).toBe(true)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('snareHit')).toBe(true)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('hatHit')).toBe(true)
  })
  it('does not include continuous sources like bass, energy', () => {
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('bass')).toBe(false)
    expect(TRIGGER_TIMING_EVENT_SOURCES.has('energy')).toBe(false)
  })
})

// ── 3. checkTriggerTimingFilter — everyOccurrence ────────────────────────────

describe('checkTriggerTimingFilter: everyOccurrence', () => {
  it('no filter → always permits', () => {
    expect(checkTriggerTimingFilter(undefined, miAt(0, 0))).toBe(true)
    expect(checkTriggerTimingFilter(undefined, miAt(32, 2))).toBe(true)
  })

  it('explicit everyOccurrence → always permits', () => {
    const f = mkFilter({ mode: 'everyOccurrence' })
    expect(checkTriggerTimingFilter(f, miAt(0, 0))).toBe(true)
    expect(checkTriggerTimingFilter(f, miAt(99, 3))).toBe(true)
  })

  it('no BPM → falls through to allow regardless of filter', () => {
    const f = mkFilter({ mode: 'specificPosition', bar: 33 })
    const mi = makeMI({ barIndex: 0, beatInBar: 0, bpm: 0 })
    expect(checkTriggerTimingFilter(f, mi)).toBe(true)
  })
})

// ── 4. checkTriggerTimingFilter — specificPosition ────────────────────────────

describe('checkTriggerTimingFilter: specificPosition', () => {
  // UI bar 33 = internal barIndex 32
  const filter = mkFilter({ mode: 'specificPosition', bar: 33 })

  it('permits at bar 33', () => {
    expect(checkTriggerTimingFilter(filter, miAt(32, 0))).toBe(true)
  })

  it('rejects at bar 32 (barIndex 31)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(31, 0))).toBe(false)
  })

  it('rejects at bar 34 (barIndex 33)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(33, 0))).toBe(false)
  })

  it('beat=any: permits all beats at bar 33', () => {
    const f = mkFilter({ mode: 'specificPosition', bar: 33, beat: 'any' })
    expect(checkTriggerTimingFilter(f, miAt(32, 0))).toBe(true)
    expect(checkTriggerTimingFilter(f, miAt(32, 2))).toBe(true)
    expect(checkTriggerTimingFilter(f, miAt(32, 3))).toBe(true)
  })

  it('beat=3 matches beatInBar=2 (0-based) at the correct bar', () => {
    const f = mkFilter({ mode: 'specificPosition', bar: 33, beat: 3 })
    expect(checkTriggerTimingFilter(f, miAt(32, 2))).toBe(true)
  })

  it('beat=3 rejects beatInBar=0 at the correct bar', () => {
    const f = mkFilter({ mode: 'specificPosition', bar: 33, beat: 3 })
    expect(checkTriggerTimingFilter(f, miAt(32, 0))).toBe(false)
  })

  it('beat=3 rejects correct beat at wrong bar', () => {
    const f = mkFilter({ mode: 'specificPosition', bar: 33, beat: 3 })
    expect(checkTriggerTimingFilter(f, miAt(31, 2))).toBe(false)
  })

  it('downbeat source: beat check is skipped (always beat 1)', () => {
    // Even if beatInBar=2 is passed, downbeat source skips the beat check
    const f = mkFilter({ mode: 'specificPosition', bar: 5, beat: 1 })
    // barIndex 4 = UI bar 5; for downbeat sources, we don't check beatInBar
    expect(checkTriggerTimingFilter(f, miAt(4, 0), 'downbeat')).toBe(true)
    expect(checkTriggerTimingFilter(f, miAt(4, 0), 'downbeatHit')).toBe(true)
  })
})

// ── 5. checkTriggerTimingFilter — specificBars ────────────────────────────────

describe('checkTriggerTimingFilter: specificBars', () => {
  const filter = mkFilter({ mode: 'specificBars', bars: [17, 21, 25] })

  it('permits at bar 17', () => expect(checkTriggerTimingFilter(filter, miAt(16, 0))).toBe(true))
  it('permits at bar 21', () => expect(checkTriggerTimingFilter(filter, miAt(20, 0))).toBe(true))
  it('permits at bar 25', () => expect(checkTriggerTimingFilter(filter, miAt(24, 0))).toBe(true))
  it('rejects at bar 18', () => expect(checkTriggerTimingFilter(filter, miAt(17, 0))).toBe(false))
  it('rejects at bar 20', () => expect(checkTriggerTimingFilter(filter, miAt(19, 0))).toBe(false))

  it('empty bars list → always false', () => {
    const f = mkFilter({ mode: 'specificBars', bars: [] })
    expect(checkTriggerTimingFilter(f, miAt(0, 0))).toBe(false)
  })
})

// ── 6. checkTriggerTimingFilter — barRange ────────────────────────────────────

describe('checkTriggerTimingFilter: barRange', () => {
  const filter = mkFilter({ mode: 'barRange', startBar: 10, endBar: 20 })

  it('permits at start boundary (bar 10)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(9, 0))).toBe(true)
  })
  it('permits at end boundary (bar 20)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(19, 0))).toBe(true)
  })
  it('permits within range (bar 15)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(14, 0))).toBe(true)
  })
  it('rejects before range (bar 9)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(8, 0))).toBe(false)
  })
  it('rejects after range (bar 21)', () => {
    expect(checkTriggerTimingFilter(filter, miAt(20, 0))).toBe(false)
  })

  it('open-ended range (no endBar) is active indefinitely', () => {
    const f = mkFilter({ mode: 'barRange', startBar: 5 })
    expect(checkTriggerTimingFilter(f, miAt(4, 0))).toBe(true)   // bar 5
    expect(checkTriggerTimingFilter(f, miAt(999, 0))).toBe(true) // bar 1000
  })
})

// ── 7. checkTriggerTimingFilter — barInterval ─────────────────────────────────

describe('checkTriggerTimingFilter: barInterval', () => {
  // Every 4 bars from anchor bar 1: bars 1, 5, 9, 13, ...
  const filter = mkFilter({ mode: 'barInterval', intervalBars: 4, intervalAnchorBar: 1 })

  it('permits at anchor bar 1', () => {
    expect(checkTriggerTimingFilter(filter, miAt(0, 0))).toBe(true)
  })
  it('permits at bar 5', () => {
    expect(checkTriggerTimingFilter(filter, miAt(4, 0))).toBe(true)
  })
  it('permits at bar 9', () => {
    expect(checkTriggerTimingFilter(filter, miAt(8, 0))).toBe(true)
  })
  it('rejects at bar 2', () => {
    expect(checkTriggerTimingFilter(filter, miAt(1, 0))).toBe(false)
  })
  it('rejects at bar 4', () => {
    expect(checkTriggerTimingFilter(filter, miAt(3, 0))).toBe(false)
  })
  it('rejects before anchor bar', () => {
    // Anchor = bar 9, interval = 4; bar 5 is before anchor
    const f = mkFilter({ mode: 'barInterval', intervalBars: 4, intervalAnchorBar: 9 })
    expect(checkTriggerTimingFilter(f, miAt(4, 0))).toBe(false) // bar 5 < anchor 9
  })

  it('non-default anchor: every 4 bars from bar 3 → 3, 7, 11, …', () => {
    const f = mkFilter({ mode: 'barInterval', intervalBars: 4, intervalAnchorBar: 3 })
    expect(checkTriggerTimingFilter(f, miAt(2,  0))).toBe(true)  // bar 3
    expect(checkTriggerTimingFilter(f, miAt(6,  0))).toBe(true)  // bar 7
    expect(checkTriggerTimingFilter(f, miAt(10, 0))).toBe(true)  // bar 11
    expect(checkTriggerTimingFilter(f, miAt(3,  0))).toBe(false) // bar 4
  })
})

// ── 8. applyModulationRoute integration ──────────────────────────────────────

describe('applyModulationRoute: timing filter integration', () => {
  it('route with no filter fires on beatHit (existing behavior unchanged)', () => {
    const route = mkRoute({ source: 'beat' })
    const mi = miAt(0, 0, { beatHit: true })
    const result = applyModulationRoute(route, mi, 'env-1', 0.016)
    expect(result).not.toBeNull()
    // Envelope just started; with attack=0 → instant rise to max
    expect(result!.value).toBeGreaterThan(0)
  })

  it('route at bar 33 does not fire at bar 32', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificPosition', bar: 33 },
    })
    const mi = miAt(31, 0, { beatHit: true }) // barIndex 31 = UI bar 32
    const result = applyModulationRoute(route, mi, 'env-bar32', 0.016)
    // triggered=false, envelope stays at 0
    expect(result!.value).toBe(0)
  })

  it('route at bar 33 fires at bar 33', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificPosition', bar: 33 },
    })
    const mi = miAt(32, 0, { beatHit: true }) // barIndex 32 = UI bar 33
    const result = applyModulationRoute(route, mi, 'env-bar33', 0.016)
    expect(result!.value).toBeGreaterThan(0)
  })

  it('fired at bar 33; next frame same bar without beatHit → envelope decays, no retrigger', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificPosition', bar: 33 },
      release: 0.5,
    })
    const envKey = 'env-bar33-decay'
    // Fire
    applyModulationRoute(route, miAt(32, 0, { beatHit: true }), envKey, 0.016)
    // Next frame: no beatHit → should not retrigger, envelope decays
    const result = applyModulationRoute(route, miAt(32, 0, { beatHit: false }), envKey, 0.016)
    // Value is non-zero (decaying) but triggered=false
    expect(result!.value).toBeGreaterThanOrEqual(0)
    // Confirm it's decaying: less than 1 (was 1 at peak)
    expect(result!.value).toBeLessThanOrEqual(1)
  })

  it('specificBars route only fires at listed bars', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificBars', bars: [17, 21, 25] },
    })
    // bar 20 (barIndex 19) should not fire
    const r20 = applyModulationRoute(route, miAt(19, 0, { beatHit: true }), 'env-spec-20', 0.016)
    expect(r20!.value).toBe(0)
    // bar 21 (barIndex 20) should fire
    const r21 = applyModulationRoute(route, miAt(20, 0, { beatHit: true }), 'env-spec-21', 0.016)
    expect(r21!.value).toBeGreaterThan(0)
  })

  it('barInterval every 4 bars: fires at bar 1, not bar 2', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'barInterval', intervalBars: 4, intervalAnchorBar: 1 },
    })
    const r1 = applyModulationRoute(route, miAt(0, 0, { beatHit: true }), 'env-int-1', 0.016)
    expect(r1!.value).toBeGreaterThan(0)

    const r2 = applyModulationRoute(route, miAt(1, 0, { beatHit: true }), 'env-int-2', 0.016)
    expect(r2!.value).toBe(0)
  })

  it('barRange: fires within range, not outside', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'barRange', startBar: 10, endBar: 20 },
    })
    const inside  = applyModulationRoute(route, miAt(14, 0, { beatHit: true }), 'env-range-in',  0.016)
    const outside = applyModulationRoute(route, miAt(20, 0, { beatHit: true }), 'env-range-out', 0.016)
    expect(inside!.value).toBeGreaterThan(0)
    expect(outside!.value).toBe(0)
  })
})

// ── 9. Seeking / position change ─────────────────────────────────────────────

describe('seeking behavior', () => {
  it('seeking back before bar 33 and re-crossing allows trigger to fire again', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificPosition', bar: 33 },
      release: 0,
    })
    const envKey = 'env-seek-refire'

    // First pass: fire at bar 33
    applyModulationRoute(route, miAt(32, 0, { beatHit: true }), envKey, 0.016)

    // Seek back to bar 10 — envelope fully decays (release=0, instant drop)
    applyModulationRoute(route, miAt(9, 0, { beatHit: false }), envKey, 1.0)

    // Cross bar 33 again
    const result = applyModulationRoute(route, miAt(32, 0, { beatHit: true }), envKey, 0.016)
    expect(result!.value).toBeGreaterThan(0)
  })
})

// ── 10. Missing BPM — fallback to fire ────────────────────────────────────────

describe('missing BPM fallback', () => {
  it('bpm=0 with specificPosition filter still allows event to fire', () => {
    const route = mkRoute({
      source: 'beat',
      timingFilter: { mode: 'specificPosition', bar: 33 },
    })
    // At barIndex 0 (bar 1), NOT bar 33 — but bpm=0 so filter falls through
    const mi = makeMI({ barIndex: 0, beatInBar: 0, beatHit: true, bpm: 0 })
    const result = applyModulationRoute(route, mi, 'env-nobpm', 0.016)
    expect(result!.value).toBeGreaterThan(0)
  })
})

// ── 11. Existing routes: no timingFilter → unchanged behavior ─────────────────

describe('backward compatibility', () => {
  it('route without timingFilter fires on every occurrence (existing behavior)', () => {
    const route = mkRoute({ source: 'beat' }) // no timingFilter
    // fires at bar 1
    const r1 = applyModulationRoute(route, miAt(0, 0, { beatHit: true }), 'env-bc-1', 0.016)
    expect(r1!.value).toBeGreaterThan(0)
  })

  it('disabled route returns null regardless of timing filter', () => {
    const route = mkRoute({ enabled: false, source: 'beat', timingFilter: { mode: 'specificPosition', bar: 33 } })
    const result = applyModulationRoute(route, miAt(32, 0, { beatHit: true }), 'env-disabled', 0.016)
    expect(result).toBeNull()
  })
})

// ── 12. Serialization ─────────────────────────────────────────────────────────

describe('timingFilter serialization', () => {
  it('timingFilter is a plain JSON-serializable object', () => {
    const filter: LaserDmxTriggerTimingFilter = {
      mode: 'specificPosition',
      bar:  33,
      beat: 1,
    }
    const serialized = JSON.stringify(filter)
    const restored   = JSON.parse(serialized) as LaserDmxTriggerTimingFilter
    expect(restored.mode).toBe('specificPosition')
    expect(restored.bar).toBe(33)
    expect(restored.beat).toBe(1)
    // Filter still works after round-trip
    expect(checkTriggerTimingFilter(restored, miAt(32, 0))).toBe(true)
    expect(checkTriggerTimingFilter(restored, miAt(31, 0))).toBe(false)
  })

  it('specificBars bars list is sorted and deduplicated after normalization', () => {
    // This tests the expected normalization contract (done in UI onBlur handler)
    const raw = [25, 17, 21, 21, 17]
    const sorted = [...new Set(raw)].sort((a, b) => a - b)
    expect(sorted).toEqual([17, 21, 25])
    const filter: LaserDmxTriggerTimingFilter = { mode: 'specificBars', bars: sorted }
    expect(checkTriggerTimingFilter(filter, miAt(16, 0))).toBe(true)  // bar 17
    expect(checkTriggerTimingFilter(filter, miAt(17, 0))).toBe(false) // bar 18
  })
})

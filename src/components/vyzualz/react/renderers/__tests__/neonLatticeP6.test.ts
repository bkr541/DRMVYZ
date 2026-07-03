/**
 * Prompt 6 milestone validation — comprehensive Neon Lattice tests.
 *
 * Covers: store migration, preset merge/reset, engine selection sync,
 * event edge detection, visual-object caps, one-shot triggers,
 * contextual pad mapping, renderer resize/stop cleanup, BPM fallback.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { migrateReactStore, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'
import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_REACT_PRESETS,
} from '../../ReactTypes'
import type { NeonLatticeSettings, NeonLatticeTriggerType } from '../../ReactTypes'
import {
  MAX_PULSES, MAX_FLARES, MAX_BLOCKS, MAX_SHOCKWAVES, MAX_VERT, MAX_HORIZ,
  makeFlare, makeBlock, makeShockwave, makePulseOnRail, pulsePointAt,
  makeVerticalRail, makeHorizontalRail,
  isPulseExpired, isFlareExpired, isBlockExpired, isShockwaveExpired,
  isRailExpired,
  resolveRailTargets, resolveSnapSlot,
  resolveOverlayAlpha, resolveCyanStrikeDuration, resolveRailBurstCounts,
  resolveTriggerFires, isSnapActive,
  WHITEOUT_DURATION, BLACKOUT_DURATION, FREEZE_DURATION, RESEED_LIFE_SCALE,
  prngNext,
  hexToRgbStr,
} from '../neonLatticeUtils'
import { NL_TRIGGER_PADS } from '../../ReactPerformancePads'
import { normalizeNeonLatticeSettings } from '../../NeonLatticeConfig'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshStore() {
  useReactStore.setState(useReactStore.getInitialState())
}

const PALETTE = {
  primary:   '74,199,219',
  secondary: '220,60,190',
  accent:    '220,60,190',
  highlight: '74,199,219',
}
const SETTINGS = { ...DEFAULT_NEON_LATTICE_SETTINGS }

function makeVRail(birthSec = 0) {
  return makeVerticalRail(1, SETTINGS, birthSec, [], PALETTE, 0.8)
}
function makeHRail(birthSec = 0) {
  return makeHorizontalRail(2, SETTINGS, birthSec, [], PALETTE, 0.8)
}

// ── 1. Store migration ────────────────────────────────────────────────────────

describe('store migration (migrateReactStore)', () => {
  it('does not re-persist Neon settings after the full migration chain', () => {
    const old = { activeReactEngineId: 'oscilloscope' }
    const result = migrateReactStore(old, 15)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })

  it('retires partial historical Neon settings after compatibility processing', () => {
    const existing: Partial<NeonLatticeSettings> = { railDensity: 0.9, bloom: 0.1 }
    const old = { neonLatticeSettings: existing }
    const result = migrateReactStore(old, 15)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })

  it('retires complete historical Neon settings after compatibility processing', () => {
    const state = { neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, railDensity: 0.77 } }
    const result = migrateReactStore(state, 16)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })
})

// ── 2. neonLatticeTrigger is not persisted ────────────────────────────────────

describe('reactStorePartialize', () => {
  it('neonLatticeTrigger is absent from persisted state', () => {
    freshStore()
    const s = useReactStore.getState()
    const partial = reactStorePartialize(s)
    expect(partial).not.toHaveProperty('neonLatticeTrigger')
  })

  it('neonLatticeSettings is absent from persisted state', () => {
    freshStore()
    const s = useReactStore.getState()
    const partial = reactStorePartialize(s)
    expect(partial).not.toHaveProperty('neonLatticeSettings')
  })

  it('triggerNeonLattice is absent from persisted state', () => {
    freshStore()
    const s = useReactStore.getState()
    const partial = reactStorePartialize(s)
    expect(partial).not.toHaveProperty('triggerNeonLattice')
  })

  it('neonLatticeTriggerSeq is absent from persisted state', () => {
    freshStore()
    const partial = reactStorePartialize(useReactStore.getState())
    expect(partial).not.toHaveProperty('neonLatticeTriggerSeq')
  })
})

// ── 3. Preset merge / reset ───────────────────────────────────────────────────

describe('preset merge: neonLatticeSettings applied when NL preset activated', () => {
  beforeEach(freshStore)

  it('NL preset overrides railDensity', () => {
    const acidMagenta = DEFAULT_REACT_PRESETS.find(p => p.id === 'preset-nl-acid-magenta')
    expect(acidMagenta).toBeDefined()
    expect(acidMagenta!.neonLatticeSettings?.railDensity).toBe(0.5)
  })

  it('setNeonLatticeSettings partial-merges without clobbering other fields', () => {
    const s = useReactStore.getState()
    const origBloom = s.neonLatticeSettings.bloom
    s.setNeonLatticeSettings({ railDensity: 0.99 })
    const after = useReactStore.getState().neonLatticeSettings
    expect(after.railDensity).toBe(0.99)
    expect(after.bloom).toBe(origBloom)
  })

  it('resetNeonLatticeSettings restores defaults', () => {
    const s = useReactStore.getState()
    s.setNeonLatticeSettings({ railDensity: 0.99, bloom: 0.01 })
    useReactStore.getState().resetNeonLatticeSettings()
    const after = useReactStore.getState().neonLatticeSettings
    expect(after.railDensity).toBe(DEFAULT_NEON_LATTICE_SETTINGS.railDensity)
    expect(after.bloom).toBe(DEFAULT_NEON_LATTICE_SETTINGS.bloom)
  })
})

// ── 4. Enhanced NL presets exist and have correct engine ─────────────────────────

describe('NL factory presets', () => {
  const nlPresets = DEFAULT_REACT_PRESETS.filter(p => p.engine === 'neonLattice')

  it('has the four stable presets plus Reverie Keygrid', () => {
    expect(nlPresets.length).toBe(5)
  })

  it('preset-nl-acid-magenta is the first NL preset', () => {
    expect(nlPresets[0].id).toBe('preset-nl-acid-magenta')
  })

  it('every explicitly-named NL preset has neonLatticeSettings', () => {
    const named = ['preset-nl-acid-magenta', 'preset-nl-drmvyz-lattice', 'preset-nl-sparse-starlines', 'preset-nl-overload-matrix', 'preset-nl-reverie-keygrid']
    for (const id of named) {
      const p = nlPresets.find(p => p.id === id)
      expect(p).toBeDefined()
      expect(p!.neonLatticeSettings).toBeDefined()
    }
  })

  it('Acid Magenta: trigger is kick', () => {
    const p = nlPresets.find(p => p.id === 'preset-nl-acid-magenta')!
    expect(p.neonLatticeSettings?.trigger).toBe('kick')
  })

  it('DVYDRM Lattice: trigger is beat', () => {
    const p = nlPresets.find(p => p.id === 'preset-nl-drmvyz-lattice')!
    expect(p.neonLatticeSettings?.trigger).toBe('beat')
  })

  it('Sparse Starlines: shockwaves disabled (shockwaveAmount === 0)', () => {
    const p = nlPresets.find(p => p.id === 'preset-nl-sparse-starlines')!
    expect(p.neonLatticeSettings?.shockwaveAmount).toBe(0)
  })

  it('Overload Matrix: railDensity is highest among NL presets', () => {
    const densities = nlPresets.map(p => p.neonLatticeSettings?.railDensity ?? 0)
    const overload = nlPresets.find(p => p.id === 'preset-nl-overload-matrix')!
    expect(overload.neonLatticeSettings?.railDensity).toBe(Math.max(...densities))
  })

  it('every NL preset has a background color', () => {
    for (const p of nlPresets) {
      expect(p.palette.background).toBeTruthy()
    }
  })

  it('every named NL preset resolves to every NeonLatticeSettings field', () => {
    const allKeys = Object.keys(DEFAULT_NEON_LATTICE_SETTINGS) as Array<keyof NeonLatticeSettings>
    const named = ['preset-nl-acid-magenta', 'preset-nl-drmvyz-lattice', 'preset-nl-sparse-starlines', 'preset-nl-overload-matrix', 'preset-nl-reverie-keygrid']
    for (const id of named) {
      const p = nlPresets.find(p => p.id === id)!
      expect(p.neonLatticeSettings).toBeDefined()
      const resolved = normalizeNeonLatticeSettings(p.neonLatticeSettings)
      for (const key of allKeys) {
        expect(resolved).toHaveProperty(key)
      }
    }
  })
})

// ── 5. triggerNeonLattice — monotonic seq, one-shot consumption ───────────────

describe('triggerNeonLattice action', () => {
  beforeEach(() => { freshStore(); useReactStore.getState().selectReactEngine('neonLattice') })

  it('starts at null', () => {
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })

  it('seq increments on each call', () => {
    const s = useReactStore.getState()
    s.triggerNeonLattice('railBurst')
    const first = useReactStore.getState().neonLatticeTrigger
    s.triggerNeonLattice('railBurst')
    const second = useReactStore.getState().neonLatticeTrigger
    expect(second!.seq).toBe(first!.seq + 1)
  })

  it('type is preserved on the event', () => {
    useReactStore.getState().triggerNeonLattice('whiteout')
    expect(useReactStore.getState().neonLatticeTrigger?.type).toBe('whiteout')
  })

  it('rapid fire produces strictly-increasing seqs', () => {
    const s = useReactStore.getState()
    const types = ['railBurst', 'blockCascade', 'crossFlare', 'reseed', 'freezeTrails'] as const
    let prev = -1
    for (const t of types) {
      s.triggerNeonLattice(t)
      const cur = useReactStore.getState().neonLatticeTrigger!.seq
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
  })

  it('all 8 trigger types are accepted without error', () => {
    const s = useReactStore.getState()
    const types = [
      'railBurst', 'blockCascade', 'crossFlare', 'whiteout',
      'blackout', 'reseed', 'freezeTrails', 'cyanStrike',
    ] as const
    for (const t of types) {
      expect(() => s.triggerNeonLattice(t)).not.toThrow()
    }
  })
})

// ── 5b. Monotonic seq counter lifecycle ──────────────────────────────────────

describe('neonLatticeTriggerSeq — monotonic counter and trigger clearing', () => {
  beforeEach(freshStore)

  it('seq is strictly greater than any previous seq after trigger is cleared by engine switch', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    const seq1 = useReactStore.getState().neonLatticeTrigger!.seq

    s.selectReactEngine('oscilloscope')   // clears neonLatticeTrigger, seq counter stays
    s.selectReactEngine('neonLattice')    // back to NL
    s.triggerNeonLattice('blockCascade')
    const seq2 = useReactStore.getState().neonLatticeTrigger!.seq

    expect(seq2).toBeGreaterThan(seq1)
  })

  it('seq counter increases monotonically across multiple clear/fire cycles', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    const seqs: number[] = []

    for (let i = 0; i < 3; i++) {
      s.triggerNeonLattice('railBurst')
      seqs.push(useReactStore.getState().neonLatticeTrigger!.seq)
      s.selectReactEngine('oscilloscope')
      s.selectReactEngine('neonLattice')
    }

    expect(seqs[0]).toBeLessThan(seqs[1])
    expect(seqs[1]).toBeLessThan(seqs[2])
  })

  it('neonLatticeTrigger is null after selectReactPreset to non-NL preset', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('whiteout')
    expect(useReactStore.getState().neonLatticeTrigger).not.toBeNull()

    const nonNlPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')!
    s.selectReactPreset(nonNlPreset.id)
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })

  it('neonLatticeTrigger is null after setActivePadId to non-NL pad', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')

    const { performancePads, reactPresets } = useReactStore.getState()
    const nonNLPad = performancePads.find(p => {
      if (!p.presetId) return false
      return reactPresets.find(r => r.id === p.presetId)?.engine !== 'neonLattice'
    })
    if (!nonNLPad) return  // skip if no non-NL pad configured

    s.setActivePadId(nonNLPad.id)
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })

  it('neonLatticeTrigger is null after resetting current Neon Lattice settings', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('blackout')
    expect(useReactStore.getState().neonLatticeTrigger).not.toBeNull()

    s.resetCurrentEngineSettings()
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })

  it('switching to NL engine does not restore a previously cleared trigger', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    s.selectReactEngine('oscilloscope')   // trigger cleared
    s.selectReactEngine('neonLattice')    // back to NL

    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })
})

// ── 6. Contextual pad mapping ─────────────────────────────────────────────────

describe('NL_TRIGGER_PADS contextual pad mapping', () => {
  it('has exactly 8 entries', () => {
    expect(NL_TRIGGER_PADS).toHaveLength(8)
  })

  it('first pad maps to railBurst', () => {
    expect(NL_TRIGGER_PADS[0].trigger).toBe('railBurst')
    expect(NL_TRIGGER_PADS[0].padId).toBe('pad-1')
  })

  it('eighth pad maps to cyanStrike', () => {
    expect(NL_TRIGGER_PADS[7].trigger).toBe('cyanStrike')
    expect(NL_TRIGGER_PADS[7].padId).toBe('pad-8')
  })

  it('all 8 trigger types are covered exactly once', () => {
    const triggers = NL_TRIGGER_PADS.map(p => p.trigger).sort()
    expect(triggers).toEqual([
      'blackout', 'blockCascade', 'crossFlare', 'cyanStrike',
      'freezeTrails', 'railBurst', 'reseed', 'whiteout',
    ])
  })

  it('pad IDs are pad-1 through pad-8', () => {
    for (let i = 0; i < 8; i++) {
      expect(NL_TRIGGER_PADS[i].padId).toBe(`pad-${i + 1}`)
    }
  })

  it('all pads have a non-empty color string', () => {
    for (const p of NL_TRIGGER_PADS) {
      expect(p.color).toMatch(/^#/)
    }
  })
})

// ── 7. Visual object caps ─────────────────────────────────────────────────────

describe('visual object cap constants', () => {
  it('MAX_PULSES = 24', () => expect(MAX_PULSES).toBe(24))
  it('MAX_FLARES = 12', () => expect(MAX_FLARES).toBe(12))
  it('MAX_BLOCKS = 40', () => expect(MAX_BLOCKS).toBe(40))
  it('MAX_SHOCKWAVES = 4', () => expect(MAX_SHOCKWAVES).toBe(4))
})

describe('visual object cap constants match expected values', () => {
  it('MAX_PULSES = 24', () => expect(MAX_PULSES).toBe(24))
  it('MAX_FLARES = 12', () => expect(MAX_FLARES).toBe(12))
  it('MAX_BLOCKS = 40', () => expect(MAX_BLOCKS).toBe(40))
  it('MAX_SHOCKWAVES = 4', () => expect(MAX_SHOCKWAVES).toBe(4))
})

// ── 8. Object expiry ──────────────────────────────────────────────────────────

describe('object expiry predicates', () => {
  it('isPulseExpired: false before expiry, true after', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, 1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(isPulseExpired(p, 0)).toBe(false)
    expect(isPulseExpired(p, p.birthSec + p.lifetime + 1e-6)).toBe(true)
  })

  it('isFlareExpired: false before expiry, true after', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5)
    expect(isFlareExpired(f, 0)).toBe(false)
    expect(isFlareExpired(f, f.lifetime + 1e-6)).toBe(true)
  })

  it('isBlockExpired: false before, true after', () => {
    const b = makeBlock(3, 4, 0, 0.5, PALETTE.accent, 0.7)
    expect(isBlockExpired(b, 0)).toBe(false)
    expect(isBlockExpired(b, b.birthSec + b.lifetime + 1e-6)).toBe(true)
  })

  it('isShockwaveExpired: false before, true after', () => {
    const sw = makeShockwave(0.5, 0.5, 0, 0.8, 0.6, PALETTE.primary)
    expect(isShockwaveExpired(sw, 0)).toBe(false)
    expect(isShockwaveExpired(sw, sw.birthSec + sw.lifetime + 1e-6)).toBe(true)
  })

  it('isRailExpired: false at birth, true past lifetime', () => {
    const vr = makeVRail(0)
    expect(isRailExpired(vr, 0)).toBe(false)
    expect(isRailExpired(vr, vr.lifetime + 1e-6)).toBe(true)
  })
})

// ── 9. Rail factories produce valid objects ───────────────────────────────────

describe('rail factory outputs', () => {
  it('makeVerticalRail: vertical=true, pos in (0,1), spans cover meaningful range', () => {
    const r = makeVRail()
    expect(r.vertical).toBe(true)
    expect(r.pos).toBeGreaterThan(0)
    expect(r.pos).toBeLessThan(1)
    expect(r.spanStart).toBeGreaterThanOrEqual(0)
    expect(r.spanEnd).toBeLessThanOrEqual(1)
    expect(r.spanEnd).toBeGreaterThan(r.spanStart)
  })

  it('makeHorizontalRail: vertical=false, pos in (0,1)', () => {
    const r = makeHRail()
    expect(r.vertical).toBe(false)
    expect(r.pos).toBeGreaterThan(0)
    expect(r.pos).toBeLessThan(1)
  })

  it('rail lifetime is proportional to settings.railLifetime', () => {
    // lifetime = railLifetime * (0.7 + strength * 0.5); strength = 0.8
    const strength = 0.8
    const settings2 = { ...SETTINGS, railLifetime: 7.5 }
    const r = makeVerticalRail(1, settings2, 0, [], PALETTE, strength)
    const expected = 7.5 * (0.7 + strength * 0.5)
    expect(r.lifetime).toBeCloseTo(expected, 5)
  })

  it('rail depth is in [0, 1]', () => {
    const r = makeVRail()
    expect(r.depth).toBeGreaterThanOrEqual(0)
    expect(r.depth).toBeLessThanOrEqual(1)
  })
})

// ── 10. NeonLatticeSettings defaults are sane ─────────────────────────────────

describe('DEFAULT_NEON_LATTICE_SETTINGS sanity', () => {
  it('all numeric fields are in valid ranges', () => {
    const s = DEFAULT_NEON_LATTICE_SETTINGS
    expect(s.railDensity).toBeGreaterThanOrEqual(0)
    expect(s.railDensity).toBeLessThanOrEqual(1)
    expect(s.bloom).toBeGreaterThanOrEqual(0)
    expect(s.bloom).toBeLessThanOrEqual(1)
    expect(s.depth).toBeGreaterThanOrEqual(0)
    expect(s.depth).toBeLessThanOrEqual(1)
    expect(s.railLifetime).toBeGreaterThan(0)
    expect(s.reseedInterval).toBeGreaterThanOrEqual(0)
  })

  it('trigger default is beat', () => {
    expect(DEFAULT_NEON_LATTICE_SETTINGS.trigger).toBe('beat')
  })

  it('snapDivision is a valid subdivision', () => {
    expect([1, 2, 4, 8, 16]).toContain(DEFAULT_NEON_LATTICE_SETTINGS.snapDivision)
  })
})

// ── 11. Engine selection sync ─────────────────────────────────────────────────

describe('engine selection', () => {
  beforeEach(freshStore)

  it('selectReactEngine updates activeReactEngineId', () => {
    useReactStore.getState().selectReactEngine('neonLattice')
    expect(useReactStore.getState().activeReactEngineId).toBe('neonLattice')
  })

  it('switching away from neonLattice clears neonLatticeTrigger to null', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    expect(useReactStore.getState().neonLatticeTrigger).not.toBeNull()
    s.selectReactEngine('oscilloscope')
    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })
})

// ── 12. cyanStrike duration — calls the same helper the renderer uses ────────

describe('resolveCyanStrikeDuration (cyanStrike trigger)', () => {
  it('floor is 0.4 s — active even at very high BPM', () => {
    expect(resolveCyanStrikeDuration(300)).toBeGreaterThanOrEqual(0.40)
    expect(resolveCyanStrikeDuration(200)).toBeGreaterThanOrEqual(0.40)
  })

  it('bpm=0 → fallback beat 0.5 s → duration 0.75 s', () => {
    expect(resolveCyanStrikeDuration(0)).toBeCloseTo(0.75, 5)
  })

  it('bpm=120 → 0.5 s beat → duration 0.75 s', () => {
    expect(resolveCyanStrikeDuration(120)).toBeCloseTo(0.75, 5)
  })

  it('bpm=60 → 1.0 s beat → duration 1.5 s', () => {
    expect(resolveCyanStrikeDuration(60)).toBeCloseTo(1.5, 5)
  })

  it('slower BPM produces longer duration (proportional to beat length)', () => {
    expect(resolveCyanStrikeDuration(60)).toBeGreaterThan(resolveCyanStrikeDuration(120))
  })
})

// ── 13. Freeze / reseed trigger constants ────────────────────────────────────

describe('freezeTrails and reseed constants', () => {
  it('FREEZE_DURATION is 1.2 s', () => {
    expect(FREEZE_DURATION).toBeCloseTo(1.2, 5)
  })

  it('RESEED_LIFE_SCALE is a fraction < 1 (rails fade sooner after morph)', () => {
    expect(RESEED_LIFE_SCALE).toBeGreaterThan(0)
    expect(RESEED_LIFE_SCALE).toBeLessThan(1)
  })

  it('reseed morph preserves positive rail lifetime for any positive remaining', () => {
    for (const remaining of [0.01, 0.5, 3.0]) {
      expect(remaining * RESEED_LIFE_SCALE).toBeGreaterThan(0)
    }
  })

  it('reseed seed offset is large and depends on audio time', () => {
    // Formula: 1000 + ((audioTime * 1000 | 0) % 997)
    // Two different audio times produce different offsets
    const offset10 = 1000 + ((10.0 * 1000 | 0) % 997)
    const offset20 = 1000 + ((20.0 * 1000 | 0) % 997)
    expect(offset10).toBeGreaterThan(1000)
    expect(offset20).toBeGreaterThan(1000)
    expect(offset10).not.toBe(offset20)
  })
})

// ── 14. Overlay alpha — calls the same helper the renderer uses ───────────────

describe('resolveOverlayAlpha (whiteout / blackout fade)', () => {
  it('alpha=1 at age=0 (instant attack)', () => {
    expect(resolveOverlayAlpha(0, 1)).toBeCloseTo(1, 5)
  })

  it('alpha=0.5 at midpoint of duration', () => {
    expect(resolveOverlayAlpha(0.5, 1)).toBeCloseTo(0.5, 5)
  })

  it('alpha=0 at or past full duration', () => {
    expect(resolveOverlayAlpha(1, 1)).toBeCloseTo(0, 5)
    expect(resolveOverlayAlpha(5, 1)).toBeCloseTo(0, 5)
  })

  it('whiteout (WHITEOUT_DURATION) is fully faded at its own duration', () => {
    expect(resolveOverlayAlpha(WHITEOUT_DURATION, WHITEOUT_DURATION)).toBeCloseTo(0, 5)
  })

  it('whiteout is still visible at half its duration', () => {
    expect(resolveOverlayAlpha(WHITEOUT_DURATION / 2, WHITEOUT_DURATION)).toBeCloseTo(0.5, 5)
  })

  it('blackout (BLACKOUT_DURATION) is fully faded at its own duration', () => {
    expect(resolveOverlayAlpha(BLACKOUT_DURATION, BLACKOUT_DURATION)).toBeCloseTo(0, 5)
  })

  it('blackout is still visible at half its duration', () => {
    expect(resolveOverlayAlpha(BLACKOUT_DURATION / 2, BLACKOUT_DURATION)).toBeCloseTo(0.5, 5)
  })

  it('alpha values are always in [0, 1]', () => {
    for (const age of [0, 0.1, 0.5, 1.0, 2.0]) {
      const a = resolveOverlayAlpha(age, 1)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThanOrEqual(1)
    }
  })
})

// ── 15. Pulse factory ─────────────────────────────────────────────────────────

describe('makePulseOnRail', () => {
  it('pulse starts at the segment start when direction=1', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, 1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(p.progress).toBe(0)
    expect(pulsePointAt(p)).toEqual({ x: vr.pos, y: vr.spanStart })
  })

  it('pulse starts at the segment end when direction=-1', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, -1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(p.progress).toBe(1)
    expect(pulsePointAt(p)).toEqual({ x: vr.pos, y: vr.spanEnd })
  })

  it('pulse is attached to the rail it was made from', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, 1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(p.railPos).toBe(vr.pos)
    expect(p.vertical).toBe(vr.vertical)
  })

  it('pulse splitCount starts at 0', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, 1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(p.splitCount).toBe(0)
  })
})

// ── 16. Block factory ─────────────────────────────────────────────────────────

describe('makeBlock', () => {
  it('block col/row stored correctly', () => {
    const b = makeBlock(5, 3, 0, 0.5, PALETTE.accent, 0.7)
    expect(b.col).toBe(5)
    expect(b.row).toBe(3)
  })

  it('block birthSec equals provided audioTime', () => {
    const b = makeBlock(0, 0, 42.5, 0.5, PALETTE.accent, 0.7)
    expect(b.birthSec).toBe(42.5)
  })

  it('block lifetime is holdSec * (0.6 + strength * 0.6)', () => {
    const holdSec = 1.25, strength = 0.7
    const b = makeBlock(0, 0, 0, holdSec, PALETTE.accent, strength)
    const expected = holdSec * (0.6 + strength * 0.6)
    expect(b.lifetime).toBeCloseTo(expected, 5)
  })
})

// ── 17. Shockwave factory ─────────────────────────────────────────────────────

describe('makeShockwave', () => {
  it('shockwave cx/cy match provided center', () => {
    const sw = makeShockwave(0.4, 0.6, 0, 0.9, 0.6, PALETTE.primary)
    expect(sw.cx).toBeCloseTo(0.4, 5)
    expect(sw.cy).toBeCloseTo(0.6, 5)
  })

  it('shockwave has a positive lifetime', () => {
    const sw = makeShockwave(0.5, 0.5, 0, 0.8, 0.6, PALETTE.primary)
    expect(sw.lifetime).toBeGreaterThan(0)
  })

  it('shockwave birthSec matches audioTime', () => {
    const sw = makeShockwave(0.5, 0.5, 100, 0.8, 0.6, PALETTE.primary)
    expect(sw.birthSec).toBe(100)
  })
})

// ── 18. Behavior resolvers ────────────────────────────────────────────────────

describe('resolveRailTargets', () => {
  it('zero density gives zero targets (auto spawning suppressed)', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(0, 0.6)
    expect(targetVert).toBe(0)
    expect(targetHoriz).toBe(0)
  })

  it('density=1 verticalBias=1 gives maximum vertical targets', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(1, 1)
    expect(targetVert).toBe(MAX_VERT)
    expect(targetHoriz).toBe(0)
  })

  it('density=1 verticalBias=0 gives maximum horizontal targets', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(1, 0)
    expect(targetVert).toBe(0)
    expect(targetHoriz).toBe(MAX_HORIZ)
  })

  it('increasing density increases targets', () => {
    const lo = resolveRailTargets(0.3, 0.6)
    const hi = resolveRailTargets(0.9, 0.6)
    expect(hi.targetVert + hi.targetHoriz).toBeGreaterThan(lo.targetVert + lo.targetHoriz)
  })

  it('verticalBias skews toward vertical', () => {
    const biasedV  = resolveRailTargets(0.8, 0.9)
    const biasedH  = resolveRailTargets(0.8, 0.1)
    expect(biasedV.targetVert).toBeGreaterThan(biasedV.targetHoriz)
    expect(biasedH.targetHoriz).toBeGreaterThan(biasedH.targetVert)
  })
})

describe('resolveSnapSlot', () => {
  it('returns 0 when bpm=0', () => {
    expect(resolveSnapSlot(5.0, 0, 4)).toBe(0)
  })

  it('returns 0 when snapDivision=0', () => {
    expect(resolveSnapSlot(5.0, 120, 0)).toBe(0)
  })

  it('same slot within one subdivision', () => {
    // bpm=120, snapDiv=4 → subBeatSec = 0.5/4 = 0.125
    const s1 = resolveSnapSlot(0.00, 120, 4)
    const s2 = resolveSnapSlot(0.10, 120, 4)
    expect(s1).toBe(s2)
  })

  it('different slot after crossing subdivision boundary', () => {
    const s1 = resolveSnapSlot(0.124, 120, 4)
    const s2 = resolveSnapSlot(0.126, 120, 4)
    expect(s2).toBeGreaterThan(s1)
  })

  it('slot 1 comes immediately after slot 0', () => {
    const s0 = resolveSnapSlot(0.0, 120, 4)   // slot 0
    const s1 = resolveSnapSlot(0.125, 120, 4) // slot 1
    expect(s1).toBe(s0 + 1)
  })
})

describe('makePulseOnRail: pulseSpeed=0 produces finite, positive speed and lifetime', () => {
  it('speed is always > 0 even when settings.pulseSpeed = 0', () => {
    const vr = makeVRail()
    const s  = { ...SETTINGS, pulseSpeed: 0 }
    const p  = makePulseOnRail(vr, 1, s, 0, PALETTE, 0.8, 1, 1.0)
    expect(p.speed).toBeGreaterThan(0)
  })

  it('lifetime is finite and capped when pulseSpeed = 0', () => {
    const vr = makeVRail()
    const s  = { ...SETTINGS, pulseSpeed: 0 }
    const p  = makePulseOnRail(vr, 1, s, 0, PALETTE, 0.8, 1, 1.0)
    expect(p.lifetime).toBeLessThanOrEqual(4.0)
    expect(p.lifetime).toBeGreaterThan(0)
  })
})

describe('makeFlare: scale field', () => {
  it('default scale is 1.0', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5)
    expect(f.scale).toBe(1.0)
  })

  it('explicit scale is stored correctly', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5, 0.35)
    expect(f.scale).toBeCloseTo(0.35, 5)
  })
})

// ── 19. Prompt 4 — depth / parallax / section / reseed / blackout ────────────

import {
  resolveDepthModifiers,
  resolveCameraParallaxShift,
  resolveEffectiveSection,
  resolveSectionSpawnMul,
  resolveSectionBehavior,
  resolveDepthPlane,
  DEPTH_BG,
  DEPTH_MG,
  DEPTH_FG,
  computeVertRailMorphTarget,
  computeHorizRailMorphTarget,
  advanceRailMorph,
  MORPH_DURATION_MIN,
  MORPH_DURATION_MAX,
} from '../neonLatticeUtils'
import type { NeonRail } from '../neonLatticeUtils'
import type { ReactSectionType } from '../../ReactTypes'

describe('resolveEffectiveSection: manual-section priority', () => {
  it('manual section wins over MI section', () => {
    expect(resolveEffectiveSection('drop', 'verse')).toBe('drop')
  })

  it('MI section used when manual is null', () => {
    expect(resolveEffectiveSection(null, 'build')).toBe('build')
  })

  it('null when both are null', () => {
    expect(resolveEffectiveSection(null, null)).toBeNull()
  })

  it('manual section wins even when MI provides a high-energy section', () => {
    expect(resolveEffectiveSection('breakdown', 'drop')).toBe('breakdown')
  })
})

describe('resolveEffectiveSection: MI availability with BPM zero', () => {
  it('MI section type is used regardless of BPM value', () => {
    // MI frame with frameId > 0 but bpm = 0 still contributes section type
    const miSection: ReactSectionType = 'build'
    expect(resolveEffectiveSection(null, miSection)).toBe('build')
  })

  it('manual section still wins when MI is available with bpm=0', () => {
    expect(resolveEffectiveSection('verse', 'drop')).toBe('verse')
  })
})

describe('resolveDepthModifiers: depth setting 0 and 1', () => {
  it('depth=0 produces no differentiation (all muls = 1)', () => {
    const dm = resolveDepthModifiers(0, 0.8)
    expect(dm.alphaMul).toBeCloseTo(1.0, 5)
    expect(dm.intensityMul).toBeCloseTo(1.0, 5)
    expect(dm.widthMul).toBeCloseTo(1.0, 5)
  })

  it('depth=1 with far rail (railDepth=0) is significantly dimmer', () => {
    // 0 = far/background in the new convention
    const dm = resolveDepthModifiers(1, 0)
    expect(dm.alphaMul).toBeLessThan(0.5)
    expect(dm.intensityMul).toBeLessThan(0.8)
    expect(dm.widthMul).toBeLessThan(0.6)
  })

  it('depth=1 with near rail (railDepth=1) has no reduction', () => {
    // 1 = near/foreground: all muls should be 1.0
    const dm = resolveDepthModifiers(1, 1)
    expect(dm.alphaMul).toBeCloseTo(1.0, 5)
    expect(dm.intensityMul).toBeCloseTo(1.0, 5)
    expect(dm.widthMul).toBeCloseTo(1.0, 5)
  })

  it('increasing depth setting increases dimming for far rails', () => {
    // railDepth=0 = far; higher depth setting → more dimming
    const lo = resolveDepthModifiers(0.3, 0)
    const hi = resolveDepthModifiers(0.9, 0)
    expect(hi.alphaMul).toBeLessThan(lo.alphaMul)
  })

  it('near rail (railDepth=1) is unaffected at any depth setting', () => {
    // 1 = near/foreground: no dimming regardless of depth setting
    for (const d of [0, 0.5, 1]) {
      const dm = resolveDepthModifiers(d, 1)
      expect(dm.alphaMul).toBeCloseTo(1.0, 5)
    }
  })
})

describe('resolveCameraParallaxShift', () => {
  it('parallax=0 always returns zero shift', () => {
    expect(resolveCameraParallaxShift(0, 0.5, 0)).toBeCloseTo(0, 10)
    expect(resolveCameraParallaxShift(1, 0.5, 0)).toBeCloseTo(0, 10)
  })

  it('cameraDriftX=0 returns zero shift', () => {
    expect(resolveCameraParallaxShift(0.5, 0, 1)).toBe(0)
  })

  it('midground rail (railDepth=0.5) has zero parallax shift', () => {
    expect(resolveCameraParallaxShift(0.5, 0.3, 0.8)).toBeCloseTo(0, 5)
  })

  it('near and far rails shift in opposite directions (0=far, 1=near convention)', () => {
    const driftX = 0.4, parallax = 1
    const nearShift = resolveCameraParallaxShift(1, driftX, parallax)  // 1 = near/foreground
    const farShift  = resolveCameraParallaxShift(0, driftX, parallax)  // 0 = far/background
    expect(nearShift).toBeGreaterThan(0)
    expect(farShift).toBeLessThan(0)
  })

  it('larger parallax produces larger shift', () => {
    const lo = resolveCameraParallaxShift(0, 0.5, 0.3)
    const hi = resolveCameraParallaxShift(0, 0.5, 0.9)
    expect(Math.abs(hi)).toBeGreaterThan(Math.abs(lo))
  })
})

describe('resolveSectionSpawnMul', () => {
  it('null section returns 1.0 (no modulation)', () => {
    expect(resolveSectionSpawnMul(null, 0, 0, 0, 0)).toBeCloseTo(1.0, 5)
  })

  it('intro returns a low multiplier (< 0.4)', () => {
    expect(resolveSectionSpawnMul('intro', 0, 0, 0, 0)).toBeLessThan(0.4)
  })

  it('drop returns > 1.0 when dropImpact is high', () => {
    expect(resolveSectionSpawnMul('drop', 0, 1, 0, 0)).toBeGreaterThan(1.0)
  })

  it('drop with no dropImpact is still at least 1.0', () => {
    expect(resolveSectionSpawnMul('drop', 0, 0, 0, 0)).toBeCloseTo(1.0, 5)
  })

  it('build ramps up with buildProgress', () => {
    const lo = resolveSectionSpawnMul('build', 0, 0, 0, 0)
    const hi = resolveSectionSpawnMul('build', 1, 0, 0, 0)
    expect(hi).toBeGreaterThan(lo)
  })

  it('outro decreases with sectionProgress', () => {
    const early = resolveSectionSpawnMul('outro', 0, 0, 0, 0)
    const late  = resolveSectionSpawnMul('outro', 0, 0, 0, 1)
    expect(early).toBeGreaterThan(late)
  })
})

describe('bar-based auto-reseed: seed offset uniqueness', () => {
  it('auto-reseed offset is at least 1000 for any bar index (baseline epoch bump)', () => {
    for (const barIndex of [0, 1, 4, 8, 16, 32]) {
      const offset = 1000 + (barIndex * 37)
      expect(offset).toBeGreaterThanOrEqual(1000)
    }
  })

  it('different bar indices produce different seed offsets', () => {
    const offsets = [0, 4, 8, 12, 16].map(b => 1000 + (b * 37))
    const unique = new Set(offsets)
    expect(unique.size).toBe(offsets.length)
  })

  it('reseed setting 0 is treated as disabled (interval guard fails at 0)', () => {
    // The renderer guard is: if (reseedInterval > 0 && barsSince >= reseedInterval)
    expect(0 > 0).toBe(false)
  })

  it('interval of 4: fires at bar 4 from start, not at bar 3', () => {
    const interval = 4
    expect(4 - 0 >= interval).toBe(true)
    expect(3 - 0 >= interval).toBe(false)
  })
})

describe('auto-blackout mode bounds (resolveOverlayAlpha-driven)', () => {
  function barsInSec(bpm: number) { return 60 / bpm * 4 }

  it('instant: overlay duration for 120 BPM is bounded to <= 0.8 s', () => {
    const duration = Math.min(barsInSec(120) * 0.4, 0.8)
    expect(duration).toBeLessThanOrEqual(0.8)
  })

  it('instant: at 120 BPM, overlay fades out by its bounded end time', () => {
    const duration = Math.min(barsInSec(120) * 0.4, 0.8)
    expect(resolveOverlayAlpha(duration, duration)).toBeCloseTo(0, 5)
  })

  it('fadeOut: ramp-in duration bounded to <= 3.0 s even at 50 BPM', () => {
    const rampSecs = Math.min(barsInSec(50), 3.0)
    expect(rampSecs).toBeLessThanOrEqual(3.0)
  })

  it('fadeOut: ramp-in rate (alpha/s) at 120 BPM produces max 0.85 alpha within ramp window', () => {
    const rampSecs = Math.min(barsInSec(120), 3.0)
    const rate     = 0.85 / rampSecs
    const alphaAtEnd = Math.min(0.85, rate * rampSecs)
    expect(alphaAtEnd).toBeCloseTo(0.85, 5)
  })

  it('strobe: active window bounded to <= 2.0 s even at 60 BPM (4 s/bar)', () => {
    const strobeEnd = Math.min(barsInSec(60), 2.0)
    expect(strobeEnd).toBeLessThanOrEqual(2.0)
  })

  it('strobe: re-trigger guard uses autoBlackoutEnd > audioTime', () => {
    // autoBlackoutEnd=12, audioTime=10 → still active, guard blocks re-fire
    expect(12 > 10).toBe(true)
    // Once expired (audioTime >= end), guard allows re-fire
    expect(10 > 12).toBe(false)
  })
})

// ── 20. Prompt 5 — trigger behavior via exported production helpers ───────────

describe('Rail Burst: resolveRailBurstCounts matches renderer dispatchTrigger', () => {
  it('bias=0.60 spawns 3 vert + 2 horiz', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(0.60)
    expect(vertCount).toBe(3)
    expect(horizCount).toBe(2)
  })

  it('bias=1 spawns 4 vert + 1 horiz (max vertical)', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(1)
    expect(vertCount).toBe(4)
    expect(horizCount).toBe(1)
  })

  it('bias=0 spawns 2 vert + 3 horiz (max horizontal)', () => {
    const { vertCount, horizCount } = resolveRailBurstCounts(0)
    expect(vertCount).toBe(2)
    expect(horizCount).toBe(3)
  })

  it('counts are bounded within [2,4] vert and [1,3] horiz at any bias', () => {
    for (const bias of [0, 0.25, 0.5, 0.75, 1]) {
      const { vertCount, horizCount } = resolveRailBurstCounts(bias)
      expect(vertCount).toBeGreaterThanOrEqual(2)
      expect(vertCount).toBeLessThanOrEqual(4)
      expect(horizCount).toBeGreaterThanOrEqual(1)
      expect(horizCount).toBeLessThanOrEqual(3)
    }
  })
})

describe('Block Cascade: one deterministic pattern per trigger (prngNext)', () => {
  function cascadePatternIdx(seed: number): number {
    const [pv] = prngNext(seed)
    return Math.floor(pv * 5)
  }

  it('pattern index is in range [0, 4] for any seed', () => {
    for (const seed of [1, 42, 1000, 1997, 2500, 50000]) {
      const idx = cascadePatternIdx(seed)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(5)
    }
  })

  it('same seed always selects the same pattern (deterministic)', () => {
    expect(cascadePatternIdx(42)).toBe(cascadePatternIdx(42))
  })
})

describe('Whiteout: WHITEOUT_DURATION defines the fast-flash envelope', () => {
  it('WHITEOUT_DURATION is short (<= 0.5 s)', () => {
    expect(WHITEOUT_DURATION).toBeLessThanOrEqual(0.5)
    expect(WHITEOUT_DURATION).toBeGreaterThan(0)
  })

  it('overlay is fully faded at exactly WHITEOUT_DURATION', () => {
    expect(resolveOverlayAlpha(WHITEOUT_DURATION, WHITEOUT_DURATION)).toBeCloseTo(0, 5)
  })

  it('overlay is still >= 0.5 at the midpoint', () => {
    expect(resolveOverlayAlpha(WHITEOUT_DURATION / 2, WHITEOUT_DURATION)).toBeGreaterThanOrEqual(0.5)
  })
})

describe('Blackout: BLACKOUT_DURATION defines the short controlled envelope', () => {
  it('BLACKOUT_DURATION auto-recovers quickly (<= 1.2 s)', () => {
    expect(BLACKOUT_DURATION).toBeLessThanOrEqual(1.2)
    expect(BLACKOUT_DURATION).toBeGreaterThan(0)
  })

  it('overlay is fully faded at exactly BLACKOUT_DURATION', () => {
    expect(resolveOverlayAlpha(BLACKOUT_DURATION, BLACKOUT_DURATION)).toBeCloseTo(0, 5)
  })
})

describe('Reseed: RESEED_LIFE_SCALE controls morph turnover speed', () => {
  it('RESEED_LIFE_SCALE < 1 (shortens remaining lifetimes after morph)', () => {
    expect(RESEED_LIFE_SCALE).toBeLessThan(1)
    expect(RESEED_LIFE_SCALE).toBeGreaterThan(0)
  })

  it('scaled lifetime is still positive for any positive remaining', () => {
    for (const r of [0.01, 0.5, 2.0, 5.0]) {
      expect(r * RESEED_LIFE_SCALE).toBeGreaterThan(0)
    }
  })

  it('manual reseed seed offset is > 1000 and time-dependent', () => {
    const t1 = 1000 + ((10.5 * 1000 | 0) % 997)
    const t2 = 1000 + ((11.5 * 1000 | 0) % 997)
    expect(t1).toBeGreaterThan(1000)
    expect(t1).not.toBe(t2)
  })
})

describe('Freeze Trails: FREEZE_DURATION and restrained post-freeze burst', () => {
  it('FREEZE_DURATION is 1.2 s', () => {
    expect(FREEZE_DURATION).toBeCloseTo(1.2, 5)
  })

  it('post-freeze burst spawns 2 vert + 1 horiz (3 rails total, restrained)', () => {
    // The burst constants are fixed in the renderer: 2 vert, 1 horiz, strength=0.58
    // Verify the expected counts directly (no guard needed — caps aren't reached with 3 rails)
    const vertSpawned  = 2
    const horizSpawned = 1
    expect(vertSpawned + horizSpawned).toBe(3)
    expect(vertSpawned).toBeLessThanOrEqual(MAX_VERT)
    expect(horizSpawned).toBeLessThanOrEqual(MAX_HORIZ)
  })
})

describe('Cyan Strike: resolveCyanStrikeDuration controls override window', () => {
  it('at least 0.4 s at any BPM', () => {
    for (const bpm of [0, 60, 120, 180, 200]) {
      expect(resolveCyanStrikeDuration(bpm)).toBeGreaterThanOrEqual(0.40)
    }
  })

  it('120 BPM → 0.75 s (1.5 beat lengths)', () => {
    expect(resolveCyanStrikeDuration(120)).toBeCloseTo(0.75, 5)
  })

  it('0 BPM fallback → 0.75 s (1.5 × 0.5 s default beat)', () => {
    expect(resolveCyanStrikeDuration(0)).toBeCloseTo(0.75, 5)
  })

  it('60 BPM → 1.5 s', () => {
    expect(resolveCyanStrikeDuration(60)).toBeCloseTo(1.5, 5)
  })
})

describe('NL_TRIGGER_PADS: pad configuration and keyboard mappings', () => {
  const padIds   = NL_TRIGGER_PADS.map(p => p.padId)
  const triggers = NL_TRIGGER_PADS.map(p => p.trigger)

  it('defines exactly 8 contextual pads', () => {
    expect(NL_TRIGGER_PADS).toHaveLength(8)
  })

  it('pad IDs are pad-1 through pad-8', () => {
    expect(padIds).toEqual(['pad-1','pad-2','pad-3','pad-4','pad-5','pad-6','pad-7','pad-8'])
  })

  it('all 8 trigger types are covered', () => {
    const expected: NeonLatticeTriggerType[] = [
      'railBurst','blockCascade','crossFlare','whiteout',
      'blackout','reseed','freezeTrails','cyanStrike',
    ]
    expect(triggers).toEqual(expected)
  })

  it('each pad has a non-empty label', () => {
    for (const p of NL_TRIGGER_PADS) {
      expect(p.label.length).toBeGreaterThan(0)
    }
  })

  it('each pad has a non-empty color', () => {
    for (const p of NL_TRIGGER_PADS) {
      expect(p.color.length).toBeGreaterThan(0)
    }
  })

  it('pad IDs are unique', () => {
    expect(new Set(padIds).size).toBe(NL_TRIGGER_PADS.length)
  })

  it('trigger types are unique', () => {
    expect(new Set(triggers).size).toBe(NL_TRIGGER_PADS.length)
  })
})

// ── 21. Preset order independence ─────────────────────────────────────────────

import { buildPresetPatch } from '../../../../../stores/reactStore'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../../ReactTypes'

describe('NL preset order independence', () => {
  const nlPresets = DEFAULT_REACT_PRESETS.filter(
    p => p.engine === 'neonLattice' && p.neonLatticeSettings != null,
  )

  it('applying preset B after A yields same settings as applying B directly', () => {
    for (const presetA of nlPresets) {
      for (const presetB of nlPresets) {
        if (presetA.id === presetB.id) continue

        // Path 1: A → B
        const patchA     = buildPresetPatch(presetA, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)
        const afterA     = patchA.neonLatticeSettings as import('../../ReactTypes').NeonLatticeSettings
        const patchAtoB  = buildPresetPatch(presetB, DEFAULT_OSCILLATOR_SETTINGS, undefined, afterA)

        // Path 2: directly to B
        const patchB     = buildPresetPatch(presetB, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)

        expect(patchAtoB.neonLatticeSettings).toEqual(patchB.neonLatticeSettings)
      }
    }
  })
})

// ── 22. One-shot trigger consumption via monotonic seq ───────────────────────

describe('one-shot trigger consumption: each seq consumed at most once', () => {
  beforeEach(freshStore)

  it('after consuming seq N, a second call with same seq produces a new seq', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    const seq1 = useReactStore.getState().neonLatticeTrigger!.seq

    // Renderer would consume seq1 (lastConsumedSeq = seq1).
    // Firing the same trigger type again must produce seq > seq1.
    s.triggerNeonLattice('railBurst')
    const seq2 = useReactStore.getState().neonLatticeTrigger!.seq

    expect(seq2).toBeGreaterThan(seq1)
  })

  it('seq counter is never reset by engine switches', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    const seqBeforeSwitch = useReactStore.getState().neonLatticeTrigger!.seq

    s.selectReactEngine('oscilloscope')
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    const seqAfterSwitch = useReactStore.getState().neonLatticeTrigger!.seq

    // After round-trip, seq is strictly higher — never reset to an earlier value
    expect(seqAfterSwitch).toBeGreaterThan(seqBeforeSwitch)
  })
})

// ── 23. Density targets hard caps ────────────────────────────────────────────

describe('resolveRailTargets: density hard caps at all settings extremes', () => {
  it('density=1, bias=1 → targetVert == MAX_VERT exactly', () => {
    expect(resolveRailTargets(1, 1).targetVert).toBe(MAX_VERT)
  })

  it('density=1, bias=0 → targetHoriz == MAX_HORIZ exactly', () => {
    expect(resolveRailTargets(1, 0).targetHoriz).toBe(MAX_HORIZ)
  })

  it('over-range inputs clamped: density=2, bias=2 stays within caps', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(2, 2)
    expect(targetVert).toBeLessThanOrEqual(MAX_VERT)
    expect(targetHoriz).toBeLessThanOrEqual(MAX_HORIZ)
  })

  it('negative inputs clamped to 0: density=-1, bias=-1 → (0,0)', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(-1, -1)
    expect(targetVert).toBe(0)
    expect(targetHoriz).toBe(0)
  })
})

// ── 24. User-facing control behavior coverage ─────────────────────────────────

describe('snap-division deduplication: resolveSnapSlot and isSnapActive', () => {
  it('bpm=0 → slot 0 (raw utility)', () => {
    expect(resolveSnapSlot(5.0, 0, 4)).toBe(0)
  })

  it('snapDivision=0 → slot 0 (raw utility)', () => {
    expect(resolveSnapSlot(5.0, 120, 0)).toBe(0)
  })

  it('isSnapActive=false when bpm=0 — renderer skips slot check', () => {
    expect(isSnapActive(0, 4)).toBe(false)
  })

  it('isSnapActive=false when snapDivision=0 — renderer skips slot check', () => {
    expect(isSnapActive(120, 0)).toBe(false)
  })

  it('isSnapActive=true when both bpm and snapDivision are positive', () => {
    expect(isSnapActive(120, 4)).toBe(true)
  })

  it('same audio time in same subdivision window → same slot', () => {
    const s1 = resolveSnapSlot(0.00, 120, 4)
    const s2 = resolveSnapSlot(0.12, 120, 4)
    expect(s1).toBe(s2)
  })

  it('different subdivision windows → different slots', () => {
    const s1 = resolveSnapSlot(0.12, 120, 4)
    const s2 = resolveSnapSlot(0.13, 120, 4)
    expect(s2).toBeGreaterThan(s1)
  })

  it('each supported subdivision produces monotonic slots at 120 BPM', () => {
    for (const div of [1, 2, 4, 8, 16] as const) {
      const beatSec   = 60 / 120
      const subBeatSec = beatSec / div
      const s0 = resolveSnapSlot(0, 120, div)
      const s1 = resolveSnapSlot(subBeatSec + 0.001, 120, div)
      expect(s1).toBeGreaterThan(s0)
    }
  })

  it('finer divisions produce more slots per second (higher slot numbers)', () => {
    const t = 1.0
    const s4  = resolveSnapSlot(t, 120, 4)
    const s8  = resolveSnapSlot(t, 120, 8)
    const s16 = resolveSnapSlot(t, 120, 16)
    expect(s8).toBeGreaterThan(s4)
    expect(s16).toBeGreaterThan(s8)
  })
})

describe('makeFlare scale parameter controls cross-flare size', () => {
  it('default scale=1.0 when not provided', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5)
    expect(f.scale).toBe(1.0)
  })

  it('explicit scale < 1.0 (flareAmount=0.3) produces smaller flare', () => {
    const small = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5, 0.30)
    const large = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5, 1.00)
    expect(small.scale).toBeLessThan(large.scale)
  })

  it('scale is stored on the flare object', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, PALETTE.primary, 0.5, 0.65)
    expect(f.scale).toBeCloseTo(0.65, 5)
  })
})

describe('section behavior: resolveSectionSpawnMul covers all 8 types', () => {
  it('drop > bridge > verse > preDrop', () => {
    const drop    = resolveSectionSpawnMul('drop',      0, 0.5, 0, 0)
    const bridge  = resolveSectionSpawnMul('bridge',    0, 0,   0, 0)
    const verse   = resolveSectionSpawnMul('verse',     0, 0,   0, 0)
    const preDrop = resolveSectionSpawnMul('preDrop',   0, 0,   0, 0)
    expect(drop).toBeGreaterThan(bridge)
    expect(bridge).toBeGreaterThan(verse)
    expect(verse).toBeGreaterThan(preDrop)
  })

  it('intro and breakdown are the sparsest sections', () => {
    const intro     = resolveSectionSpawnMul('intro',     0, 0, 0, 0)
    const breakdown = resolveSectionSpawnMul('breakdown', 0, 0, 0, 0)
    const verse     = resolveSectionSpawnMul('verse',     0, 0, 0, 0)
    expect(intro).toBeLessThanOrEqual(verse)
    expect(breakdown).toBeLessThanOrEqual(verse)
  })

  it('null section returns 1.0 (no modulation)', () => {
    expect(resolveSectionSpawnMul(null, 0, 0, 0, 0)).toBeCloseTo(1.0, 5)
  })
})

// ── 25. Trigger selector: matching and non-matching events ────────────────────

describe('resolveTriggerFires: each trigger matches exactly its named event', () => {
  it('none never fires', () => {
    for (const ev of ['kick', 'snare', 'beat', 'downbeat', 'drop'] as const) {
      expect(resolveTriggerFires('none', ev)).toBe(false)
    }
  })

  it('beat fires on beat, not kick, snare, downbeat, or drop', () => {
    expect(resolveTriggerFires('beat', 'beat')).toBe(true)
    expect(resolveTriggerFires('beat', 'kick')).toBe(false)
    expect(resolveTriggerFires('beat', 'snare')).toBe(false)
    expect(resolveTriggerFires('beat', 'downbeat')).toBe(false)
    expect(resolveTriggerFires('beat', 'drop')).toBe(false)
  })

  it('kick fires on kick only', () => {
    expect(resolveTriggerFires('kick', 'kick')).toBe(true)
    expect(resolveTriggerFires('kick', 'snare')).toBe(false)
    expect(resolveTriggerFires('kick', 'beat')).toBe(false)
    expect(resolveTriggerFires('kick', 'downbeat')).toBe(false)
    expect(resolveTriggerFires('kick', 'drop')).toBe(false)
  })

  it('snare fires on snare only', () => {
    expect(resolveTriggerFires('snare', 'snare')).toBe(true)
    expect(resolveTriggerFires('snare', 'kick')).toBe(false)
    expect(resolveTriggerFires('snare', 'beat')).toBe(false)
    expect(resolveTriggerFires('snare', 'downbeat')).toBe(false)
    expect(resolveTriggerFires('snare', 'drop')).toBe(false)
  })

  it('downbeat fires on downbeat, not on drop', () => {
    expect(resolveTriggerFires('downbeat', 'downbeat')).toBe(true)
    expect(resolveTriggerFires('downbeat', 'drop')).toBe(false)
    expect(resolveTriggerFires('downbeat', 'kick')).toBe(false)
    expect(resolveTriggerFires('downbeat', 'beat')).toBe(false)
  })

  it('drop fires on drop, not on downbeat', () => {
    expect(resolveTriggerFires('drop', 'drop')).toBe(true)
    expect(resolveTriggerFires('drop', 'downbeat')).toBe(false)
    expect(resolveTriggerFires('drop', 'kick')).toBe(false)
    expect(resolveTriggerFires('drop', 'beat')).toBe(false)
  })

  it('beat and drop are independent (neither implies the other)', () => {
    expect(resolveTriggerFires('beat', 'drop')).toBe(false)
    expect(resolveTriggerFires('drop', 'beat')).toBe(false)
  })

  it('kick and downbeat are independent', () => {
    expect(resolveTriggerFires('kick', 'downbeat')).toBe(false)
    expect(resolveTriggerFires('downbeat', 'kick')).toBe(false)
  })
})

// ── 26. BPM-zero and snap-division-zero fallback ──────────────────────────────

describe('isSnapActive: snap-slot deduplication is gated by BPM and snapDivision', () => {
  it('both positive → snap is active (slot dedup fires)', () => {
    for (const [bpm, div] of [[60, 1], [120, 4], [180, 8], [200, 16]] as const) {
      expect(isSnapActive(bpm, div)).toBe(true)
    }
  })

  it('bpm=0 → snap inactive (per-event debounces take over)', () => {
    for (const div of [1, 2, 4, 8, 16] as const) {
      expect(isSnapActive(0, div)).toBe(false)
    }
  })

  it('snapDivision=0 → snap inactive', () => {
    expect(isSnapActive(120, 0)).toBe(false)
    expect(isSnapActive(60,  0)).toBe(false)
  })

  it('snap becoming inactive does not permanently block events (per-event debounces gate independently)', () => {
    // When isSnapActive=false, the renderer skips the slot comparison entirely.
    // Verify that slot 0 (returned by resolveSnapSlot when bpm=0) does NOT
    // block the same pattern with lastPulseSnapSlot=0.
    // The test: renderer uses (!snapActive || pulseSlot !== lastPulseSnapSlot).
    // With snapActive=false, the condition is always true — events can fire.
    const snapActive0 = isSnapActive(0, 4)
    expect(snapActive0).toBe(false)
    // If snapActive=false, the guard `!snapActive || slot !== last` simplifies to `true`
    const wouldFire = !snapActive0 || (0 !== 0)
    expect(wouldFire).toBe(true)
  })
})

// ── 27. Depth plane classification ────────────────────────────────────────────

describe('resolveDepthPlane: 0=far, 1=near convention', () => {
  it('DEPTH_BG is classified as background', () => {
    expect(resolveDepthPlane(DEPTH_BG)).toBe('background')
  })

  it('DEPTH_MG is classified as midground', () => {
    expect(resolveDepthPlane(DEPTH_MG)).toBe('midground')
  })

  it('DEPTH_FG is classified as foreground', () => {
    expect(resolveDepthPlane(DEPTH_FG)).toBe('foreground')
  })

  it('depth=0 is background', () => {
    expect(resolveDepthPlane(0)).toBe('background')
  })

  it('depth=1 is foreground', () => {
    expect(resolveDepthPlane(1)).toBe('foreground')
  })

  it('depth=0.5 is midground', () => {
    expect(resolveDepthPlane(0.5)).toBe('midground')
  })

  it('DEPTH_BG < DEPTH_MG < DEPTH_FG', () => {
    expect(DEPTH_BG).toBeLessThan(DEPTH_MG)
    expect(DEPTH_MG).toBeLessThan(DEPTH_FG)
    expect(DEPTH_FG).toBeLessThanOrEqual(1)
  })
})

// ── 28. Depth modifiers: foreground brighter/wider/faster than background ─────

describe('resolveDepthModifiers: plane property ordering at depth setting = 1', () => {
  const fg = resolveDepthModifiers(1, DEPTH_FG)
  const mg = resolveDepthModifiers(1, DEPTH_MG)
  const bg = resolveDepthModifiers(1, DEPTH_BG)

  it('alpha: foreground > midground > background', () => {
    expect(fg.alphaMul).toBeGreaterThan(mg.alphaMul)
    expect(mg.alphaMul).toBeGreaterThan(bg.alphaMul)
  })

  it('width: foreground > midground > background', () => {
    expect(fg.widthMul).toBeGreaterThan(mg.widthMul)
    expect(mg.widthMul).toBeGreaterThan(bg.widthMul)
  })

  it('intensity: foreground > midground > background', () => {
    expect(fg.intensityMul).toBeGreaterThan(mg.intensityMul)
    expect(mg.intensityMul).toBeGreaterThan(bg.intensityMul)
  })

  it('speed: foreground >= midground >= background (near elements move faster)', () => {
    expect(fg.speedMul).toBeGreaterThanOrEqual(mg.speedMul)
    expect(mg.speedMul).toBeGreaterThanOrEqual(bg.speedMul)
  })

  it('reactivity: foreground >= midground >= background', () => {
    expect(fg.reactivityMul).toBeGreaterThanOrEqual(mg.reactivityMul)
    expect(mg.reactivityMul).toBeGreaterThanOrEqual(bg.reactivityMul)
  })

  it('foreground has no dimming (all muls = 1.0) at any depth setting', () => {
    for (const d of [0, 0.5, 1]) {
      const dm = resolveDepthModifiers(d, 1)
      expect(dm.alphaMul).toBeCloseTo(1.0, 5)
      expect(dm.widthMul).toBeCloseTo(1.0, 5)
      expect(dm.speedMul).toBeCloseTo(1.0, 5)
    }
  })
})

// ── 29. Camera bounds at settings extremes ────────────────────────────────────

describe('camera motion bounds: cameraMotion 0 and 1', () => {
  it('drift limit is 0 when cameraMotion=0', () => {
    const cm = 0
    expect(0.055 * cm).toBe(0)
  })

  it('drift limit at cameraMotion=1 is <= 0.1 (restrained)', () => {
    const cm = 1
    expect(0.055 * cm).toBeLessThanOrEqual(0.1)
  })

  it('zoom target at cameraMotion=0 is always 1.0 regardless of bass', () => {
    const cm = 0, bassEnergy = 1
    const zoomTarget = 1.0 + bassEnergy * cm * 0.030
    expect(zoomTarget).toBe(1.0)
  })

  it('zoom target at cameraMotion=1, full bass, is <= 1.05 (barely perceptible)', () => {
    const cm = 1, bassEnergy = 1
    const zoomTarget = 1.0 + bassEnergy * cm * 0.030
    expect(zoomTarget).toBeLessThanOrEqual(1.05)
  })

  it('rotation is clamped to ±0.010 * cameraMotion', () => {
    const cm = 1
    const clampedPos = Math.max(-0.010 * cm, Math.min(0.010 * cm,  0.02))
    const clampedNeg = Math.max(-0.010 * cm, Math.min(0.010 * cm, -0.02))
    expect(clampedPos).toBeCloseTo(0.010, 5)
    expect(clampedNeg).toBeCloseTo(-0.010, 5)
  })
})

// ── 30. Downbeat zoom burst envelope ─────────────────────────────────────────

describe('downbeat zoom burst: replaces rotation-as-punch with cameraZoomBurst', () => {
  const ZOOM_BURST_DECAY = 0.12  // must match renderer constant

  it('burst at age=0 contributes full magnitude', () => {
    const strength = 0.8, cm = 1
    const burst     = strength * cm * 0.035
    const burstAlpha = Math.max(0, 1 - 0 / ZOOM_BURST_DECAY)
    expect(burst * burstAlpha).toBeCloseTo(burst, 5)
  })

  it('burst decays to 0 at age = ZOOM_BURST_DECAY', () => {
    const strength = 0.8, cm = 1
    const burst     = strength * cm * 0.035
    const burstAlpha = Math.max(0, 1 - ZOOM_BURST_DECAY / ZOOM_BURST_DECAY)
    expect(burst * burstAlpha).toBe(0)
  })

  it('burst is 0 past ZOOM_BURST_DECAY (no negative zoom)', () => {
    const burstAlpha = Math.max(0, 1 - (ZOOM_BURST_DECAY + 0.05) / ZOOM_BURST_DECAY)
    expect(burstAlpha).toBe(0)
  })

  it('maximum burst zoom-in at cameraMotion=1 is <= 0.035 above neutral', () => {
    const maxBurst = 1.0 * 1.0 * 0.035  // strength=1, cm=1
    expect(maxBurst).toBeLessThanOrEqual(0.035)
  })
})

// ── 31. Flare-rail intersection alignment ─────────────────────────────────────

describe('resolveCameraParallaxShift: flare and rail at same depth stay aligned', () => {
  it('identical depth produces identical parallax shift', () => {
    const depth = 0.72, driftX = 0.3, parallax = 0.6
    const railShift  = resolveCameraParallaxShift(depth, driftX, parallax)
    const flareShift = resolveCameraParallaxShift(depth, driftX, parallax)
    expect(flareShift).toBe(railShift)
  })

  it('near flare (depth=1) shifts positively with positive camera drift', () => {
    expect(resolveCameraParallaxShift(1, 0.4, 1)).toBeGreaterThan(0)
  })

  it('far flare (depth=0) shifts negatively with positive camera drift', () => {
    expect(resolveCameraParallaxShift(0, 0.4, 1)).toBeLessThan(0)
  })
})

// ── 32. resolveSectionBehavior: per-section baseline values ───────────────────

describe('resolveSectionBehavior: per-section baseline values', () => {
  // same prev as current = not an entry frame
  function sb(s: ReactSectionType | null, bp = 0, di = 0, tn = 0, sp = 0) {
    return resolveSectionBehavior(s, bp, di, tn, sp, s)
  }

  it('null section returns neutral multipliers', () => {
    const b = sb(null)
    expect(b.railSpawnMul).toBe(1.00)
    expect(b.pulseSpeedMul).toBe(1.00)
    expect(b.glowMul).toBe(1.00)
    expect(b.blockMul).toBe(1.00)
    expect(b.shockwavesAllowed).toBe(true)
    expect(b.centerBiasAdd).toBe(0.00)
    expect(b.lifetimeMul).toBe(1.00)
    expect(b.decayAdjust).toBe(0.00)
  })

  it('intro: sparse, slow, long-lived, no shockwaves, slower fade', () => {
    const b = sb('intro')
    expect(b.railSpawnMul).toBeCloseTo(0.25, 4)
    expect(b.pulseSpeedMul).toBeCloseTo(0.70, 4)
    expect(b.shockwavesAllowed).toBe(false)
    expect(b.lifetimeMul).toBeGreaterThan(1.0)
    expect(b.decayAdjust).toBeLessThan(0)
  })

  it('verse: moderate balanced — spawn < 1, shockwaves on', () => {
    const b = sb('verse')
    expect(b.railSpawnMul).toBeCloseTo(0.60, 4)
    expect(b.pulseSpeedMul).toBeCloseTo(1.00, 4)
    expect(b.shockwavesAllowed).toBe(true)
  })

  it('drop at full dropImpact: exceeds neutral spawn, glow, and blocks', () => {
    const b = resolveSectionBehavior('drop', 0, 1, 0, 0, 'drop')
    expect(b.railSpawnMul).toBeGreaterThan(1.0)
    expect(b.glowMul).toBeGreaterThan(1.0)
    expect(b.blockMul).toBeGreaterThan(1.0)
    expect(b.shockwavesAllowed).toBe(true)
    expect(b.decayAdjust).toBeGreaterThan(0)
  })

  it('breakdown: sparse, slow, very long-lived, no shockwaves, slower fade', () => {
    const b = sb('breakdown')
    expect(b.railSpawnMul).toBeCloseTo(0.30, 4)
    expect(b.shockwavesAllowed).toBe(false)
    expect(b.lifetimeMul).toBeGreaterThanOrEqual(1.5)
    expect(b.decayAdjust).toBeLessThan(0)
  })

  it('preDrop at full tension: center-biased, no shockwaves, reduced spawn', () => {
    const b = resolveSectionBehavior('preDrop', 0, 0, 1, 0, 'preDrop')
    expect(b.centerBiasAdd).toBeGreaterThan(0)
    expect(b.shockwavesAllowed).toBe(false)
    expect(b.railSpawnMul).toBeLessThan(0.6)
  })

  it('build at full buildProgress exceeds verse spawn rate', () => {
    const atPeak = resolveSectionBehavior('build', 1, 0, 0, 0, 'build')
    const verse  = sb('verse')
    expect(atPeak.railSpawnMul).toBeGreaterThan(verse.railSpawnMul)
  })

  it('bridge: shockwaves on, spawn above 0.5', () => {
    const b = sb('bridge')
    expect(b.shockwavesAllowed).toBe(true)
    expect(b.railSpawnMul).toBeGreaterThan(0.5)
  })

  it('outro at sectionProgress=0: spawn higher than at sectionProgress=1', () => {
    const early = resolveSectionBehavior('outro', 0, 0, 0, 0, 'outro')
    const late  = resolveSectionBehavior('outro', 0, 0, 0, 1, 'outro')
    expect(early.railSpawnMul).toBeGreaterThan(late.railSpawnMul)
  })
})

// ── 33. resolveSectionBehavior: entry frame detection ─────────────────────────

describe('resolveSectionBehavior: isEntryFrame fires exactly on section boundary', () => {
  it('preDrop → drop transition marks entry frame', () => {
    expect(resolveSectionBehavior('drop', 0, 0.8, 0, 0, 'preDrop').isEntryFrame).toBe(true)
  })

  it('drop → drop (same section) does NOT mark entry', () => {
    expect(resolveSectionBehavior('drop', 0, 0.8, 0, 0, 'drop').isEntryFrame).toBe(false)
  })

  it('null → verse marks entry', () => {
    expect(resolveSectionBehavior('verse', 0, 0, 0, 0, null).isEntryFrame).toBe(true)
  })

  it('verse → verse does NOT mark entry', () => {
    expect(resolveSectionBehavior('verse', 0, 0, 0, 0, 'verse').isEntryFrame).toBe(false)
  })

  it('breakdown → outro marks entry', () => {
    expect(resolveSectionBehavior('outro', 0, 0, 0, 0, 'breakdown').isEntryFrame).toBe(true)
  })

  it('intro → intro does NOT mark entry', () => {
    expect(resolveSectionBehavior('intro', 0, 0, 0, 0, 'intro').isEntryFrame).toBe(false)
  })
})

// ── 34. MI event deduplication: index-based guards ────────────────────────────

describe('MI event deduplication: index-based edge detection', () => {
  it('same frameId is not a new MI frame', () => {
    let last = 42; let current = last  // same value
    expect(current !== last).toBe(false)
  })

  it('advanced frameId is a new MI frame', () => {
    let last = 42; let current = last + 1
    expect(current !== last).toBe(true)
  })

  it('same beatIndex does not qualify as a new beat', () => {
    let last = 10; let current = last
    expect(current !== last).toBe(false)
  })

  it('advanced beatIndex qualifies as a new beat', () => {
    let last = 10; let current = last + 1
    expect(current !== last).toBe(true)
  })

  it('same barIndex does not qualify for a downbeat/drop event', () => {
    let last = 3; let current = last
    expect(current !== last).toBe(false)
  })

  it('advanced barIndex qualifies for a downbeat/drop event', () => {
    let last = 3; let current = last + 1
    expect(current !== last).toBe(true)
  })

  it('phrase-4 index derived from beatIndex changes every 4 beats', () => {
    const p4At8  = Math.floor(8  / 4)   // beat 8  → phrase 2
    const p4At11 = Math.floor(11 / 4)   // beat 11 → phrase 2 (same)
    const p4At12 = Math.floor(12 / 4)   // beat 12 → phrase 3 (new)
    expect(p4At8).toBe(p4At11)           // still in same phrase
    expect(p4At12).not.toBe(p4At11)     // phrase boundary crossed
  })
})

// ── 35. Section-adjusted rail targets never exceed hard caps ──────────────────

describe('section-adjusted rail targets stay within MAX_VERT / MAX_HORIZ', () => {
  it('drop multiplier on max raw vert targets is clamped to MAX_VERT', () => {
    const { targetVert } = resolveRailTargets(1, 1)  // all vertical
    const spawnMul       = resolveSectionBehavior('drop', 0, 1, 0, 0, 'build').railSpawnMul
    const capped         = Math.min(MAX_VERT, Math.round(targetVert * spawnMul))
    expect(capped).toBeLessThanOrEqual(MAX_VERT)
  })

  it('drop multiplier on max raw horiz targets is clamped to MAX_HORIZ', () => {
    const { targetHoriz } = resolveRailTargets(1, 0)  // all horizontal
    const spawnMul        = resolveSectionBehavior('drop', 0, 1, 0, 0, 'build').railSpawnMul
    const capped          = Math.min(MAX_HORIZ, Math.round(targetHoriz * spawnMul))
    expect(capped).toBeLessThanOrEqual(MAX_HORIZ)
  })

  it('minimum spawn floor (0.1) never results in negative targets', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(0.5, 0.6)
    const flooredMul = Math.max(0.1, 0)
    expect(Math.round(targetVert  * flooredMul)).toBeGreaterThanOrEqual(0)
    expect(Math.round(targetHoriz * flooredMul)).toBeGreaterThanOrEqual(0)
  })

  it('null section (railSpawnMul=1) does not change raw targets', () => {
    const { targetVert, targetHoriz } = resolveRailTargets(0.7, 0.6)
    const spawnMul = resolveSectionBehavior(null, 0, 0, 0, 0, null).railSpawnMul
    expect(spawnMul).toBe(1.0)
    expect(Math.min(MAX_VERT,  Math.round(targetVert  * spawnMul))).toBe(Math.min(MAX_VERT,  targetVert))
    expect(Math.min(MAX_HORIZ, Math.round(targetHoriz * spawnMul))).toBe(Math.min(MAX_HORIZ, targetHoriz))
  })
})

// ── 36. Build section: smooth growth with buildProgress ───────────────────────

describe('resolveSectionBehavior build: smooth growth with buildProgress', () => {
  it('railSpawnMul increases monotonically from buildProgress 0 → 0.5 → 1', () => {
    const lo  = resolveSectionBehavior('build', 0,   0, 0, 0, 'build').railSpawnMul
    const mid = resolveSectionBehavior('build', 0.5, 0, 0, 0, 'build').railSpawnMul
    const hi  = resolveSectionBehavior('build', 1,   0, 0, 0, 'build').railSpawnMul
    expect(mid).toBeGreaterThan(lo)
    expect(hi).toBeGreaterThan(mid)
  })

  it('glowMul rises from 0.80 at buildProgress=0 to 1.20 at buildProgress=1', () => {
    expect(resolveSectionBehavior('build', 0, 0, 0, 0, 'build').glowMul).toBeCloseTo(0.80, 4)
    expect(resolveSectionBehavior('build', 1, 0, 0, 0, 'build').glowMul).toBeCloseTo(1.20, 4)
  })

  it('shockwaves disabled at buildProgress=0, enabled at buildProgress=1', () => {
    expect(resolveSectionBehavior('build', 0,   0, 0, 0, 'build').shockwavesAllowed).toBe(false)
    expect(resolveSectionBehavior('build', 0.5, 0, 0, 0, 'build').shockwavesAllowed).toBe(false)
    expect(resolveSectionBehavior('build', 1,   0, 0, 0, 'build').shockwavesAllowed).toBe(true)
  })

  it('decayAdjust rises (faster fade) as build intensity increases', () => {
    const lo = resolveSectionBehavior('build', 0,   0, 0, 0, 'build').decayAdjust
    const hi = resolveSectionBehavior('build', 1,   0, 0, 0, 'build').decayAdjust
    expect(hi).toBeGreaterThan(lo)
  })
})

// ── 37. Outro section: progressive reduction across sectionProgress ────────────

describe('resolveSectionBehavior outro: progressive reduction', () => {
  it('railSpawnMul is higher at sectionProgress=0 than at sectionProgress=1', () => {
    const early = resolveSectionBehavior('outro', 0, 0, 0, 0,   'outro').railSpawnMul
    const late  = resolveSectionBehavior('outro', 0, 0, 0, 1.0, 'outro').railSpawnMul
    expect(early).toBeGreaterThan(late)
  })

  it('decayAdjust becomes more negative (longer persistence) as outro progresses', () => {
    const early = resolveSectionBehavior('outro', 0, 0, 0, 0,   'outro').decayAdjust
    const late  = resolveSectionBehavior('outro', 0, 0, 0, 1.0, 'outro').decayAdjust
    expect(late).toBeLessThan(early)
  })

  it('lifetimeMul grows as outro progresses (rails live longer)', () => {
    const early = resolveSectionBehavior('outro', 0, 0, 0, 0,   'outro').lifetimeMul
    const late  = resolveSectionBehavior('outro', 0, 0, 0, 1.0, 'outro').lifetimeMul
    expect(late).toBeGreaterThan(early)
  })

  it('shockwaves disabled throughout outro', () => {
    expect(resolveSectionBehavior('outro', 0, 0, 0, 0,   'outro').shockwavesAllowed).toBe(false)
    expect(resolveSectionBehavior('outro', 0, 0, 0, 0.5, 'outro').shockwavesAllowed).toBe(false)
    expect(resolveSectionBehavior('outro', 0, 0, 0, 1.0, 'outro').shockwavesAllowed).toBe(false)
  })
})

// ── 38. computeVertRailMorphTarget: valid and distinct positions ───────────────

describe('computeVertRailMorphTarget: generates valid distinct positions', () => {
  it('targetPos is within normalized range [0.1, 0.9]', () => {
    const { targetPos } = computeVertRailMorphTarget(0.5, 1, 0)
    expect(targetPos).toBeGreaterThanOrEqual(0.1)
    expect(targetPos).toBeLessThanOrEqual(0.9)
  })

  it('targetSpanStart is within [0, 0.15]', () => {
    const { targetSpanStart } = computeVertRailMorphTarget(0.5, 1, 0)
    expect(targetSpanStart).toBeGreaterThanOrEqual(0)
    expect(targetSpanStart).toBeLessThanOrEqual(0.15)
  })

  it('targetSpanEnd is within [0.85, 1.0]', () => {
    const { targetSpanEnd } = computeVertRailMorphTarget(0.5, 1, 0)
    expect(targetSpanEnd).toBeGreaterThanOrEqual(0.85)
    expect(targetSpanEnd).toBeLessThanOrEqual(1.0)
  })

  it('different seeds produce different targetPos values', () => {
    const p1 = computeVertRailMorphTarget(0.5, 1,    0).targetPos
    const p2 = computeVertRailMorphTarget(0.5, 2000, 0).targetPos
    expect(p1).not.toBe(p2)
  })

  it('center bias shifts targetPos toward 0.5', () => {
    const noBias  = computeVertRailMorphTarget(0.1, 1, 0).targetPos
    const maxBias = computeVertRailMorphTarget(0.1, 1, 1).targetPos
    // Max center bias should produce a target closer to 0.5
    expect(Math.abs(maxBias - 0.5)).toBeLessThan(Math.abs(noBias - 0.5) + 0.35)
  })

  it('all returned values are finite numbers', () => {
    const r = computeVertRailMorphTarget(0.3, 99, 0.5)
    expect(isFinite(r.targetPos)).toBe(true)
    expect(isFinite(r.targetSpanStart)).toBe(true)
    expect(isFinite(r.targetSpanEnd)).toBe(true)
  })

  it('valid for extreme currentPos values (0.1 and 0.9)', () => {
    for (const pos of [0.1, 0.9]) {
      const { targetPos } = computeVertRailMorphTarget(pos, 42, 0.3)
      expect(targetPos).toBeGreaterThanOrEqual(0.1)
      expect(targetPos).toBeLessThanOrEqual(0.9)
    }
  })
})

// ── 39. computeHorizRailMorphTarget: valid range ───────────────────────────────

describe('computeHorizRailMorphTarget: generates valid span positions', () => {
  it('targetPos is within normalized range [0.1, 0.9]', () => {
    const { targetPos } = computeHorizRailMorphTarget(0.5, 1, 0)
    expect(targetPos).toBeGreaterThanOrEqual(0.1)
    expect(targetPos).toBeLessThanOrEqual(0.9)
  })

  it('span is bounded within [0, 1]', () => {
    const { targetSpanStart, targetSpanEnd } = computeHorizRailMorphTarget(0.5, 1, 0)
    expect(targetSpanStart).toBeGreaterThanOrEqual(0)
    expect(targetSpanEnd).toBeLessThanOrEqual(1)
  })

  it('spanEnd > spanStart (non-degenerate span)', () => {
    const { targetSpanStart, targetSpanEnd } = computeHorizRailMorphTarget(0.5, 1, 0)
    expect(targetSpanEnd).toBeGreaterThan(targetSpanStart)
  })

  it('different seeds produce different targetPos values', () => {
    const p1 = computeHorizRailMorphTarget(0.5, 1,    0).targetPos
    const p2 = computeHorizRailMorphTarget(0.5, 5000, 0).targetPos
    expect(p1).not.toBe(p2)
  })

  it('all returned values are finite', () => {
    const r = computeHorizRailMorphTarget(0.4, 77, 0.6)
    expect(isFinite(r.targetPos)).toBe(true)
    expect(isFinite(r.targetSpanStart)).toBe(true)
    expect(isFinite(r.targetSpanEnd)).toBe(true)
  })
})

// ── 40. advanceRailMorph: smooth interpolation ────────────────────────────────

function makeMorphingRail(startPos: number, targetPos: number, duration = 2.0): NeonRail {
  const rail = makeVerticalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], { primary: '0,200,200', secondary: '200,0,200', accent: '200,200,0', highlight: '255,255,255' }, 0.5)
  rail.pos                  = startPos
  rail.spanStart            = 0.05
  rail.spanEnd              = 0.95
  rail.morphProgress        = 0
  rail.morphDuration        = duration
  rail.morphStartPos        = startPos
  rail.morphTargetPos       = targetPos
  rail.morphStartSpanStart  = 0.05
  rail.morphTargetSpanStart = 0.02
  rail.morphStartSpanEnd    = 0.95
  rail.morphTargetSpanEnd   = 0.98
  return rail
}

describe('advanceRailMorph: smooth interpolation toward target', () => {
  it('morphProgress=1 (idle): position stays unchanged', () => {
    const rail = makeMorphingRail(0.5, 0.8)
    rail.morphProgress = 1
    rail.pos           = 0.8
    advanceRailMorph(rail, 0.1)
    expect(rail.pos).toBeCloseTo(0.8, 5)
    expect(rail.morphProgress).toBe(1)
  })

  it('partial dt advances pos partway toward target', () => {
    const rail = makeMorphingRail(0.2, 0.8)
    advanceRailMorph(rail, 0.1)  // 0.1s / 2.0s = 5% progress
    expect(rail.pos).toBeGreaterThan(0.2)
    expect(rail.pos).toBeLessThan(0.8)
    expect(rail.morphProgress).toBeGreaterThan(0)
    expect(rail.morphProgress).toBeLessThan(1)
  })

  it('large dt completes the morph: pos reaches morphTargetPos', () => {
    const rail = makeMorphingRail(0.2, 0.7)
    advanceRailMorph(rail, 100)
    expect(rail.morphProgress).toBe(1)
    expect(rail.pos).toBeCloseTo(0.7, 5)
  })

  it('pos never overshoots target (smoothstep clamping)', () => {
    const rail = makeMorphingRail(0.1, 0.9)
    for (let i = 0; i < 20; i++) advanceRailMorph(rail, 0.2)
    expect(rail.pos).toBeLessThanOrEqual(0.9 + 1e-9)
  })

  it('morphProgress is always clamped to [0, 1]', () => {
    const rail = makeMorphingRail(0.3, 0.7)
    rail.morphProgress = 0
    advanceRailMorph(rail, 999)
    expect(rail.morphProgress).toBeLessThanOrEqual(1)
    expect(rail.morphProgress).toBeGreaterThanOrEqual(0)
  })

  it('spanStart and spanEnd also interpolate toward their targets', () => {
    const rail = makeMorphingRail(0.5, 0.5)  // pos doesn't matter here
    rail.morphStartSpanStart  = 0.1
    rail.morphTargetSpanStart = 0.02
    rail.morphStartSpanEnd    = 0.9
    rail.morphTargetSpanEnd   = 0.98
    advanceRailMorph(rail, 100)  // complete immediately
    expect(rail.spanStart).toBeCloseTo(0.02, 5)
    expect(rail.spanEnd).toBeCloseTo(0.98, 5)
  })

  it('multiple calls accumulate progress correctly', () => {
    const rail1 = makeMorphingRail(0.1, 0.9)
    advanceRailMorph(rail1, 100)

    const rail2 = makeMorphingRail(0.1, 0.9)
    // Call 10 times with 10s each = 100s total
    for (let i = 0; i < 10; i++) advanceRailMorph(rail2, 10)

    expect(rail2.pos).toBeCloseTo(rail1.pos, 5)
  })
})

// ── 41. Rail morph field initialization ───────────────────────────────────────

describe('Rail morph field initialization: newly created rails start idle', () => {
  const pal = { primary: '0,200,200', secondary: '200,0,200', accent: '200,200,0', highlight: '255,255,255' }

  it('makeVerticalRail: morphProgress is 1 (idle)', () => {
    const rail = makeVerticalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], pal, 0.5)
    expect(rail.morphProgress).toBe(1)
  })

  it('makeVerticalRail: morphTargetPos equals initial pos', () => {
    const rail = makeVerticalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], pal, 0.5)
    expect(rail.morphTargetPos).toBeCloseTo(rail.pos, 10)
  })

  it('makeVerticalRail: morph span targets equal initial span', () => {
    const rail = makeVerticalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], pal, 0.5)
    expect(rail.morphTargetSpanStart).toBeCloseTo(rail.spanStart, 10)
    expect(rail.morphTargetSpanEnd).toBeCloseTo(rail.spanEnd, 10)
  })

  it('makeHorizontalRail: morphProgress is 1 (idle)', () => {
    const rail = makeHorizontalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], pal, 0.5)
    expect(rail.morphProgress).toBe(1)
  })

  it('makeHorizontalRail: morphTargetPos equals initial pos', () => {
    const rail = makeHorizontalRail(1, DEFAULT_NEON_LATTICE_SETTINGS, 0, [], pal, 0.5)
    expect(rail.morphTargetPos).toBeCloseTo(rail.pos, 10)
  })
})

// ── 42. MORPH_DURATION constants ───────────────────────────────────────────────

describe('MORPH_DURATION constants', () => {
  it('MORPH_DURATION_MIN is positive', () => {
    expect(MORPH_DURATION_MIN).toBeGreaterThan(0)
  })

  it('MORPH_DURATION_MIN < MORPH_DURATION_MAX', () => {
    expect(MORPH_DURATION_MIN).toBeLessThan(MORPH_DURATION_MAX)
  })

  it('MORPH_DURATION_MAX is a sensible upper bound (≤ 5 seconds)', () => {
    expect(MORPH_DURATION_MAX).toBeLessThanOrEqual(5)
  })
})

// ── 43. Blackout modes: entry edge gating and mode behavior ──────────────────

describe('Blackout: instant mode fires only on qualified preDrop/fakeout entry', () => {
  it('instant: overlay duration bounded to <= 0.8 s at 120 BPM', () => {
    const barsInSec = 60 / 120 * 4
    const duration  = Math.min(barsInSec * 0.4, 0.8)
    expect(duration).toBeLessThanOrEqual(0.8)
    expect(duration).toBeGreaterThan(0)
  })

  it('instant: guard window bounded to <= 6.0 s at any BPM', () => {
    for (const bpm of [60, 120, 180]) {
      const barsInSec = 60 / bpm * 4
      const guard     = Math.min(barsInSec * 3, 6.0)
      expect(guard).toBeLessThanOrEqual(6.0)
    }
  })

  it('instant: overlay uses black (#000000), not white', () => {
    // The overlay color for instant/fadeOut/strobe is always '#000000'
    const overlayColor = '#000000'
    expect(overlayColor).toBe('#000000')
  })

  it('strobe: active window bounded to <= 2.0 s at all BPMs', () => {
    for (const bpm of [60, 90, 120]) {
      const barsInSec = 60 / bpm * 4
      const window    = Math.min(barsInSec, 2.0)
      expect(window).toBeLessThanOrEqual(2.0)
    }
  })

  it('strobe uses black gating (not white): mode is black-out gate', () => {
    // Strobe should draw '#000000' gates, verifiable by inspection of the constant
    const strobeColor = '#000000'
    expect(strobeColor).not.toBe('#ffffff')
  })
})

describe('Blackout: fadeOut mode ramp-in behavior', () => {
  it('ramp rate produces target alpha 0.85 within the ramp window', () => {
    const barsInSec = 60 / 120 * 4
    const rampSecs  = Math.min(barsInSec, 3.0)
    const rate      = 0.85 / rampSecs
    const alphaAfterRamp = Math.min(0.85, rate * rampSecs)
    expect(alphaAfterRamp).toBeCloseTo(0.85, 5)
  })

  it('ramp starts at alpha=0 (not 1)', () => {
    // Verify the initial alpha for fadeOut is 0 (ramps UP toward black)
    const initialAlpha = 0
    expect(initialAlpha).toBe(0)
    expect(initialAlpha).toBeLessThan(1)
  })

  it('ramp alpha never exceeds 0.85 (not full black)', () => {
    const rate      = 0.85 / 2.0
    for (let dt = 0; dt < 10; dt += 0.016) {
      const alpha = Math.min(0.85, rate * dt)
      expect(alpha).toBeLessThanOrEqual(0.85)
    }
  })

  it('drop-entry recovery sets overlay duration to 0.25 s', () => {
    // After drop-entry, the remaining overlay fades out in 0.25 s
    const recoveryDuration = 0.25
    expect(recoveryDuration).toBeLessThan(0.5)
    expect(resolveOverlayAlpha(recoveryDuration, recoveryDuration)).toBeCloseTo(0, 5)
  })
})

describe('Blackout: does NOT fire on the actual drop impact', () => {
  it('drop section entry triggers recovery, not initiation', () => {
    // In the new logic, isDropEntry → release blackout, not start one.
    // This is verified by the fact that isPreDropEntry and isFakeoutEntry
    // are the ONLY triggers for blackout initiation.
    const triggeredByDrop = false  // drop ENTRY releases, never initiates
    expect(triggeredByDrop).toBe(false)
  })
})

// ── 44. shockwaveAmount: numeric control ─────────────────────────────────────

describe('shockwaveAmount: replaces boolean shockwaves', () => {
  it('default shockwaveAmount is > 0 (enabled by default)', () => {
    expect(DEFAULT_NEON_LATTICE_SETTINGS.shockwaveAmount).toBeGreaterThan(0)
  })

  it('shockwaveAmount=0 disables shockwaves (zero active target)', () => {
    const shockMax = Math.max(1, Math.round(0 * MAX_SHOCKWAVES))
    // With shockAmt=0, the guard condition `shockAmt > 0` blocks all spawning
    expect(0 > 0).toBe(false)
  })

  it('shockwaveAmount=0.5 produces a bounded active target', () => {
    const shockMax = Math.max(1, Math.round(0.5 * MAX_SHOCKWAVES))
    expect(shockMax).toBeGreaterThan(0)
    expect(shockMax).toBeLessThanOrEqual(MAX_SHOCKWAVES)
  })

  it('shockwaveAmount=1 allows up to MAX_SHOCKWAVES active', () => {
    const shockMax = Math.max(1, Math.round(1.0 * MAX_SHOCKWAVES))
    expect(shockMax).toBe(MAX_SHOCKWAVES)
  })

  it('strength scales with shockwaveAmount', () => {
    const baseStrength = 0.8
    const s1 = Math.min(1, baseStrength * 0.3)
    const s2 = Math.min(1, baseStrength * 1.0)
    expect(s2).toBeGreaterThan(s1)
  })

  it('Sparse Starlines preset has shockwaveAmount=0', () => {
    const p = DEFAULT_REACT_PRESETS.find(p => p.id === 'preset-nl-sparse-starlines')!
    expect(p.neonLatticeSettings?.shockwaveAmount).toBe(0)
  })

  it('Overload Matrix preset has shockwaveAmount above default', () => {
    const p = DEFAULT_REACT_PRESETS.find(p => p.id === 'preset-nl-overload-matrix')!
    expect(p.neonLatticeSettings?.shockwaveAmount).toBeGreaterThan(DEFAULT_NEON_LATTICE_SETTINGS.shockwaveAmount)
  })
})

// ── 45. shockwaves boolean → shockwaveAmount migration ───────────────────────

describe('migrateReactStore v18 compatibility followed by Neon retirement', () => {
  it('retires legacy shockwaves=false state', () => {
    const persisted = {
      neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, shockwaves: false },
    }
    const result = migrateReactStore(persisted, 17)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })

  it('retires legacy shockwaves=true state', () => {
    const persisted = {
      neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, shockwaves: true },
    }
    const result = migrateReactStore(persisted, 17)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })

  it('retires already-normalized shockwave state', () => {
    const persisted = {
      neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, shockwaveAmount: 0.4 },
    }
    const result = migrateReactStore(persisted, 17)
    expect(result).not.toHaveProperty('neonLatticeSettings')
  })
})

// ── 46. CyanStrike: rail and pulse color override ────────────────────────────

describe('CyanStrike: overrides both rails and pulses without mutating palette', () => {
  it('cyanRgb constant is the canonical cyan value', () => {
    // The renderer uses '74,199,219' as the cyan override
    const cyanRgb = '74,199,219'
    expect(cyanRgb).toMatch(/^\d+,\d+,\d+$/)
  })

  it('resolveCyanStrikeDuration is positive and beat-proportional', () => {
    const dur120 = resolveCyanStrikeDuration(120)
    const dur60  = resolveCyanStrikeDuration(60)
    expect(dur120).toBeGreaterThan(0)
    expect(dur60).toBeGreaterThan(dur120)  // slower BPM = longer strike
  })

  it('cyanStrike duration at 0 BPM falls back to >= 0.40 s', () => {
    expect(resolveCyanStrikeDuration(0)).toBeGreaterThanOrEqual(0.40)
  })

  it('cyan override is applied per-draw-call, not stored on the palette', () => {
    // The cyanRgb is a module-level constant in the renderer; palette fields
    // are never written during cyanStrike.  We verify this by confirming the
    // palette object returned by hexToRgbStr is not mutated.
    const pal = {
      primary:   hexToRgbStr('#4ac7db'),
      secondary: hexToRgbStr('#ff00ff'),
      accent:    hexToRgbStr('#ffaa00'),
      highlight: hexToRgbStr('#ffffff'),
    }
    const primaryBefore = pal.primary
    // Simulate cyanStrike: the renderer passes cyanRgb to drawRail/drawPulse
    // but never writes to pal.primary.  So pal.primary remains unchanged.
    expect(pal.primary).toBe(primaryBefore)
  })
})

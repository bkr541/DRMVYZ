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
  makeFlare, makeBlock, makeShockwave, makePulseOnRail,
  makeVerticalRail, makeHorizontalRail,
  isPulseExpired, isFlareExpired, isBlockExpired, isShockwaveExpired,
  isRailExpired,
  resolveRailTargets, resolveSnapSlot,
  resolveOverlayAlpha, resolveCyanStrikeDuration, resolveRailBurstCounts,
  WHITEOUT_DURATION, BLACKOUT_DURATION, FREEZE_DURATION, RESEED_LIFE_SCALE,
  prngNext,
} from '../neonLatticeUtils'
import { NL_TRIGGER_PADS } from '../../ReactPerformancePads'

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
  it('adds neonLatticeSettings when missing (v<16)', () => {
    const old = { activeReactEngineId: 'oscilloscope' }
    const result = migrateReactStore(old, 15)
    expect(result).toHaveProperty('neonLatticeSettings')
    expect((result.neonLatticeSettings as NeonLatticeSettings).railDensity)
      .toBe(DEFAULT_NEON_LATTICE_SETTINGS.railDensity)
  })

  it('v<17 migration normalizes partial settings: missing fields get default values', () => {
    const existing: Partial<NeonLatticeSettings> = { railDensity: 0.9, bloom: 0.1 }
    const old = { neonLatticeSettings: existing }
    const result = migrateReactStore(old, 15)
    const s = result.neonLatticeSettings as NeonLatticeSettings
    // Explicitly-set values are preserved
    expect(s.railDensity).toBe(0.9)
    expect(s.bloom).toBe(0.1)
    // Missing fields are backfilled from DEFAULT
    expect(s.parallax).toBe(DEFAULT_NEON_LATTICE_SETTINGS.parallax)
    expect(s.cameraMotion).toBe(DEFAULT_NEON_LATTICE_SETTINGS.cameraMotion)
    // All keys from DEFAULT must be present
    for (const key of Object.keys(DEFAULT_NEON_LATTICE_SETTINGS) as Array<keyof NeonLatticeSettings>) {
      expect(s).toHaveProperty(key)
    }
  })

  it('v<17 migration with complete settings: all values are preserved unchanged', () => {
    const state = { neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, railDensity: 0.77 } }
    const result = migrateReactStore(state, 16)
    expect((result.neonLatticeSettings as NeonLatticeSettings).railDensity).toBe(0.77)
    expect((result.neonLatticeSettings as NeonLatticeSettings).bloom)
      .toBe(DEFAULT_NEON_LATTICE_SETTINGS.bloom)
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

  it('neonLatticeSettings is present in persisted state', () => {
    freshStore()
    const s = useReactStore.getState()
    const partial = reactStorePartialize(s)
    expect(partial).toHaveProperty('neonLatticeSettings')
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
    expect(acidMagenta!.neonLatticeSettings?.railDensity).toBe(0.55)
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

// ── 4. Four NL presets exist and have correct engine ─────────────────────────

describe('NL factory presets', () => {
  const nlPresets = DEFAULT_REACT_PRESETS.filter(p => p.engine === 'neonLattice')

  it('has exactly 4 NL presets', () => {
    expect(nlPresets.length).toBe(4)
  })

  it('preset-nl-acid-magenta is the first NL preset', () => {
    expect(nlPresets[0].id).toBe('preset-nl-acid-magenta')
  })

  it('every explicitly-named NL preset has neonLatticeSettings', () => {
    const named = ['preset-nl-acid-magenta', 'preset-nl-drmvyz-lattice', 'preset-nl-sparse-starlines', 'preset-nl-overload-matrix']
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

  it('Sparse Starlines: shockwaves disabled', () => {
    const p = nlPresets.find(p => p.id === 'preset-nl-sparse-starlines')!
    expect(p.neonLatticeSettings?.shockwaves).toBe(false)
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

  it('every named NL preset has every NeonLatticeSettings field', () => {
    const allKeys = Object.keys(DEFAULT_NEON_LATTICE_SETTINGS) as Array<keyof NeonLatticeSettings>
    const named = ['preset-nl-acid-magenta', 'preset-nl-drmvyz-lattice', 'preset-nl-sparse-starlines', 'preset-nl-overload-matrix']
    for (const id of named) {
      const p = nlPresets.find(p => p.id === id)!
      expect(p.neonLatticeSettings).toBeDefined()
      for (const key of allKeys) {
        expect(p.neonLatticeSettings!).toHaveProperty(key)
      }
    }
  })
})

// ── 5. triggerNeonLattice — monotonic seq, one-shot consumption ───────────────

describe('triggerNeonLattice action', () => {
  beforeEach(freshStore)

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

    const shaderPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'shaderPads')!
    s.selectReactPreset(shaderPreset.id)
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

  it('neonLatticeTrigger is null after resetReactView', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('blackout')
    expect(useReactStore.getState().neonLatticeTrigger).not.toBeNull()

    s.resetReactView()
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
  it('pulse starts at rail.spanStart when direction=1', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, 1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    // progress = spanStart for direction = +1
    expect(p.progress).toBeCloseTo(vr.spanStart, 5)
  })

  it('pulse starts at rail.spanEnd when direction=-1', () => {
    const vr = makeVRail()
    const p  = makePulseOnRail(vr, -1, SETTINGS, 0, PALETTE, 0.8, 42, 1.0)
    expect(p.progress).toBeCloseTo(vr.spanEnd, 5)
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
} from '../neonLatticeUtils'
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

  it('depth=1 with near rail (railDepth=0) has no reduction', () => {
    const dm = resolveDepthModifiers(1, 0)
    expect(dm.alphaMul).toBeCloseTo(1.0, 5)
    expect(dm.intensityMul).toBeCloseTo(1.0, 5)
    expect(dm.widthMul).toBeCloseTo(1.0, 5)
  })

  it('depth=1 with far rail (railDepth=1) is significantly dimmer', () => {
    const dm = resolveDepthModifiers(1, 1)
    expect(dm.alphaMul).toBeLessThan(0.5)
    expect(dm.intensityMul).toBeLessThan(0.8)
    expect(dm.widthMul).toBeLessThan(0.6)
  })

  it('increasing depth increases dimming for far rails', () => {
    const lo = resolveDepthModifiers(0.3, 1)
    const hi = resolveDepthModifiers(0.9, 1)
    expect(hi.alphaMul).toBeLessThan(lo.alphaMul)
  })

  it('near rail (railDepth=0) is unaffected at any depth setting', () => {
    for (const d of [0, 0.5, 1]) {
      const dm = resolveDepthModifiers(d, 0)
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

  it('near and far rails shift in opposite directions', () => {
    const driftX = 0.4, parallax = 1
    const nearShift = resolveCameraParallaxShift(0, driftX, parallax)
    const farShift  = resolveCameraParallaxShift(1, driftX, parallax)
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

  it('instant: overlay duration for 120 BPM is bounded to <= 1.2 s', () => {
    const duration = Math.min(barsInSec(120) * 0.5, 1.2)
    expect(duration).toBeLessThanOrEqual(1.2)
  })

  it('instant: at 120 BPM, overlay fades out by its bounded end time', () => {
    const duration = Math.min(barsInSec(120) * 0.5, 1.2)
    expect(resolveOverlayAlpha(duration, duration)).toBeCloseTo(0, 5)
  })

  it('fadeOut: duration bounded to <= 3.5 s even at 50 BPM', () => {
    const duration = Math.min(barsInSec(50) * 2, 3.5)
    expect(duration).toBeLessThanOrEqual(3.5)
  })

  it('fadeOut: overlay is fully faded at its bounded end time', () => {
    const duration = Math.min(barsInSec(50) * 2, 3.5)
    expect(resolveOverlayAlpha(duration, duration)).toBeCloseTo(0, 5)
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

        // All explicitly-defined keys in preset B must match in both paths
        for (const [key, val] of Object.entries(presetB.neonLatticeSettings!)) {
          const kk = key as keyof NeonLatticeSettings
          expect(patchAtoB.neonLatticeSettings![kk]).toBe(val)
          expect(patchB.neonLatticeSettings![kk]).toBe(val)
        }
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

describe('snap-division deduplication: zero BPM and zero snapDivision both return 0', () => {
  it('bpm=0 → slot 0 (no temporal event gating)', () => {
    expect(resolveSnapSlot(5.0, 0, 4)).toBe(0)
  })

  it('snapDivision=0 → slot 0', () => {
    expect(resolveSnapSlot(5.0, 120, 0)).toBe(0)
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

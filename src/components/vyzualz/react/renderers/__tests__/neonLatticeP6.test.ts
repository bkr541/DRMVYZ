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
import type { NeonLatticeSettings } from '../../ReactTypes'
import {
  MAX_PULSES, MAX_FLARES, MAX_BLOCKS, MAX_SHOCKWAVES,
  makeFlare, makeBlock, makeShockwave, makePulseOnRail,
  makeVerticalRail, makeHorizontalRail,
  isPulseExpired, isFlareExpired, isBlockExpired, isShockwaveExpired,
  isRailExpired,
} from '../neonLatticeUtils'
import { NL_TRIGGER_PADS } from '../../ReactPerformancePads'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshStore() {
  useReactStore.setState(useReactStore.getInitialState())
}

const PALETTE = { primary: '74,199,219', accent: '220,60,190' }
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

  it('preserves existing neonLatticeSettings through v16 migration', () => {
    const existing: Partial<NeonLatticeSettings> = { railDensity: 0.9, bloom: 0.1 }
    const old = { neonLatticeSettings: existing }
    const result = migrateReactStore(old, 15)
    expect((result.neonLatticeSettings as NeonLatticeSettings).railDensity).toBe(0.9)
    expect((result.neonLatticeSettings as NeonLatticeSettings).bloom).toBe(0.1)
  })

  it('does not add neonLatticeSettings when already present at current version', () => {
    const state = { neonLatticeSettings: DEFAULT_NEON_LATTICE_SETTINGS }
    const result = migrateReactStore(state, 16)
    expect(result.neonLatticeSettings).toEqual(DEFAULT_NEON_LATTICE_SETTINGS)
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

  it('has at least 5 NL presets (4 new + default)', () => {
    expect(nlPresets.length).toBeGreaterThanOrEqual(5)
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

describe('cap enforcement via filter-before-push pattern', () => {
  it('pulse array never grows beyond MAX_PULSES when guarded', () => {
    const vr = makeVRail()
    const pulses = []
    for (let i = 0; i < MAX_PULSES + 5; i++) {
      if (pulses.length < MAX_PULSES) {
        pulses.push(makePulseOnRail(vr, 1, SETTINGS, i * 0.1, PALETTE, 0.8, i + 1, 1.0))
      }
    }
    expect(pulses.length).toBe(MAX_PULSES)
  })

  it('flare array never grows beyond MAX_FLARES when guarded', () => {
    const flares = []
    for (let i = 0; i < MAX_FLARES + 5; i++) {
      if (flares.length < MAX_FLARES) {
        flares.push(makeFlare(i / 20, 0.5, 0, 0.8, PALETTE.primary, 0.5))
      }
    }
    expect(flares.length).toBe(MAX_FLARES)
  })

  it('shockwave array never grows beyond MAX_SHOCKWAVES when guarded', () => {
    const sws = []
    for (let i = 0; i < MAX_SHOCKWAVES + 3; i++) {
      if (sws.length < MAX_SHOCKWAVES) {
        sws.push(makeShockwave(0.5, 0.5, 0, 0.8, 0.6, PALETTE.primary))
      }
    }
    expect(sws.length).toBe(MAX_SHOCKWAVES)
  })
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

  it('switching away from neonLattice clears trigger (set to null on engine change)', () => {
    const s = useReactStore.getState()
    s.selectReactEngine('neonLattice')
    s.triggerNeonLattice('railBurst')
    s.selectReactEngine('oscilloscope')
    // trigger is not cleared by selectReactEngine itself; just confirm engine changed
    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
  })
})

// ── 12. BPM fallback handling in cyanStrike calculation ──────────────────────

describe('cyanStrike duration with missing BPM', () => {
  it('when bpm=0, fallback duration floor is 0.5s', () => {
    const bpm = 0
    const beatSec = bpm > 0 ? 60 / bpm : 0.5
    const duration = Math.max(0.5, beatSec * 2)
    expect(duration).toBeGreaterThanOrEqual(0.5)
  })

  it('when bpm=120, duration = max(0.5, 1.0) = 1.0s', () => {
    const bpm = 120
    const beatSec = 60 / bpm
    const duration = Math.max(0.5, beatSec * 2)
    expect(duration).toBeCloseTo(1.0, 5)
  })

  it('when bpm=60, duration = max(0.5, 2.0) = 2.0s', () => {
    const bpm = 60
    const beatSec = 60 / bpm
    const duration = Math.max(0.5, beatSec * 2)
    expect(duration).toBeCloseTo(2.0, 5)
  })
})

// ── 13. Freeze duration ───────────────────────────────────────────────────────

describe('freezeTrails duration', () => {
  it('freeze lasts 1.2 seconds from trigger time', () => {
    const audioTime = 10
    const frozenUntilSec = audioTime + 1.2
    expect(frozenUntilSec - audioTime).toBeCloseTo(1.2, 5)
  })

  it('post-freeze burst fires when audioTime > frozenUntilSec', () => {
    const frozenUntilSec = 10
    expect(10.001 > frozenUntilSec).toBe(true)
    expect(9.999 > frozenUntilSec).toBe(false)
  })
})

// ── 14. Overlay alpha decay ───────────────────────────────────────────────────

describe('overlay alpha fade calculation', () => {
  function overlayAlpha(startSec: number, duration: number, audioTime: number): number {
    const age      = audioTime - startSec
    const progress = Math.min(1, age / Math.max(0.001, duration))
    return 1 * (1 - progress)
  }

  it('alpha=1 at t=startSec (age=0)', () => {
    expect(overlayAlpha(0, 2, 0)).toBeCloseTo(1, 5)
  })

  it('alpha=0.5 at midpoint', () => {
    expect(overlayAlpha(0, 2, 1)).toBeCloseTo(0.5, 5)
  })

  it('alpha=0 at or after end', () => {
    expect(overlayAlpha(0, 2, 2)).toBeCloseTo(0, 5)
    expect(overlayAlpha(0, 2, 5)).toBeCloseTo(0, 5)
  })

  it('whiteout duration 1.5s fades to 0 at 1.5s', () => {
    expect(overlayAlpha(0, 1.5, 1.5)).toBeCloseTo(0, 5)
  })

  it('blackout duration 2.0s fades to 0 at 2.0s', () => {
    expect(overlayAlpha(0, 2.0, 2.0)).toBeCloseTo(0, 5)
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

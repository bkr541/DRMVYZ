import { describe, it, expect, beforeEach } from 'vitest'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
  getLaserDmxBeamMatrixPreset,
  createLaserDmxBeamMatrixPresetSettings,
  summarizePreset,
} from '../../laserDmxBeamMatrixPresets'
import {
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
} from '../../ReactTypes'
import { useReactStore } from '../../../../../stores/reactStore'

// ── Supported target sets (mirrors compiler dispatch tables) ──────────────────
const GROUP_ROUTE_TARGETS  = new Set(['dimmer', 'beamWidth', 'beamDivergence', 'beamGlow', 'strobeRate'])
const GLOBAL_ROUTE_TARGETS = new Set([
  'masterDimmer', 'backgroundFade', 'beamPersistence',
  'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
  'fogDensity', 'fogOpacity', 'fogBeamScatter', 'fogTurbulence',
])
const VALID_MODES    = new Set(['set', 'add', 'multiply', 'trigger'])
const VALID_CURVES   = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut', 'pulse', 'exponential'])
const VALID_GEOMETRY = new Set(['line', 'volumetricCone'])

// ── Registry integrity ────────────────────────────────────────────────────────

describe('LASER_DMX_BEAM_MATRIX_PRESETS registry', () => {
  it('contains exactly 12 presets', () => {
    expect(LASER_DMX_BEAM_MATRIX_PRESETS).toHaveLength(12)
  })

  it('all presets have non-empty id, name, description, category', () => {
    for (const p of LASER_DMX_BEAM_MATRIX_PRESETS) {
      expect(p.id.length).toBeGreaterThan(0)
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
      expect(p.category.length).toBeGreaterThan(0)
    }
  })

  it('all presets have at least one tag', () => {
    for (const p of LASER_DMX_BEAM_MATRIX_PRESETS) {
      expect(p.tags.length).toBeGreaterThan(0)
    }
  })

  it('preset IDs are unique across the registry', () => {
    const ids = LASER_DMX_BEAM_MATRIX_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getLaserDmxBeamMatrixPreset finds presets by id', () => {
    for (const p of LASER_DMX_BEAM_MATRIX_PRESETS) {
      expect(getLaserDmxBeamMatrixPreset(p.id)).toBe(p)
    }
  })

  it('getLaserDmxBeamMatrixPreset returns undefined for unknown id', () => {
    expect(getLaserDmxBeamMatrixPreset('does-not-exist')).toBeUndefined()
  })

  it('createLaserDmxBeamMatrixPresetSettings returns null for unknown id', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('no-such-preset')).toBeNull()
  })
})

// ── Per-preset beam counts ────────────────────────────────────────────────────

describe('preset beam counts', () => {
  it('minimal-crossfire has 4 beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    expect(s.beams).toHaveLength(4)
  })

  it('redline-bass-tunnel has 8 beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('redline-bass-tunnel')!
    expect(s.beams).toHaveLength(8)
  })

  it('blue-snare-crossfire has 10 beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('blue-snare-crossfire')!
    expect(s.beams).toHaveLength(10)
  })

  it('green-beat-pyramid has 6 beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('green-beat-pyramid')!
    expect(s.beams).toHaveLength(6)
  })
})

// ── Fresh object graph isolation ──────────────────────────────────────────────

describe('createSettings produces fresh object graphs', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: two calls return different arrays`, () => {
      const a = preset.createSettings()
      const b = preset.createSettings()
      expect(a).not.toBe(b)
      expect(a.beams).not.toBe(b.beams)
      expect(a.groups).not.toBe(b.groups)
      expect(a.globalModulationRoutes).not.toBe(b.globalModulationRoutes)
      expect(a.output).not.toBe(b.output)
      expect(a.fog).not.toBe(b.fog)
    })

    it(`${preset.id}: mutating one copy does not affect the other`, () => {
      const a = preset.createSettings()
      const b = preset.createSettings()
      a.beams.push({ ...a.beams[0], id: 'injected' })
      expect(b.beams.find(bm => bm.id === 'injected')).toBeUndefined()
    })
  }
})

// ── Internal ID uniqueness ─────────────────────────────────────────────────────

describe('preset internal IDs are unique', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: beam IDs are unique`, () => {
      const s    = preset.createSettings()
      const ids  = s.beams.map(b => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it(`${preset.id}: group IDs are unique`, () => {
      const s   = preset.createSettings()
      const ids = s.groups.map(g => g.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it(`${preset.id}: route IDs within each group are unique`, () => {
      const s = preset.createSettings()
      for (const g of s.groups) {
        const ids = g.modulationRoutes.map(r => r.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    })

    it(`${preset.id}: global route IDs are unique`, () => {
      const s   = preset.createSettings()
      const ids = s.globalModulationRoutes.map(r => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  }
})

// ── Group reference integrity ─────────────────────────────────────────────────

describe('beam group references are valid', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: every beam's groupId refers to an existing group`, () => {
      const s       = preset.createSettings()
      const groupIds = new Set(s.groups.map(g => g.id))
      for (const beam of s.beams) {
        if (beam.groupId !== null) {
          expect(groupIds.has(beam.groupId)).toBe(true)
        }
      }
    })

    it(`${preset.id}: all beams have a non-null groupId`, () => {
      const s = preset.createSettings()
      for (const beam of s.beams) {
        expect(beam.groupId).not.toBeNull()
      }
    })
  }
})

// ── Grid coordinate bounds ────────────────────────────────────────────────────

describe('beam grid coordinates are in-bounds', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: beam origin columns and rows are in bounds`, () => {
      const s = preset.createSettings()
      for (const beam of s.beams) {
        expect(beam.origin.column).toBeGreaterThanOrEqual(1)
        expect(beam.origin.column).toBeLessThanOrEqual(LASER_DMX_MATRIX_COLUMNS)
        expect(beam.origin.row).toBeGreaterThanOrEqual(1)
        expect(beam.origin.row).toBeLessThanOrEqual(LASER_DMX_MATRIX_ROWS)
      }
    })

    it(`${preset.id}: beam grid targets are in bounds`, () => {
      const s = preset.createSettings()
      for (const beam of s.beams) {
        if (beam.target.kind === 'grid') {
          expect(beam.target.column).toBeGreaterThanOrEqual(1)
          expect(beam.target.column).toBeLessThanOrEqual(LASER_DMX_MATRIX_COLUMNS)
          expect(beam.target.row).toBeGreaterThanOrEqual(1)
          expect(beam.target.row).toBeLessThanOrEqual(LASER_DMX_MATRIX_ROWS)
        }
      }
    })
  }
})

// ── Beam count within limit ───────────────────────────────────────────────────

describe('preset beam counts are within limit', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: beam count < ${LASER_DMX_MATRIX_MAX_BEAMS}`, () => {
      const s = preset.createSettings()
      expect(s.beams.length).toBeLessThan(LASER_DMX_MATRIX_MAX_BEAMS)
    })
  }
})

// ── Supported route targets ───────────────────────────────────────────────────

describe('route targets are compiler-supported', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: group route targets are in compileGroupRoutes dispatch`, () => {
      const s = preset.createSettings()
      for (const g of s.groups) {
        for (const r of g.modulationRoutes) {
          expect(GROUP_ROUTE_TARGETS.has(r.target)).toBe(true)
        }
      }
    })

    it(`${preset.id}: global route targets are in applyGlobalRoute dispatch`, () => {
      const s = preset.createSettings()
      for (const r of s.globalModulationRoutes) {
        expect(GLOBAL_ROUTE_TARGETS.has(r.target)).toBe(true)
      }
    })

    it(`${preset.id}: route modes are valid`, () => {
      const s = preset.createSettings()
      const allRoutes = [
        ...s.globalModulationRoutes,
        ...s.groups.flatMap(g => g.modulationRoutes),
        ...s.beams.flatMap(b => b.modulationRoutes),
      ]
      for (const r of allRoutes) {
        expect(VALID_MODES.has(r.mode)).toBe(true)
        expect(VALID_CURVES.has(r.curve)).toBe(true)
      }
    })
  }
})

// ── Beam geometry ─────────────────────────────────────────────────────────────

describe('beam geometry values are valid', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: all beams use a valid geometry`, () => {
      const s = preset.createSettings()
      for (const beam of s.beams) {
        expect(VALID_GEOMETRY.has(beam.appearance.geometry)).toBe(true)
      }
    })
  }
})

// ── volumetricCone geometry ───────────────────────────────────────────────────

describe('green-beat-pyramid uses volumetricCone geometry', () => {
  it('all beams are volumetricCone', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('green-beat-pyramid')!
    for (const beam of s.beams) {
      expect(beam.appearance.geometry).toBe('volumetricCone')
    }
  })
})

// ── Selection cleared on factory output ──────────────────────────────────────

describe('createSettings produces cleared selection state', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: selectedBeamIds is empty`, () => {
      const s = preset.createSettings()
      expect(s.selectedBeamIds).toHaveLength(0)
    })

    it(`${preset.id}: selectedGroupId is null`, () => {
      const s = preset.createSettings()
      expect(s.selectedGroupId).toBeNull()
    })
  }
})

// ── Fog and output value ranges ───────────────────────────────────────────────

describe('fog and output values are in valid ranges', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: fog values are finite and non-negative`, () => {
      const { fog } = preset.createSettings()
      const nums = [fog.density, fog.opacity, fog.noiseScale, fog.driftSpeed,
                    fog.turbulence, fog.diffusion, fog.dissipation, fog.beamScatter,
                    fog.colorAbsorption]
      for (const v of nums) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    })

    it(`${preset.id}: output values are finite and non-negative`, () => {
      const { output } = preset.createSettings()
      const nums = [output.masterDimmer, output.safetyClamp, output.backgroundFade,
                    output.beamPersistence, output.globalBeamWidth, output.globalGlow,
                    output.globalStrobeRate]
      for (const v of nums) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }
    })
  }
})

// ── Route value range sanity ──────────────────────────────────────────────────

describe('route amount/min/max are finite', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: all route amount/min/max are finite`, () => {
      const s = preset.createSettings()
      const allRoutes = [
        ...s.globalModulationRoutes,
        ...s.groups.flatMap(g => g.modulationRoutes),
        ...s.beams.flatMap(b => b.modulationRoutes),
      ]
      for (const r of allRoutes) {
        expect(Number.isFinite(r.amount)).toBe(true)
        expect(Number.isFinite(r.min)).toBe(true)
        expect(Number.isFinite(r.max)).toBe(true)
        expect(Number.isFinite(r.attack)).toBe(true)
        expect(Number.isFinite(r.release)).toBe(true)
      }
    })
  }
})

// ── Group count ───────────────────────────────────────────────────────────────

const EXPECTED_GROUP_COUNTS: Record<string, number> = {
  'minimal-crossfire':    2,
  'redline-bass-tunnel':  2,
  'blue-snare-crossfire': 2,
  'green-beat-pyramid':   2,
  'kick-snare-duel':      2,
  'rgb-reaction-split':   4,
  'ceiling-scanner':      4,
  'laser-cage':           4,
  'build-ladder':         1,
  'drop-starburst':       2,
  'vocal-halo':           2,
  'fog-cathedral':        2,
}

describe('preset group counts', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: has expected group count`, () => {
      const s = preset.createSettings()
      expect(s.groups).toHaveLength(EXPECTED_GROUP_COUNTS[preset.id] ?? 2)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// Presets 5–8 specific tests
// ════════════════════════════════════════════════════════════════════════════

// ── Beam route target set (mirrors applyBeamRoute dispatch) ───────────────────
const BEAM_ROUTE_TARGETS = new Set([
  'dimmer', 'beamWidth', 'beamDivergence', 'focus', 'beamGlow',
  'strobeRate', 'flickerAmount', 'alpha', 'red', 'green', 'blue', 'white',
  'originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY',
])

// ── Category assertions ───────────────────────────────────────────────────────

describe('presets 5–8 appear in correct categories', () => {
  it('kick-snare-duel is multiReactive', () => {
    expect(getLaserDmxBeamMatrixPreset('kick-snare-duel')?.category).toBe('multiReactive')
  })
  it('rgb-reaction-split is multiReactive', () => {
    expect(getLaserDmxBeamMatrixPreset('rgb-reaction-split')?.category).toBe('multiReactive')
  })
  it('ceiling-scanner is rhythmic', () => {
    expect(getLaserDmxBeamMatrixPreset('ceiling-scanner')?.category).toBe('rhythmic')
  })
  it('laser-cage is drop', () => {
    expect(getLaserDmxBeamMatrixPreset('laser-cage')?.category).toBe('drop')
  })
})

// ── Structural counts ─────────────────────────────────────────────────────────

describe('Kick and Snare Duel — structure', () => {
  it('has 12 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('kick-snare-duel')!.beams).toHaveLength(12)
  })
  it('has 2 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('kick-snare-duel')!.groups).toHaveLength(2)
  })
})

describe('RGB Reaction Split — structure', () => {
  it('has 16 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!.beams).toHaveLength(16)
  })
  it('has 4 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!.groups).toHaveLength(4)
  })
})

describe('Ceiling Scanner — structure', () => {
  it('has 8 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!.beams).toHaveLength(8)
  })
  it('has 4 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!.groups).toHaveLength(4)
  })
})

describe('Laser Cage — structure', () => {
  it('has 12 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('laser-cage')!.beams).toHaveLength(12)
  })
  it('has 4 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('laser-cage')!.groups).toHaveLength(4)
  })
})

// ── Group reference resolution ────────────────────────────────────────────────

describe('group references resolve for presets 5–8', () => {
  const newIds = ['kick-snare-duel', 'rgb-reaction-split', 'ceiling-scanner', 'laser-cage']
  for (const id of newIds) {
    it(`${id}: every beam's non-null groupId exists in groups`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      const groupIds = new Set(s.groups.map(g => g.id))
      for (const beam of s.beams) {
        if (beam.groupId !== null) expect(groupIds.has(beam.groupId)).toBe(true)
      }
    })
  }
})

// ── Stage target bounds ───────────────────────────────────────────────────────

describe('RGB Reaction Split — green cone stage targets are in bounds', () => {
  it('all stage x values are in [-1, 2]', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!
    const stageTargets = s.beams.filter(b => b.target.kind === 'stage').map(b => b.target as { kind: 'stage'; x: number; y: number; z: number })
    expect(stageTargets.length).toBeGreaterThan(0)
    for (const t of stageTargets) {
      expect(t.x).toBeGreaterThanOrEqual(-1)
      expect(t.x).toBeLessThanOrEqual(2)
      expect(t.y).toBeGreaterThanOrEqual(-1)
      expect(t.y).toBeLessThanOrEqual(2)
    }
  })

  it('exactly 4 beams use stage targets (the green cones)', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!
    const stageBeams = s.beams.filter(b => b.target.kind === 'stage')
    expect(stageBeams).toHaveLength(4)
  })
})

// ── Volumetric cone geometry ──────────────────────────────────────────────────

describe('RGB Reaction Split — green beams use volumetricCone', () => {
  it('all stage-target beams are volumetricCone', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!
    const stageBeams = s.beams.filter(b => b.target.kind === 'stage')
    for (const b of stageBeams) expect(b.appearance.geometry).toBe('volumetricCone')
  })
  it('no grid-target beam uses volumetricCone in this preset', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('rgb-reaction-split')!
    const gridBeams = s.beams.filter(b => b.target.kind === 'grid')
    for (const b of gridBeams) expect(b.appearance.geometry).toBe('line')
  })
})

// ── Ceiling Scanner — mirrored phase behavior ─────────────────────────────────

describe('Ceiling Scanner — mirrored phase behavior', () => {
  it('Sweep A beams have beatPhase→targetOffsetX with invert: false', () => {
    const s      = createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!
    const sweepA = s.groups.find(g => g.id.includes('sweep-a'))!
    const sweepABeams = s.beams.filter(b => b.groupId === sweepA.id)
    expect(sweepABeams.length).toBeGreaterThan(0)
    for (const beam of sweepABeams) {
      const route = beam.modulationRoutes.find(r => r.source === 'beatPhase' && r.target === 'targetOffsetX')
      expect(route).toBeDefined()
      expect(route!.invert).toBe(false)
    }
  })

  it('Sweep B beams have beatPhase→targetOffsetX with invert: true', () => {
    const s      = createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!
    const sweepB = s.groups.find(g => g.id.includes('sweep-b'))!
    const sweepBBeams = s.beams.filter(b => b.groupId === sweepB.id)
    expect(sweepBBeams.length).toBeGreaterThan(0)
    for (const beam of sweepBBeams) {
      const route = beam.modulationRoutes.find(r => r.source === 'beatPhase' && r.target === 'targetOffsetX')
      expect(route).toBeDefined()
      expect(route!.invert).toBe(true)
    }
  })

  it('every beam has exactly one beam-level route', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!
    for (const b of s.beams) expect(b.modulationRoutes).toHaveLength(1)
  })

  it('all beam-level routes use a compiler-supported target', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('ceiling-scanner')!
    for (const b of s.beams) {
      for (const r of b.modulationRoutes) {
        expect(BEAM_ROUTE_TARGETS.has(r.target)).toBe(true)
      }
    }
  })
})

// ── Laser Cage — beam type counts ────────────────────────────────────────────

describe('Laser Cage — exactly 4 horizontal, 4 vertical, 4 diagonal beams', () => {
  it('4 horizontal beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('laser-cage')!
    expect(s.beams.filter(b => b.id.includes(':horiz:'))).toHaveLength(4)
  })
  it('4 vertical beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('laser-cage')!
    expect(s.beams.filter(b => b.id.includes(':vert:'))).toHaveLength(4)
  })
  it('4 diagonal beams', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('laser-cage')!
    expect(s.beams.filter(b => b.id.includes(':diag:'))).toHaveLength(4)
  })
  it('Drop Impact group has no beams assigned', () => {
    const s    = createLaserDmxBeamMatrixPresetSettings('laser-cage')!
    const drop = s.groups.find(g => g.id.includes('drop-impact'))!
    expect(s.beams.filter(b => b.groupId === drop.id)).toHaveLength(0)
  })
})

// ── Every route is supported at its selected scope ────────────────────────────

describe('presets 5–8 route scope validation', () => {
  const newPresets = ['kick-snare-duel', 'rgb-reaction-split', 'ceiling-scanner', 'laser-cage']

  for (const id of newPresets) {
    it(`${id}: group routes use compileGroupRoutes-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const g of s.groups) {
        for (const r of g.modulationRoutes) {
          expect(GROUP_ROUTE_TARGETS.has(r.target)).toBe(true)
        }
      }
    })

    it(`${id}: global routes use applyGlobalRoute-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const r of s.globalModulationRoutes) {
        expect(GLOBAL_ROUTE_TARGETS.has(r.target)).toBe(true)
      }
    })

    it(`${id}: beam-level routes use applyBeamRoute-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const b of s.beams) {
        for (const r of b.modulationRoutes) {
          expect(BEAM_ROUTE_TARGETS.has(r.target)).toBe(true)
        }
      }
    })
  }
})

// ── Compile safety — no NaN/Infinity in output ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBaseMiFrame(): any {
  return {
    frameId: 1,
    bands:   { sub: 0.2, bass: 0.5, lowMid: 0.3, mid: 0.2, high: 0.15, air: 0.05, volume: 0.4,
               normalizedSub: 0.2, normalizedBass: 0.6, normalizedLowMid: 0.3, normalizedMid: 0.25, normalizedHigh: 0.2, normalizedAir: 0.1 },
    rhythm:  { beatHit: true, kickHit: true, snareHit: false, hatHit: false, downbeatHit: false,
               phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
               beatPhase: 0.5, bpm: 128, transient: 0.8, kickStrength: 0.7, snareStrength: 0, hatStrength: 0 },
    energy:  { instant: 0.5, shortTerm: 0.4, longTerm: 0.3, spectralFlux: 0.3, tension: 0.2,
               complexity: 0.3, buildProgress: 0.4, dropImpact: 0.6, rms: 0.4, peak: 0.6,
               crestFactor: 8, percentile: 0.5, delta: 0.1,
               spectralCentroid: 0.4, spectralSpread: 0.3, spectralRolloff: 0.5, spectralFlatness: 0.2 },
    harmonic:{ pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: null },
    stems:   { vocals: 0, drums: 0.5, bass: 0, instruments: 0, other: 0,
               bassStemEnergy: 0.4, instrumentEnergy: 0.2, otherStemEnergy: 0, vocalEnergy: 0,
               drumEnergy: 0.5, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics:  { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: null },
    section: { type: 'unknown', progress: 0, intensity: 0, label: '', startSec: 0, endSec: 60, confidence: 0, source: 'heuristic' },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeNoHitMiFrame(): any {
  return { ...makeBaseMiFrame(), rhythm: { ...makeBaseMiFrame().rhythm, beatHit: false, kickHit: false, downbeatHit: false } }
}

describe('presets 5–8 compile safely under a representative MI frame', () => {
  const newIds = ['kick-snare-duel', 'rgb-reaction-split', 'ceiling-scanner', 'laser-cage']

  for (const id of newIds) {
    it(`${id}: compileLaserDmxBeamMatrix produces no NaN or Infinity`, async () => {
      const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
      resetBeamMatrixCompilerState()
      const settings = createLaserDmxBeamMatrixPresetSettings(id)!
      const result = compileLaserDmxBeamMatrix({
        settings, mi: makeBaseMiFrame(), time: 0, timeSec: 0.016,
        canvasWidth: 1280, canvasHeight: 720,
      })
      // All compiled beams must have finite numeric properties
      for (const b of result.beams) {
        const nums = [b.intensity, b.beamWidth, b.glow, b.rgba.r, b.rgba.g, b.rgba.b, b.rgba.a]
        for (const v of nums) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
      // Fog and output scalars must be finite
      const fogNums = [result.fog.density, result.fog.opacity, result.fog.beamScatter, result.fog.turbulence]
      for (const v of fogNums) expect(Number.isFinite(v)).toBe(true)
    })
  }
})

// ── Trigger routes produce visible release tails ──────────────────────────────

describe('trigger routes produce visible release tails after a hit', () => {
  beforeEach(async () => {
    const { resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
  })

  it('kick-snare-duel: kickHit trigger envelope has value > 0 one frame after hit', async () => {
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')
    const route = {
      id: 'test:kick-glow', enabled: true, source: 'kickHit', target: 'beamGlow' as const,
      amount: 0.55, min: 0, max: 0.6, curve: 'easeOut' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0.18, invert: false,
    }
    const dt = 1 / 60
    // Hit frame
    const hitMi = makeBaseMiFrame()
    applyModulationRoute(route, hitMi, 'test:kick-glow', dt)
    // One frame later, no kick
    const after = applyModulationRoute(route, makeNoHitMiFrame(), 'test:kick-glow', dt)
    expect(after).not.toBeNull()
    expect(after!.value).toBeGreaterThan(0)
  })

  it('ceiling-scanner: downbeat trigger envelope decays over multiple frames', async () => {
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')
    const route = {
      id: 'test:downbeat-glow', enabled: true, source: 'downbeat', target: 'beamGlow' as const,
      amount: 0.45, min: 0, max: 0.45, curve: 'easeOut' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0.22, invert: false,
    }
    const dt = 1 / 60
    // Hit — need downbeatHit: true
    const downbeatHitMi = { ...makeBaseMiFrame(), rhythm: { ...makeBaseMiFrame().rhythm, downbeatHit: true } }
    applyModulationRoute(route, downbeatHitMi, 'test:db-glow', dt)
    // Frame 1 after
    const v1 = applyModulationRoute(route, makeNoHitMiFrame(), 'test:db-glow', dt)!.value
    // Frame 5 after
    let v5 = v1
    for (let i = 1; i < 5; i++) v5 = applyModulationRoute(route, makeNoHitMiFrame(), 'test:db-glow', dt)!.value
    // Release tail: value at frame 1 > 0 and decaying (frame 5 <= frame 1)
    expect(v1).toBeGreaterThan(0)
    expect(v5).toBeLessThanOrEqual(v1)
  })
})

// ── Loading a preset resets envelope state ────────────────────────────────────

describe('loading a preset resets old envelope state', () => {
  it('resetBeamMatrixCompilerState clears a built-up envelope', async () => {
    const { applyModulationRoute, resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    const { resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    resetAllEnvelopes()
    const route = {
      id: 'env-test', enabled: true, source: 'beatHit', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'linear' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0.9, invert: false,
    }
    const dt = 1 / 60
    // Build up envelope
    applyModulationRoute(route, makeBaseMiFrame(), 'env-test', dt)
    const before = applyModulationRoute(route, makeNoHitMiFrame(), 'env-test', dt)!.value
    expect(before).toBeGreaterThan(0)
    // Simulate preset load — resetBeamMatrixCompilerState calls resetAllEnvelopes
    resetBeamMatrixCompilerState()
    // After reset, envelope should be 0 on non-hit frame
    const after = applyModulationRoute(route, makeNoHitMiFrame(), 'env-test', dt)
    expect(after).not.toBeNull()
    expect(after!.value).toBeCloseTo(0, 3)
  })
})

// ── Switching to Spatial Fixtures preserves its state ─────────────────────────

describe('switching to Spatial Fixtures after loading a Beam Matrix preset', () => {
  it('laserDmxSettings is unchanged after applying a beam matrix preset and switching mode', () => {
    const store = useReactStore.getState()
    const before = JSON.stringify(store.laserDmxSettings)
    store.applyLaserDmxBeamMatrixPreset('kick-snare-duel')
    store.setLaserDmxWorkspaceMode('spatialFixtures')
    const after = JSON.stringify(useReactStore.getState().laserDmxSettings)
    expect(after).toBe(before)
    // Restore
    useReactStore.getState().setLaserDmxWorkspaceMode('beamMatrix')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Presets 9–12 specific tests
// ════════════════════════════════════════════════════════════════════════════

// ── Category assertions ───────────────────────────────────────────────────────

describe('presets 9–12 appear in correct categories', () => {
  it('build-ladder is build', () => {
    expect(getLaserDmxBeamMatrixPreset('build-ladder')?.category).toBe('build')
  })
  it('drop-starburst is drop', () => {
    expect(getLaserDmxBeamMatrixPreset('drop-starburst')?.category).toBe('drop')
  })
  it('vocal-halo is multiReactive', () => {
    expect(getLaserDmxBeamMatrixPreset('vocal-halo')?.category).toBe('multiReactive')
  })
  it('fog-cathedral is atmospheric', () => {
    expect(getLaserDmxBeamMatrixPreset('fog-cathedral')?.category).toBe('atmospheric')
  })
})

// ── Structural counts ─────────────────────────────────────────────────────────

describe('Build Ladder — structure', () => {
  it('has 10 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('build-ladder')!.beams).toHaveLength(10)
  })
  it('has 1 group', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('build-ladder')!.groups).toHaveLength(1)
  })
  it('all beams are horizontal lines', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    for (const b of s.beams) {
      expect(b.appearance.geometry).toBe('line')
      if (b.target.kind === 'grid') {
        expect(b.origin.row).toBe(b.target.row)
      }
    }
  })
  it('all beams have useGroupColor: false', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    for (const b of s.beams) expect(b.useGroupColor).toBe(false)
  })
})

describe('Drop Starburst — structure', () => {
  it('has 16 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('drop-starburst')!.beams).toHaveLength(16)
  })
  it('has 2 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('drop-starburst')!.groups).toHaveLength(2)
  })
  it('all beams use volumetricCone and stage targets', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('drop-starburst')!
    for (const b of s.beams) {
      expect(b.appearance.geometry).toBe('volumetricCone')
      expect(b.target.kind).toBe('stage')
    }
  })
  it('beams alternate between the two groups', () => {
    const s  = createLaserDmxBeamMatrixPresetSettings('drop-starburst')!
    const g0 = s.groups[0].id
    const g1 = s.groups[1].id
    s.beams.forEach((b, i) => {
      expect(b.groupId).toBe(i % 2 === 0 ? g0 : g1)
    })
  })
})

describe('Vocal Halo — structure', () => {
  it('has 12 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('vocal-halo')!.beams).toHaveLength(12)
  })
  it('has 2 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('vocal-halo')!.groups).toHaveLength(2)
  })
  it('has 8 inward line beams and 4 outward cone beams', () => {
    const s     = createLaserDmxBeamMatrixPresetSettings('vocal-halo')!
    const lines = s.beams.filter(b => b.appearance.geometry === 'line')
    const cones = s.beams.filter(b => b.appearance.geometry === 'volumetricCone')
    expect(lines).toHaveLength(8)
    expect(cones).toHaveLength(4)
  })
  it('cone beams have spectralFlux→targetOffsetX beam-level route', () => {
    const s     = createLaserDmxBeamMatrixPresetSettings('vocal-halo')!
    const cones = s.beams.filter(b => b.appearance.geometry === 'volumetricCone')
    for (const c of cones) {
      const route = c.modulationRoutes.find(r => r.source === 'spectralFlux' && r.target === 'targetOffsetX')
      expect(route).toBeDefined()
    }
  })
  it('cone beam-level routes use compiler-supported targets', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('vocal-halo')!
    for (const b of s.beams) {
      for (const r of b.modulationRoutes) {
        expect(BEAM_ROUTE_TARGETS.has(r.target)).toBe(true)
      }
    }
  })
})

describe('Fog Cathedral — structure', () => {
  it('has 10 beams', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('fog-cathedral')!.beams).toHaveLength(10)
  })
  it('has 2 groups', () => {
    expect(createLaserDmxBeamMatrixPresetSettings('fog-cathedral')!.groups).toHaveLength(2)
  })
  it('has 6 volumetricCone beams and 4 line beams', () => {
    const s     = createLaserDmxBeamMatrixPresetSettings('fog-cathedral')!
    const cones = s.beams.filter(b => b.appearance.geometry === 'volumetricCone')
    const lines = s.beams.filter(b => b.appearance.geometry === 'line')
    expect(cones).toHaveLength(6)
    expect(lines).toHaveLength(4)
  })
  it('cone beams have useGroupColor: false', () => {
    const s     = createLaserDmxBeamMatrixPresetSettings('fog-cathedral')!
    const cones = s.beams.filter(b => b.appearance.geometry === 'volumetricCone')
    for (const c of cones) expect(c.useGroupColor).toBe(false)
  })
  it('fog is enabled and density is high', () => {
    const { fog } = createLaserDmxBeamMatrixPresetSettings('fog-cathedral')!
    expect(fog.enabled).toBe(true)
    expect(fog.density).toBeGreaterThan(0.4)
  })
})

// ── Build Ladder — threshold stagger ─────────────────────────────────────────

describe('Build Ladder — threshold stagger', () => {
  it('each beam has a unique threshold on its buildProgress→dimmer route', () => {
    const s          = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    const thresholds = s.beams.map(b => {
      const r = b.modulationRoutes.find(r => r.source === 'buildProgress' && r.target === 'dimmer')
      return r?.threshold ?? null
    })
    expect(thresholds.every(t => t !== null)).toBe(true)
    expect(new Set(thresholds).size).toBe(thresholds.length)
  })

  it('thresholds rise monotonically bottom-to-top', () => {
    const s    = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    const vals = s.beams.map(b =>
      b.modulationRoutes.find(r => r.source === 'buildProgress')?.threshold ?? 0,
    )
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1])
    }
  })

  it('at buildProgress=0 all dimmer routes output 0 due to threshold', async () => {
    const { applyModulationRoute, resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
    const s   = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    const mi  = { ...makeBaseMiFrame(), energy: { ...makeBaseMiFrame().energy, buildProgress: 0 } }
    const dt  = 1 / 60
    for (const beam of s.beams) {
      const route = beam.modulationRoutes.find(r => r.source === 'buildProgress' && r.target === 'dimmer')!
      const result = applyModulationRoute(route, mi, `test:${beam.id}:dimmer`, dt)
      expect(result?.value ?? 0).toBeCloseTo(0, 2)
    }
  })

  it('at buildProgress=1 all dimmer routes output > 0', async () => {
    const { applyModulationRoute, resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()
    const s  = createLaserDmxBeamMatrixPresetSettings('build-ladder')!
    const mi = { ...makeBaseMiFrame(), energy: { ...makeBaseMiFrame().energy, buildProgress: 1 } }
    const dt = 1 / 60
    for (const beam of s.beams) {
      const route = beam.modulationRoutes.find(r => r.source === 'buildProgress' && r.target === 'dimmer')!
      const result = applyModulationRoute(route, mi, `test:${beam.id}:dimmer-full`, dt)
      expect(result!.value).toBeGreaterThan(0)
    }
  })
})

// ── Route scope validation for presets 9–12 ──────────────────────────────────

describe('presets 9–12 route scope validation', () => {
  const newPresets = ['build-ladder', 'drop-starburst', 'vocal-halo', 'fog-cathedral']

  for (const id of newPresets) {
    it(`${id}: group routes use compileGroupRoutes-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const g of s.groups) {
        for (const r of g.modulationRoutes) {
          expect(GROUP_ROUTE_TARGETS.has(r.target)).toBe(true)
        }
      }
    })

    it(`${id}: global routes use applyGlobalRoute-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const r of s.globalModulationRoutes) {
        expect(GLOBAL_ROUTE_TARGETS.has(r.target)).toBe(true)
      }
    })

    it(`${id}: beam-level routes use applyBeamRoute-supported targets`, () => {
      const s = createLaserDmxBeamMatrixPresetSettings(id)!
      for (const b of s.beams) {
        for (const r of b.modulationRoutes) {
          expect(BEAM_ROUTE_TARGETS.has(r.target)).toBe(true)
        }
      }
    })
  }
})

// ── Compile safety for presets 9–12 ──────────────────────────────────────────

describe('presets 9–12 compile safely under a representative MI frame', () => {
  const newIds = ['build-ladder', 'drop-starburst', 'vocal-halo', 'fog-cathedral']

  for (const id of newIds) {
    it(`${id}: compileLaserDmxBeamMatrix produces no NaN or Infinity`, async () => {
      const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
      resetBeamMatrixCompilerState()
      const settings = createLaserDmxBeamMatrixPresetSettings(id)!
      const result = compileLaserDmxBeamMatrix({
        settings, mi: makeBaseMiFrame(), time: 0, timeSec: 0.016,
        canvasWidth: 1280, canvasHeight: 720,
      })
      for (const b of result.beams) {
        const nums = [b.intensity, b.beamWidth, b.glow, b.rgba.r, b.rgba.g, b.rgba.b, b.rgba.a]
        for (const v of nums) expect(Number.isFinite(v)).toBe(true)
      }
      const fogNums = [result.fog.density, result.fog.opacity, result.fog.beamScatter, result.fog.turbulence]
      for (const v of fogNums) expect(Number.isFinite(v)).toBe(true)
    })
  }
})

// ── summarizePreset ───────────────────────────────────────────────────────────

describe('summarizePreset', () => {
  it('returns correct beam and group counts', () => {
    const p   = getLaserDmxBeamMatrixPreset('build-ladder')!
    const sum = summarizePreset(p)
    expect(sum.beamCount).toBe(10)
    expect(sum.groupCount).toBe(1)
  })

  it('correctly classifies line vs cone beams', () => {
    const p   = getLaserDmxBeamMatrixPreset('vocal-halo')!
    const sum = summarizePreset(p)
    expect(sum.lineBeamCount).toBe(8)
    expect(sum.coneBeamCount).toBe(4)
  })

  it('reports fog correctly for fog-heavy presets', () => {
    const fogCathedral = summarizePreset(getLaserDmxBeamMatrixPreset('fog-cathedral')!)
    expect(fogCathedral.usesFog).toBe(true)
    const buildLadder = summarizePreset(getLaserDmxBeamMatrixPreset('build-ladder')!)
    expect(buildLadder.usesFog).toBe(true)
  })

  it('musicSources includes sources from all route scopes', () => {
    const p   = getLaserDmxBeamMatrixPreset('vocal-halo')!
    const sum = summarizePreset(p)
    expect(sum.musicSources).toContain('vocalActivity')
    expect(sum.musicSources).toContain('spectralFlux')
    expect(sum.musicSources).toContain('phrase8')
  })

  it('all 12 presets produce a valid summary', () => {
    for (const p of LASER_DMX_BEAM_MATRIX_PRESETS) {
      const sum = summarizePreset(p)
      expect(sum.beamCount).toBeGreaterThan(0)
      expect(sum.groupCount).toBeGreaterThan(0)
      expect(sum.lineBeamCount + sum.coneBeamCount).toBe(sum.beamCount)
      expect(Array.isArray(sum.musicSources)).toBe(true)
    }
  })
})

// ── Performance: 600-frame simulation ────────────────────────────────────────

describe('performance: 600-frame simulation across all 12 presets', () => {
  it('compiles all presets for 600 frames without throwing', async () => {
    const { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } = await import('../LaserDmxBeamMatrixCompiler')
    const dt = 1 / 60
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      resetBeamMatrixCompilerState()
      const settings = preset.createSettings()
      for (let frame = 0; frame < 600; frame++) {
        const mi = frame % 4 === 0
          ? { ...makeBaseMiFrame(), rhythm: { ...makeBaseMiFrame().rhythm, downbeatHit: true } }
          : makeNoHitMiFrame()
        expect(() =>
          compileLaserDmxBeamMatrix({
            settings, mi, time: frame, timeSec: frame * dt,
            canvasWidth: 1280, canvasHeight: 720,
          }),
        ).not.toThrow()
      }
    }
  }, 30_000)
})

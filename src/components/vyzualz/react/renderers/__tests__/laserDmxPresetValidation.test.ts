import { describe, it, expect } from 'vitest'
import {
  validateBeamMatrixSettings,
  isValid,
  normalizeBeamMatrixSettings,
  GROUP_ROUTE_TARGETS,
  GLOBAL_ROUTE_TARGETS,
  BEAM_ROUTE_TARGETS,
} from '../laserDmxPresetValidation'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
  createLaserDmxBeamMatrixPresetSettings,
} from '../../laserDmxBeamMatrixPresets'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
} from '../../ReactTypes'

// ── All factory presets must pass validation with no errors ───────────────────

describe('all 20 factory presets pass validation', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: no validation errors`, () => {
      const s = preset.createSettings()
      const issues = validateBeamMatrixSettings(s)
      const errors = issues.filter(i => i.severity === 'error')
      if (errors.length > 0) {
        // Print them for easier debugging
        console.error(`[${preset.id}] Validation errors:`, errors)
      }
      expect(errors).toHaveLength(0)
    })
  }
})

describe('isValid returns true for all factory presets', () => {
  for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
    it(`${preset.id}: isValid is true`, () => {
      expect(isValid(preset.createSettings())).toBe(true)
    })
  }
})

// ── Default settings pass validation ─────────────────────────────────────────

describe('default beam matrix settings', () => {
  it('pass validation with no errors', () => {
    const s = createDefaultLaserDmxBeamMatrixSettings()
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors).toHaveLength(0)
  })
})

// ── Error cases: unsupported route targets ────────────────────────────────────

describe('unsupported route targets produce errors', () => {
  it('detects unsupported group route target', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.groups[0].modulationRoutes.push({
      id: 'bad-group-route', enabled: true,
      source: 'energy', target: 'focusUnsupported' as any,
      mode: 'set', amount: 1, min: 0, max: 1,
      curve: 'linear', attack: 0.1, release: 0.1,
      smoothing: 0, threshold: 0, invert: false,
    })
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('target'))).toBe(true)
  })

  it('detects unsupported global route target', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.globalModulationRoutes.push({
      id: 'bad-global-route', enabled: true,
      source: 'energy', target: 'beamWidth' as any,
      mode: 'set', amount: 1, min: 0, max: 1,
      curve: 'linear', attack: 0.1, release: 0.1,
      smoothing: 0, threshold: 0, invert: false,
    })
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('globalModulationRoutes') && e.path.includes('target'))).toBe(true)
  })

  it('GROUP_ROUTE_TARGETS does not include beam-only targets', () => {
    expect(GROUP_ROUTE_TARGETS.has('focus')).toBe(false)
    expect(GROUP_ROUTE_TARGETS.has('alpha')).toBe(false)
    expect(GROUP_ROUTE_TARGETS.has('red')).toBe(false)
  })

  it('GLOBAL_ROUTE_TARGETS does not include beam-level or group-level targets', () => {
    expect(GLOBAL_ROUTE_TARGETS.has('dimmer')).toBe(false)
    expect(GLOBAL_ROUTE_TARGETS.has('beamWidth')).toBe(false)
    expect(GLOBAL_ROUTE_TARGETS.has('focus')).toBe(false)
  })

  it('BEAM_ROUTE_TARGETS includes all expected targets', () => {
    expect(BEAM_ROUTE_TARGETS.has('dimmer')).toBe(true)
    expect(BEAM_ROUTE_TARGETS.has('targetOffsetX')).toBe(true)
    expect(BEAM_ROUTE_TARGETS.has('red')).toBe(true)
    expect(BEAM_ROUTE_TARGETS.has('focus')).toBe(true)
  })
})

// ── Error cases: invalid sequence fields ──────────────────────────────────────

describe('invalid sequence fields produce errors', () => {
  it('detects invalid sequence mode', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('bass-fan')!
    s.groups[0].sequence.mode = 'zigzag' as any
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('sequence') && e.path.includes('mode'))).toBe(true)
  })

  it('detects NaN stepsPerBeat', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!
    s.groups[0].sequence.stepsPerBeat = NaN
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('stepsPerBeat'))).toBe(true)
  })
})

// ── Error cases: invalid motion fields ───────────────────────────────────────

describe('invalid motion fields produce errors', () => {
  it('detects invalid travel mode', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('snare-crossfire-seq')!
    s.beams[0].motion!.mode = 'warp' as any
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('motion') && e.path.includes('mode'))).toBe(true)
  })

  it('detects invalid easing value', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('center-out-chase')!
    s.beams[0].motion!.easing = 'bounce' as any
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('easing'))).toBe(true)
  })

  it('warns about tailLength outside [0, 1]', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('snare-crossfire-seq')!
    s.beams[0].motion!.tailLength = 1.5
    const warnings = validateBeamMatrixSettings(s).filter(i => i.severity === 'warning')
    expect(warnings.some(w => w.path.includes('tailLength'))).toBe(true)
  })
})

// ── Error cases: invalid beam fields ─────────────────────────────────────────

describe('invalid beam field values produce errors', () => {
  it('detects unknown groupId reference', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].groupId = 'nonexistent-group-id'
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('groupId'))).toBe(true)
  })

  it('detects out-of-range origin column', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].origin.column = 99
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('origin.column'))).toBe(true)
  })

  it('detects NaN dimmer', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].appearance.dimmer = NaN
    const errors = validateBeamMatrixSettings(s).filter(i => i.severity === 'error')
    expect(errors.some(e => e.path.includes('dimmer'))).toBe(true)
  })

  it('warns about out-of-range dimmer', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].appearance.dimmer = 1.5
    const warnings = validateBeamMatrixSettings(s).filter(i => i.severity === 'warning')
    expect(warnings.some(w => w.path.includes('dimmer'))).toBe(true)
  })
})

// ── Duplicate sequence indices produce warning ────────────────────────────────

describe('duplicate sequenceIndex produces warning', () => {
  it('warns when two beams share the same sequenceIndex', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].sequenceIndex = 0
    s.beams[1].sequenceIndex = 0
    const warnings = validateBeamMatrixSettings(s).filter(i => i.severity === 'warning')
    expect(warnings.some(w => w.path.includes('sequenceIndex'))).toBe(true)
  })
})

// ── normalizeBeamMatrixSettings ───────────────────────────────────────────────

describe('normalizeBeamMatrixSettings', () => {
  it('adds DEFAULT_BEAM_MOTION to beams missing motion', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    ;(s.beams[0] as any).motion = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.beams[0].motion).toEqual(DEFAULT_BEAM_MOTION)
  })

  it('adds DEFAULT_BEAM_SEQUENCE to groups missing sequence', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    ;(s.groups[0] as any).sequence = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.groups[0].sequence).toEqual(DEFAULT_BEAM_SEQUENCE)
  })

  it('migrates legacy reverse and pingPong motion to forward grow', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[0].motion = { ...DEFAULT_BEAM_MOTION, mode: 'pingPong' as any, direction: 'reverse' as any }
    normalizeBeamMatrixSettings(s)
    expect(s.beams[0].motion.mode).toBe('grow')
    expect(s.beams[0].motion.direction).toBe('forward')
  })

  it('fixes NaN sequenceIndex', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    s.beams[1].sequenceIndex = NaN
    normalizeBeamMatrixSettings(s)
    expect(Number.isFinite(s.beams[1].sequenceIndex)).toBe(true)
  })

  it('returns the same object reference', () => {
    const s = createLaserDmxBeamMatrixPresetSettings('minimal-crossfire')!
    const result = normalizeBeamMatrixSettings(s)
    expect(result).toBe(s)
  })
})

// ── Legacy migration (no sequence field) ─────────────────────────────────────

describe('legacy preset migration via normalize', () => {
  it('old data with no sequence field normalizes to DEFAULT_BEAM_SEQUENCE', () => {
    const s = createDefaultLaserDmxBeamMatrixSettings()
    // Simulate a pre-sequence-feature group (no sequence field)
    ;(s.groups[0] as any).sequence = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.groups[0].sequence).toBeDefined()
    expect(s.groups[0].sequence.enabled).toBe(false)
    expect(s.groups[0].sequence.mode).toBe('forward')
  })

  it('old data with no motion field normalizes to DEFAULT_BEAM_MOTION', () => {
    const s = createDefaultLaserDmxBeamMatrixSettings()
    if (s.beams.length === 0) return // skip if no beams in default
    ;(s.beams[0] as any).motion = undefined
    normalizeBeamMatrixSettings(s)
    expect(s.beams[0].motion).toBeDefined()
    expect(s.beams[0].motion!.mode).toBe('static')
  })
})

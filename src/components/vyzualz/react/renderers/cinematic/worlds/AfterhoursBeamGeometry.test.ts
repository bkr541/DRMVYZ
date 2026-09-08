import { describe, expect, it } from 'vitest'
import { AFTERHOURS_DEFAULTS, AFTERHOURS_PATTERNS, type AfterhoursPattern } from '../../../CinematicWorldSettings'
import { AFTERHOURS_VIRTUAL_STAGE_RIG } from './AfterhoursVirtualStageRig'
import {
  AFTERHOURS_BOTTOM_EMITTERS,
  AFTERHOURS_LEFT_EMITTERS,
  AFTERHOURS_MAX_BEAMS,
  AFTERHOURS_PATTERN_IDS,
  AFTERHOURS_RIGHT_EMITTERS,
  AFTERHOURS_TOP_EMITTERS,
  afterhoursRayFieldLength,
  type AfterhoursBeamGenerationSettings,
  generateAfterhoursBeams,
  intersectAfterhoursRayWithViewport,
  isAfterhoursViewportExit,
} from './AfterhoursBeamGeometry'

const BASE: AfterhoursBeamGenerationSettings = {
  pattern: 'wideFan',
  symmetry: true,
  sideLasers: false,
  topLasers: false,
  beamCount: 8,
  spread: 0.65,
  accentMix: 0.25,
}

const gen = (overrides: Partial<AfterhoursBeamGenerationSettings> = {}, variation = 0, viewportAspectRatio = 16 / 9) =>
  generateAfterhoursBeams({ ...BASE, ...overrides }, { variation, viewportAspectRatio })

const active = (overrides: Partial<AfterhoursBeamGenerationSettings> = {}, variation = 0, viewportAspectRatio = 16 / 9) =>
  gen(overrides, variation, viewportAspectRatio).filter(beam => beam.active)

function expectViewportRay(
  beam: ReturnType<typeof active>[number],
  aspect = 16 / 9,
): void {
  expect(Number.isFinite(beam.direction.x) && Number.isFinite(beam.direction.y)).toBe(true)
  expect(Math.hypot(beam.direction.x, beam.direction.y)).toBeCloseTo(1, 8)
  expect(beam.projection).toBe('viewportExit')
  expect(beam.target).toBe(beam.endpoint)
  expect(isAfterhoursViewportExit(beam.endpoint)).toBe(true)
  expect(beam.endpoint.x).toBeGreaterThanOrEqual(0)
  expect(beam.endpoint.x).toBeLessThanOrEqual(1)
  expect(beam.endpoint.y).toBeGreaterThanOrEqual(0)
  expect(beam.endpoint.y).toBeLessThanOrEqual(1)
  expect(afterhoursRayFieldLength(beam.origin, beam.endpoint, aspect)).toBeGreaterThanOrEqual(0.29)
}

describe('Afterhours Stage 1 — canonical fixture banks and ray identity', () => {
  it('reuses the persisted pattern union as its only pattern-id source of truth', () => {
    expect(AFTERHOURS_PATTERN_IDS).toBe(AFTERHOURS_PATTERNS)
    expect([...AFTERHOURS_PATTERN_IDS]).toEqual(['wideFan', 'splitWings', 'crossCanopy', 'diamondStar', 'chevronRoof', 'radialCrown', 'sparseArchitecture', 'fullRig'])
  })

  it('owns fixed frozen, deliberately mirrored fixture banks', () => {
    expect(AFTERHOURS_BOTTOM_EMITTERS).toHaveLength(10)
    expect(AFTERHOURS_LEFT_EMITTERS).toHaveLength(3)
    expect(AFTERHOURS_RIGHT_EMITTERS).toHaveLength(3)
    expect(AFTERHOURS_TOP_EMITTERS).toHaveLength(6)
    for (const bank of [AFTERHOURS_BOTTOM_EMITTERS, AFTERHOURS_LEFT_EMITTERS, AFTERHOURS_RIGHT_EMITTERS, AFTERHOURS_TOP_EMITTERS]) {
      expect(Object.isFrozen(bank)).toBe(true)
      expect(bank.every(emitter => Object.isFrozen(emitter))).toBe(true)
    }
    for (let i = 0; i < AFTERHOURS_BOTTOM_EMITTERS.length / 2; i += 1) {
      expect(AFTERHOURS_BOTTOM_EMITTERS[i].x + AFTERHOURS_BOTTOM_EMITTERS[AFTERHOURS_BOTTOM_EMITTERS.length - 1 - i].x).toBeCloseTo(1, 9)
    }
    for (let i = 0; i < AFTERHOURS_TOP_EMITTERS.length / 2; i += 1) {
      expect(AFTERHOURS_TOP_EMITTERS[i].x + AFTERHOURS_TOP_EMITTERS[AFTERHOURS_TOP_EMITTERS.length - 1 - i].x).toBeCloseTo(1, 9)
    }
  })

  it('gives every active slot stable beam/source identity and role metadata', () => {
    const a = active({ pattern: 'crossCanopy', sideLasers: true, beamCount: 12 }, 0)
    const b = active({ pattern: 'crossCanopy', sideLasers: true, beamCount: 12 }, 17)
    expect(a.map(beam => beam.id)).toEqual(b.map(beam => beam.id))
    expect(a.map(beam => beam.sourceId)).toEqual(b.map(beam => beam.sourceId))
    for (const beam of a) {
      expect(beam.id).toMatch(/^afterhours-beam-slot-\d+$/)
      expect(beam.sourceId).toMatch(/^afterhours-(bottom|left|right|top)-\d+$/)
      expect(beam.fixtureId).toBe(beam.sourceId)
      expect(AFTERHOURS_VIRTUAL_STAGE_RIG.fixtures.some(fixture => fixture.id === beam.fixtureId)).toBe(true)
      expect(beam.role).toBe('crossCanopy')
      expect(beam.symmetry?.axis).toBe('vertical')
    }
  })
})

describe('Afterhours Stage 1 — deterministic viewport intersection', () => {
  it('projects horizontal and vertical rays to the exact viewport edge', () => {
    expect(intersectAfterhoursRayWithViewport({ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, 16 / 9)).toEqual({ x: 1, y: 0.5 })
    expect(intersectAfterhoursRayWithViewport({ x: 0.5, y: 0.5 }, { x: -1, y: 0 }, 16 / 9)).toEqual({ x: 0, y: 0.5 })
    expect(intersectAfterhoursRayWithViewport({ x: 0.5, y: 0.5 }, { x: 0, y: 1 }, 16 / 9)).toEqual({ x: 0.5, y: 1 })
    expect(intersectAfterhoursRayWithViewport({ x: 0.5, y: 0.5 }, { x: 0, y: -1 }, 16 / 9)).toEqual({ x: 0.5, y: 0 })
  })

  it('stays finite for near-horizontal/vertical rays and extreme supported aspects', () => {
    for (const aspect of [0.25, 0.5, 1, 16 / 9, 3, 4]) {
      for (const direction of [{ x: 1, y: 1e-12 }, { x: 1e-12, y: 1 }, { x: -1, y: 1e-10 }, { x: 1e-10, y: -1 }]) {
        const point = intersectAfterhoursRayWithViewport({ x: 0.37, y: 0.41 }, direction, aspect)
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true)
        expect(isAfterhoursViewportExit(point)).toBe(true)
      }
    }
  })
})

describe('Afterhours Stage 1 — global beam allocation', () => {
  it('always returns 16 slots with exactly Beam Count active, clamped to 2..16', () => {
    for (const [request, expected] of [[-4, 2], [0, 2], [2, 2], [8, 8], [16, 16], [40, 16]] as const) {
      const beams = gen({ beamCount: request })
      expect(beams).toHaveLength(AFTERHOURS_MAX_BEAMS)
      expect(beams.filter(beam => beam.active)).toHaveLength(expected)
      expect(beams.slice(expected).every(beam => !beam.active)).toBe(true)
    }
  })

  it('clears every inactive slot while retaining a stable slot identity', () => {
    const beams = gen({ beamCount: 3 })
    for (let index = 3; index < beams.length; index += 1) {
      const beam = beams[index]
      expect(beam.active).toBe(false)
      expect(beam.id).toBe(`afterhours-beam-slot-${index}`)
      expect(beam.endpoint).toEqual({ x: 0, y: 0 })
      expect(beam.direction).toEqual({ x: 0, y: 0 })
      expect(beam.accent).toBe(false)
    }
  })

  it('may reuse a physical fixture above the fixed-bank count without exceeding 16 visible rays', () => {
    const beams = active({ pattern: 'wideFan', beamCount: 16 })
    const perSource = new Map<string, number>()
    for (const beam of beams) perSource.set(beam.sourceId, (perSource.get(beam.sourceId) ?? 0) + 1)
    expect(Math.max(...perSource.values())).toBeGreaterThan(1)
    expect(beams).toHaveLength(16)
  })
})

describe('Afterhours Stage 1 — visual-DNA regression: rays, not floating targets', () => {
  const patterns: readonly AfterhoursPattern[] = [...AFTERHOURS_PATTERNS]

  for (const pattern of patterns) {
    for (const spread of [0, 0.5, 1]) {
      it(`${pattern} @ spread ${spread} derives every visible endpoint from a substantial viewport-exit ray`, () => {
        const beams = active({ pattern, spread, sideLasers: true, topLasers: true, beamCount: 16 })
        expect(beams).toHaveLength(pattern === 'sparseArchitecture' ? 4 : 16)
        for (const beam of beams) expectViewportRay(beam)
      })
    }
  }

  it('never uses an unconstrained interior point as an active beam endpoint', () => {
    for (let variation = 0; variation < 48; variation += 1) {
      for (const pattern of patterns) {
        const beams = active({ pattern, symmetry: pattern === 'radialCrown', sideLasers: true, topLasers: true, beamCount: 16 }, variation)
        expect(beams.every(beam => beam.projection === 'viewportExit' && isAfterhoursViewportExit(beam.endpoint))).toBe(true)
      }
    }
  })

  it('Spread visibly widens the static Fan arrangement while retaining an open centre structure', () => {
    const span = (spread: number) => {
      const xs = active({ pattern: 'wideFan', spread, beamCount: 10 }).map(beam => beam.endpoint.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(span(1)).toBeGreaterThan(span(0))
    const fan = active({ pattern: 'wideFan', spread: 0.8, beamCount: 10 })
    expect(fan.some(beam => beam.endpoint.x === 0)).toBe(true)
    expect(fan.some(beam => beam.endpoint.x === 1)).toBe(true)
  })

  it('falls back to Fan for an unknown persisted pattern id', () => {
    const bogus = active({ pattern: 'spiral' as AfterhoursPattern, beamCount: 12 })
    const fan = active({ pattern: 'wideFan', beamCount: 12 })
    expect(bogus.map(beam => ({ source: beam.sourceId, direction: beam.direction, endpoint: beam.endpoint })))
      .toEqual(fan.map(beam => ({ source: beam.sourceId, direction: beam.direction, endpoint: beam.endpoint })))
  })
})

describe('Afterhours Stage 1 — coherent bank participation', () => {
  it('never uses a disabled optional bank', () => {
    for (const pattern of ['radialCrown', 'chevronRoof', 'crossCanopy', 'wideFan', 'splitWings'] as const) {
      const beams = active({ pattern, sideLasers: false, topLasers: false, beamCount: 16 })
      expect(beams.every(beam => beam.bank === 'bottom')).toBe(true)
    }
  })

  it('recruits enabled Side and Top banks by Beam Count 8 for every current topology family', () => {
    for (const pattern of ['radialCrown', 'chevronRoof', 'crossCanopy', 'wideFan', 'splitWings'] as const) {
      const banks = new Set(active({ pattern, sideLasers: true, topLasers: true, beamCount: 8 }).map(beam => beam.bank))
      expect(banks.has('bottom'), `${pattern} bottom`).toBe(true)
      expect(banks.has('left'), `${pattern} left`).toBe(true)
      expect(banks.has('right'), `${pattern} right`).toBe(true)
      expect(banks.has('top'), `${pattern} top`).toBe(true)
    }
  })

  it('derives every production beam origin from its stable rig fixture rather than pattern-local coordinates', () => {
    const fixtures = new Map(AFTERHOURS_VIRTUAL_STAGE_RIG.fixtures.map(fixture => [fixture.id, fixture]))
    for (const pattern of ['radialCrown', 'chevronRoof', 'crossCanopy', 'wideFan', 'splitWings'] as const) {
      const beams = active({ pattern, sideLasers: true, topLasers: true, beamCount: 16 })
      for (const beam of beams) {
        const fixture = fixtures.get(beam.fixtureId)
        expect(fixture, `${pattern}:${beam.fixtureId}`).toBeDefined()
        expect(beam.origin).toBe(fixture?.position)
        expect(beam.bank).toBe(fixture?.bank)
        expect(beam.fixtureRole).toBe(fixture?.role)
      }
    }
  })

  it('a single enabled optional bank participates by Beam Count 8 without enabling the other bank', () => {
    for (const pattern of ['radialCrown', 'chevronRoof', 'crossCanopy', 'wideFan', 'splitWings'] as const) {
      const sideBanks = new Set(active({ pattern, sideLasers: true, topLasers: false, beamCount: 8 }).map(beam => beam.bank))
      expect(sideBanks.has('left') && sideBanks.has('right'), `${pattern} side`).toBe(true)
      expect(sideBanks.has('top')).toBe(false)

      const topBanks = new Set(active({ pattern, sideLasers: false, topLasers: true, beamCount: 8 }).map(beam => beam.bank))
      expect(topBanks.has('top'), `${pattern} top`).toBe(true)
      expect(topBanks.has('left') || topBanks.has('right')).toBe(false)
    }
  })

  it('Split preserves a deliberate left/right aperture', () => {
    const beams = active({ pattern: 'splitWings', spread: 0.8, beamCount: 10 })
    const left = beams.filter(beam => beam.origin.x < 0.5)
    const right = beams.filter(beam => beam.origin.x > 0.5)
    expect(left.every(beam => beam.direction.x < 0)).toBe(true)
    expect(right.every(beam => beam.direction.x > 0)).toBe(true)
  })
})

describe('Afterhours Stage 1 — symmetry, determinism, and seek/re-entry reconstruction', () => {
  it('structured static families are numerically mirrored in adjacent pairs', () => {
    for (const pattern of ['wideFan', 'splitWings', 'chevronRoof', 'crossCanopy'] as const) {
      const beams = active({ pattern, sideLasers: true, topLasers: true, beamCount: 12, spread: 0.72 })
      for (let index = 0; index + 1 < beams.length; index += 2) {
        const left = beams[index]
        const right = beams[index + 1]
        expect(left.symmetry?.pairId).toBe(right.symmetry?.pairId)
        expect(left.origin.x).toBeCloseTo(1 - right.origin.x, 8)
        expect(left.origin.y).toBeCloseTo(right.origin.y, 8)
        expect(left.endpoint.x).toBeCloseTo(1 - right.endpoint.x, 8)
        expect(left.endpoint.y).toBeCloseTo(right.endpoint.y, 8)
        expect(left.direction.x).toBeCloseTo(-right.direction.x, 8)
        expect(left.direction.y).toBeCloseTo(right.direction.y, 8)
      }
    }
  })

  it('Radial Crown retains bilateral rig-pair symmetry and an explicit odd-count singleton', () => {
    for (const beamCount of [2, 6, 7, 16]) {
      const beams = active({ pattern: 'radialCrown', symmetry: true, sideLasers: true, topLasers: true, beamCount })
      const pairedCount = beamCount - (beamCount % 2)
      for (let index = 0; index < pairedCount; index += 2) {
        const source = beams[index]
        const mirror = beams[index + 1]
        expect(mirror.origin.x).toBeCloseTo(1 - source.origin.x, 8)
        expect(mirror.origin.y).toBeCloseTo(source.origin.y, 8)
        expect(mirror.direction.x).toBeCloseTo(-source.direction.x, 8)
        expect(mirror.direction.y).toBeCloseTo(source.direction.y, 8)
        expect(mirror.endpoint.x).toBeCloseTo(1 - source.endpoint.x, 8)
        expect(mirror.endpoint.y).toBeCloseTo(source.endpoint.y, 8)
        expect(mirror.symmetry?.pairId).toBe(source.symmetry?.pairId)
      }
      if (beamCount % 2 === 1) {
        expect(beams[beamCount - 1].fixtureRole).toBe('lower')
        expect(beams[beamCount - 1].symmetry).toBeNull()
      }
    }
  })

  it('keeps the same rig source allocation across pattern changes and viewport resizes', () => {
    const settings = { ...BASE, sideLasers: true, topLasers: true, beamCount: 10 }
    const expectedIds = active({ ...settings, pattern: 'wideFan' }, 0, 16 / 9).map(beam => beam.fixtureId)
    for (const pattern of ['splitWings', 'chevronRoof', 'crossCanopy', 'radialCrown'] as const) {
      expect(active({ ...settings, pattern }, 0, 16 / 9).map(beam => beam.fixtureId)).toEqual(expectedIds)
    }
    expect(active({ ...settings, pattern: 'wideFan' }, 0, 4 / 3).map(beam => beam.fixtureId)).toEqual(expectedIds)
    expect(active({ ...settings, pattern: 'wideFan' }, 0, 21 / 9).map(beam => beam.fixtureId)).toEqual(expectedIds)
  })

  it('same settings/seed/variation reconstruct exactly; variation and seed can change aim without changing source identity', () => {
    const settings = { ...BASE, pattern: 'wideFan' as const, beamCount: 16 }
    const a = generateAfterhoursBeams(settings, { variation: 2, seed: 48001 })
    const again = generateAfterhoursBeams(settings, { variation: 2, seed: 48001 })
    const varied = generateAfterhoursBeams(settings, { variation: 3, seed: 48001 })
    const otherSeed = generateAfterhoursBeams(settings, { variation: 2, seed: 1337 })
    expect(again).toEqual(a)
    expect(varied.filter(beam => beam.active).map(beam => beam.sourceId)).toEqual(a.filter(beam => beam.active).map(beam => beam.sourceId))
    expect(otherSeed.filter(beam => beam.active).map(beam => beam.sourceId)).toEqual(a.filter(beam => beam.active).map(beam => beam.sourceId))
    expect(varied.filter(beam => beam.active).map(beam => beam.direction)).not.toEqual(a.filter(beam => beam.active).map(beam => beam.direction))
    expect(otherSeed.filter(beam => beam.active).map(beam => beam.direction)).not.toEqual(a.filter(beam => beam.active).map(beam => beam.direction))
  })

  it('accepts the persisted Afterhours defaults without introducing a new persistence owner', () => {
    const beams = generateAfterhoursBeams(AFTERHOURS_DEFAULTS)
    expect(beams.filter(beam => beam.active)).toHaveLength(AFTERHOURS_DEFAULTS.beamCount)
    for (const beam of beams.filter(beam => beam.active)) expectViewportRay(beam)
  })
})

describe('Afterhours existing reactive motion — ray-safe compatibility', () => {
  it('is an exact no-op at motionAuthority 0', () => {
    const still = generateAfterhoursBeams({ ...BASE, pattern: 'wideFan', beamCount: 16 }, { motionPhase: 0, motionAuthority: 0 })
    const phased = generateAfterhoursBeams({ ...BASE, pattern: 'wideFan', beamCount: 16 }, { motionPhase: 4.2, motionAuthority: 0 })
    expect(phased).toEqual(still)
  })

  it('rotates directions deterministically and re-intersects every swept ray with the viewport', () => {
    const settings = { ...BASE, pattern: 'radialCrown' as const, spread: 0.8, symmetry: false, beamCount: 16 }
    const still = generateAfterhoursBeams(settings, { motionPhase: 1.37, motionAuthority: 0 }).filter(beam => beam.active)
    const swept = generateAfterhoursBeams(settings, { motionPhase: 1.37, motionAuthority: 1 }).filter(beam => beam.active)
    const sweptAgain = generateAfterhoursBeams(settings, { motionPhase: 1.37, motionAuthority: 1 }).filter(beam => beam.active)
    expect(swept.map(beam => beam.direction)).toEqual(sweptAgain.map(beam => beam.direction))
    expect(swept.map(beam => beam.direction)).not.toEqual(still.map(beam => beam.direction))
    for (const beam of swept) expectViewportRay(beam)
  })
})

describe('Afterhours Stage 5 — scanner motion authority and traversal', () => {
  const angularDistanceDeg = (
    a: Readonly<{ x: number; y: number }>,
    b: Readonly<{ x: number; y: number }>,
  ) => {
    const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))
    return Math.acos(dot) * 180 / Math.PI
  }

  const maximumAngularSpan = (motionAuthority: number) => {
    const settings = { ...BASE, pattern: 'wideFan' as const, beamCount: 8, symmetry: true }
    const baseline = generateAfterhoursBeams(settings, { motionPhase: 0, motionAuthority: 0 })[0]!
    let maximum = 0
    for (let phase = 0; phase <= 2; phase += 0.025) {
      const moving = generateAfterhoursBeams(settings, { motionPhase: phase, motionAuthority })[0]!
      maximum = Math.max(maximum, angularDistanceDeg(baseline.direction, moving.direction))
    }
    return maximum
  }

  it('maps Motion 0/25/50/75/100 to materially larger bounded stage-scale angular spans', () => {
    const spans = [0, 0.25, 0.5, 0.75, 1].map(maximumAngularSpan)
    expect(spans[0]).toBeLessThan(1e-7)
    expect(spans[1]).toBeGreaterThan(6)
    expect(spans[2]).toBeGreaterThan(15)
    expect(spans[3]).toBeGreaterThan(30)
    expect(spans[4]).toBeGreaterThan(45)
    expect(spans[4]).toBeLessThanOrEqual(54.01)
    for (let index = 1; index < spans.length; index += 1) expect(spans[index]).toBeGreaterThan(spans[index - 1]!)
  })

  it('preserves bilateral symmetry while every scene uses its intended scanner vocabulary', () => {
    const expectedMode = new Map<AfterhoursPattern, string>([
      ['wideFan', 'fanOpenClose'],
      ['splitWings', 'opposingSweep'],
      ['crossCanopy', 'centerOut'],
      ['diamondStar', 'geometricTraversal'],
      ['chevronRoof', 'topologyRotation'],
      ['radialCrown', 'topologyRotation'],
      ['sparseArchitecture', 'boundedHold'],
      ['fullRig', 'bankChase'],
    ])
    for (const pattern of AFTERHOURS_PATTERNS) {
      const beams = generateAfterhoursBeams(
        { ...BASE, pattern, symmetry: true, sideLasers: true, topLasers: true, beamCount: 8 },
        { variation: 0, motionPhase: 0.73, motionAuthority: 1 },
      ).filter(beam => beam.active)
      expect(beams[0]?.motion?.mode).toBe(expectedMode.get(pattern))
      for (let index = 0; index + 1 < beams.length; index += 2) {
        const left = beams[index]!
        const right = beams[index + 1]!
        expect(left.symmetry?.pairId).toBe(right.symmetry?.pairId)
        expect(left.origin.x).toBeCloseTo(1 - right.origin.x, 8)
        expect(left.origin.y).toBeCloseTo(right.origin.y, 8)
        expect(left.direction.x).toBeCloseTo(-right.direction.x, 8)
        expect(left.direction.y).toBeCloseTo(right.direction.y, 8)
        expect(left.endpoint.x).toBeCloseTo(1 - right.endpoint.x, 8)
        expect(left.endpoint.y).toBeCloseTo(right.endpoint.y, 8)
      }
    }
  })

  it('is deterministic and keeps shared-scanner velocity/acceleration diagnostics bounded', () => {
    for (const authority of [0.25, 0.5, 0.75, 1]) {
      const settings = { ...BASE, pattern: 'fullRig' as const, sideLasers: true, topLasers: true, beamCount: 16 }
      const first = generateAfterhoursBeams(settings, { variation: 3, motionPhase: 0.37, motionAuthority: authority })
      const again = generateAfterhoursBeams(settings, { variation: 3, motionPhase: 0.37, motionAuthority: authority })
      expect(again).toEqual(first)
      for (const beam of first.filter(candidate => candidate.active)) {
        expect(beam.motion).not.toBeNull()
        expect(beam.motion!.velocityRatio).toBeGreaterThanOrEqual(0)
        expect(beam.motion!.velocityRatio).toBeLessThanOrEqual(1)
        expect(beam.motion!.accelerationRatio).toBeGreaterThanOrEqual(0)
        expect(beam.motion!.accelerationRatio).toBeLessThanOrEqual(1)
      }
    }
  })

  it('uses deterministic ping-pong traversal without retrace and blanks loop closure for geometric scans', () => {
    const fanSettings = { ...BASE, pattern: 'wideFan' as const, beamCount: 8 }
    for (let phase = 0; phase <= 2; phase += 0.02) {
      const fan = generateAfterhoursBeams(fanSettings, { motionPhase: phase, motionAuthority: 1 })
      expect(fan.filter(beam => beam.active).every(beam => beam.motion?.retrace === false && beam.blanked === false)).toBe(true)
    }

    const diamondSettings = { ...BASE, pattern: 'diamondStar' as const, sideLasers: true, topLasers: true, beamCount: 8 }
    let sawBlankedRetrace = false
    for (let phase = 0; phase <= 4; phase += 0.01) {
      const first = generateAfterhoursBeams(diamondSettings, { motionPhase: phase, motionAuthority: 1 })
      const again = generateAfterhoursBeams(diamondSettings, { motionPhase: phase, motionAuthority: 1 })
      expect(again).toEqual(first)
      if (first.some(beam => beam.active && beam.blanked && beam.motion?.retrace)) sawBlankedRetrace = true
    }
    expect(sawBlankedRetrace).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { IFRIT_PATTERNS, IFRIT_MECHANICS_NUMBERS, ifritComponentId, type IfritPattern } from '../modules/ifrit/Cinema2IfritDomain'
import { IFRIT_QUALITY_LIMITS, createIfritMechanicalFrame, ifritEffectiveCounts, type IfritMechanicsControls, type IfritComponentPose } from '../modules/ifrit/Cinema2IfritMechanics'
import { createIfritVisualFrame, IfritTimeline, type IfritPhases } from '../modules/ifrit/Cinema2IfritMotion'
import { IFRIT_EMPTY_OVERRIDES, parseIfritElementOverrides, resolveIfritElementPatch } from '../modules/ifrit/Cinema2IfritOverrides'

const phases = (score = 3.1, gear = 0.5): IfritPhases => ({ travel: 4.2, spin: 0.7, score, gear })
const rings = (p: IfritPhases = phases(), pattern: IfritPattern = 'infernalPassage', channels: Record<string, number> = {}) =>
  createIfritVisualFrame(p, { count: 5, spacing: 1, twist: 0.45, detail: 1 }, channels, pattern).rings
const controls = (over: Partial<IfritMechanicsControls> = {}): IfritMechanicsControls => ({
  enabled: true, density: 0.7, spokeExtension: 0.35, spokePulse: 0.55, bladeSweep: 0.6, bladeCount: 3, satelliteCount: 2, satelliteOrbitRadius: 0.65, satelliteOrbitSpeed: 0.45,
  sectors: Array.from({ length: 6 }, () => ({ enabled: true, armOffset: 0, bladeOffset: 0 })), aperture: 1, spacing: 1, overrides: IFRIT_EMPTY_OVERRIDES, quality: 'high', ...over,
})
const frame = (c = controls(), p = phases(), pattern: IfritPattern = 'infernalPassage', channels: Record<string, number> = {}, previous: IfritPattern = pattern, transition = 1) =>
  createIfritMechanicalFrame(p, rings(p, pattern, channels), c, channels, pattern, previous, transition)
const byId = (poses: readonly IfritComponentPose[]) => new Map(poses.map(pose => [pose.id, pose]))
const same = (a?: IfritComponentPose, b?: IfritComponentPose) => JSON.stringify(a) === JSON.stringify(b)

describe('Radial Mechanics: identities and structure', () => {
  it('gives every part a unique, stable id, and the authored counts at the defaults (5 rings: spoke, gear, 3 blades, 2 satellites per sector)', () => {
    const poses = frame()
    expect(poses).toHaveLength(5 * 6 * (1 + 1 + 3 + 2))
    expect(new Set(poses.map(pose => pose.id)).size).toBe(poses.length)
    expect(poses[0]!.id).toMatch(/^ring-\d\d\/sector-[0-5]\/(spoke|gear|blade-\d|satellite-\d)$/)
    expect(byId(poses).has(ifritComponentId(2, 4, 'blade', 1))).toBe(true)
    // Ids do not depend on the frame: a different time gives the same id set.
    expect(new Set(frame(controls(), phases(9.7, 2.2)).map(pose => pose.id))).toEqual(new Set(poses.map(pose => pose.id)))
  })

  it('produces nothing with mechanics off or density 0, and honours the count controls and quality tiers (ids of survivors unchanged)', () => {
    expect(frame(controls({ enabled: false }))).toEqual([])
    expect(frame(controls({ density: 0 }))).toEqual([])
    const none = frame(controls({ bladeCount: 0, satelliteCount: 0 }))
    expect(none.every(pose => pose.kind === 'spoke' || pose.kind === 'gear')).toBe(true)
    const high = byId(frame(controls({ bladeCount: 6, satelliteCount: 6, quality: 'high' })))
    const low = frame(controls({ bladeCount: 6, satelliteCount: 6, quality: 'low' }))
    expect(low.length).toBeLessThan(high.size)
    expect(low.every(pose => high.has(pose.id))).toBe(true)
    expect(ifritEffectiveCounts({ density: 0.7, bladeCount: 6, satelliteCount: 6, quality: 'low' })).toEqual({ blades: IFRIT_QUALITY_LIMITS.low.blades, satellites: IFRIT_QUALITY_LIMITS.low.satellites, spokesAndGears: true })
  })

  it('keeps every part outside the central opening and satellites orbiting through depth, never inward', () => {
    const rs = rings()
    for (const pose of frame(controls({ bladeCount: 6, satelliteCount: 6, satelliteOrbitRadius: 1.5 }))) {
      const ring = rs[pose.ringSlot]!
      const radius = Math.hypot(pose.position[0], pose.position[1]) / ring.radius
      expect(radius, pose.id).toBeGreaterThan(2.7)
      if (pose.kind === 'satellite') expect(radius, pose.id).toBeGreaterThan(3.6)
    }
  })
})

describe('Radial Mechanics: independence', () => {
  it('a disabled sector hides only that sector', () => {
    const c = controls({ sectors: Array.from({ length: 6 }, (_, s) => ({ enabled: s !== 2, armOffset: 0, bladeOffset: 0 })) })
    const all = byId(frame()), some = byId(frame(c))
    for (const [id, pose] of all) {
      if (pose.sector === 2) expect(some.has(id), id).toBe(false)
      else expect(same(some.get(id), pose), id).toBe(true)
    }
  })

  it('a sector arm offset and blade offset change only that sector', () => {
    const c = controls({ sectors: Array.from({ length: 6 }, (_, s) => ({ enabled: true, armOffset: s === 1 ? 0.8 : 0, bladeOffset: s === 3 ? 1 : 0 })) })
    const base = byId(frame()), edited = byId(frame(c))
    for (const [id, pose] of base) {
      const other = edited.get(id)!
      if (pose.kind === 'spoke' && pose.sector === 1) expect(other.scale[0]).toBeGreaterThan(pose.scale[0])
      else if (pose.kind === 'blade' && pose.sector === 3) expect(other.rotation[2]).not.toBeCloseTo(pose.rotation[2], 3)
      else expect(same(other, pose), id).toBe(true)
    }
  })

  it('a per-part override changes only that part; a group key changes only that group; a sector key can hide a whole sector', () => {
    const base = byId(frame())
    const part = byId(frame(controls({ overrides: parseIfritElementOverrides('{"ring-01/sector-4/blade-0":{"rotationOffset":0.6}}') })))
    for (const [id, pose] of base) expect(same(part.get(id), pose), id).toBe(id !== 'ring-01/sector-4/blade-0')
    expect(part.get('ring-01/sector-4/blade-0')!.rotation[2]).toBeCloseTo(base.get('ring-01/sector-4/blade-0')!.rotation[2] + 0.6, 6)
    const group = byId(frame(controls({ overrides: parseIfritElementOverrides('{"ring-01/sector-4/blade":{"rotationOffset":0.6}}') })))
    for (const [id, pose] of base) expect(same(group.get(id), pose), id).toBe(/^ring-01\/sector-4\/blade-\d$/.test(id) ? false : true)
    expect(group.get('ring-00/sector-4/blade-0')).toEqual(base.get('ring-00/sector-4/blade-0'))
    const hidden = byId(frame(controls({ overrides: parseIfritElementOverrides('{"ring-02/sector-0":{"enabled":false}}') })))
    for (const id of base.keys()) expect(hidden.has(id), id).toBe(!id.startsWith('ring-02/sector-0/'))
  })

  it('applies each patch field to its own part: scale, angular velocity, spread and extension', () => {
    const base = byId(frame())
    const set = (patch: string, id: string) => byId(frame(controls({ overrides: parseIfritElementOverrides(JSON.stringify({ [id]: JSON.parse(patch) })) }))).get(id)!
    expect(set('{"scaleMultiplier":2}', 'ring-00/sector-0/gear').scale[2]).toBeCloseTo(base.get('ring-00/sector-0/gear')!.scale[2] * 2, 6)
    expect(set('{"extensionOffset":0.8}', 'ring-00/sector-0/spoke').scale[0]).toBeGreaterThan(base.get('ring-00/sector-0/spoke')!.scale[0])
    expect(set('{"angularVelocityMultiplier":-1}', 'ring-00/sector-0/gear').rotation[2]).not.toBeCloseTo(base.get('ring-00/sector-0/gear')!.rotation[2], 3)
    expect(set('{"spreadMultiplier":2}', 'ring-00/sector-0/satellite-0').position).not.toEqual(base.get('ring-00/sector-0/satellite-0')!.position)
  })

  it('parses overrides safely: bad JSON, unknown ids/keys, non-finite numbers are ignored and values are clamped', () => {
    expect(parseIfritElementOverrides('not json')).toBe(IFRIT_EMPTY_OVERRIDES)
    expect(parseIfritElementOverrides('[1,2]')).toBe(IFRIT_EMPTY_OVERRIDES)
    expect(parseIfritElementOverrides('{"ring-99/sector-0/gear":{"enabled":false},"ring-00/sector-9/gear":{"enabled":false},"junk":{"enabled":false}}')).toBe(IFRIT_EMPTY_OVERRIDES)
    const parsed = parseIfritElementOverrides('{"ring-00/sector-0/gear":{"scaleMultiplier":99,"extensionOffset":null,"bogus":1,"enabled":false,"phaseOffset":"x"}}')
    expect(resolveIfritElementPatch(parsed, 'ring-00/sector-0/gear')).toEqual({ enabled: false, scaleMultiplier: 3 })
    expect(resolveIfritElementPatch(parsed, 'ring-00/sector-0/spoke')).toEqual({})
  })
})

describe('Radial Mechanics: patterns, transitions and shared musical cues', () => {
  it('gives each of the six original patterns a distinct mechanical arrangement', () => {
    const arrangements = IFRIT_PATTERNS.map(pattern => JSON.stringify(frame(controls(), phases(3.1), pattern).map(p => [p.position, p.rotation, p.scale])))
    expect(new Set(arrangements).size).toBe(6)
  })

  it('blends an actual intermediate pose through the pattern transition (no pop, no long way round)', () => {
    const a = byId(frame(controls(), phases(), 'infernalPassage', {}, 'infernalPassage', 1))
    const b = byId(frame(controls(), phases(), 'counterfire', {}, 'infernalPassage', 1))
    const start = byId(frame(controls(), phases(), 'counterfire', {}, 'infernalPassage', 0))
    const middle = byId(frame(controls(), phases(), 'counterfire', {}, 'infernalPassage', 0.5))
    const id = ifritComponentId(1, 2, 'spoke')
    expect(start.get(id)!.scale[0]).toBeCloseTo(a.get(id)!.scale[0], 6)
    const lo = Math.min(a.get(id)!.scale[0], b.get(id)!.scale[0]), hi = Math.max(a.get(id)!.scale[0], b.get(id)!.scale[0])
    expect(middle.get(id)!.scale[0]).toBeGreaterThanOrEqual(lo - 1e-9)
    expect(middle.get(id)!.scale[0]).toBeLessThanOrEqual(hi + 1e-9)
    for (const gear of [ifritComponentId(0, 0, 'gear'), ifritComponentId(3, 5, 'gear')]) {
      const step = Math.abs(Math.atan2(Math.sin(middle.get(gear)!.rotation[2] - start.get(gear)!.rotation[2]), Math.cos(middle.get(gear)!.rotation[2] - start.get(gear)!.rotation[2])))
      expect(step, gear).toBeLessThan(Math.PI)
    }
  })

  it('reacts to each shared cue on its own part: spoke kicks, blade snares, gear downbeats, satellite phrases, drop banks', () => {
    const quiet = byId(frame())
    const spoke = ifritComponentId(0, 0, 'spoke'), blade = ifritComponentId(0, 0, 'blade', 0), gear = ifritComponentId(0, 0, 'gear'), sat = ifritComponentId(0, 0, 'satellite', 0)
    const kicked = byId(frame(controls(), phases(), 'infernalPassage', { spokeKick: 1, kickNear: 1 }))
    expect(kicked.get(spoke)!.scale[0]).toBeGreaterThan(quiet.get(spoke)!.scale[0])
    expect(kicked.get(gear)).toEqual(quiet.get(gear))
    const snared = byId(frame(controls(), phases(), 'infernalPassage', { bladeSnare: 1, snareLeft: 1 }))
    expect(snared.get(blade)!.rotation[2]).not.toBeCloseTo(quiet.get(blade)!.rotation[2], 3)
    const downbeat = byId(frame(controls(), phases(), 'infernalPassage', { gearDownbeat: 1 }))
    expect(downbeat.get(gear)!.rotation[2]).not.toBeCloseTo(quiet.get(gear)!.rotation[2], 3)
    expect(downbeat.get(spoke)).toEqual(quiet.get(spoke))
    const phrase = byId(frame(controls(), phases(), 'infernalPassage', { satellitePhrase: 1 }))
    expect(phrase.get(sat)!.position).not.toEqual(quiet.get(sat)!.position)
    const drop = byId(frame(controls(), phases(), 'infernalPassage', { dropExpand: 1, dropAlign: 1 }))
    expect(drop.get(spoke)!.scale[0]).toBeGreaterThan(quiet.get(spoke)!.scale[0])
    // Near, middle and far kicks drive different rings by their current distance.
    const rs = rings()
    const nearest = rs.reduce((best, r, i) => r.distance < rs[best]!.distance ? i : best, 0), farthest = rs.reduce((best, r, i) => r.distance > rs[best]!.distance ? i : best, 0)
    const near = byId(frame(controls(), phases(), 'infernalPassage', { kickNear: 1 })), far = byId(frame(controls(), phases(), 'infernalPassage', { kickFar: 1 }))
    const gain = (m: Map<string, IfritComponentPose>, slot: number) => m.get(ifritComponentId(slot, 0, 'spoke'))!.scale[0] / quiet.get(ifritComponentId(slot, 0, 'spoke'))!.scale[0]
    expect(gain(near, nearest)).toBeGreaterThan(gain(near, farthest))
    expect(gain(far, farthest)).toBeGreaterThan(gain(far, nearest))
  })

  it('is deterministic: the same canonical phases and channel values give identical poses, and a paused timeline holds them', () => {
    const channels = { spokeKick: 0.4, bladeSnare: 0.3, energy: 0.6 }
    expect(frame(controls(), phases(), 'riftLock', channels)).toEqual(frame(controls(), phases(), 'riftLock', channels))
    const timeline = new IfritTimeline()
    const f = { audio: null, transport: { sourcePresent: true, playing: false, paused: true, timeSec: 12 }, timestampMs: 0, elapsedTimeSec: 12, contextGeneration: 1 } as never
    const first = timeline.update(f, 12, { travel: 0.6, rotation: 0.15, sync: false, gearSpeed: 0.35 }, true)
    expect(timeline.update(f, 12, { travel: 0.6, rotation: 0.15, sync: false, gearSpeed: 0.35 }, false)).toEqual(first)
    expect(frame(controls(), first)).toEqual(frame(controls(), first))
  })

  it('timeline: a gear-speed edit preserves the gear phase (no jump), and zero travel and rotation still freeze score', () => {
    const timeline = new IfritTimeline()
    const f = (t: number) => ({ audio: null, transport: { sourcePresent: true, playing: true, paused: false, timeSec: t, bpm: 120 }, timestampMs: t * 1000, elapsedTimeSec: t, contextGeneration: 1 }) as never
    const before = timeline.update(f(10), 10, { travel: 0.6, rotation: 0.15, sync: false, gearSpeed: 0.35 }, true)
    const after = timeline.update(f(10), 10, { travel: 0.6, rotation: 0.15, sync: false, gearSpeed: -1.2 }, false)
    expect(after.gear).toBeCloseTo(before.gear!, 9)
    const later = timeline.update(f(11), 11, { travel: 0.6, rotation: 0.15, sync: false, gearSpeed: -1.2 }, false)
    expect(later.gear!).toBeLessThan(after.gear!)
    const frozen = new IfritTimeline()
    const a = frozen.update(f(10), 10, { travel: 0, rotation: 0, sync: false, gearSpeed: 0.35 }, true), b = frozen.update(f(12), 12, { travel: 0, rotation: 0, sync: false, gearSpeed: 0.35 }, false)
    expect(b.score).toBe(a.score)
  })

  it('declares the controls exactly as authored (ranges and defaults)', () => {
    expect(IFRIT_MECHANICS_NUMBERS['mechanics-density']).toEqual([0, 0.70, 1])
    expect(IFRIT_MECHANICS_NUMBERS['gear-speed']).toEqual([-2, 0.35, 2])
    expect(IFRIT_MECHANICS_NUMBERS['satellite-orbit-radius']).toEqual([0.1, 0.65, 1.5])
  })
})

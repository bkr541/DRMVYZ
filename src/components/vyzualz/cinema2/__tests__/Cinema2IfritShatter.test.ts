import { describe, expect, it } from 'vitest'
import { IFRIT_PATTERNS, IFRIT_SHATTER_NUMBERS, ifritComponentId, ifritHash, type IfritPattern } from '../modules/ifrit/Cinema2IfritDomain'
import { IFRIT_RADIUS } from '../modules/ifrit/Cinema2IfritGeometry'
import { createIfritVisualFrame, type IfritPhases } from '../modules/ifrit/Cinema2IfritMotion'
import { IFRIT_EMPTY_OVERRIDES, parseIfritElementOverrides } from '../modules/ifrit/Cinema2IfritOverrides'
import { createIfritShatterFrame, ifritCut, ifritFragmentBoundaries, ifritOriginalSurvival, type IfritShardPose, type IfritShatterControls } from '../modules/ifrit/Cinema2IfritShatter'

const phases = (score = 3.1): IfritPhases => ({ travel: 4.2, spin: 0.7, score, gear: 0.5 })
const rings = (p = phases(), pattern: IfritPattern = 'infernalPassage') => createIfritVisualFrame(p, { count: 5, spacing: 1, twist: 0.45, detail: 1 }, {}, pattern).rings
const controls = (over: Partial<IfritShatterControls> = {}): IfritShatterControls => ({
  enabled: true, trigger: 'drop', strength: 0.72, hold: 0, fragmentsPerEdge: 3, spread: 0.9, spin: 1.25, reassembly: 0.75, sectorBias: [1, 1, 1, 1, 1, 1],
  aperture: 1, spacing: 1, thickness: 1, overrides: IFRIT_EMPTY_OVERRIDES, quality: 'high', ...over,
})
const frame = (c = controls(), channels: Record<string, number> = {}, pattern: IfritPattern = 'infernalPassage', p = phases(), previous: IfritPattern = pattern, transition = 1) =>
  createIfritShatterFrame(p, rings(p, pattern), c, channels, pattern, previous, transition)
const byId = (shards: readonly IfritShardPose[]) => new Map(shards.map(shard => [shard.id, shard]))
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

describe('Shatter & Reconstruction: whole by default', () => {
  it('emits nothing and keeps every original edge with no cue, with shatter off, and at strength 0 (survival is exactly all ones)', () => {
    expect(frame()).toEqual([])
    expect(frame(controls({ enabled: false }), { shatterBurst: 1 })).toEqual([])
    expect(frame(controls({ strength: 0 }), { shatterBurst: 1 })).toEqual([])
    expect([...ifritOriginalSurvival(frame())].every(v => v === 1)).toBe(true)
    expect(ifritOriginalSurvival([]).length).toBe(72)
  })

  it('declares the controls exactly as authored', () => {
    expect(IFRIT_SHATTER_NUMBERS['shatter-strength']).toEqual([0, 0.72, 1])
    expect(IFRIT_SHATTER_NUMBERS['fragments-per-edge']).toEqual([1, 3, 4])
    expect(IFRIT_SHATTER_NUMBERS['reassembly-duration']).toEqual([0.15, 0.75, 2])
  })
})

describe('Shatter & Reconstruction: addressable pieces that tile the edge', () => {
  const manual = (hold: number, extra: Partial<IfritShatterControls> = {}) => frame(controls({ trigger: 'manual', hold, ...extra }))

  it('gives every section a stable id, three per edge by default, on every active ring, and the same ids whatever the history', () => {
    const shards = manual(1)
    expect(shards).toHaveLength(5 * 6 * 3)
    expect(shards.every(s => /^ring-\d\d\/sector-[0-5]\/shard-[0-2]$/.test(s.id))).toBe(true)
    expect(new Set(shards.map(s => s.id)).size).toBe(shards.length)
    const first = byId(manual(1)), afterOther = (frame(controls({ trigger: 'manual', hold: 0.4 }), {}, 'riftLock', phases(8)), byId(manual(1)))
    expect([...afterOther.keys()]).toEqual([...first.keys()])
    expect(afterOther.get(ifritComponentId(1, 2, 'shard', 1))).toEqual(first.get(ifritComponentId(1, 2, 'shard', 1)))
  })

  it('whole sections tile the hexagon edge exactly: lengths sum to the side, adjacent ends share their cut, the corners are straight', () => {
    for (const count of [1, 2, 3, 4]) {
      const shards = manual(1, { fragmentsPerEdge: count }).filter(s => s.ringSlot === 0 && s.sector === 0)
      expect(shards).toHaveLength(count)
      const ring = rings()[0]!
      const side = IFRIT_RADIUS * ring.radius
      expect(shards.reduce((sum, s) => sum + s.scale[0], 0)).toBeCloseTo(side, 6)
      expect(shards[0]!.cutStart).toBe(0)
      expect(shards[count - 1]!.cutEnd).toBe(0)
      for (let j = 0; j < count - 1; j++) expect(shards[j]!.cutEnd).toBe(shards[j + 1]!.cutStart)
      expect(ifritFragmentBoundaries(0, 0, count)[0]).toBe(0)
      expect(ifritFragmentBoundaries(0, 0, count)[count]).toBe(1)
      expect(ifritCut(0, 0, 0, count)).toBe(0)
    }
    expect(manual(1).filter(s => s.corner).length).toBe(5 * 6)
  })

  it('suppresses exactly the original edges whose pieces are in flight', () => {
    const shards = frame(controls({ trigger: 'manual', hold: 1, sectorBias: [1, 0, 1, 1, 1, 1] }))
    const survive = ifritOriginalSurvival(shards)
    for (let ring = 0; ring < 5; ring++) for (let sector = 0; sector < 6; sector++) expect(survive[ring * 6 + sector], `${ring}/${sector}`).toBe(sector === 1 ? 1 : 0)
    for (let ring = 5; ring < 12; ring++) for (let sector = 0; sector < 6; sector++) expect(survive[ring * 6 + sector]).toBe(1)
    expect(shards.some(s => s.sector === 1)).toBe(false)
  })
})

describe('Shatter & Reconstruction: break, hold and exact reconstruction', () => {
  // Twisted Descent passes the event through unchanged, so a piece's threshold is its own hash alone.
  const manual = (hold: number) => frame(controls({ trigger: 'manual', hold, sectorBias: [1, 1, 1, 1, 1, 1] }), {}, 'twistedDescent')

  // The piece that breaks first (its own threshold is lowest), so every fracture level has it in flight.
  const earliest = () => manual(1).reduce((best, s) => ifritHashOf(s) < ifritHashOf(best) ? s : best)
  const ifritHashOf = (s: IfritShardPose) => ifritHash(s.ringSlot, s.sector, s.fragmentIndex, 21)
  const track = (hold: number) => byId(manual(hold)).get(earliest().id)

  it('shatter 0 and shatter 1 are physically different: whole, then separated with their own rotation', () => {
    const id = earliest().id
    const broken = byId(manual(1)).get(id)!
    expect(dist(broken.position, broken.sourcePosition)).toBeGreaterThan(0.45)
    expect(Math.abs(broken.rotation[0]) + Math.abs(broken.rotation[1])).toBeGreaterThan(0.3)
    expect(broken.fracture).toBeGreaterThan(0.9)
    // Pieces that have not yet broken sit exactly on their source in a sector that has: no doubled or drifting edge.
    for (const shard of manual(0.2)) if (shard.fracture === 0) { expect(shard.position).toEqual(shard.sourcePosition); expect(shard.rotation[0]).toBeCloseTo(0, 12); expect(shard.rotation[1]).toBeCloseTo(0, 12) }
  })

  it('leaves its source point along one path and returns along the same path, reaching the source at 0', () => {
    const start = ifritHashOf(earliest()) * 0.5
    const levels = [start * 1.5 + 0.0005, 0.1 + start, 0.3 + start, 0.55, 0.8, 1]
    const path = levels.map(track)
    const distances = path.map(p => dist(p!.position, p!.sourcePosition))
    for (let i = 1; i < distances.length; i++) expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]! - 1e-9)
    // The same fracture gives the same pose going out or coming back (a pure function of the fracture, no history).
    expect(track(0.55)).toEqual(path[3])
    // Just above the piece's own threshold the error to the source is effectively zero, and at 0 the original edge is back with no shards at all.
    const hash = ifritHashOf(earliest())
    const nearly = track(hash * 0.5 * 1.5 + 0.0005)!
    expect(dist(nearly.position, nearly.sourcePosition)).toBeLessThan(0.002)
    expect(Math.abs(nearly.rotation[0]) + Math.abs(nearly.rotation[1])).toBeLessThan(0.005)
    expect(manual(0)).toEqual([])
  })

  it('direction has radial, tangential and axial parts that differ piece to piece', () => {
    const shards = manual(1).filter(s => s.ringSlot === 0)
    const offsets = shards.map(s => [s.position[0] - s.sourcePosition[0], s.position[1] - s.sourcePosition[1], s.position[2] - s.sourcePosition[2]])
    expect(offsets.some(o => Math.abs(o[2]!) > 0.3)).toBe(true)
    expect(new Set(offsets.map(o => o.map(v => v.toFixed(2)).join(','))).size).toBe(offsets.length)
  })

  it('moves with the drop burst and rebuilds as the shared recall rises, back to whole when both are done', () => {
    const at = (channels: Record<string, number>) => frame(controls(), channels)
    const burst = at({ shatterBurst: 1 }), mid = at({ shatterBurst: 0.5, shatterRecall: 0.2 }), recalled = at({ shatterBurst: 0.6, shatterRecall: 1 }), done = at({ shatterBurst: 0, shatterRecall: 0.3 })
    expect(burst.length).toBeGreaterThan(0)
    const spread = (s: readonly IfritShardPose[]) => s.reduce((sum, p) => sum + dist(p.position, p.sourcePosition), 0) / Math.max(1, s.length)
    expect(spread(burst)).toBeGreaterThan(spread(mid))
    expect(spread(recalled)).toBeLessThan(spread(mid))
    expect(done).toEqual([])
    expect(burst.every(s => ifritOriginalSurvival(burst)[s.ringSlot * 6 + s.sector] === 0)).toBe(true)
    // A small cue moves only the pieces whose own threshold it clears.
    const small = at({ shatterBurst: 0.35 })
    expect(small.filter(s => s.fracture > 0).length).toBeLessThan(burst.filter(s => s.fracture > 0).length)
  })

  it('reassembly duration reshapes the return: shorter snaps back faster, longer lingers', () => {
    const f = (reassembly: number) => frame(controls({ reassembly }), { shatterBurst: 0.45 }).reduce((sum, s) => sum + s.fracture, 0)
    expect(f(0.15)).toBeLessThan(f(0.75))
    expect(f(2)).toBeGreaterThan(f(0.75))
  })

  it('depth biases which rings separate on a modest cue (nearer first)', () => {
    const rs = rings()
    const nearest = rs.reduce((b, r, i) => r.distance < rs[b]!.distance ? i : b, 0), farthest = rs.reduce((b, r, i) => r.distance > rs[b]!.distance ? i : b, 0)
    const shards = frame(controls({ strength: 1 }), { shatterBurst: 0.5 })
    const total = (slot: number) => shards.filter(s => s.ringSlot === slot).reduce((sum, s) => sum + s.fracture, 0)
    expect(total(nearest)).toBeGreaterThanOrEqual(total(farthest))
  })

  it('sector bias and per-part overrides stay local', () => {
    const base = byId(frame(controls({ trigger: 'manual', hold: 1 })))
    const biased = byId(frame(controls({ trigger: 'manual', hold: 1, sectorBias: [1, 1, 1, 0, 1, 1] })))
    for (const [id, shard] of base) expect(biased.has(id), id).toBe(shard.sector !== 3)
    const one = byId(frame(controls({ trigger: 'manual', hold: 1, overrides: parseIfritElementOverrides('{"ring-01/sector-2/shard-1":{"enabled":false,"spreadMultiplier":3}}') })))
    expect(one.has('ring-01/sector-2/shard-1')).toBe(false)
    for (const [id, shard] of base) if (id !== 'ring-01/sector-2/shard-1') expect(one.get(id), id).toEqual(shard)
    const wide = byId(frame(controls({ trigger: 'manual', hold: 1, overrides: parseIfritElementOverrides('{"ring-01/sector-2/shard-1":{"spreadMultiplier":2}}') })))
    expect(dist(wide.get('ring-01/sector-2/shard-1')!.position, base.get('ring-01/sector-2/shard-1')!.sourcePosition)).toBeGreaterThan(dist(base.get('ring-01/sector-2/shard-1')!.position, base.get('ring-01/sector-2/shard-1')!.sourcePosition))
  })
})

describe('Shatter & Reconstruction: triggers and patterns', () => {
  it('routes by trigger: drop uses the burst, kick the staged kicks (alternating banks), phrase a travelling wave, manual never invents an event', () => {
    const channels = { shatterBurst: 1, kickNear: 1, kickMiddle: 1, kickFar: 1, shatterPhrase: 0.6 }
    expect(frame(controls({ trigger: 'drop' }), { kickNear: 1, shatterPhrase: 1 })).toEqual([])
    expect(frame(controls({ trigger: 'kick' }), { shatterBurst: 1 })).toEqual([])
    expect(frame(controls({ trigger: 'phrase' }), { shatterBurst: 1, kickNear: 1 })).toEqual([])
    expect(frame(controls({ trigger: 'manual', hold: 0 }), channels)).toEqual([])
    expect(frame(controls({ trigger: 'drop' }), channels).length).toBeGreaterThan(0)
    expect(frame(controls({ trigger: 'kick' }), channels).length).toBeGreaterThan(0)
    expect(frame(controls({ trigger: 'phrase' }), channels).length).toBeGreaterThan(0)
    const a = frame(controls({ trigger: 'kick', strength: 1 }), { kickNear: 1, kickMiddle: 1, kickFar: 1 }, 'infernalPassage', phases(2.2))
    const b = frame(controls({ trigger: 'kick', strength: 1 }), { kickNear: 1, kickMiddle: 1, kickFar: 1 }, 'infernalPassage', phases(3.2))
    expect(new Set(a.map(s => `${s.ringSlot}/${s.sector}`))).not.toEqual(new Set(b.map(s => `${s.ringSlot}/${s.sector}`)))
    const wave = (shatterPhrase: number) => new Set(frame(controls({ trigger: 'phrase', strength: 1 }), { shatterPhrase }).map(s => s.ringSlot))
    expect(wave(0.95)).not.toEqual(wave(0.2))
  })

  it('gives each of the six patterns a distinct shard arrangement, and an in-between pose mid-transition', () => {
    const arrangements = IFRIT_PATTERNS.map(pattern => JSON.stringify(frame(controls({ trigger: 'manual', hold: 0.7 }), { snareLeft: 0.5 }, pattern).map(s => [s.position, s.rotation])))
    expect(new Set(arrangements).size).toBe(6)
    const c = controls({ trigger: 'manual', hold: 0.7 })
    const a = byId(frame(c, {}, 'twistedDescent', phases(), 'infernalPassage', 0)), b = byId(frame(c, {}, 'twistedDescent', phases(), 'infernalPassage', 1)), m = byId(frame(c, {}, 'twistedDescent', phases(), 'infernalPassage', 0.5))
    const id = ifritComponentId(0, 0, 'shard', 0)
    const da = dist(a.get(id)!.position, b.get(id)!.position)
    expect(dist(a.get(id)!.position, m.get(id)!.position)).toBeGreaterThan(0)
    expect(dist(a.get(id)!.position, m.get(id)!.position)).toBeLessThan(da)
  })

  it('is deterministic across play, seek, loop and re-entry: the same phase and shared values give identical shards', () => {
    const channels = { shatterBurst: 0.8, shatterRecall: 0.1, snareRight: 0.3 }
    expect(frame(controls(), channels, 'counterfire', phases(7.7))).toEqual(frame(controls(), channels, 'counterfire', phases(7.7)))
  })

  it('quality tiers thin the sections but keep every kind of piece and the ids of the survivors', () => {
    const high = byId(frame(controls({ trigger: 'manual', hold: 1, fragmentsPerEdge: 4 }))), low = frame(controls({ trigger: 'manual', hold: 1, fragmentsPerEdge: 4, quality: 'low' }))
    expect(low.length).toBeLessThan(high.size)
    expect(low.every(s => /shard-[01]$/.test(s.id) && high.has(s.id))).toBe(true)
  })
})

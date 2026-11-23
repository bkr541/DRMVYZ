import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_HYPNOTIZE_INSTANCE_FLOATS,
  CINEMA2_HYPNOTIZE_QUALITY_RINGS,
  CINEMA2_HYPNOTIZE_RING_PARTS,
  CINEMA2_HYPNOTIZE_TUNNEL,
  HYP_KIND,
  buildCinema2HypnotizeTunnelLayout,
  createCinema2HypnotizeTunnelFrame,
  updateCinema2HypnotizeTunnelFrame,
  type Cinema2HypnotizeTunnelInputs,
} from '../modules/hypnotize/Cinema2HypnotizeTunnel'
import { CINEMA2_HYPNOTIZE_PATTERNS, CINEMA2_HYPNOTIZE_PATTERN_PROFILES } from '../modules/hypnotize/Cinema2HypnotizePatternEngine'
import { createCinema2HypnotizeNativeModuleDefinition } from '../modules/Cinema2HypnotizeNativeModule'
import type { Cinema2ModuleCreateContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_HYPNOTIZE_PRESET_MANIFEST } from '../presets/Cinema2HypnotizePreset'

const layout = buildCinema2HypnotizeTunnelLayout()
const T = CINEMA2_HYPNOTIZE_TUNNEL

function inputs(patch: Partial<Cinema2HypnotizeTunnelInputs> = {}, pattern: (typeof CINEMA2_HYPNOTIZE_PATTERNS)[number] = 'mesmericOrbit'): Cinema2HypnotizeTunnelInputs {
  return {
    patternFrame: { pattern, previousPattern: pattern, transition: 1, beats: 5.6, profile: CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern] },
    signals: { overallEnergy: 0.5, bassPressure: 0.5, highsAmount: 0.3, fluxAmount: 0.2, kickAccent: 0.2, snareAccent: 0.1, downbeatAccent: 0, phraseAccent: 0, dropAccent: 0 },
    ledPowerGatingEnabled: true, scroll: 0.3, rotationEven: 0.4, rotationOdd: -0.3, twist: 0.21, intensity: 1, ledGain: 1, pulseDepth: 0.55, vocalRestraint: 1,
    beatAccent: 0, kickAccent: 0, downbeatAccent: 0, dropAccent: 0, overallEnergy: 0.5, ringsVisible: 28, lineGain: 1.7, ...patch,
  }
}

describe('Hypnotize tunnel layout', () => {
  it('is one fixed block of instances: the lines and glow first, then every ring in the same order', () => {
    expect(layout.globalCount).toBe(T.lines + 2)
    expect(layout.ringCount).toBe(T.ringSlots)
    expect(layout.perRing).toBe(CINEMA2_HYPNOTIZE_RING_PARTS.perRing)
    expect(layout.instanceCount).toBe(layout.globalCount + T.ringSlots * layout.perRing)
    expect(layout.packed).toHaveLength(layout.instanceCount * CINEMA2_HYPNOTIZE_INSTANCE_FLOATS)
    // a few thousand instances in total, against about 600 separate meshes with a material each before
    expect(layout.instanceCount).toBeLessThan(8000)
  })

  it('has only finite values, valid kinds, and ring slots inside the tunnel', () => {
    const kinds = new Set<number>(Object.values(HYP_KIND))
    for (let index = 0; index < layout.instanceCount; index += 1) {
      const row = layout.packed.subarray(index * 12, index * 12 + 12)
      expect([...row].every(Number.isFinite)).toBe(true)
      expect(kinds.has(row[3]!)).toBe(true)
      const slot = row[8]!
      if (index < layout.globalCount) expect(slot).toBe(-1)
      else expect(slot).toBe(Math.floor((index - layout.globalCount) / layout.perRing))
      expect(row[4]).toBeGreaterThan(0); expect(row[5]).toBeGreaterThan(0); expect(row[6]).toBeGreaterThan(0)
    }
  })

  it('addresses every strip of a ring once, by sector and segment, the address space the pattern choreography is written for', () => {
    const seen = new Set<string>()
    const base = layout.globalCount + CINEMA2_HYPNOTIZE_RING_PARTS.strips
    for (let strip = 0; strip < CINEMA2_HYPNOTIZE_RING_PARTS.stripsPerRing; strip += 1) {
      const row = layout.packed.subarray((base + strip) * 12, (base + strip) * 12 + 12)
      expect(row[3]).toBe(HYP_KIND.strip)
      seen.add(`${row[9]}:${row[10]}`)
    }
    expect(seen.size).toBe(T.sectors * T.segmentsPerSector)
  })
})

describe('Hypnotize tunnel animation', () => {
  it('places the rings one spacing apart, nearest first, and keeps them continuous as the tunnel scrolls past a whole ring', () => {
    const frame = createCinema2HypnotizeTunnelFrame(layout)
    updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ scroll: 4.25 }))
    for (let slot = 1; slot < T.ringSlots; slot += 1) expect(frame.ringZ[slot - 1]! - frame.ringZ[slot]!).toBeCloseTo(T.spacing, 4)
    const before = createCinema2HypnotizeTunnelFrame(layout), after = createCinema2HypnotizeTunnelFrame(layout)
    updateCinema2HypnotizeTunnelFrame(layout, before, inputs({ scroll: 4.999 }))
    updateCinema2HypnotizeTunnelFrame(layout, after, inputs({ scroll: 5.001 }))
    // the ring that was in slot 1 is now in slot 0, at (almost) the same place, with the same turn
    expect(after.ringZ[0]).toBeCloseTo(before.ringZ[1]!, 1)
    expect(after.ringAngle[0]).toBeCloseTo(before.ringAngle[1]!, 6)
    expect(after.ringVane[0]).toBe(before.ringVane[1])
  })

  it('turns each ring a little more than the last, with neighbours turning against each other, and a hero ring every ninth', () => {
    const frame = createCinema2HypnotizeTunnelFrame(layout)
    updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ scroll: 0, rotationEven: 1, rotationOdd: -1, twist: 0.2 }))
    expect(frame.ringAngle[0]).toBeCloseTo(0 * 0.2 + 1, 6)
    expect(frame.ringAngle[1]).toBeCloseTo(1 * 0.2 - 1, 6)
    expect(frame.ringAngle[2]).toBeCloseTo(2 * 0.2 + 1, 6)
    const heroes = [...frame.ringHero].map((value, slot) => (value > 0 ? slot : -1)).filter(slot => slot >= 0)
    expect(heroes).toEqual([0, 9, 18, 27])
    expect([...frame.ringVane.subarray(0, 4)]).toEqual([1, 0, 1, 0])
  })

  it('lights the strips differently for each of the six patterns, and never produces a non-finite value', () => {
    const signatures = CINEMA2_HYPNOTIZE_PATTERNS.map(pattern => {
      const frame = createCinema2HypnotizeTunnelFrame(layout)
      updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({}, pattern))
      expect([...frame.dynamic].every(Number.isFinite)).toBe(true)
      expect([...frame.ringGlow, ...frame.ringZ, ...frame.ringAngle].every(Number.isFinite)).toBe(true)
      const base = layout.globalCount + CINEMA2_HYPNOTIZE_RING_PARTS.strips
      return Array.from({ length: 96 }, (_, strip) => frame.dynamic[(base + strip) * 4]!.toFixed(3)).join(',')
    })
    expect(new Set(signatures).size).toBe(6)
  })

  it('is brighter with Intensity and LED Intensity, and a drop lifts the hero ring', () => {
    const emission = (patch: Partial<Cinema2HypnotizeTunnelInputs>, slot = 0) => {
      const frame = createCinema2HypnotizeTunnelFrame(layout)
      updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ scroll: 0, ...patch }))
      const base = layout.globalCount + slot * layout.perRing + CINEMA2_HYPNOTIZE_RING_PARTS.strips
      return Array.from({ length: 48 }, (_, strip) => frame.dynamic[(base + strip) * 4]!).reduce((sum, value) => sum + value, 0)
    }
    expect(emission({ intensity: 2 })).toBeGreaterThan(emission({ intensity: 1 }))
    expect(emission({ ledGain: 0 })).toBe(0)
    expect(emission({ dropAccent: 1 }, 0)).toBeGreaterThan(emission({ dropAccent: 0 }, 0))
  })

  it('draws fewer rings at a lower quality tier, from the front', () => {
    const frame = createCinema2HypnotizeTunnelFrame(layout)
    updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ ringsVisible: CINEMA2_HYPNOTIZE_QUALITY_RINGS.low }))
    expect(frame.ringsVisible).toBe(16)
    updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ ringsVisible: 999 }))
    expect(frame.ringsVisible).toBe(T.ringSlots)
    updateCinema2HypnotizeTunnelFrame(layout, frame, inputs({ ringsVisible: -4 }))
    expect(frame.ringsVisible).toBe(1)
  })
})

describe('Hypnotize native module', () => {
  function create(parameters: Record<string, unknown>, frameOverride: Record<string, unknown> = {}) {
    const draw = vi.fn(), dispose = vi.fn(), reportGpuBytes = vi.fn()
    let release: (() => void) | null = null
    const renderer = { draw, dispose, estimateGpuBytes: () => 12345 }
    const definition = createCinema2HypnotizeNativeModuleDefinition({ createRenderer: () => renderer })
    const resources = {
      acquire: (_key: string, _kind: string, make: () => typeof renderer, free: (value: typeof renderer) => void) => { const value = make(); release = () => free(value); return value },
      reportGpuBytes,
    }
    const module = CINEMA2_HYPNOTIZE_PRESET_MANIFEST.modules![0]!
    const instance = definition.create({
      module, parameters: new Map(Object.entries(parameters)), targets: {}, media: {}, resources, randomness: {},
    } as unknown as Cinema2ModuleCreateContext)
    const run = (extra: Record<string, unknown> = {}) => instance.render!.providers[0]!.execute({
      depthAvailable: true,
      camera: { position: [0, 0, 0.4], viewProjectionMatrix: Array.from({ length: 16 }, (_, index) => index) },
      lightingEnvironment: { quality: 'high' },
      frame: { elapsedTimeSec: 1, deltaTimeSec: 0.016, transport: { animationActive: true, paused: false, playing: false, sourcePresent: false, bpm: 120 }, ...frameOverride, ...extra },
    } as never)
    return { instance, run, draw, dispose, reportGpuBytes, release: () => release?.() }
  }

  it('draws the whole tunnel with the preset\'s colours and settings, and reports its GPU memory', () => {
    const { run, draw, reportGpuBytes } = create({ look: 'turbineBloom', autoPerformance: false, bpmSync: true, spread: 1.1, edgeGlow: 1.4, primaryColor: [0.1, 0.2, 0.3, 1], secondaryColor: [0.4, 0.5, 0.6, 1], spectrumColor: [0.7, 0.8, 0.9, 1], highlightColor: [1, 1, 1, 1] })
    run()
    expect(draw).toHaveBeenCalledOnce()
    const state = draw.mock.calls[0]![0]
    expect(state).toMatchObject({ cameraPosition: [0, 0, 0.4], lightA: [0.4, 0.5, 0.6], lightB: [0.7, 0.8, 0.9], core: [1, 1, 1], body: [0.1, 0.2, 0.3], radiusScale: 1.1 })
    expect(state.frame.ringsVisible).toBe(CINEMA2_HYPNOTIZE_QUALITY_RINGS.high)
    expect(reportGpuBytes).toHaveBeenCalledWith(12345)
  })

  it('requires a depth attachment and a camera, like every world module', () => {
    const { instance } = create({})
    expect(() => instance.render!.providers[0]!.execute({ depthAvailable: false, camera: {}, frame: {} } as never)).toThrow(/depth attachment/)
    expect(() => instance.render!.providers[0]!.execute({ depthAvailable: true, frame: {} } as never)).toThrow(/Camera Runtime/)
  })

  it('scrolls the tunnel with time, faster with Travel, never while paused, and holds still for Lock Off', () => {
    const scrollAfter = (parameters: Record<string, unknown>, transport: Record<string, unknown> = {}) => {
      const { run, draw } = create({ look: 'mesmericOrbit', autoPerformance: false, bpmSync: false, ...parameters }, { transport: { animationActive: true, paused: false, playing: false, sourcePresent: false, bpm: 120, ...transport } })
      // The module reuses its frame arrays every frame (it allocates nothing), so the first ring's position is read at each draw, not afterwards.
      const first: number[] = []
      draw.mockImplementation((state: { frame: { ringZ: Float32Array } }) => { first.push(state.frame.ringZ[0]!) })
      for (let step = 0; step < 20; step += 1) run({ deltaTimeSec: 0.05 })
      return first.at(-1)! - first[0]!
    }
    const slow = scrollAfter({ travel: 0.1 }), fast = scrollAfter({ travel: 0.9 })
    expect(slow).toBeGreaterThan(0)
    expect(fast).toBeGreaterThan(slow)
    expect(scrollAfter({ travel: 0.9, motionSafety: 'reduced' })).toBeLessThan(fast)
    expect(scrollAfter({ travel: 0.9, motionSafety: 'lockoff' })).toBe(0)
    expect(scrollAfter({ travel: 0.9 }, { paused: true })).toBe(0)
  })

  it('releases its renderer when the last lease is released, and never throws on dispose', () => {
    const { instance, dispose, release } = create({})
    instance.lifecycle.dispose()
    expect(dispose).not.toHaveBeenCalled()
    release()
    expect(dispose).toHaveBeenCalledOnce()
  })
})

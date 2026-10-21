import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BWC_PRESET_MANIFEST } from '../presets/Cinema2BwcPreset'
import { createCinema2BwcNativeModuleDefinition } from '../modules/Cinema2BwcNativeModule'
import { neutralBwcLighting, type Cinema2BwcLightingState } from '../modules/bwc/Cinema2BwcLighting'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })

function frame(options: { time: number; paused?: boolean; stopped?: boolean; event?: { kind: 'beat' | 'downbeat' | 'kick'; id: string }; beatIndex?: number; trackId?: string }): Readonly<Cinema2ModuleFrameReadContext> {
  const { time } = options
  const trackId = options.trackId ?? 'track'
  const event = options.event
  const audioEvent = (kind: string) => event?.kind === kind ? { id: event.id, kind, timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: event.id } : null
  const fixed = (lengthBeats: 4 | 8 | 16 | 32) => ({ lengthBeats, progress: 0, boundary: null })
  return {
    frameId: Math.round(time * 1000), timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: !options.stopped, playing: !options.paused && !options.stopped, paused: options.paused ?? false, analysisActive: !options.stopped, animationActive: !options.paused, trackId, timeSec: time, bpmSync: true, bpm: 120 },
    director: null,
    audio: options.stopped ? null : {
      version: 1, visualFrameId: 1, smoothingOwnership: 'upstream-music-intelligence',
      upstream: { frameId: 1, publicationSequence: 1, publicationKind: 'live', publishedAtMs: 0, publisherId: 'test', sourceId: 'test', trackId, timeSec: time, sampleRate: 48000, analysisRevision: null, timelineRevision: null },
      capabilities: {},
      discontinuity: { occurred: false, id: null, generation: 1, reason: null },
      bands: { sub: available(0.4), bass: available(0.6), lowMid: available(0.35), mid: available(0.5), high: available(0.45), air: available(0.25) },
      features: { overallEnergy: available(0.55), rms: available(0.5), spectralCentroid: unavailable(), spectralFlux: available(0.4), transientEnergy: available(0.3), vocalPresence: available(0.45), tension: unavailable(), complexity: unavailable(), buildProgress: available(0.35), trackEnergy: available(0.5) },
      rhythm: {
        bpm: available(120), beatPhase: available((time * 2) % 1), beatIndex: available(options.beatIndex ?? Math.floor(time * 2)), beatInBar: available(Math.floor(time * 2) % 4), barIndex: available(Math.floor(time / 2)),
        beat: audioEvent('beat'), kick: audioEvent('kick'), snare: null, downbeat: audioEvent('downbeat'), transient: null,
        fixedClocks: { 4: fixed(4), 8: fixed(8), 16: fixed(16), 32: fixed(32) },
      },
      structure: { analyzedPhrases: unavailable(), section: unavailable(), semanticMoments: { ...unavailable(), available: true, value: [] }, buildConfidence: available(0.3), dropConfidence: available(0) },
      stems: unavailable(), lyrics: unavailable(), harmonic: unavailable(),
    } as never,
  } as unknown as Readonly<Cinema2ModuleFrameReadContext>
}

function setup(overrides: Record<string, Cinema2JsonValue> = {}) {
  const moduleManifest = CINEMA2_BWC_PRESET_MANIFEST.modules![0]!
  const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
  for (const [name, value] of Object.entries(overrides)) values.set(name, value)
  const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
  const draw = vi.fn()
  const renderer = { draw, dispose: vi.fn(), estimateGpuBytes: () => 16384 }
  const definition = createCinema2BwcNativeModuleDefinition({ createRenderer: () => renderer })
  const resources = { acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer) => create({} as WebGL2RenderingContext), reportGpuBytes: vi.fn() }
  const instance = definition.create({ module: moduleManifest, parameters, targets: {}, media: {}, resources, randomness: { sample: (_: string, i: number) => ((i + 1) * 0.37) % 1 } } as unknown as Cinema2ModuleCreateContext)
  const update = (f: Readonly<Cinema2ModuleFrameReadContext>) => instance.lifecycle!.update!({ parameters, frame: f } as never)
  const drawn = (): Readonly<Cinema2BwcLightingState> => {
    instance.render!.providers[0]!.execute({ target: null, width: 640, height: 360, frame: frame({ time: 0 }) } as never)
    return draw.mock.calls[draw.mock.calls.length - 1]![0].lighting
  }
  const inspect = () => (instance as unknown as { inspect: () => unknown }).inspect() as { activePattern: string; authoredPattern: string; patternChange: boolean; trigger: string }
  return { instance, values, update, drawn, inspect, draw }
}

describe('BWC module lighting', () => {
  it('draws the authored look before any music has arrived', () => {
    expect(setup().drawn()).toEqual(neutralBwcLighting())
  })

  it('choreographs the lights once music plays, with the authored pattern', () => {
    const { update, drawn, inspect } = setup({ pattern: 'alternate' })
    update(frame({ time: 1 })); update(frame({ time: 1.1 }))
    expect(inspect().activePattern).toBe('alternate')
    expect(drawn()).not.toEqual(neutralBwcLighting())
  })

  it('returns to the authored look when playback stops', () => {
    const { update, drawn } = setup({ pattern: 'center-out' })
    update(frame({ time: 1 })); update(frame({ time: 1.1 }))
    expect(drawn()).not.toEqual(neutralBwcLighting())
    update(frame({ time: 1.2, stopped: true }))
    expect(drawn()).toEqual(neutralBwcLighting())
  })

  it('holds the pattern still while Pattern Change is off, whatever the trigger', () => {
    const { update, inspect } = setup({ pattern: 'flow', patternChange: false, trigger: 'beat' })
    update(frame({ time: 1 }))
    for (let i = 0; i < 6; i += 1) update(frame({ time: 2 + i * 0.5, event: { kind: 'beat', id: `beat:${i}` } }))
    expect(inspect().activePattern).toBe('flow')
  })

  it('moves to another pattern on a new qualified beat with Pattern Change on, and a repeated event does nothing', () => {
    const { update, inspect } = setup({ pattern: 'flow', patternChange: true, trigger: 'beat' })
    update(frame({ time: 1 }))
    update(frame({ time: 1.5, event: { kind: 'beat', id: 'beat:1' } }))
    const afterFirst = inspect().activePattern
    expect(afterFirst).not.toBe('flow')
    update(frame({ time: 1.52, event: { kind: 'beat', id: 'beat:1' } }))
    expect(inspect().activePattern).toBe(afterFirst)
    update(frame({ time: 2, event: { kind: 'beat', id: 'beat:2' } }))
    expect(inspect().activePattern).not.toBe(afterFirst)
  })

  it('ignores an unknown pattern or trigger and falls back to Flow and Bar 4', () => {
    const { update, inspect } = setup({ pattern: 'nope', trigger: 'nope' })
    update(frame({ time: 1 }))
    expect(inspect()).toMatchObject({ activePattern: 'flow', trigger: 'bar4' })
  })

  it('lifts the reactor when the shared choreography delivers a kick cue, and ignores malformed deliveries', () => {
    // The dispatcher names a delivery `<upstream event id>:mainframe-<kind>-cue`; the module matches it against the frame's own event.
    const run = (cue: boolean) => {
      const { instance, update, drawn } = setup({ pattern: 'alternate' })
      update(frame({ time: 1 }))
      if (cue) instance.handleAction!('musicalCue', { eventId: 'kick:1:mainframe-kick-cue', payload: { kind: 'kick' } } as never)
      update(frame({ time: 1.016, event: { kind: 'kick', id: 'kick:1' } }))
      return { instance, core: drawn().reactorCore }
    }
    const cued = run(true)
    expect(cued.core).toBeGreaterThan(run(false).core)
    expect(() => cued.instance.handleAction!('musicalCue', { eventId: 'cue:2', payload: { kind: 'nonsense' } } as never)).not.toThrow()
    expect(() => cued.instance.handleAction!('musicalCue', { eventId: '', payload: null } as never)).not.toThrow()
    expect(() => cued.instance.handleAction!('somethingElse', { eventId: 'x', payload: {} } as never)).not.toThrow()
  })

  describe('controls reach the picture', () => {
    const playing = (overrides: Record<string, Cinema2JsonValue>, beatTime = 1.3) => {
      const rig = setup({ pattern: 'flow', ...overrides })
      rig.update(frame({ time: 1 })); rig.update(frame({ time: beatTime }))
      return rig
    }
    const drawArgs = (rig: ReturnType<typeof setup>) => {
      rig.drawn()
      return rig.draw.mock.calls[rig.draw.mock.calls.length - 1]![0]
    }

    it('hands the renderer the five palette colours, the bloom glow and the fixed hall materials', () => {
      const rig = setup({ reactorColor: [1, 0, 0, 1], pipeColor: [0, 1, 0, 1], wallColor: [0, 0, 1, 1], ceilingColor: [1, 1, 0, 1], structureColor: [0.1, 0.2, 0.3, 1] })
      const args = drawArgs(rig)
      expect(args.lightColors).toEqual({ reactor: [1, 0, 0], pipes: [0, 1, 0], wall: [0, 0, 1], ceiling: [1, 1, 0] })
      expect(args.structure).toEqual([0.1, 0.2, 0.3])
      expect(args.energy).toEqual([1, 0, 0])
      expect(args.glow).toBeGreaterThan(0)
      expect(args.background).toHaveLength(3)
    })

    it('Light Reactivity pulls the choreography back to the authored look, and 0 holds it there', () => {
      const full = playing({ lightReactivity: 1 }).drawn()
      const half = playing({ lightReactivity: 0.5 }).drawn()
      const none = playing({ lightReactivity: 0 }).drawn()
      expect(none).toEqual(neutralBwcLighting())
      expect(full).not.toEqual(neutralBwcLighting())
      expect(Math.abs(half.reactorCore - 1)).toBeCloseTo(Math.abs(full.reactorCore - 1) / 2, 6)
    })

    it('Pulse Width changes the wave, Flicker stutters the panels, and Drop Intensity scales a drop', () => {
      expect(playing({ pulseWidth: 0 }).drawn().wallLeft).not.toEqual(playing({ pulseWidth: 1 }).drawn().wallLeft)
      const steady = playing({ flicker: 0 }).drawn()
      const stutter = playing({ flicker: 1 }).drawn()
      expect([...stutter.wallLeft, ...stutter.ceiling]).not.toEqual([...steady.wallLeft, ...steady.ceiling])
      expect(Math.max(...stutter.wallLeft, ...stutter.ceiling)).toBeLessThanOrEqual(Math.max(...steady.wallLeft, ...steady.ceiling))
      const dropped = (dropIntensity: number) => {
        const rig = setup({ pattern: 'surge', dropIntensity })
        rig.update(frame({ time: 1 }))
        rig.instance.handleAction!('musicalCue', { eventId: 'beat:9:mainframe-kick-cue', payload: { kind: 'kick' } } as never)
        rig.update(frame({ time: 1.016, event: { kind: 'kick', id: 'beat:9' } }))
        return rig.drawn()
      }
      expect(dropped(1).reactorCore).toBeGreaterThanOrEqual(dropped(0).reactorCore)
    })
  })

  it('disposes cleanly and can be updated afterwards without throwing', () => {
    const { instance, update } = setup()
    update(frame({ time: 1 }))
    instance.lifecycle!.dispose!()
    expect(() => update(frame({ time: 1.1 }))).not.toThrow()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BWC_PRESET_MANIFEST } from '../presets/Cinema2BwcPreset'
import { createCinema2BwcNativeModuleDefinition } from '../modules/Cinema2BwcNativeModule'
import { neutralBwcLighting, type Cinema2BwcLightingState } from '../modules/bwc/Cinema2BwcLighting'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })

function frame(options: { time: number; paused?: boolean; stopped?: boolean; event?: { kind: 'beat' | 'downbeat' | 'kick'; id: string }; beatIndex?: number; trackId?: string; build?: number; dropMoment?: string }): Readonly<Cinema2ModuleFrameReadContext> {
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
      features: { overallEnergy: available(0.55), rms: available(0.5), spectralCentroid: unavailable(), spectralFlux: available(0.4), transientEnergy: available(0.3), vocalPresence: available(0.45), tension: unavailable(), complexity: unavailable(), buildProgress: available(options.build ?? 0.35), trackEnergy: available(0.5) },
      rhythm: {
        bpm: available(120), beatPhase: available((time * 2) % 1), beatIndex: available(options.beatIndex ?? Math.floor(time * 2)), beatInBar: available(Math.floor(time * 2) % 4), barIndex: available(Math.floor(time / 2)),
        beat: audioEvent('beat'), kick: audioEvent('kick'), snare: null, downbeat: audioEvent('downbeat'), transient: null,
        fixedClocks: { 4: fixed(4), 8: fixed(8), 16: fixed(16), 32: fixed(32) },
      },
      structure: { analyzedPhrases: unavailable(), section: unavailable(), semanticMoments: { ...unavailable(), available: true, value: options.dropMoment ? [{ id: options.dropMoment, timeSec: time, type: 'drop', confidence: 1, source: 'test' }] : [] }, buildConfidence: available(options.build ? 0.95 : 0.3), dropConfidence: available(0) },
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
  const inspect = () => (instance as unknown as { inspect: () => unknown }).inspect() as { activePattern: string; authoredPattern: string; patternChange: boolean; trigger: string; onStage: string; performance: { pattern: string | null; reason: string | null } }
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

  describe('Auto Performance', () => {
    /** Delivers a drop the way production does: the shared runtime names the cue `<event id>:<action id>` from the manifest's own rule. */
    const dropCueId = (momentId: string): string => {
      const rule = CINEMA2_BWC_PRESET_MANIFEST.choreography!.rules.find(candidate => candidate.source.signal === 'drop')!
      return `${momentId}:${rule.actions[0]!.id}`
    }
    const deliverDrop = (rig: ReturnType<typeof setup>, momentId: string, time: number) => {
      rig.instance.handleAction!('musicalCue', { eventId: dropCueId(momentId), payload: { kind: 'drop' } } as never)
      rig.update(frame({ time, dropMoment: momentId }))
    }
    /** Plays on from `from` to `to` seconds in 0.1 s frames, as the host would; the beat clock advances at most 0.25 s a frame. */
    const playTo = (rig: ReturnType<typeof setup>, from: number, to: number, extra: Parameters<typeof frame>[0] extends infer O ? Partial<O> : never = {}) => {
      for (let t = from + 0.1; t <= to + 1e-9; t += 0.1) rig.update(frame({ ...extra, time: Math.round(t * 1000) / 1000 } as Parameters<typeof frame>[0]))
    }
    const started = (overrides: Record<string, Cinema2JsonValue> = {}) => {
      const rig = setup({ pattern: 'flow', ...overrides })
      rig.update(frame({ time: 1 })); rig.update(frame({ time: 1.1 }))
      return rig
    }

    it('puts Core Burst on stage from a drop for two bars while the base pattern stays Flow, then resumes Flow', () => {
      const rig = started()
      deliverDrop(rig, 'drop-1', 2)
      expect(rig.inspect()).toMatchObject({ authoredPattern: 'flow', activePattern: 'flow', onStage: 'core-burst', performance: { pattern: 'core-burst', reason: 'drop' } })
      playTo(rig, 2, 4)
      expect(rig.inspect().onStage).toBe('core-burst')
      playTo(rig, 4, 6.3)
      expect(rig.inspect()).toMatchObject({ onStage: 'flow', performance: { pattern: null } })
    })

    it('puts Surge on stage while a confident buildup charges and hands back when it ends', () => {
      const rig = started()
      playTo(rig, 1.1, 1.6, { build: 0.7 })
      expect(rig.inspect()).toMatchObject({ onStage: 'surge', performance: { reason: 'build' } })
      playTo(rig, 1.6, 2.5, { build: 0 })
      expect(rig.inspect().onStage).toBe('flow')
    })

    it('does nothing when Auto Performance is off, and does not change the saved Pattern, Pattern Change or Trigger', () => {
      const off = started({ autoPerformance: false })
      deliverDrop(off, 'drop-1', 2)
      off.update(frame({ time: 2.5, build: 0.7 }))
      expect(off.inspect().onStage).toBe('flow')
      const on = started({ patternChange: true, trigger: 'bar8' })
      deliverDrop(on, 'drop-1', 2)
      expect(on.inspect()).toMatchObject({ onStage: 'core-burst', authoredPattern: 'flow', patternChange: true, trigger: 'bar8' })
      expect(on.values.get('pattern')).toBe('flow')
      expect(on.values.get('patternChange')).toBe(true)
      expect(on.values.get('trigger')).toBe('bar8')
    })

    it('keeps the Pattern Change controller running underneath an override, so the base that resumes includes what it advanced to', () => {
      const rig = started({ patternChange: true, trigger: 'beat' })
      deliverDrop(rig, 'drop-1', 2)
      expect(rig.inspect().onStage).toBe('core-burst')
      const baseDuring = new Set<string>()
      let now = 2
      for (let i = 0; i < 5; i += 1) {
        playTo(rig, now, now + 0.4)
        now += 0.5
        rig.update(frame({ time: now, event: { kind: 'beat', id: `beat:${i}` } }))
        baseDuring.add(rig.inspect().activePattern)
        expect(rig.inspect().onStage).toBe('core-burst')
      }
      expect(baseDuring.size).toBeGreaterThan(1)
      playTo(rig, now, 6.4)
      const resumed = rig.inspect()
      expect(resumed.performance.pattern).toBeNull()
      expect(resumed.onStage).toBe(resumed.activePattern)
      expect(resumed.activePattern).not.toBe('flow')
    })

    it('shows a manual Pattern choice at once, is not undone by the drop already on stage, and may override again only on a new drop', () => {
      const rig = started({ patternChange: true, trigger: 'bar8' })
      deliverDrop(rig, 'drop-1', 2)
      expect(rig.inspect().onStage).toBe('core-burst')
      rig.values.set('pattern', 'alternate')
      rig.update(frame({ time: 2.1, dropMoment: 'drop-1' }))
      expect(rig.inspect()).toMatchObject({ authoredPattern: 'alternate', activePattern: 'alternate', onStage: 'alternate', patternChange: true })
      playTo(rig, 2.1, 3, { dropMoment: 'drop-1' })
      expect(rig.inspect().onStage).toBe('alternate')
      playTo(rig, 3, 3.9)
      deliverDrop(rig, 'drop-2', 4)
      expect(rig.inspect()).toMatchObject({ onStage: 'core-burst', activePattern: 'alternate' })
    })

    it('gives the stage back and forgets everything on a track change', () => {
      const rig = started()
      deliverDrop(rig, 'drop-1', 2)
      expect(rig.inspect().onStage).toBe('core-burst')
      rig.update(frame({ time: 2.1, trackId: 'other-track' }))
      expect(rig.inspect().performance.pattern).toBeNull()
    })

    it('lights the hall differently when a drop arrives: kick cues named by the manifest reach the lighting engine', () => {
      const kickRule = CINEMA2_BWC_PRESET_MANIFEST.choreography!.rules.find(candidate => candidate.source.signal === 'kick')!
      const run = (cue: boolean) => {
        const rig = setup({ pattern: 'alternate', autoPerformance: false })
        rig.update(frame({ time: 1 }))
        if (cue) rig.instance.handleAction!('musicalCue', { eventId: `kick:1:${kickRule.actions[0]!.id}`, payload: { kind: 'kick' } } as never)
        rig.update(frame({ time: 1.016, event: { kind: 'kick', id: 'kick:1' } }))
        return rig.drawn().reactorCore
      }
      expect(run(true)).toBeGreaterThan(run(false))
    })
  })

  it('disposes cleanly and can be updated afterwards without throwing', () => {
    const { instance, update } = setup()
    update(frame({ time: 1 }))
    instance.lifecycle!.dispose!()
    expect(() => update(frame({ time: 1.1 }))).not.toThrow()
  })
})

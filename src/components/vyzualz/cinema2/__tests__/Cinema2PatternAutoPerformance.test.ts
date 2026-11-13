import { describe, expect, it } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { cinema2BackstreetNativeModuleDefinition, resolveCinema2BackstreetStaticFrame } from '../modules/Cinema2BackstreetNativeModule'
import { cinema2MainframeNativeModuleDefinition, resolveCinema2MainframeStaticFrame } from '../modules/Cinema2MainframeNativeModule'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  Cinema2PatternAutoPerformance,
  CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS,
  CINEMA2_PATTERN_AUTO_BUILD_OFF,
  CINEMA2_PATTERN_AUTO_BUILD_ON,
  CINEMA2_PATTERN_AUTO_DROP_BEATS,
  type Cinema2PatternAutoPerformanceInput,
} from '../modules/mainframe/Cinema2PatternAutoPerformance'
import { CINEMA2_BACKSTREET_PRESET_MANIFEST } from '../presets/Cinema2BackstreetPreset'
import { CINEMA2_MAINFRAME_PRESET_MANIFEST } from '../presets/Cinema2MainframePreset'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
type P = 'build-program' | 'drop-program'
const idle: Cinema2PatternAutoPerformanceInput = { enabled: true, absoluteBeat: 0, buildCharge: 0, dropEventId: null, patternEdited: false, reset: false }
const make = () => new Cinema2PatternAutoPerformance<P>({ buildPattern: 'build-program', dropPattern: 'drop-program' })
const step = (c: Cinema2PatternAutoPerformance<P>, beat: number, change: Partial<Cinema2PatternAutoPerformanceInput> = {}) => c.update({ ...idle, absoluteBeat: beat, ...change })

describe('Pattern Auto Performance controller', () => {
  it('stays out of the way until a build or a drop, and never acts while disabled', () => {
    expect(step(make(), 4)).toMatchObject({ pattern: null, reason: null })
    const c = make()
    expect(step(c, 1, { enabled: false, buildCharge: 0.9, dropEventId: 'drop-1' }).pattern).toBeNull()
  })

  it('takes the build program when a confident build charges, and hands back when it ends', () => {
    const c = make()
    expect(step(c, 1, { buildCharge: CINEMA2_PATTERN_AUTO_BUILD_ON - 0.01 }).pattern).toBeNull()
    expect(step(c, 2, { buildCharge: CINEMA2_PATTERN_AUTO_BUILD_ON })).toMatchObject({ pattern: 'build-program', reason: 'build', startBeat: 2 })
    expect(step(c, 6, { buildCharge: 0.6 })).toMatchObject({ pattern: 'build-program', startBeat: 2 })
    expect(step(c, 9, { buildCharge: CINEMA2_PATTERN_AUTO_BUILD_OFF - 0.01 }).pattern).toBeNull()
  })

  it('is bounded, and a build that never ends does not take the stage a second time', () => {
    const c = make()
    step(c, 0, { buildCharge: 0.5 })
    expect(step(c, CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS - 1, { buildCharge: 0.5 }).pattern).toBe('build-program')
    expect(step(c, CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS, { buildCharge: 0.5 }).pattern).toBeNull()
    expect(step(c, CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS + 8, { buildCharge: 0.5 }).pattern).toBeNull()
  })

  it('puts the drop program on stage from the drop for a bounded time, ending a build\'s turn', () => {
    const c = make()
    step(c, 0, { buildCharge: 0.5 })
    expect(step(c, 6, { buildCharge: 0.5, dropEventId: 'drop-1' })).toMatchObject({ pattern: 'drop-program', reason: 'drop', startBeat: 6 })
    expect(step(c, 6 + CINEMA2_PATTERN_AUTO_DROP_BEATS - 0.5, { buildCharge: 0.5 }).pattern).toBe('drop-program')
    expect(step(c, 6 + CINEMA2_PATTERN_AUTO_DROP_BEATS, { buildCharge: 0.5 }).pattern).toBeNull()
  })

  it('uses each drop once, and never replays a drop that arrived while it was disabled', () => {
    const c = make()
    step(c, 1, { enabled: false, dropEventId: 'drop-1' })
    expect(step(c, 2, { dropEventId: 'drop-1' }).pattern).toBeNull()
    expect(step(c, 3, { dropEventId: 'drop-2' }).pattern).toBe('drop-program')
  })

  it('ends an override at once when the user edits the Pattern, and the spent build cannot take over again', () => {
    const c = make()
    step(c, 0, { buildCharge: 0.5 })
    expect(step(c, 1, { buildCharge: 0.5, patternEdited: true }).pattern).toBeNull()
    expect(step(c, 2, { buildCharge: 0.5 }).pattern).toBeNull()
    expect(step(c, 3, { buildCharge: 0.5, dropEventId: 'drop-1' }).pattern).toBe('drop-program')
  })

  it('does not take the stage mid-build when switched on, and releases at once when switched off', () => {
    const c = make()
    step(c, 0, { enabled: false, buildCharge: 0.5 })
    expect(step(c, 1, { buildCharge: 0.5 }).pattern).toBeNull()
    const d = make()
    step(d, 0, { dropEventId: 'drop-1' })
    expect(step(d, 1, { enabled: false }).pattern).toBeNull()
  })

  it('clears everything on a discontinuity, including a stale override after the beat clock runs backward', () => {
    const c = make()
    step(c, 50, { dropEventId: 'drop-1' })
    expect(step(c, 2).pattern).toBeNull()
    const d = make()
    step(d, 50, { dropEventId: 'drop-1' })
    expect(step(d, 51, { reset: true }).pattern).toBeNull()
    expect(step(d, 52, { dropEventId: 'drop-1' }).pattern).toBe('drop-program')
  })

  it('ignores non-finite input', () => {
    const c = make()
    expect(step(c, Number.NaN, { buildCharge: Number.NaN }).pattern).toBeNull()
  })
})

const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })
const event = (kind: string, id: string, time: number) => ({ id, kind, timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: id })

/** A playing frame in which every kind of musical event is present, each with its own identity, at `time`. */
function baseFrame(time: number, tag: string): Readonly<Cinema2ModuleFrameReadContext> {
  const boundary = (id: string) => ({ lengthBeats: 4, progress: 0, boundary: event('boundary', id, time) })
  return {
    frameId: Math.round(time * 1000), timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: true, playing: true, paused: false, analysisActive: true, animationActive: true, trackId: 'track', timeSec: time, bpmSync: true, bpm: 120 },
    director: {
      continuous: {}, authority: { impact: { available: false }, variation: { available: false } },
      context: { section: { available: false }, transition: { available: true, occurred: true, eventId: `section:${tag}`, authority: 1, confidence: 1 } },
    },
    audio: {
      version: 1, visualFrameId: 1, smoothingOwnership: 'upstream-music-intelligence',
      upstream: { frameId: 1, publicationSequence: 1, publicationKind: 'live', publishedAtMs: 0, publisherId: 'test', sourceId: 'test', trackId: 'track', timeSec: time, sampleRate: 48000, analysisRevision: null, timelineRevision: null },
      capabilities: {}, discontinuity: { occurred: false, id: null, generation: 1, reason: null },
      bands: { sub: available(0.4), bass: available(0.6), lowMid: available(0.35), mid: available(0.5), high: available(0.45), air: available(0.25) },
      features: { overallEnergy: available(0.55), rms: available(0.5), spectralCentroid: unavailable(), spectralFlux: available(0.4), transientEnergy: available(0.3), vocalPresence: available(0.45), tension: unavailable(), complexity: unavailable(), buildProgress: available(0.35), trackEnergy: available(0.5) },
      rhythm: {
        bpm: available(120), beatPhase: available(0.25), beatIndex: available(2), beatInBar: available(2), barIndex: available(0),
        beat: event('beat', `beat:${tag}`, time), kick: event('kick', `kick:${tag}`, time), snare: event('snare', `snare:${tag}`, time),
        downbeat: event('downbeat', `downbeat:${tag}`, time), transient: event('transient', `transient:${tag}`, time),
        fixedClocks: { 4: boundary(`bar:${tag}`), 8: boundary(`eight:${tag}`), 16: boundary(`phrase:${tag}`), 32: boundary(`thirtytwo:${tag}`) },
      },
      structure: { analyzedPhrases: unavailable(), section: unavailable(), semanticMoments: { ...unavailable(), available: true, value: [{ id: `drop:${tag}`, timeSec: time, type: 'drop', confidence: 1, source: 'test' }] }, buildConfidence: available(0.3), dropConfidence: available(0) },
      stems: unavailable(), lyrics: unavailable(), harmonic: unavailable(),
    } as never,
  } as unknown as Readonly<Cinema2ModuleFrameReadContext>
}



interface FrameOptions { build?: number; paused?: boolean; trackId?: string; generation?: number }
/** `baseFrame` plus a confident build at `build` (0..1), optional pause, and a different track or context generation. */
function frame(time: number, tag: string, options: FrameOptions = {}): Readonly<Cinema2ModuleFrameReadContext> {
  const f = baseFrame(time, tag) as unknown as { audio: any; transport: any; contextGeneration: number }
  const build = options.build ?? 0
  f.audio.features.buildProgress = available(build)
  f.audio.structure.buildConfidence = available(build > 0 ? 0.95 : 0)
  if (options.paused) f.transport = { ...f.transport, playing: false, paused: true }
  if (options.trackId) { f.transport.trackId = options.trackId; f.audio.upstream.trackId = options.trackId }
  if (options.generation) f.contextGeneration = options.generation
  return f as unknown as Readonly<Cinema2ModuleFrameReadContext>
}

type Manifest = typeof CINEMA2_MAINFRAME_PRESET_MANIFEST
const FAMILIES = [
  ['Mainframe', CINEMA2_MAINFRAME_PRESET_MANIFEST, cinema2MainframeNativeModuleDefinition, resolveCinema2MainframeStaticFrame],
  ['Backstreet', CINEMA2_BACKSTREET_PRESET_MANIFEST, cinema2BackstreetNativeModuleDefinition, resolveCinema2BackstreetStaticFrame],
] as const

function stage(manifest: Manifest, definition: typeof cinema2MainframeNativeModuleDefinition, overrides: Record<string, Cinema2JsonValue>) {
  const moduleManifest = manifest.modules![0]!
  const values = new Map<string, Cinema2JsonValue>(Object.entries({ ...moduleManifest.parameters, pattern: 'radar-sweep', ...overrides }))
  const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
  const instance = definition.create({
    module: moduleManifest, parameters, targets: {}, media: {}, resources: { acquire: () => { throw new Error('unused') }, reportGpuBytes: () => {} },
    randomness: { sample: (_: string, index: number) => ((index + 1) * 0.37) % 1 },
  } as unknown as Cinema2ModuleCreateContext)
  const dropRule = manifest.choreography!.rules.find(rule => (rule.actions[0]!.value as { kind?: string } | undefined)?.kind === 'drop')!
  return {
    set: (name: string, value: Cinema2JsonValue) => values.set(name, value),
    update: (f: Readonly<Cinema2ModuleFrameReadContext>) => instance.lifecycle!.update!({ parameters, frame: f } as never),
    dropCue: (tag: string) => instance.handleAction!('musicalCue', { eventId: `drop:${tag}:${dropRule.actions[0]!.id}`, payload: { kind: 'drop' } } as never),
    inspect: () => (instance as unknown as { inspect: () => any }).inspect(),
  }
}

describe.each(FAMILIES)('%s Auto Performance', (_name, manifest, definition, resolveStatic) => {
  const m = manifest as Manifest
  const d = definition as typeof cinema2MainframeNativeModuleDefinition

  it('is off by default and absent from older saved settings, so existing behaviour is unchanged', () => {
    const without = new Map<string, Cinema2JsonValue>()
    const reader = { get: (name: string) => without.get(name), getAuthored: (name: string) => without.get(name), resolve: () => null }
    expect((resolveStatic as typeof resolveCinema2MainframeStaticFrame)(reader as never).autoPerformance).toBe(false)
    expect(m.modules![0]!.parameters?.autoPerformance).toBe(false)
  })

  it('does nothing while off, even through a build and a drop: the authored Pattern stays on stage', () => {
    const s = stage(m, d, { autoPerformance: false })
    s.update(frame(1, 'a', { build: 0.9 }))
    s.dropCue('b'); s.update(frame(1.5, 'b', { build: 0.9 }))
    expect(s.inspect()).toMatchObject({ authoredPattern: 'radar-sweep', onStage: 'radar-sweep' })
    expect(s.inspect().performance.pattern).toBeNull()
  })

  it('puts System Surge on stage during a build and Outward Bus from a drop, without touching the authored Pattern', () => {
    const s = stage(m, d, { autoPerformance: true })
    s.update(frame(1, 'a'))
    s.update(frame(1.5, 'a', { build: 0.9 }))
    s.update(frame(2, 'a', { build: 0.9 }))
    expect(s.inspect()).toMatchObject({ authoredPattern: 'radar-sweep', onStage: 'system-surge', performance: { reason: 'build' } })
    expect(s.inspect().lighting.pattern).toBe('system-surge')
    s.dropCue('b'); s.update(frame(2.5, 'b', { build: 0.9 }))
    expect(s.inspect()).toMatchObject({ authoredPattern: 'radar-sweep', onStage: 'outward-bus', performance: { reason: 'drop' } })
    expect(s.inspect().lighting.pattern).toBe('outward-bus')
  })

  it('returns to the authored Pattern as soon as Auto Performance is switched off', () => {
    const s = stage(m, d, { autoPerformance: true })
    s.update(frame(1, 'a')); s.update(frame(1.5, 'a', { build: 0.9 })); s.update(frame(2, 'a', { build: 0.9 }))
    expect(s.inspect().onStage).toBe('system-surge')
    s.set('autoPerformance', false)
    s.update(frame(2.5, 'a', { build: 0.9 }))
    expect(s.inspect()).toMatchObject({ onStage: 'radar-sweep', authoredPattern: 'radar-sweep' })
    expect(s.inspect().lighting.pattern).toBe('radar-sweep')
  })

  it('lets a manual Pattern edit end the override at once', () => {
    const s = stage(m, d, { autoPerformance: true })
    s.update(frame(1, 'a')); s.update(frame(1.5, 'a', { build: 0.9 })); s.update(frame(2, 'a', { build: 0.9 }))
    expect(s.inspect().onStage).toBe('system-surge')
    s.set('pattern', 'quadrant-relay')
    s.update(frame(2.5, 'a', { build: 0.9 }))
    expect(s.inspect()).toMatchObject({ authoredPattern: 'quadrant-relay', onStage: 'quadrant-relay' })
  })

  it('keeps pattern change and the trigger independent of Auto Performance', () => {
    for (const auto of [false, true]) {
      const s = stage(m, d, { autoPerformance: auto, patternChange: true, trigger: 'beat' })
      s.update(frame(1, 'a')); s.update(frame(1.5, 'b'))
      const inspected = s.inspect()
      expect(inspected).toMatchObject({ patternChange: true, trigger: 'beat', autoPerformance: auto })
      expect(inspected.activePattern).not.toBe(inspected.authoredPattern)
    }
  })

  it('releases the override on pause and on a track change, and does not replay a consumed drop', () => {
    const s = stage(m, d, { autoPerformance: true })
    s.update(frame(1, 'a'))
    s.dropCue('b'); s.update(frame(1.5, 'b'))
    expect(s.inspect().onStage).toBe('outward-bus')
    s.update(frame(1.6, 'b', { paused: true }))
    expect(s.inspect().onStage).toBe('radar-sweep')
    s.update(frame(1.7, 'b'))
    expect(s.inspect().performance.pattern).toBeNull()
    s.dropCue('c'); s.update(frame(4, 'c'))
    expect(s.inspect().onStage).toBe('outward-bus')
    s.update(frame(4.1, 'c', { trackId: 'another-track', generation: 2 }))
    expect(s.inspect()).toMatchObject({ onStage: 'radar-sweep' })
    expect(s.inspect().performance.pattern).toBeNull()
  })
})

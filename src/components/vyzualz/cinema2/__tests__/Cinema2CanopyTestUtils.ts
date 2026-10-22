import { vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { createCinema2CanopyNativeModuleDefinition, type Cinema2CanopyModuleInspection } from '../modules/Cinema2CanopyNativeModule'
import { CINEMA2_CANOPY_PRESET_MANIFEST } from '../presets/Cinema2CanopyPreset'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })

export interface CanopyFrameOptions {
  time: number
  paused?: boolean
  stopped?: boolean
  bpm?: number
  trackId?: string
  generation?: number
  /** Events present on this frame; each id is published to the audio frame and, through `cues`, as a choreography delivery. */
  events?: readonly { kind: 'beat' | 'downbeat' | 'kick' | 'snare' | 'transient'; id: string }[]
  fourBeat?: string
  phrase?: string
  dropMoment?: string
  bands?: Partial<Record<'sub' | 'bass' | 'mid' | 'high', number>>
  energy?: number
  vocal?: number
  build?: number
  beatGrid?: boolean
  beatIndex?: number
  barIndex?: number
  director?: { impact: number; intensity: number } | null
}

export function canopyFrame(options: CanopyFrameOptions): Readonly<Cinema2ModuleFrameReadContext> {
  const { time } = options
  const bpm = options.bpm ?? 120
  const trackId = options.trackId ?? 'track'
  const beatsPerSecond = bpm / 60
  const event = (kind: string) => {
    const found = options.events?.find(candidate => candidate.kind === kind)
    return found ? { id: found.id, kind, timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: found.id } : null
  }
  const fixed = (lengthBeats: 4 | 8 | 16 | 32) => ({ lengthBeats, progress: 0, boundary: lengthBeats === 4 && options.fourBeat ? { id: options.fourBeat, kind: 'bar', timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: options.fourBeat } : lengthBeats === 16 && options.phrase ? { id: options.phrase, kind: 'phrase', timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: options.phrase } : null })
  const grid = options.beatGrid ?? true
  return {
    frameId: Math.round(time * 1000), timestampMs: time * 1000, deltaTimeSec: 1 / 60, elapsedTimeSec: time,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: options.generation ?? 1,
    transport: { sourcePresent: !options.stopped, playing: !options.paused && !options.stopped, paused: options.paused ?? false, analysisActive: !options.stopped, animationActive: !options.paused, trackId, timeSec: time, bpmSync: true, bpm },
    director: options.director === null || options.director === undefined ? null : {
      continuous: { intensity: available(options.director.intensity), momentum: unavailable() },
      context: { build: available(options.build ?? 0), section: unavailable(), transition: { available: false, occurred: false } },
      authority: { impact: { available: true, authority: options.director.impact }, variation: { available: false, authority: 0 } },
    } as never,
    audio: options.stopped ? null : {
      version: 1, visualFrameId: 1, smoothingOwnership: 'upstream-music-intelligence',
      upstream: { frameId: 1, publicationSequence: 1, publicationKind: 'live', publishedAtMs: 0, publisherId: 'test', sourceId: 'test', trackId, timeSec: time, sampleRate: 48000, analysisRevision: null, timelineRevision: null },
      capabilities: {},
      discontinuity: { occurred: false, id: null, generation: options.generation ?? 1, reason: null },
      bands: { sub: available(options.bands?.sub ?? 0), bass: available(options.bands?.bass ?? 0), lowMid: available(0), mid: available(options.bands?.mid ?? 0), high: available(options.bands?.high ?? 0), air: available(0) },
      features: { overallEnergy: available(options.energy ?? 0.5), rms: available(0.5), spectralCentroid: unavailable(), spectralFlux: available(0.2), transientEnergy: available(0.2), vocalPresence: available(options.vocal ?? 0), tension: unavailable(), complexity: unavailable(), buildProgress: available(options.build ?? 0), trackEnergy: available(0.5) },
      rhythm: {
        bpm: available(bpm),
        beatPhase: grid ? available((time * beatsPerSecond) % 1) : unavailable(),
        beatIndex: grid ? available(options.beatIndex ?? Math.floor(time * beatsPerSecond)) : unavailable(),
        beatInBar: grid ? available(Math.floor(time * beatsPerSecond) % 4) : unavailable(),
        barIndex: grid ? available(options.barIndex ?? Math.floor(time * beatsPerSecond / 4)) : unavailable(),
        beat: event('beat'), kick: event('kick'), snare: event('snare'), downbeat: event('downbeat'), transient: event('transient'),
        fixedClocks: { 4: fixed(4), 8: fixed(8), 16: fixed(16), 32: fixed(32) },
      },
      structure: {
        analyzedPhrases: unavailable(), section: unavailable(),
        semanticMoments: { ...unavailable(), available: true, value: options.dropMoment ? [{ id: options.dropMoment, timeSec: time, type: 'drop', confidence: 1, source: 'test' }] : [] },
        buildConfidence: available(options.build ? 0.95 : 0.3), dropConfidence: available(0),
      },
      stems: unavailable(), lyrics: unavailable(), harmonic: unavailable(),
    } as never,
  } as unknown as Readonly<Cinema2ModuleFrameReadContext>
}

/** The delivery the engine's choreography runtime would make for an event: `<event id>:mainframe-<kind>-cue`. */
export function canopyCue(kind: string, id: string) {
  return { kind, eventId: `${id}:mainframe-${kind === 'fourBeat' ? 'four-beat' : kind}-cue` }
}

export function setupCanopy(overrides: Record<string, Cinema2JsonValue> = {}) {
  const moduleManifest = CINEMA2_CANOPY_PRESET_MANIFEST.modules![0]!
  const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
  for (const [name, value] of Object.entries(overrides)) values.set(name, value)
  const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
  const draw = vi.fn()
  const dispose = vi.fn()
  const renderer = { draw, dispose, estimateGpuBytes: () => 22_000 }
  const definition = createCinema2CanopyNativeModuleDefinition({ createRenderer: () => renderer })
  const resources = { acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof renderer) => create({} as WebGL2RenderingContext), reportGpuBytes: vi.fn(), getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 22_000 }) }
  const instance = definition.create({
    module: moduleManifest, parameters, targets: {}, media: {}, resources,
    randomness: { sample: (_purpose: string, index = 0) => ((index + 1) * 0.37) % 1 },
  } as unknown as Cinema2ModuleCreateContext)
  const update = (f: Readonly<Cinema2ModuleFrameReadContext>, cues: readonly { kind: string; eventId: string }[] = []) => {
    for (const cue of cues) instance.handleAction!('musicalCue', { eventId: cue.eventId, payload: { kind: cue.kind } } as never)
    instance.lifecycle.update({ parameters, frame: f, targets: {} } as never)
  }
  const inspect = () => (instance as unknown as { inspect: () => Cinema2CanopyModuleInspection }).inspect()
  const execute = () => instance.render!.providers[0]!.execute({
    target: null, width: 640, height: 360, depthAvailable: true, frame: canopyFrame({ time: 0 }),
    camera: { viewProjectionMatrix: new Array(16).fill(0).map((_, i) => (i % 5 === 0 ? 1 : 0)), position: [0, 0, 10] },
  } as never)
  return { instance, values, update, inspect, execute, draw, dispose, resources }
}

import { describe, expect, it } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { cinema2BackstreetNativeModuleDefinition } from '../modules/Cinema2BackstreetNativeModule'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { resolveCinema2MainframeMusicalEvents } from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_BACKSTREET_PRESET_MANIFEST } from '../presets/Cinema2BackstreetPreset'

const available = (value: number) => ({ available: true, value, confidence: 1, source: 'test', provenance: null })
const unavailable = () => ({ available: false, value: null, confidence: null, source: null, provenance: null })
const event = (kind: string, id: string, time: number) => ({ id, kind, timeSec: time, strength: 1, confidence: 1, source: 'test', upstreamIdentity: id })

/** A playing frame in which every kind of musical event is present, each with its own identity, at `time`. */
function frame(time: number, tag: string): Readonly<Cinema2ModuleFrameReadContext> {
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

/** The upstream event identity each cue kind is matched against in `frame()`. */
const upstreamId = (kind: string, tag: string): string => ({
  kick: `kick:${tag}`, snare: `snare:${tag}`, transient: `transient:${tag}`, beat: `beat:${tag}`, downbeat: `downbeat:${tag}`,
  fourBeat: `bar:${tag}`, phrase: `phrase:${tag}`, section: `section:${tag}`, drop: `drop:${tag}`,
}[kind] as string)

const rules = CINEMA2_BACKSTREET_PRESET_MANIFEST.choreography!.rules.filter(rule => rule.actions[0]?.target.kind === 'parameter')

/** What the shared choreography runtime delivers: `<event id>:<action id>`, the action id coming from the manifest's own rule. */
const delivered = (kind: string, tag: string, actionId: string): string => `${upstreamId(kind, tag)}:${actionId}`

describe('Backstreet musical cue delivery', () => {
  it('has a cue rule for each of the nine shared musical events', () => {
    expect(rules.map(rule => (rule.actions[0]!.value as { kind: string }).kind)).toEqual(['kick', 'snare', 'transient', 'beat', 'downbeat', 'fourBeat', 'phrase', 'section', 'drop'])
  })

  it.each(rules.map(rule => [(rule.actions[0]!.value as { kind: string }).kind, rule.actions[0]!.id] as const))('the shared music adapter accepts a %s cue named by the manifest (%s)', (kind, actionId) => {
    const events = resolveCinema2MainframeMusicalEvents(frame(1, 'a'), [{ kind: kind as never, dispatchedEventId: delivered(kind, 'a', actionId) }])
    expect(events.map(item => item.kind)).toContain(kind)
  })

  it('reaches Backstreet\'s lighting: a kick cue delivered the way the runtime delivers it fires the kick impulse', () => {
    const moduleManifest = CINEMA2_BACKSTREET_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    const parameters = { get: (name: string) => values.get(name), getAuthored: (name: string) => values.get(name), resolve: () => null }
    const run = (cue: boolean) => {
      const instance = cinema2BackstreetNativeModuleDefinition.create({
        module: moduleManifest, parameters, targets: {}, media: {}, resources: { acquire: () => { throw new Error('unused') }, reportGpuBytes: () => {} },
        randomness: { sample: (_: string, index: number) => ((index + 1) * 0.37) % 1 },
      } as unknown as Cinema2ModuleCreateContext)
      instance.lifecycle!.update!({ parameters, frame: frame(1, 'a') } as never)
      if (cue) {
        const kickRule = rules.find(rule => (rule.actions[0]!.value as { kind: string }).kind === 'kick')!
        instance.handleAction!('musicalCue', { eventId: delivered('kick', 'b', kickRule.actions[0]!.id), payload: { kind: 'kick' } } as never)
      }
      instance.lifecycle!.update!({ parameters, frame: frame(1.016, 'b') } as never)
      return (instance as unknown as { inspect: () => { lighting: { impulses: { kick: number } } } }).inspect().lighting.impulses.kick
    }
    expect(run(false)).toBe(0)
    expect(run(true)).toBeGreaterThan(0)
  })
})

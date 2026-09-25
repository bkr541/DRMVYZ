import { describe, expect, it } from 'vitest'

import { humMusicFrame, type HumFrameInput } from './support/Cinema2HumNFrameFactory'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import {
  cinema2Ref,
  cinema2StableId,
  type Cinema2LightGroupId,
  type Cinema2LightId,
  type Cinema2NativePresetManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID,
  CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
  CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID,
} from '../presets/Cinema2AtmosphereReferencePreset'
import {
  cinema2LightGroupStaggerRanks,
  expandCinema2LightGroupChoreography,
} from '../presets/Cinema2LightGroupExpansion'
import {
  cinema2LightRigAlternate,
  cinema2LightRigHit,
} from '../presets/Cinema2LightRigAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting',
  'music.beat', 'music.downbeat', 'music.phrase', 'visual-director.significance',
] as const

const group = (id: string) => cinema2StableId<Cinema2LightGroupId>(id)
const lightId = (id: string) => cinema2StableId<Cinema2LightId>(id)

function withGroupAction(overrides: Record<string, unknown> = {}, groups = CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.lighting!.groups): Cinema2NativePresetManifest {
  return {
    ...CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
    lighting: { ...CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.lighting!, groups },
    choreography: {
      rules: [{
        id: cinema2StableId('test-rule'),
        priority: 1,
        source: { signal: 'downbeat', capability: 'music.downbeat' },
        actions: [{
          id: cinema2StableId('test-action'),
          target: { kind: 'light-group', ref: cinema2Ref(group('atmosphere-reference-sides')), property: 'intensity', ...overrides },
          operation: 'envelope',
          composition: 'add',
          value: 1,
        }],
      }],
    },
  } as unknown as Cinema2NativePresetManifest
}

describe('Cinema 2.0 light group expansion', () => {
  it('ranks members for every stagger order', () => {
    expect(cinema2LightGroupStaggerRanks(4, 'forward')).toEqual([0, 1, 2, 3])
    expect(cinema2LightGroupStaggerRanks(4, 'reverse')).toEqual([3, 2, 1, 0])
    expect(cinema2LightGroupStaggerRanks(5, 'center-out')).toEqual([3, 1, 0, 2, 4])
    expect(cinema2LightGroupStaggerRanks(5, 'edges-in')).toEqual([1, 3, 4, 2, 0])
  })

  it('expands a group action into one light action per member with staggered delays', () => {
    const result = expandCinema2LightGroupChoreography(withGroupAction({ stagger: { beats: 0.25, order: 'forward' } }))
    expect(result.diagnostics).toEqual([])
    const actions = result.manifest.choreography!.rules[0].actions
    expect(actions.map(action => action.id)).toEqual([
      `test-action-${CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID}`,
      `test-action-${CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID}`,
    ])
    expect(actions.map(action => action.target)).toEqual([
      { kind: 'light', ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID), property: 'intensity' },
      { kind: 'light', ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID), property: 'intensity' },
    ])
    expect(actions.map(action => action.delayBeats)).toEqual([undefined, 0.25])
  })

  it('does not mutate the authored manifest and returns manifests without groups untouched', () => {
    const authored = withGroupAction()
    const before = JSON.stringify(authored)
    expandCinema2LightGroupChoreography(authored)
    expect(JSON.stringify(authored)).toBe(before)
    const plain = { ...CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, choreography: undefined } as Cinema2NativePresetManifest
    expect(expandCinema2LightGroupChoreography(plain).manifest).toBe(plain)
  })

  it('reports unknown, empty, duplicate and invalid group authoring', () => {
    const codes = (manifest: Cinema2NativePresetManifest) => expandCinema2LightGroupChoreography(manifest).diagnostics.map(diagnostic => diagnostic.code)
    expect(codes(withGroupAction({ ref: cinema2Ref(group('missing')) }))).toContain('CINEMA2_PRESET_LIGHT_GROUP_UNKNOWN')
    expect(codes(withGroupAction({ stagger: { beats: 0 } }))).toContain('CINEMA2_PRESET_LIGHT_GROUP_STAGGER_INVALID')
    const sides = group('atmosphere-reference-sides')
    expect(codes(withGroupAction({}, [{ id: sides, lights: [] }]))).toContain('CINEMA2_PRESET_LIGHT_GROUP_EMPTY')
    expect(codes(withGroupAction({}, [{ id: sides, lights: [cinema2Ref(lightId('no-such-light'))] }]))).toContain('CINEMA2_PRESET_LIGHT_GROUP_MEMBER_UNKNOWN')
    expect(codes(withGroupAction({}, [
      { id: sides, lights: [cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID)] },
      { id: sides, lights: [cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID)] },
    ]))).toContain('CINEMA2_PRESET_LIGHT_GROUP_DUPLICATE')
  })

  it('compiles group choreography down to ordinary light targets and rejects a bad group at compile time', () => {
    const ok = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    const kinds = new Set(ok.plan.manifest.choreography!.rules.flatMap(rule => rule.actions.map(action => action.target.kind)))
    expect(kinds.has('light-group' as never)).toBe(false)
    expect(kinds.has('light')).toBe(true)

    const bad = compileCinema2NativePreset(withGroupAction({ ref: cinema2Ref(group('missing')) }), { availableCapabilities: CAPABILITIES })
    expect(bad.ok).toBe(false)
    expect(bad.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA2_PRESET_LIGHT_GROUP_UNKNOWN')
  })

  it('validates beat-interval conditions at compile time', () => {
    const manifest = (condition: unknown) => ({
      ...CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST,
      choreography: {
        rules: [{
          id: cinema2StableId('interval-rule'),
          priority: 1,
          source: { signal: 'beat', capability: 'music.beat' },
          conditions: [condition],
          actions: [{
            id: cinema2StableId('interval-action'),
            target: { kind: 'light', ref: cinema2Ref(CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID), property: 'intensity' },
            operation: 'pulse',
          }],
        }],
      },
    }) as unknown as Cinema2NativePresetManifest
    const compileOk = (condition: unknown) => compileCinema2NativePreset(manifest(condition), { availableCapabilities: CAPABILITIES }).ok
    expect(compileOk({ kind: 'beat-interval', every: 2, phase: 1 })).toBe(true)
    expect(compileOk({ kind: 'beat-interval', every: 0 })).toBe(false)
    expect(compileOk({ kind: 'beat-interval', every: 2, phase: 2 })).toBe(false)
    expect(compileOk({ kind: 'beat-interval', every: 2.5 })).toBe(false)
    expect(compileOk({ kind: 'beat-interval', every: 2, unit: 'week' })).toBe(false)
  })
})

describe('Cinema 2.0 light rig authoring helpers', () => {
  it('builds an N-group alternation cycle on the beat grid', () => {
    const rules = cinema2LightRigAlternate({ id: 'rig', groups: [group('a'), group('b'), group('c')], everyBeats: 2, peak: 2 })
    expect(rules).toHaveLength(3)
    expect(rules.map(rule => rule.conditions![0])).toEqual([
      { kind: 'beat-interval', every: 6, phase: 0, unit: 'beat' },
      { kind: 'beat-interval', every: 6, phase: 2, unit: 'beat' },
      { kind: 'beat-interval', every: 6, phase: 4, unit: 'beat' },
    ])
    expect(rules[0].actions[0]).toMatchObject({ operation: 'set-for-duration', durationBeats: 2, composition: 'replace' })
  })

  it('builds an event hit with envelope defaults and optional counter gating', () => {
    const [hit] = cinema2LightRigHit({ id: 'rig', group: group('a'), peak: 1, every: 2, phase: 1, unit: 'bar' })
    expect(hit.source.signal).toBe('downbeat')
    expect(hit.conditions).toEqual([{ kind: 'once-per-event' }, { kind: 'beat-interval', every: 2, phase: 1, unit: 'bar' }])
    expect(hit.actions[0]).toMatchObject({ operation: 'envelope', composition: 'add', envelope: { attack: 0, hold: 0.1, release: 0.9, unit: 'beats' } })
  })
})

// ── Rig behaviour on the Atmosphere Reference preset ─────────────────────────────────────────────

function rigHarness() {
  const compiled = compileCinema2NativePreset(CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const runtime = new Cinema2ChoreographyRuntime(plan, state, resolver)
  const director = new Cinema2VisualDirector()
  const BPM = 120
  const beatSec = 60 / BPM
  let sequence = 1
  let source = humMusicFrame({ frameId: 1, timeSec: 0 })
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => source,
    getPublicationMeta: () => ({ sequence, publishedAtMs: source.timeSec * 1000, publisherId: 'light-rig-test', kind: 'frame' as const }),
  })
  let visualFrameId = 0
  let priorMs = 0

  /** Advances to a position in beats. A whole-beat position emits that beat (and the bar/phrase boundary it lands on). */
  function step(beats: number, extra: Partial<Omit<HumFrameInput, 'frameId' | 'timeSec'>> = {}) {
    const beatIndex = Math.floor(beats)
    const onBeat = Math.abs(beats - beatIndex) < 1e-9
    sequence += 1
    const musicFrame = humMusicFrame({ ...extra, frameId: source.frameId + 1, timeSec: beats * beatSec, beat: onBeat, downbeat: onBeat && beatIndex % 4 === 0 })
    source = {
      ...musicFrame,
      rhythm: {
        ...musicFrame.rhythm,
        bpm: BPM,
        beatIndex,
        beatPhase: beats - beatIndex,
        beatInBar: beatIndex % 4,
        barIndex: Math.floor(beatIndex / 4),
        beatHit: onBeat,
        downbeatHit: onBeat && beatIndex % 4 === 0,
        phrase4Hit: onBeat && beatIndex % 4 === 0,
        phrase8Hit: onBeat && beatIndex % 8 === 0,
        phrase16Hit: onBeat && beatIndex % 16 === 0,
        phrase32Hit: onBeat && beatIndex % 32 === 0,
        beatEventTimeSec: beats * beatSec,
      },
    }
    const audio = bridge.capture(++visualFrameId)
    const timestampMs = source.timeSec * 1000
    const frame = Object.freeze({
      frameId: visualFrameId,
      timestampMs,
      deltaTimeSec: Math.max(0, (timestampMs - priorMs) / 1000),
      elapsedTimeSec: timestampMs / 1000,
      viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
      contextGeneration: 1,
      audio,
      director: director.capture(audio),
    }) as Readonly<Cinema2ModuleFrameReadContext>
    priorMs = timestampMs
    runtime.update(frame)
  }

  function intensity(id: Cinema2LightId): number {
    const target = plan.targets.targets.find(candidate => candidate.kind === 'light' && candidate.ownerId === id && candidate.property === 'intensity')
    if (!target) throw new Error(`Missing intensity target for ${id}`)
    const value = resolver.resolve(target.id).value
    if (typeof value !== 'number') throw new Error('Intensity did not resolve to a number')
    return value
  }
  return { step, intensity, runtime }
}

const KEY = CINEMA2_ATMOSPHERE_REFERENCE_CENTER_LIGHT_ID
const LEFT = CINEMA2_ATMOSPHERE_REFERENCE_LEFT_LIGHT_ID
const RIGHT = CINEMA2_ATMOSPHERE_REFERENCE_RIGHT_LIGHT_ID
const REST = 0.6
const LIT = 1.5

describe('Cinema 2.0 Atmosphere Reference light rig behaviour', () => {
  it('alternates key and sides every two beats and repeats', () => {
    const h = rigHarness()
    // beat 1 is mid-note for key (lit beats 0-1), sides rest.
    h.step(0); h.step(1)
    expect(h.intensity(KEY)).toBeGreaterThan(LIT)
    expect(h.intensity(LEFT)).toBeLessThan(LIT)
    // beats 2-3: sides lit, key rests.
    h.step(2); h.step(3)
    expect(h.intensity(LEFT)).toBeGreaterThan(LIT)
    expect(h.intensity(RIGHT)).toBeGreaterThan(LIT)
    expect(h.intensity(KEY)).toBeLessThan(LIT)
    // beat 4 starts the cycle again with the key.
    h.step(4); h.step(5)
    expect(h.intensity(KEY)).toBeGreaterThan(LIT)
    expect(h.intensity(LEFT)).toBeLessThan(LIT)
  })

  it('rests at the authored base intensity when no beat is driving a light', () => {
    const h = rigHarness()
    h.step(0.25)
    expect(h.intensity(KEY)).toBeCloseTo(REST, 5)
    expect(h.intensity(LEFT)).toBeCloseTo(REST, 5)
  })

  it('sweeps the downbeat hit from the left side light to the right one, a quarter beat apart', () => {
    const h = rigHarness()
    h.step(8) // downbeat, sides are in their "resting" half of the cycle (beats 8-9 belong to the key)
    const leftAtDownbeat = h.intensity(LEFT)
    const rightAtDownbeat = h.intensity(RIGHT)
    expect(leftAtDownbeat).toBeGreaterThan(REST + 0.5)
    expect(rightAtDownbeat).toBeCloseTo(REST, 3)
    h.step(8.25)
    expect(h.intensity(RIGHT)).toBeGreaterThan(REST + 0.3)
  })

  it('drops the key light for whole alternate phrases', () => {
    const h = rigHarness()
    h.step(0); h.step(1)
    expect(h.intensity(KEY)).toBeGreaterThan(LIT)
    // Phrase 1 starts at beat 16; on beat 16-17 the key would normally be lit (16 % 4 === 0).
    for (let beat = 2; beat <= 16; beat += 1) h.step(beat)
    h.step(17)
    expect(h.intensity(KEY)).toBe(0)
    // Phrase 2 (beat 32) is a full-arrangement phrase again.
    for (let beat = 18; beat <= 33; beat += 1) h.step(beat)
    expect(h.intensity(KEY)).toBeGreaterThan(LIT)
  })

  it('lifts every rig light as the Visual Director build climbs', () => {
    const climbing = { buildProgress: 1, tension: 1, buildConfidence: 1, sectionType: 'build', energy: 0.9 } as const
    const quiet = rigHarness()
    const building = rigHarness()
    for (const beat of [0.25, 0.5, 0.75, 1.25, 1.5]) {
      quiet.step(beat)
      building.step(beat, climbing)
    }
    expect(building.intensity(LEFT)).toBeGreaterThan(quiet.intensity(LEFT) + 0.1)
  })
})
